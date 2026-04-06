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

// ---------- NBA STATS API (balldontlie) ----------
async function fetchNBAStatsForPlayer(playerId: string): Promise<any[]> {
  // Map ESPN player ID to balldontlie ID? This is complex. For demo, we'll use a fallback.
  // In production, you'd need a mapping table or use ESPN's own stats API.
  // For now, return empty (will use placeholder).
  return []
}

// ---------- Generic Stats Fetcher ----------
async function fetchPlayerStats(sport: string, externalId: string): Promise<any[]> {
  if (sport === 'nba') {
    return fetchNBAStatsForPlayer(externalId)
  }
  // Other sports: ESPN stats endpoint (needs league ID, season)
  return []
}

// ---------- Compute Rolling Averages ----------
function computeRollingAverages(stats: any[], statKey: string): { last5: number, last10: number, last15: number, last20: number } {
  const values = stats.map(s => s[statKey]).filter(v => v !== null && !isNaN(v))
  const avg = (arr: number[]) => arr.reduce((a,b) => a+b,0) / (arr.length || 1)
  return {
    last5: avg(values.slice(0,5)),
    last10: avg(values.slice(0,10)),
    last15: avg(values.slice(0,15)),
    last20: avg(values.slice(0,20)),
  }
}

// ---------- Update Player Averages in DB ----------
async function updatePlayerAverages(sb: any, playerId: string, sport: string) {
  // Fetch last 20 games from player_stats
  const { data: stats } = await sb
    .from('player_stats')
    .select('points, rebounds, assists, steals, minutes, game_date')
    .eq('player_id', playerId)
    .order('game_date', { ascending: false })
    .limit(20)

  if (!stats || stats.length === 0) return

  const pointsAvg = computeRollingAverages(stats, 'points')
  const reboundsAvg = computeRollingAverages(stats, 'rebounds')
  const assistsAvg = computeRollingAverages(stats, 'assists')

  await sb.from('player_averages').upsert({
    player_id: playerId,
    avg_points: pointsAvg.last20,
    avg_rebounds: reboundsAvg.last20,
    avg_assists: assistsAvg.last20,
    last5_avg_points: pointsAvg.last5,
    last10_avg_points: pointsAvg.last10,
    last15_avg_points: pointsAvg.last15,
    last20_avg_points: pointsAvg.last20,
    last5_avg_rebounds: reboundsAvg.last5,
    last10_avg_rebounds: reboundsAvg.last10,
    last15_avg_rebounds: reboundsAvg.last15,
    last20_avg_rebounds: reboundsAvg.last20,
    last5_avg_assists: assistsAvg.last5,
    last10_avg_assists: assistsAvg.last10,
    last15_avg_assists: assistsAvg.last15,
    last20_avg_assists: assistsAvg.last20,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'player_id' })
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

// ---------- Get all teams for a sport (no date filter) ----------
async function getAllTeams(sb: any, sport: string) {
  // Fetch from ESPN team list
  const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const teams = data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => t.team) || []
  for (const team of teams) {
    await sb.from('teams').upsert({
      external_id: String(team.id),
      sport,
      name: team.displayName,
      abbreviation: team.abbreviation,
      logo_url: team.logos?.[0]?.href || null,
    }, { onConflict: 'sport,external_id' })
  }
  return teams.map((t: any) => t.id)
}

// ---------- Get players (with optional upcoming games filter) ----------
async function getPlayers(sb: any, sport: string, onlyUpcoming = true) {
  let games = []
  let teamExtIds = new Set<string>()

  if (onlyUpcoming) {
    games = await fetchGamesForRange(sport, 2)
    for (const g of games) {
      if (g.home_team_ext_id) teamExtIds.add(g.home_team_ext_id)
      if (g.away_team_ext_id) teamExtIds.add(g.away_team_ext_id)
    }
    if (teamExtIds.size === 0) {
      // No upcoming games – return empty array for scanner
      return []
    }
  } else {
    // For roster/injuries: get all teams
    const allTeamIds = await getAllTeams(sb, sport)
    teamExtIds = new Set(allTeamIds.map(String))
  }

  // Ensure teams in DB
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
      for (const a of flat) {
        const athleteId = String(a.id)
        const injury = injuryMap.get(athleteId)
        let status = 'active'
        let injuryDescription = null
        if (injury) {
          status = injury.status
          injuryDescription = injury.description
        }
        const lineupOrder = a.lineupOrder || a.position?.order || 999
        const isStarter = lineupOrder <= 7

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

  // Fetch from DB with averages
  const { data: dbPlayers } = await sb
    .from('players')
    .select(`
      id, full_name, position, team_id, status, injury_description, is_starter,
      teams:team_id(name, abbreviation),
      player_averages(
        last5_avg_points, last10_avg_points, last15_avg_points, last20_avg_points,
        last5_avg_rebounds, last10_avg_rebounds, last15_avg_rebounds, last20_avg_rebounds,
        last5_avg_assists, last10_avg_assists, last15_avg_assists, last20_avg_assists
      )
    `)
    .eq('sport', sport)
    .in('team_id', teams.map(t => t.id))

  if (!dbPlayers?.length) return []

  // Build opponent map (for upcoming games only)
  const opponentMap = new Map()
  if (onlyUpcoming) {
    for (const g of games) {
      if (g.home_team_ext_id) opponentMap.set(g.home_team_ext_id, g.away_team_ext_id)
      if (g.away_team_ext_id) opponentMap.set(g.away_team_ext_id, g.home_team_ext_id)
    }
  }

  // Default line based on sport and position
  const getLine = (player: any) => {
    const sportKey = sport as keyof typeof sportLines
    const pos = player.position?.toLowerCase() || ''
    if (sport === 'nba') {
      if (pos.includes('g')) return 22.5
      if (pos.includes('f')) return 18.5
      if (pos.includes('c')) return 15.5
      return 20.5
    }
    if (sport === 'nfl') return 225.5 // passing yards
    if (sport === 'mlb') return 1.5   // hits
    if (sport === 'nhl') return 0.5   // goals
    return 20.5
  }

  const sportLines = { nba: 22.5, nfl: 225.5, mlb: 1.5, nhl: 0.5, soccer: 0.5 }

  return dbPlayers.map(p => {
    const avg = p.player_averages || {}
    const last20Points = avg.last20_avg_points || 15
    const line = getLine(p)
    const edge = last20Points - line
    const confidence = Math.min(100, Math.max(0, 50 + (edge * 5)))
    const hitRate = edge > 0 ? 65 : 45

    const teamExt = teams.find(t => t.id === p.team_id)?.external_id
    const oppExt = onlyUpcoming ? opponentMap.get(teamExt) : null
    const opponent = oppExt ? (teamAbbrByExt.get(oppExt) || 'TBD') : 'N/A'

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
      is_starter: p.is_starter || false,
    }
  })
}

// ---------- Sync upcoming games (lightweight) ----------
async function syncUpcoming(sb: any, sport: string) {
  const players = await getPlayers(sb, sport, true)
  return { teams: 0, players: players.length }
}

// ---------- Full sync: fetch historical stats and update averages ----------
async function fullSync(sb: any, sport: string) {
  // Get all players for this sport
  const { data: players } = await sb.from('players').select('id, external_id').eq('sport', sport)
  if (!players) return { players: 0, props_generated: 0 }

  let updated = 0
  for (const player of players) {
    const stats = await fetchPlayerStats(sport, player.external_id)
    if (stats.length) {
      // Insert stats into player_stats
      for (const stat of stats) {
        await sb.from('player_stats').upsert({
          player_id: player.id,
          game_date: stat.game_date,
          points: stat.points,
          rebounds: stat.rebounds,
          assists: stat.assists,
          steals: stat.steals,
          minutes: stat.minutes,
        }, { onConflict: 'player_id,game_date' })
      }
      await updatePlayerAverages(sb, player.id, sport)
      updated++
    }
    await new Promise(r => setTimeout(r, 100))
  }
  return { players: updated, props_generated: updated * 3 }
}

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport, mode } = body // mode: 'upcoming' or 'all'

    if (!operation && sport) operation = 'get_players'
    if (!operation) throw new Error('Missing operation')
    if (!sport && operation !== 'status') throw new Error('Missing sport')

    console.log(`[clever-action] op=${operation} sport=${sport} mode=${mode}`)

    switch (operation) {
      case 'get_players': {
        const onlyUpcoming = mode !== 'all' // 'all' for roster/injuries, default upcoming
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
