import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ------------------------------------------------------------------
// Helper: fetch from ESPN with retry
// ------------------------------------------------------------------
async function fetchESPN(url: string, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 500 * i))
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      })
      if (res.ok) return await res.json()
    } catch { /* ignore */ }
  }
  throw new Error(`ESPN fetch failed: ${url}`)
}

// ------------------------------------------------------------------
// Fetch games for next N days (used by sync_upcoming)
// ------------------------------------------------------------------
async function fetchGamesForRange(sport: string, daysAhead = 2) {
  const sportPath: Record<string, string> = {
    nba: 'basketball/nba',
    nfl: 'football/nfl',
    mlb: 'baseball/mlb',
    nhl: 'hockey/nhl',
    soccer: 'soccer/eng.1',
  }
  const today = new Date()
  const dates = []
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }

  const allGames: any[] = []
  for (const date of dates) {
    const fmt = date.replace(/-/g, '')
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath[sport]}/scoreboard?dates=${fmt}`
    try {
      const data = await fetchESPN(url)
      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0]
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
        allGames.push({
          external_id: ev.id,
          sport,
          game_date: date,
          home_team_ext_id: home?.team?.id,
          away_team_ext_id: away?.team?.id,
        })
      }
    } catch { /* ignore */ }
  }
  return allGames
}

// ------------------------------------------------------------------
// Sync teams and players for upcoming games (lightweight)
// ------------------------------------------------------------------
async function syncUpcoming(sb: any, sport: string) {
  const games = await fetchGamesForRange(sport, 2) // next 3 days
  if (games.length === 0) return { teams: 0, players: 0 }

  // Collect team external IDs
  const teamExtIds = new Set<string>()
  for (const g of games) {
    if (g.home_team_ext_id) teamExtIds.add(g.home_team_ext_id)
    if (g.away_team_ext_id) teamExtIds.add(g.away_team_ext_id)
  }
  if (teamExtIds.size === 0) return { teams: 0, players: 0 }

  // Upsert teams
  for (const extId of teamExtIds) {
    try {
      const sportPath: Record<string, string> = {
        nba: 'basketball/nba',
        nfl: 'football/nfl',
        mlb: 'baseball/mlb',
        nhl: 'hockey/nhl',
        soccer: 'soccer/eng.1',
      }
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath[sport]}/teams/${extId}`
      const teamData = await fetchESPN(url)
      const team = teamData.team || teamData
      await sb.from('teams').upsert({
        external_id: String(team.id),
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
        logo_url: team.logos?.[0]?.href || null,
      }, { onConflict: 'sport,external_id' })
    } catch { /* ignore */ }
  }

  // Get internal team IDs
  const { data: teams } = await sb
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport)
    .in('external_id', Array.from(teamExtIds))
  const teamIdMap = new Map(teams?.map(t => [t.external_id, t.id]))

  let playersCount = 0
  for (const extId of teamExtIds) {
    const teamId = teamIdMap.get(extId)
    if (!teamId) continue
    try {
      const sportPath: Record<string, string> = {
        nba: 'basketball/nba',
        nfl: 'football/nfl',
        mlb: 'baseball/mlb',
        nhl: 'hockey/nhl',
        soccer: 'soccer/eng.1',
      }
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath[sport]}/teams/${extId}/roster`
      const data = await fetchESPN(url)
      const athletes = data.athletes || []
      const flat = Array.isArray(athletes) ? athletes.flatMap((g: any) => g.items || [g]) : []
      for (let idx = 0; idx < flat.length; idx++) {
        const a = flat[idx]
        await sb.from('players').upsert({
          external_id: String(a.id),
          sport,
          full_name: a.fullName || a.displayName,
          position: a.position?.abbreviation || null,
          headshot_url: a.headshot?.href || null,
          team_id: teamId,
          roster_order: idx,
          is_starter: idx < (sport === 'soccer' ? 11 : sport === 'nfl' ? 22 : 5),
        }, { onConflict: 'sport,external_id' })
        playersCount++
      }
    } catch { /* ignore */ }
  }

  return { teams: teamExtIds.size, players: playersCount }
}

// ------------------------------------------------------------------
// MAIN HANDLER
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport, mode } = body

    // Default to get_players if sport provided without operation
    if (!operation && sport) operation = 'get_players'
    if (!operation) {
      return new Response(JSON.stringify({ error: 'Missing operation' }), { status: 400, headers: corsHeaders })
    }
    if (!sport && operation !== 'status') {
      return new Response(JSON.stringify({ error: 'Missing sport' }), { status: 400, headers: corsHeaders })
    }

    console.log(`[clever-action] op=${operation} sport=${sport} mode=${mode}`)

    switch (operation) {
      case 'get_players': {
        // Return players from database
        const { data: players } = await sb
          .from('players')
          .select(`
            id, full_name, position, status, injury_description, is_starter,
            teams:team_id(name, abbreviation),
            player_averages(last10_avg_points, hit_rate_10, points_consistency)
          `)
          .eq('sport', sport)
          .limit(500)

        const formatted = players?.map(p => ({
          id: p.id,
          name: p.full_name,
          position: p.position || 'N/A',
          team: p.teams?.name,
          team_abbr: p.teams?.abbreviation,
          status: p.status || 'active',
          injury_description: p.injury_description,
          is_starter: p.is_starter || false,
          line: 22.5, // placeholder until real odds are fetched
          confidence: 50,
          hit_rate: Math.round((p.player_averages?.hit_rate_10 || 0) * 100),
        })) || []

        return new Response(JSON.stringify({ success: true, players: formatted, count: formatted.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'sync_upcoming': {
        const result = await syncUpcoming(sb, sport)
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_odds': {
        const { data: odds } = await sb
          .from('odds_cache')
          .select('*')
          .eq('sport', sport)
          .order('last_updated', { ascending: false })
        return new Response(JSON.stringify({ success: true, odds, count: odds?.length || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_top_picks': {
        const { data: picks } = await sb
          .from('top_picks')
          .select('*')
          .eq('sport', sport)
          .order('confidence', { ascending: false })
          .limit(20)
        return new Response(JSON.stringify({ success: true, picks, count: picks?.length || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders })
    }
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
