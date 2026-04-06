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

// ---------- Helper: fetch all teams for a sport (for roster/injuries) ----------
async function getAllTeams(sb: any, sport: string): Promise<string[]> {
  const teamExtIds: string[] = []
  try {
    let url = ''
    if (sport === 'soccer') {
      // For soccer, get teams from the league's team list
      url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams`
    } else {
      url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams`
    }
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    // ESPN structure varies: sometimes data.sports[0].leagues[0].teams
    let teams = data.sports?.[0]?.leagues?.[0]?.teams || data.teams || []
    if (teams.length === 0 && data.leagues) {
      // Alternative structure
      for (const league of data.leagues) {
        teams.push(...(league.teams || []))
      }
    }
    for (const t of teams) {
      const team = t.team || t
      const extId = String(team.id)
      teamExtIds.push(extId)
      await sb.from('teams').upsert({
        external_id: extId,
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
        logo_url: team.logos?.[0]?.href || null,
      }, { onConflict: 'sport,external_id' })
    }
  } catch (e) { console.error('getAllTeams error', e) }
  return teamExtIds
}

// ---------- Fetch games for next N days ----------
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

// ---------- Fetch injuries ----------
async function fetchInjuries(sport: string): Promise<Map<string, { status: string, description: string }>> {
  const injuryMap = new Map()
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/news/injuries`
    const res = await fetch(url)
    if (!res.ok) return injuryMap
    const data = await res.json()
    for (const athlete of data.injuries || []) {
      const athleteId = String(athlete.athlete?.id)
      const status = athlete.status?.toLowerCase() || 'out'
      const description = athlete.details || athlete.note || 'Injured'
      injuryMap.set(athleteId, { status, description })
    }
  } catch (e) { /* ignore */ }
  return injuryMap
}

// ---------- Get players (with optional upcoming games filter) ----------
async function getPlayers(sb: any, sport: string, onlyUpcoming = true) {
  let teamExtIds = new Set<string>()
  let games: any[] = []

  if (onlyUpcoming) {
    games = await fetchGamesForRange(sport, 2)
    for (const g of games) {
      if (g.home_team_ext_id) teamExtIds.add(g.home_team_ext_id)
      if (g.away_team_ext_id) teamExtIds.add(g.away_team_ext_id)
    }
    if (teamExtIds.size === 0) {
      // No upcoming games – return empty for scanner, but for roster we'd call with onlyUpcoming=false
      return []
    }
  } else {
    // For roster/injuries: fetch all teams
    const allTeamIds = await getAllTeams(sb, sport)
    teamExtIds = new Set(allTeamIds)
    if (teamExtIds.size === 0) return []
  }

  // Ensure teams are in DB (already done in getAllTeams for all-teams mode, but do again for upcoming)
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

  // Fetch injuries
  const injuryMap = await fetchInjuries(sport)

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
      // Use index to determine starter (first 5-7 players are likely starters)
      for (let idx = 0; idx < flat.length; idx++) {
        const a = flat[idx]
        const athleteId = String(a.id)
        const injury = injuryMap.get(athleteId)
        let status = 'active'
        let injuryDescription = null
        if (injury) {
          status = injury.status
          injuryDescription = injury.description
        }

        // Starter logic:
        // 1. If we have average minutes from stats (we'll fetch later) – but here we don't yet.
        // 2. Use roster order: first 5 are starters (NBA/NFL typically lists starters first)
        // 3. For soccer, first 11 are starters.
        let isStarter = false
        if (sport === 'soccer') {
          isStarter = idx < 11
        } else if (sport === 'nfl') {
          isStarter = idx < 22 // Offense+defense starters
        } else { // NBA, NHL, MLB
          isStarter = idx < 5
        }

        players.push({
          external_id: athleteId,
          sport,
          full_name: a.fullName || a.displayName,
          position: a.position?.abbreviation || null,
          headshot_url: a.headshot?.href || null,
          team_id: teamId,
          status,
          injury_description: injuryDescription,
          is_starter: isStarter,
        })
      }
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 200))
  }

  // Upsert players
  if (players.length) {
    await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
  }

  // Fetch from DB with averages (if any)
  const { data: dbPlayers } = await sb
    .from('players')
    .select(`
      id, full_name, position, team_id, status, injury_description, is_starter,
      teams:team_id(name, abbreviation),
      player_averages(
        last5_avg_points, last10_avg_points, last15_avg_points, last20_avg_points,
        last5_avg_rebounds, last10_avg_rebounds, last15_avg_rebounds, last20_avg_rebounds,
        last5_avg_assists, last10_avg_assists, last15_avg_assists, last20_avg_assists,
        avg_minutes
      )
    `)
    .eq('sport', sport)
    .in('team_id', teams.map(t => t.id))

  if (!dbPlayers?.length) return []

  // Build opponent map (only for upcoming games)
  const opponentMap = new Map()
  if (onlyUpcoming) {
    for (const g of games) {
      if (g.home_team_ext_id) opponentMap.set(g.home_team_ext_id, g.away_team_ext_id)
      if (g.away_team_ext_id) opponentMap.set(g.away_team_ext_id, g.home_team_ext_id)
    }
  }

  // Generate lines based on averages or sport defaults
  const getLine = (player: any) => {
    const avg = player.player_averages || {}
    const last20Points = avg.last20_avg_points || 15
    if (sport === 'nba') {
      const pos = player.position?.toLowerCase() || ''
      if (pos.includes('g')) return Math.round(last20Points * 10) / 10
      if (pos.includes('f')) return Math.round((last20Points - 3) * 10) / 10
      return Math.round((last20Points - 5) * 10) / 10
    }
    if (sport === 'nfl') return 225.5
    if (sport === 'mlb') return 1.5
    if (sport === 'nhl') return 0.5
    if (sport === 'soccer') return 0.5
    return 20.5
  }

  return dbPlayers.map(p => {
    const avg = p.player_averages || {}
    const last20Points = avg.last20_avg_points || 15
    const line = getLine(p)
    const edge = last20Points - line
    const confidence = Math.min(100, Math.max(0, 50 + (edge * 5)))
    const hitRate = edge > 0 ? 65 : 45

    const teamExt = teams.find(t => t.id === p.team_id)?.external_id
    const oppExt = onlyUpcoming ? opponentMap.get(teamExt) : null
    const opponent = oppExt ? (teamAbbrByExt.get(oppExt) || 'TBD') : (onlyUpcoming ? 'TBD' : 'N/A')

    // Override starter if minutes > 20 (from stats)
    let isStarter = p.is_starter
    if (avg.avg_minutes && avg.avg_minutes >= 20) {
      isStarter = true
    }

    return {
      id: p.id,
      name: p.full_name,
      position: p.position || 'N/A',
      team: p.teams?.name,
      team_abbr: p.teams?.abbreviation,
      opponent,
      line,
      edge_type: edge > 1 ? 'OVER' : edge < -1 ? 'UNDER' : 'NONE',
      confidence: Math.round(confidence),
      hit_rate: Math.round(hitRate),
      trend: 'stable',
      status: p.status || 'active',
      injury_description: p.injury_description,
      is_starter: isStarter,
    }
  })
}

// ---------- Sync upcoming games (lightweight) ----------
async function syncUpcoming(sb: any, sport: string) {
  const players = await getPlayers(sb, sport, true)
  return { teams: 0, players: players.length }
}

// ---------- Full sync (placeholder) ----------
async function fullSync(sb: any, sport: string) {
  // For now, just return
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
