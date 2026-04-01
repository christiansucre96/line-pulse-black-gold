import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com/',
  'Accept': 'application/json',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function logIngestion(supabase: any, sport: string, operation: string, status: string, records = 0, error?: string) {
  await supabase.from('ingestion_logs').insert({
    sport, operation, status, records_processed: records,
    error_message: error, completed_at: status !== 'running' ? new Date().toISOString() : null
  })
}

// ============ NBA INGESTION ============

async function fetchNbaTeams(supabase: any) {
  const res = await fetch('https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=2024-25&SeasonType=Regular+Season', { headers: NBA_HEADERS })
  if (!res.ok) {
    // Fallback to ESPN
    const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50')
    const espnData = await espnRes.json()
    const teams = espnData.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => ({
      external_id: t.team.id,
      sport: 'nba',
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      city: t.team.location,
      logo_url: t.team.logos?.[0]?.href || null,
    })) || []

    if (teams.length > 0) {
      const { error } = await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
      if (error) throw error
    }
    return teams.length
  }

  const data = await res.json()
  const standings = data.resultSets?.[0]
  if (!standings) return 0

  const headers = standings.headers
  const rows = standings.rowSet
  const teamIdIdx = headers.indexOf('TeamID')
  const teamNameIdx = headers.indexOf('TeamName')
  const teamCityIdx = headers.indexOf('TeamCity')
  const teamSlugIdx = headers.indexOf('TeamSlug')
  const confIdx = headers.indexOf('Conference')
  const divIdx = headers.indexOf('Division')

  const teams = rows.map((row: any) => ({
    external_id: String(row[teamIdIdx]),
    sport: 'nba',
    name: `${row[teamCityIdx]} ${row[teamNameIdx]}`,
    abbreviation: row[teamSlugIdx]?.toUpperCase() || null,
    city: row[teamCityIdx],
    conference: row[confIdx] || null,
    division: row[divIdx] || null,
  }))

  if (teams.length > 0) {
    const { error } = await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
    if (error) throw error
  }
  return teams.length
}

async function fetchNbaPlayers(supabase: any, season = '2024-25') {
  // Use ESPN for more reliable player data
  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', 'nba')
  if (!teams?.length) return 0

  let totalPlayers = 0
  for (const team of teams) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.external_id}/roster`)
      if (!res.ok) continue
      const data = await res.json()

      const athletes = data.athletes || []
      const players = athletes.map((a: any) => ({
        external_id: a.id,
        sport: 'nba',
        first_name: a.firstName || null,
        last_name: a.lastName || null,
        full_name: a.fullName || a.displayName,
        team_id: team.id,
        position: a.position?.abbreviation || null,
        jersey_number: a.jersey || null,
        height: a.displayHeight || null,
        weight: a.displayWeight || null,
        birth_date: a.dateOfBirth?.split('T')[0] || null,
        headshot_url: a.headshot?.href || null,
        status: 'active',
      }))

      if (players.length > 0) {
        await supabase.from('players').upsert(players, { onConflict: 'sport,external_id' })
        totalPlayers += players.length
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error(`Error fetching roster for team ${team.external_id}:`, e)
    }
  }
  return totalPlayers
}

async function fetchNbaGames(supabase: any, dateStr?: string) {
  const date = dateStr || new Date().toISOString().split('T')[0]
  const formatted = date.replace(/-/g, '')

  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${formatted}`)
  if (!res.ok) throw new Error(`ESPN NBA scoreboard failed: ${res.status}`)
  const data = await res.json()

  const events = data.events || []
  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', 'nba')
  const teamMap = new Map(teams?.map((t: any) => [t.external_id, t.id]) || [])

  const games = events.map((event: any) => {
    const comp = event.competitions?.[0]
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
    const statusType = comp?.status?.type?.name

    return {
      external_id: event.id,
      sport: 'nba',
      home_team_id: teamMap.get(home?.team?.id) || null,
      away_team_id: teamMap.get(away?.team?.id) || null,
      game_date: date,
      start_time: event.date || null,
      status: statusType === 'STATUS_FINAL' ? 'finished' : statusType === 'STATUS_IN_PROGRESS' ? 'live' : 'upcoming',
      home_score: parseInt(home?.score || '0'),
      away_score: parseInt(away?.score || '0'),
      season: '2024-25',
      season_type: 'regular',
      current_period: comp?.status?.period ? `Q${comp.status.period}` : null,
      time_remaining: comp?.status?.displayClock || null,
      venue: comp?.venue?.fullName || null,
    }
  })

  if (games.length > 0) {
    await supabase.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  }
  return games.length
}

async function fetchNbaBoxScore(supabase: any, gameExternalId: string) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameExternalId}`)
  if (!res.ok) return 0
  const data = await res.json()

  const { data: game } = await supabase.from('games_data').select('id').eq('external_id', gameExternalId).eq('sport', 'nba').single()
  if (!game) return 0

  const { data: allPlayers } = await supabase.from('players').select('id, external_id').eq('sport', 'nba')
  const playerMap = new Map(allPlayers?.map((p: any) => [p.external_id, p.id]) || [])

  const boxScore = data.boxscore?.players || []
  const stats: any[] = []
  const lineups: any[] = []

  for (const teamBox of boxScore) {
    const teamAbbr = teamBox.team?.abbreviation
    const { data: team } = await supabase.from('teams').select('id').eq('abbreviation', teamAbbr).eq('sport', 'nba').single()

    for (const statGroup of (teamBox.statistics || [])) {
      const labels = statGroup.labels || []
      for (const athlete of (statGroup.athletes || [])) {
        const playerId = playerMap.get(athlete.athlete?.id)
        if (!playerId) continue

        const s = athlete.stats || []
        const statObj: any = {}
        labels.forEach((label: string, i: number) => {
          const val = s[i]
          if (label === 'MIN') statObj.minutes_played = parseFloat(val) || 0
          if (label === 'PTS') statObj.points = parseInt(val) || 0
          if (label === 'REB') statObj.rebounds = parseInt(val) || 0
          if (label === 'AST') statObj.assists = parseInt(val) || 0
          if (label === 'STL') statObj.steals = parseInt(val) || 0
          if (label === 'BLK') statObj.blocks = parseInt(val) || 0
          if (label === 'TO') statObj.turnovers = parseInt(val) || 0
          if (label === '3PT') {
            const [made, att] = (val || '0-0').split('-')
            statObj.three_pointers_made = parseInt(made) || 0
            statObj.three_pointers_attempted = parseInt(att) || 0
          }
          if (label === 'FG') {
            const [made, att] = (val || '0-0').split('-')
            statObj.field_goals_made = parseInt(made) || 0
            statObj.field_goals_attempted = parseInt(att) || 0
          }
          if (label === 'FT') {
            const [made, att] = (val || '0-0').split('-')
            statObj.free_throws_made = parseInt(made) || 0
            statObj.free_throws_attempted = parseInt(att) || 0
          }
        })

        const starter = athlete.starter || false
        stats.push({
          player_id: playerId,
          game_id: game.id,
          sport: 'nba',
          player_name: athlete.athlete?.displayName,
          team_abbreviation: teamAbbr,
          game_date: data.header?.competitions?.[0]?.date?.split('T')[0] || null,
          started: starter,
          ...statObj,
        })

        lineups.push({
          game_id: game.id,
          player_id: playerId,
          team_id: team?.id || null,
          is_starter: starter,
          position: athlete.athlete?.position?.abbreviation || null,
        })
      }
    }
  }

  if (stats.length > 0) {
    await supabase.from('player_game_stats').upsert(stats, { onConflict: 'player_id,game_id' })
  }
  if (lineups.length > 0) {
    await supabase.from('game_lineups').upsert(lineups, { onConflict: 'game_id,player_id' })
  }
  return stats.length
}

async function fetchNbaInjuries(supabase: any) {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries')
  if (!res.ok) return 0
  const data = await res.json()

  const { data: allPlayers } = await supabase.from('players').select('id, external_id').eq('sport', 'nba')
  const playerMap = new Map(allPlayers?.map((p: any) => [p.external_id, p.id]) || [])

  const injuries: any[] = []
  for (const team of (data.injuries || [])) {
    for (const item of (team.injuries || [])) {
      const playerId = playerMap.get(item.athlete?.id)
      if (!playerId) continue
      injuries.push({
        player_id: playerId,
        sport: 'nba',
        status: item.status?.toLowerCase() || 'unknown',
        description: item.details?.detail || item.longComment || null,
        body_part: item.details?.type || null,
        last_updated: new Date().toISOString(),
      })
    }
  }

  // Clear old NBA injuries and insert fresh
  await supabase.from('injury_tracking').delete().eq('sport', 'nba')
  if (injuries.length > 0) {
    await supabase.from('injury_tracking').insert(injuries)
  }
  return injuries.length
}

// ============ MLB INGESTION ============

async function fetchMlbTeams(supabase: any) {
  const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
  if (!res.ok) throw new Error('MLB teams API failed')
  const data = await res.json()

  const teams = (data.teams || []).map((t: any) => ({
    external_id: String(t.id),
    sport: 'mlb',
    name: t.name,
    abbreviation: t.abbreviation,
    city: t.locationName,
    conference: t.league?.name || null,
    division: t.division?.name || null,
  }))

  if (teams.length > 0) {
    await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  }
  return teams.length
}

async function fetchMlbRosters(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', 'mlb')
  if (!teams?.length) return 0

  let total = 0
  for (const team of teams) {
    try {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${team.external_id}/roster?rosterType=active`)
      if (!res.ok) continue
      const data = await res.json()

      const players = (data.roster || []).map((r: any) => ({
        external_id: String(r.person.id),
        sport: 'mlb',
        full_name: r.person.fullName,
        team_id: team.id,
        position: r.position?.abbreviation || null,
        jersey_number: r.jerseyNumber || null,
        status: r.status?.description || 'active',
      }))

      if (players.length > 0) {
        await supabase.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error(`MLB roster error team ${team.external_id}:`, e)
    }
  }
  return total
}

async function fetchMlbGames(supabase: any, dateStr?: string) {
  const date = dateStr || new Date().toISOString().split('T')[0]
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`)
  if (!res.ok) return 0
  const data = await res.json()

  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', 'mlb')
  const teamMap = new Map(teams?.map((t: any) => [t.external_id, t.id]) || [])

  const games: any[] = []
  for (const d of (data.dates || [])) {
    for (const g of (d.games || [])) {
      const status = g.status?.abstractGameState === 'Final' ? 'finished' :
                     g.status?.abstractGameState === 'Live' ? 'live' : 'upcoming'
      games.push({
        external_id: String(g.gamePk),
        sport: 'mlb',
        home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
        away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
        game_date: date,
        start_time: g.gameDate || null,
        status,
        home_score: g.teams?.home?.score || 0,
        away_score: g.teams?.away?.score || 0,
        season: '2025',
        season_type: 'regular',
        current_period: g.linescore?.currentInning ? `Inning ${g.linescore.currentInning}` : null,
        venue: g.venue?.name || null,
      })
    }
  }

  if (games.length > 0) {
    await supabase.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  }
  return games.length
}

// ============ NHL INGESTION ============

async function fetchNhlTeams(supabase: any) {
  const res = await fetch('https://api-web.nhle.com/v1/standings/now')
  if (!res.ok) throw new Error('NHL API failed')
  const data = await res.json()

  const teams = (data.standings || []).map((t: any) => ({
    external_id: t.teamAbbrev?.default || t.teamCommonName?.default,
    sport: 'nhl',
    name: `${t.teamName?.default}`,
    abbreviation: t.teamAbbrev?.default,
    city: t.placeName?.default || null,
    conference: t.conferenceName || null,
    division: t.divisionName || null,
    logo_url: t.teamLogo || null,
  }))

  if (teams.length > 0) {
    await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  }
  return teams.length
}

async function fetchNhlRosters(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, external_id, abbreviation').eq('sport', 'nhl')
  if (!teams?.length) return 0

  let total = 0
  for (const team of teams) {
    try {
      const abbr = team.abbreviation || team.external_id
      const res = await fetch(`https://api-web.nhle.com/v1/roster/${abbr}/current`)
      if (!res.ok) continue
      const data = await res.json()

      const allPlayers = [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])]
      const players = allPlayers.map((p: any) => ({
        external_id: String(p.id),
        sport: 'nhl',
        first_name: p.firstName?.default || null,
        last_name: p.lastName?.default || null,
        full_name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
        team_id: team.id,
        position: p.positionCode || null,
        jersey_number: p.sweaterNumber ? String(p.sweaterNumber) : null,
        height: p.heightInInches ? `${Math.floor(p.heightInInches / 12)}'${p.heightInInches % 12}"` : null,
        weight: p.weightInPounds ? `${p.weightInPounds} lbs` : null,
        headshot_url: p.headshot || null,
        status: 'active',
      }))

      if (players.length > 0) {
        await supabase.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error(`NHL roster error:`, e)
    }
  }
  return total
}

// ============ NFL INGESTION ============

async function fetchNflTeams(supabase: any) {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=50')
  if (!res.ok) throw new Error('ESPN NFL teams failed')
  const data = await res.json()

  const teams = (data.sports?.[0]?.leagues?.[0]?.teams || []).map((t: any) => ({
    external_id: t.team.id,
    sport: 'nfl',
    name: t.team.displayName,
    abbreviation: t.team.abbreviation,
    city: t.team.location,
    logo_url: t.team.logos?.[0]?.href || null,
  }))

  if (teams.length > 0) {
    await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  }
  return teams.length
}

async function fetchNflRosters(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', 'nfl')
  if (!teams?.length) return 0

  let total = 0
  for (const team of teams) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.external_id}/roster`)
      if (!res.ok) continue
      const data = await res.json()

      const athletes = data.athletes?.flatMap((group: any) => group.items || []) || []
      const players = athletes.map((a: any) => ({
        external_id: a.id,
        sport: 'nfl',
        first_name: a.firstName || null,
        last_name: a.lastName || null,
        full_name: a.fullName || a.displayName,
        team_id: team.id,
        position: a.position?.abbreviation || null,
        jersey_number: a.jersey || null,
        height: a.displayHeight || null,
        weight: a.displayWeight || null,
        headshot_url: a.headshot?.href || null,
        status: 'active',
      }))

      if (players.length > 0) {
        await supabase.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error(`NFL roster error:`, e)
    }
  }
  return total
}

// ============ SOCCER INGESTION (ESPN) ============

async function fetchSoccerTeams(supabase: any) {
  // Using ESPN for EPL
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=50')
  if (!res.ok) return 0
  const data = await res.json()

  const teams = (data.sports?.[0]?.leagues?.[0]?.teams || []).map((t: any) => ({
    external_id: t.team.id,
    sport: 'soccer',
    name: t.team.displayName,
    abbreviation: t.team.abbreviation,
    city: t.team.location || null,
    logo_url: t.team.logos?.[0]?.href || null,
  }))

  if (teams.length > 0) {
    await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  }
  return teams.length
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabaseAdmin()

  try {
    const { sport, operation, date, season, game_id } = await req.json()

    if (!sport || !operation) {
      return new Response(JSON.stringify({ error: 'sport and operation required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await logIngestion(supabase, sport, operation, 'running')
    let count = 0

    switch (sport) {
      case 'nba':
        switch (operation) {
          case 'teams': count = await fetchNbaTeams(supabase); break
          case 'players': count = await fetchNbaPlayers(supabase, season); break
          case 'games': count = await fetchNbaGames(supabase, date); break
          case 'boxscore': count = await fetchNbaBoxScore(supabase, game_id); break
          case 'injuries': count = await fetchNbaInjuries(supabase); break
          case 'full':
            count += await fetchNbaTeams(supabase)
            count += await fetchNbaPlayers(supabase, season)
            count += await fetchNbaGames(supabase, date)
            count += await fetchNbaInjuries(supabase)
            break
          default: throw new Error(`Unknown operation: ${operation}`)
        }
        break

      case 'mlb':
        switch (operation) {
          case 'teams': count = await fetchMlbTeams(supabase); break
          case 'players': count = await fetchMlbRosters(supabase); break
          case 'games': count = await fetchMlbGames(supabase, date); break
          case 'full':
            count += await fetchMlbTeams(supabase)
            count += await fetchMlbRosters(supabase)
            count += await fetchMlbGames(supabase, date)
            break
          default: throw new Error(`Unknown operation: ${operation}`)
        }
        break

      case 'nhl':
        switch (operation) {
          case 'teams': count = await fetchNhlTeams(supabase); break
          case 'players': count = await fetchNhlRosters(supabase); break
          case 'full':
            count += await fetchNhlTeams(supabase)
            count += await fetchNhlRosters(supabase)
            break
          default: throw new Error(`Unknown operation: ${operation}`)
        }
        break

      case 'nfl':
        switch (operation) {
          case 'teams': count = await fetchNflTeams(supabase); break
          case 'players': count = await fetchNflRosters(supabase); break
          case 'full':
            count += await fetchNflTeams(supabase)
            count += await fetchNflRosters(supabase)
            break
          default: throw new Error(`Unknown operation: ${operation}`)
        }
        break

      case 'soccer':
        switch (operation) {
          case 'teams': count = await fetchSoccerTeams(supabase); break
          case 'full': count = await fetchSoccerTeams(supabase); break
          default: throw new Error(`Unknown operation: ${operation}`)
        }
        break

      default:
        throw new Error(`Unknown sport: ${sport}`)
    }

    await logIngestion(supabase, sport, operation, 'completed', count)

    return new Response(JSON.stringify({ success: true, sport, operation, records: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Ingestion error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logIngestion(supabase, 'unknown', 'unknown', 'failed', 0, msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
