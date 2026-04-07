import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing env vars')
  return createClient(url, key)
}

// ------------------------------------------------------------------
// Improved ESPN fetch with retries, delays, and realistic headers
// ------------------------------------------------------------------
async function fetchESPN(url: string, retries = 3) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ]
  for (let i = 0; i < retries; i++) {
    try {
      // Random delay 0.5–2 seconds
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1500))
      const res = await fetch(url, {
        headers: {
          'User-Agent': userAgents[i % userAgents.length],
          'Accept': 'application/json',
          'Referer': 'https://www.espn.com/',
          'Origin': 'https://www.espn.com',
        },
      })
      if (res.status === 429) {
        // Rate limit – wait longer
        await new Promise(r => setTimeout(r, 5000))
        continue
      }
      if (res.ok) return await res.json()
    } catch { /* ignore */ }
  }
  throw new Error(`ESPN fetch failed after ${retries} attempts`)
}

// ------------------------------------------------------------------
// Sync teams and players (only for sports with upcoming games)
// ------------------------------------------------------------------
async function syncUpcoming(sb: any, sport: string) {
  const sportPath: Record<string, string> = {
    nba: 'basketball/nba',
    nfl: 'football/nfl',
    mlb: 'baseball/mlb',
    nhl: 'hockey/nhl',
    soccer: 'soccer/eng.1',
  }
  // Get games for next 3 days
  const today = new Date()
  const dates = []
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  const games = []
  for (const date of dates) {
    const fmt = date.replace(/-/g, '')
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath[sport]}/scoreboard?dates=${fmt}`
    try {
      const data = await fetchESPN(url)
      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0]
        games.push({
          id: ev.id,
          home_team_id: comp?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.id,
          away_team_id: comp?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.id,
        })
      }
    } catch { /* ignore */ }
  }
  if (games.length === 0) return { teams: 0, players: 0 }

  // Extract team external IDs
  const teamExtIds = new Set<string>()
  for (const g of games) {
    if (g.home_team_id) teamExtIds.add(g.home_team_id)
    if (g.away_team_id) teamExtIds.add(g.away_team_id)
  }

  // Upsert teams
  for (const extId of teamExtIds) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath[sport]}/teams/${extId}`
      const teamData = await fetchESPN(url)
      const team = teamData.team || teamData
      await sb.from('teams').upsert({
        external_id: String(team.id),
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
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
// Get players from database (for Scanner)
// ------------------------------------------------------------------
async function getPlayers(sb: any, sport: string) {
  const { data: players } = await sb
    .from('players')
    .select(`
      id, full_name, position, status, injury_description, is_starter,
      teams:team_id(name, abbreviation)
    `)
    .eq('sport', sport)
    .limit(500)
  return players?.map(p => ({
    id: p.id,
    name: p.full_name,
    position: p.position || 'N/A',
    team: p.teams?.name,
    team_abbr: p.teams?.abbreviation,
    status: p.status || 'active',
    injury_description: p.injury_description,
    is_starter: p.is_starter || false,
    line: 22.5, // placeholder until odds API integrated
    confidence: 50,
  })) || []
}

// ------------------------------------------------------------------
// Main handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport } = body
    if (!operation && sport) operation = 'get_players'
    if (!operation) throw new Error('Missing operation')

    switch (operation) {
      case 'get_players': {
        const players = await getPlayers(sb, sport)
        return new Response(JSON.stringify({ success: true, players, count: players.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      case 'sync_upcoming': {
        const result = await syncUpcoming(sb, sport)
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
