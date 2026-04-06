// supabase/functions/clever-action/index.ts
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

const ESPN_PATH: Record<string, string> = {
  nba: 'basketball/nba',
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  soccer: 'soccer/eng.1',
}

// Fetch games for today + next 2 days (3 days total)
async function fetchGamesForRange(sport: string, daysAhead = 2) {
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
    const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/scoreboard?dates=${fmt}`
    const res = await fetch(url)
    if (!res.ok) continue
    const data = await res.json()
    for (const ev of data.events || []) {
      const comp = ev.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
      allGames.push({
        external_id: ev.id,
        sport,
        game_date: date,
        start_time: ev.date,
        home_team_ext_id: home?.team?.id,
        away_team_ext_id: away?.team?.id,
      })
    }
  }
  return allGames
}

// Get players with upcoming games (3 days)
async function getPlayersWithUpcomingGames(sb: any, sport: string) {
  const games = await fetchGamesForRange(sport, 2)
  if (!games.length) return []

  // Extract all team external IDs from these games
  const teamExtIds = new Set<string>()
  for (const g of games) {
    if (g.home_team_ext_id) teamExtIds.add(g.home_team_ext_id)
    if (g.away_team_ext_id) teamExtIds.add(g.away_team_ext_id)
  }
  if (teamExtIds.size === 0) return []

  // Ensure teams are in DB (upsert)
  for (const extId of teamExtIds) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${extId}`
      const res = await fetch(url)
      if (!res.ok) continue
      const d = await res.json()
      const team = d.team || d
      await sb.from('teams').upsert({
        external_id: String(team.id),
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
        logo_url: team.logos?.[0]?.href || null,
      }, { onConflict: 'sport,external_id' })
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 100))
  }

  // Get team IDs from DB
  const { data: teams } = await sb
    .from('teams')
    .select('id, external_id, abbreviation, name')
    .eq('sport', sport)
    .in('external_id', Array.from(teamExtIds))
  if (!teams?.length) return []

  const teamIdByExt = new Map(teams.map(t => [t.external_id, t.id]))
  const teamAbbrByExt = new Map(teams.map(t => [t.external_id, t.abbreviation]))
  const teamNameByExt = new Map(teams.map(t => [t.external_id, t.name]))

  // Fetch players for each team
  const players: any[] = []
  for (const extId of teamExtIds) {
    const teamId = teamIdByExt.get(extId)
    if (!teamId) continue
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${extId}/roster`
      const res = await fetch(url)
      if (!res.ok) continue
      const d = await res.json()
      const flat = Array.isArray(d.athletes) ? d.athletes.flatMap((g: any) => g.items || [g]) : []
      for (const a of flat) {
        players.push({
          external_id: String(a.id),
          sport,
          full_name: a.fullName || a.displayName,
          position: a.position?.abbreviation || null,
          headshot_url: a.headshot?.href || null,
          team_id: teamId,
        })
      }
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 200))
  }

  // Upsert players
  if (players.length) {
    await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
  }

  // Now fetch all players from DB for these teams
  const { data: dbPlayers } = await sb
    .from('players')
    .select('id, full_name, position, team_id, teams:team_id(name, abbreviation)')
    .eq('sport', sport)
    .in('team_id', teams.map(t => t.id))

  if (!dbPlayers?.length) return []

  // Build opponent map (team ext id -> opponent ext id)
  const opponentMap = new Map()
  for (const g of games) {
    if (g.home_team_ext_id) opponentMap.set(g.home_team_ext_id, g.away_team_ext_id)
    if (g.away_team_ext_id) opponentMap.set(g.away_team_ext_id, g.home_team_ext_id)
  }

  // Default lines per sport (placeholder)
  const defaultLine: Record<string, number> = {
    nba: 22.5,
    nfl: 225.5,
    mlb: 1.5,
    nhl: 0.5,
    soccer: 0.5,
  }
  const lineValue = defaultLine[sport] || 20

  return dbPlayers.map(p => {
    const teamExt = teams.find(t => t.id === p.team_id)?.external_id
    const oppExt = teamExt ? opponentMap.get(teamExt) : null
    const opponent = oppExt ? (teamAbbrByExt.get(oppExt) || 'TBD') : 'TBD'
    return {
      id: p.id,
      name: p.full_name,
      position: p.position || 'N/A',
      team: p.teams?.name,
      team_abbr: p.teams?.abbreviation,
      opponent,
      line: lineValue,
      edge_type: 'NONE',
      confidence: 50,
      hit_rate: 0,
      trend: 'stable',
      status: 'active',
      is_starter: false,
    }
  })
}

// Full sync (placeholder – implement later)
async function fullSync(sb: any, sport: string) {
  // TODO: fetch historical stats, compute rolling averages, edge, confidence
  return { players: 0, props_generated: 0 }
}

// Sync upcoming games only (teams + players)
async function syncUpcoming(sb: any, sport: string) {
  const players = await getPlayersWithUpcomingGames(sb, sport)
  const teamExtIds = new Set<string>()
  // ... you can also count teams
  return { teams: 0, players: players.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport } = body

    // ✅ FALLBACK: if no operation but sport exists, treat as "get_players"
    if (!operation && sport) {
      operation = 'get_players'
      console.log(`[clever-action] No operation provided, defaulting to get_players for ${sport}`)
    }

    if (!operation) {
      return new Response(JSON.stringify({ error: 'Missing operation' }), { status: 400, headers: corsHeaders })
    }
    if (!sport && operation !== 'status') {
      return new Response(JSON.stringify({ error: 'Missing sport' }), { status: 400, headers: corsHeaders })
    }

    console.log(`[clever-action] op=${operation} sport=${sport}`)

    switch (operation) {
      case 'get_players': {
        const players = await getPlayersWithUpcomingGames(sb, sport)
        return new Response(JSON.stringify({ success: true, players, count: players.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'sync_upcoming': {
        const result = await syncUpcoming(sb, sport)
        return new Response(JSON.stringify({ success: true, ...result }), { headers: corsHeaders })
      }

      case 'full_sync': {
        const result = await fullSync(sb, sport)
        return new Response(JSON.stringify({ success: true, ...result }), { headers: corsHeaders })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders })
    }
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
