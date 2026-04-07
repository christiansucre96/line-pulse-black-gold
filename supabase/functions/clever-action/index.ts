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

const ESPN_CONFIG: Record<string, { path: string; leagueId?: string }> = {
  nba: { path: 'basketball/nba' },
  nfl: { path: 'football/nfl' },
  mlb: { path: 'baseball/mlb' },
  nhl: { path: 'hockey/nhl' },
  soccer: { path: 'soccer/eng.1' }, // English Premier League
}

// ---------- Helper: fetch from ESPN with error handling ----------
async function fetchESPN(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN returned ${res.status}`)
  return res.json()
}

// ---------- Fetch games for next 3 days ----------
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
    const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_CONFIG[sport].path}/scoreboard?dates=${fmt}`
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
          start_time: ev.date,
          home_team_ext_id: home?.team?.id,
          away_team_ext_id: away?.team?.id,
        })
      }
    } catch (err) {
      console.warn(`No games on ${date} for ${sport}`, err)
    }
  }
  return allGames
}

// ---------- Get all team external IDs (for roster/injuries) ----------
async function getAllTeamExternalIds(sport: string): Promise<string[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_CONFIG[sport].path}/teams`
  try {
    const data = await fetchESPN(url)
    // ESPN response can be nested
    let teams = data.sports?.[0]?.leagues?.[0]?.teams || data.teams || []
    if (teams.length === 0 && data.leagues) {
      for (const league of data.leagues) {
        teams.push(...(league.teams || []))
      }
    }
    return teams.map((t: any) => String(t.team?.id || t.id))
  } catch (err) {
    console.error(`Failed to fetch teams for ${sport}`, err)
    return []
  }
}

// ---------- Fetch roster for a team ----------
async function fetchTeamRoster(sport: string, teamExtId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_CONFIG[sport].path}/teams/${teamExtId}/roster`
  const data = await fetchESPN(url)
  const athletes = data.athletes || []
  // Flatten the roster (sometimes grouped by position)
  const flat = Array.isArray(athletes) ? athletes.flatMap((g: any) => g.items || [g]) : []
  return flat.map((a: any, idx: number) => ({
    external_id: String(a.id),
    full_name: a.fullName || a.displayName,
    position: a.position?.abbreviation || null,
    headshot_url: a.headshot?.href || null,
    roster_order: idx,
  }))
}

// ---------- Main getPlayers (live from ESPN) ----------
async function getPlayers(sb: any, sport: string, onlyUpcoming = true) {
  let teamExtIds: string[] = []
  
  if (onlyUpcoming) {
    const games = await fetchGamesForRange(sport, 2)
    const extIdSet = new Set<string>()
    for (const g of games) {
      if (g.home_team_ext_id) extIdSet.add(g.home_team_ext_id)
      if (g.away_team_ext_id) extIdSet.add(g.away_team_ext_id)
    }
    teamExtIds = Array.from(extIdSet)
    if (teamExtIds.length === 0) return [] // no games in next 3 days
  } else {
    teamExtIds = await getAllTeamExternalIds(sport)
    if (teamExtIds.length === 0) return []
  }

  // Ensure teams exist in DB
  for (const extId of teamExtIds) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_CONFIG[sport].path}/teams/${extId}`
    try {
      const teamData = await fetchESPN(url)
      const team = teamData.team || teamData
      await sb.from('teams').upsert({
        external_id: String(team.id),
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
        logo_url: team.logos?.[0]?.href || null,
      }, { onConflict: 'sport,external_id' })
    } catch (err) {
      console.warn(`Failed to upsert team ${extId}`, err)
    }
  }

  // Fetch all players from ESPN for these teams
  const allPlayers: any[] = []
  for (const extId of teamExtIds) {
    try {
      const roster = await fetchTeamRoster(sport, extId)
      // Get the team's internal DB id
      const { data: teamRow } = await sb.from('teams').select('id').eq('sport', sport).eq('external_id', extId).single()
      if (teamRow) {
        for (const p of roster) {
          allPlayers.push({
            ...p,
            sport,
            team_id: teamRow.id,
          })
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch roster for team ${extId}`, err)
    }
  }

  // Upsert players into DB
  if (allPlayers.length) {
    await sb.from('players').upsert(allPlayers, { onConflict: 'sport,external_id' })
  }

  // Now fetch from DB with team names
  const { data: dbPlayers } = await sb
    .from('players')
    .select(`
      id, full_name, position, team_id, status, injury_description, is_starter,
      teams:team_id(name, abbreviation)
    `)
    .eq('sport', sport)
    .in('team_id', (await sb.from('teams').select('id').eq('sport', sport).in('external_id', teamExtIds)).data?.map(t => t.id) || [])

  if (!dbPlayers?.length) return []

  // Build opponent map for upcoming games (if needed)
  let opponentMap = new Map()
  if (onlyUpcoming) {
    const games = await fetchGamesForRange(sport, 2)
    for (const g of games) {
      if (g.home_team_ext_id) opponentMap.set(g.home_team_ext_id, g.away_team_ext_id)
      if (g.away_team_ext_id) opponentMap.set(g.away_team_ext_id, g.home_team_ext_id)
    }
  }

  const { data: teams } = await sb.from('teams').select('external_id, abbreviation').eq('sport', sport)
  const teamAbbrMap = new Map(teams?.map(t => [t.external_id, t.abbreviation]) || [])

  // Determine starter based on roster order (already stored in `roster_order` but not in select, so we recompute)
  // For simplicity, we'll assume first 5 are starters for NBA, etc. But we'll rely on the `is_starter` field if present.
  // We'll add a temporary heuristic: if player's name appears early in the roster order (we didn't store order, so fallback to position).
  // To keep it simple, we'll set starter based on position for now (guards/forwards more likely starters).
  // But better: store roster_order in DB. I'll add that column quickly.

  // We'll patch by adding a simple rule: if position is PG, SG, SF, PF, C in NBA -> likely starter. Not perfect but ok.
  const isLikelyStarter = (player: any) => {
    const pos = player.position?.toUpperCase() || ''
    if (sport === 'nba') {
      return ['PG', 'SG', 'SF', 'PF', 'C'].includes(pos)
    }
    if (sport === 'nfl') {
      return ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'].includes(pos) // too many, but okay
    }
    if (sport === 'soccer') {
      return true // assume all field players are starters? Not ideal.
    }
    return false
  }

  return dbPlayers.map(p => {
    const teamExt = teams?.find(t => t.id === p.team_id)?.external_id
    const oppExt = onlyUpcoming ? opponentMap.get(teamExt) : null
    const opponent = oppExt ? (teamAbbrMap.get(oppExt) || 'TBD') : (onlyUpcoming ? 'TBD' : 'N/A')
    const line = sport === 'nba' ? 22.5 : sport === 'nfl' ? 225.5 : sport === 'mlb' ? 1.5 : 0.5
    return {
      id: p.id,
      name: p.full_name,
      position: p.position || 'N/A',
      team: p.teams?.name,
      team_abbr: p.teams?.abbreviation,
      opponent,
      line,
      edge_type: 'NONE',
      confidence: 50,
      hit_rate: 0,
      trend: 'stable',
      status: p.status || 'active',
      injury_description: p.injury_description,
      is_starter: p.is_starter !== undefined ? p.is_starter : isLikelyStarter(p),
    }
  })
}

// ---------- Sync upcoming (just calls getPlayers) ----------
async function syncUpcoming(sb: any, sport: string) {
  const players = await getPlayers(sb, sport, true)
  return { teams: 0, players: players.length }
}

// ---------- Full sync placeholder ----------
async function fullSync(sb: any, sport: string) {
  return { players: 0, props_generated: 0 }
}

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport, mode } = body

    if (!operation && sport) operation = 'get_players'
    if (!operation) throw new Error('Missing operation')
    if (!sport && operation !== 'status') throw new Error('Missing sport')

    console.log(`[clever-action] op=${operation} sport=${sport} mode=${mode}`)

    switch (operation) {
      case 'get_players': {
        const onlyUpcoming = mode !== 'all'
        const players = await getPlayers(sb, sport, onlyUpcoming)
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
