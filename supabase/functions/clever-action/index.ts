// supabase/functions/clever-action/index.ts
// Merged version – supports all operations.
// Uses PROJECT_URL and SERVICE_ROLE_KEY (no SUPABASE_ prefix).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nba.com/',
  'Accept': 'application/json',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
}

// ✅ Use the same environment variable names as the first file
function getSupabase() {
  const url = Deno.env.get('PROJECT_URL')
  const key = Deno.env.get('SERVICE_ROLE_KEY')

  if (!url || !key) {
    throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY in secrets")
  }

  return createClient(url, key)
}

// ── SPORT CONFIG ──────────────────────────────────────────────
const ESPN_PATHS: Record<string, string> = {
  nba:    'basketball/nba',
  nfl:    'football/nfl',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/eng.1',
}

const PROP_CONFIGS: Record<string, { statFields: string[], combos: { name: string, fields: string[] }[] }> = {
  nba: {
    statFields: ['points','rebounds','assists','steals','blocks','turnovers','three_pointers_made'],
    combos: [
      { name: 'Pts+Reb',     fields: ['points','rebounds'] },
      { name: 'Pts+Ast',     fields: ['points','assists'] },
      { name: 'Reb+Ast',     fields: ['rebounds','assists'] },
      { name: 'Pts+Reb+Ast', fields: ['points','rebounds','assists'] },
    ],
  },
  mlb: {
    statFields: ['hits','runs','rbi','total_bases','home_runs','stolen_bases'],
    combos: [
      { name: 'H+R+RBI', fields: ['hits','runs','rbi'] },
    ],
  },
  nhl: {
    statFields: ['goals','assists_hockey','shots_on_goal'],
    combos: [
      { name: 'G+A', fields: ['goals','assists_hockey'] },
    ],
  },
  nfl: {
    statFields: ['passing_yards','rushing_yards','receiving_yards','passing_tds','receiving_tds','receptions'],
    combos: [
      { name: 'Pass+Rush Yds', fields: ['passing_yards','rushing_yards'] },
      { name: 'Rush+Rec Yds',  fields: ['rushing_yards','receiving_yards'] },
    ],
  },
  soccer: {
    statFields: ['goals_soccer','assists_soccer','shots_soccer','shots_on_target','tackles'],
    combos: [
      { name: 'G+A', fields: ['goals_soccer','assists_soccer'] },
    ],
  },
}

// ── HELPERS ───────────────────────────────────────────────────
function roundLine(n: number, to = 0.5) {
  return Math.round(n / to) * to
}

function computeHitRate(values: number[], line: number) {
  if (!values.length) return 0
  return values.filter(v => v >= line).length / values.length
}

function computeStdDev(values: number[]) {
  if (!values.length) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length)
}

// ── INGEST: TEAMS ─────────────────────────────────────────────
async function ingestTeams(supabase: any, sport: string) {
  let teams: any[] = []

  if (sport === 'mlb') {
    const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
    const data = await res.json()
    teams = (data.teams || []).map((t: any) => ({
      external_id: String(t.id), sport: 'mlb',
      name: t.name, abbreviation: t.abbreviation,
      city: t.locationName, conference: t.league?.name || null,
      division: t.division?.name || null,
    }))
  } else if (sport === 'nhl') {
    const res = await fetch('https://api-web.nhle.com/v1/standings/now')
    const data = await res.json()
    teams = (data.standings || []).map((t: any) => ({
      external_id: t.teamAbbrev?.default, sport: 'nhl',
      name: t.teamName?.default, abbreviation: t.teamAbbrev?.default,
      city: t.placeName?.default || null,
      conference: t.conferenceName || null, division: t.divisionName || null,
      logo_url: t.teamLogo || null,
    }))
  } else {
    // ESPN for NBA, NFL, Soccer
    const path = ESPN_PATHS[sport]
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams?limit=50`)
    const data = await res.json()
    const raw = data.sports?.[0]?.leagues?.[0]?.teams || []
    teams = raw.map((t: any) => ({
      external_id: t.team.id, sport,
      name: t.team.displayName, abbreviation: t.team.abbreviation,
      city: t.team.location || null, logo_url: t.team.logos?.[0]?.href || null,
    }))
  }

  if (teams.length > 0) {
    const { error } = await supabase.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
    if (error) throw error
  }
  return teams.length
}

// ── INGEST: PLAYERS ───────────────────────────────────────────
async function ingestPlayers(supabase: any, sport: string) {
  const { data: teams } = await supabase.from('teams').select('id, external_id, abbreviation').eq('sport', sport)
  if (!teams?.length) return 0
  let total = 0

  for (const team of teams) {
    try {
      let players: any[] = []

      if (sport === 'mlb') {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${team.external_id}/roster?rosterType=active`)
        const data = await res.json()
        players = (data.roster || []).map((r: any) => ({
          external_id: String(r.person.id), sport: 'mlb',
          full_name: r.person.fullName, team_id: team.id,
          position: r.position?.abbreviation || null,
          jersey_number: r.jerseyNumber || null,
          status: r.status?.description || 'active',
        }))
      } else if (sport === 'nhl') {
        const abbr = team.abbreviation || team.external_id
        const res = await fetch(`https://api-web.nhle.com/v1/roster/${abbr}/current`)
        const data = await res.json()
        const all = [...(data.forwards||[]),...(data.defensemen||[]),...(data.goalies||[])]
        players = all.map((p: any) => ({
          external_id: String(p.id), sport: 'nhl',
          first_name: p.firstName?.default || null,
          last_name: p.lastName?.default || null,
          full_name: `${p.firstName?.default||''} ${p.lastName?.default||''}`.trim(),
          team_id: team.id, position: p.positionCode || null,
          jersey_number: p.sweaterNumber ? String(p.sweaterNumber) : null,
          headshot_url: p.headshot || null, status: 'active',
        }))
      } else {
        // ESPN for NBA, NFL, Soccer
        const path = ESPN_PATHS[sport]
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team.external_id}/roster`)
        const data = await res.json()
        const athletes = data.athletes?.flatMap((g: any) => g.items || []) || data.athletes || []
        players = athletes.map((a: any) => ({
          external_id: a.id, sport,
          first_name: a.firstName || null, last_name: a.lastName || null,
          full_name: a.fullName || a.displayName,
          team_id: team.id, position: a.position?.abbreviation || null,
          jersey_number: a.jersey || null, height: a.displayHeight || null,
          weight: a.displayWeight || null, headshot_url: a.headshot?.href || null,
          status: 'active',
        }))
      }

      if (players.length > 0) {
        await supabase.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 250))
    } catch (e) {
      console.error(`Player ingest error [${sport}/${team.external_id}]:`, e)
    }
  }
  return total
}

// ── INGEST: GAMES ─────────────────────────────────────────────
async function ingestGames(supabase: any, sport: string, dateStr?: string) {
  const date = dateStr || new Date().toISOString().split('T')[0]
  const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', sport)
  const teamMap = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])
  const games: any[] = []

  if (sport === 'mlb') {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`)
    const data = await res.json()
    for (const d of (data.dates || [])) {
      for (const g of (d.games || [])) {
        const status = g.status?.abstractGameState === 'Final' ? 'finished' :
                       g.status?.abstractGameState === 'Live' ? 'live' : 'upcoming'
        games.push({
          external_id: String(g.gamePk), sport: 'mlb',
          home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
          away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
          game_date: date, start_time: g.gameDate || null, status,
          home_score: g.teams?.home?.score || 0,
          away_score: g.teams?.away?.score || 0, season: '2025',
        })
      }
    }
  } else if (sport === 'nhl') {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`)
    const data = await res.json()
    const gameDay = data.gameWeek?.[0]?.games || []
    for (const g of gameDay) {
      const status = g.gameState === 'OFF' ? 'finished' :
                     g.gameState === 'LIVE' || g.gameState === 'CRIT' ? 'live' : 'upcoming'
      games.push({
        external_id: String(g.id), sport: 'nhl',
        home_team_id: teamMap.get(g.homeTeam?.abbrev) || null,
        away_team_id: teamMap.get(g.awayTeam?.abbrev) || null,
        game_date: date, start_time: g.startTimeUTC || null, status,
        home_score: g.homeTeam?.score || 0, away_score: g.awayTeam?.score || 0,
        season: '20242025',
      })
    }
  } else {
    const path = ESPN_PATHS[sport]
    const formatted = date.replace(/-/g, '')
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${formatted}`)
    const data = await res.json()
    for (const event of (data.events || [])) {
      const comp = event.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
      const statusType = comp?.status?.type?.name
      const status = statusType === 'STATUS_FINAL' ? 'finished' :
                     statusType === 'STATUS_IN_PROGRESS' ? 'live' : 'upcoming'
      games.push({
        external_id: event.id, sport,
        home_team_id: teamMap.get(home?.team?.id) || null,
        away_team_id: teamMap.get(away?.team?.id) || null,
        game_date: date, start_time: event.date || null, status,
        home_score: parseInt(home?.score || '0'),
        away_score: parseInt(away?.score || '0'),
        current_period: comp?.status?.period ? String(comp.status.period) : null,
        time_remaining: comp?.status?.displayClock || null,
        venue: comp?.venue?.fullName || null,
        season: sport === 'nfl' ? '2024' : '2024-25',
      })
    }
  }

  if (games.length > 0) {
    await supabase.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  }
  return games.length
}

// ── GENERIC STATS INGESTION ───────────────────────────────────
async function ingestStats(supabase: any, sport: string, date: string) {
  const path = ESPN_PATHS[sport]
  if (!path) return 0

  const { data: games } = await supabase
    .from('games_data')
    .select('id, external_id')
    .eq('sport', sport)
    .eq('game_date', date)
    .eq('status', 'finished')

  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', sport)
  const playerMap = new Map(allPlayers?.map((p: any) => [String(p.external_id), p.id]) || [])

  let totalStats = 0

  for (const game of (games || [])) {
    try {
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${game.external_id}`
      const res = await fetch(summaryUrl)
      if (!res.ok) continue
      const data = await res.json()

      const statsRows: any[] = []

      for (const teamBox of (data.boxscore?.players || [])) {
        const teamAbbr = teamBox.team?.abbreviation
        for (const statGroup of (teamBox.statistics || [])) {
          const labels = statGroup.labels || []
          for (const athlete of (statGroup.athletes || [])) {
            const playerId = playerMap.get(athlete.athlete?.id)
            if (!playerId) continue
            const rawStats = athlete.stats || []
            const stat: any = {
              player_id: playerId,
              game_id: game.id,
              sport,
              game_date: date,
              player_name: athlete.athlete?.displayName,
              team_abbreviation: teamAbbr,
              started: athlete.starter || false,
            }
            labels.forEach((label: string, idx: number) => {
              const val = rawStats[idx]
              if (val === undefined || val === null) return
              const num = typeof val === 'number' ? val : parseFloat(val)
              if (isNaN(num)) return

              // Common stats across all sports
              if (label === 'PTS') stat.points = num
              if (label === 'REB') stat.rebounds = num
              if (label === 'AST') stat.assists = num
              if (label === 'STL') stat.steals = num
              if (label === 'BLK') stat.blocks = num
              if (label === 'TO') stat.turnovers = num

              // NBA / NCAA
              if (label === '3PT') {
                const [made, att] = (val as string).split('-')
                stat.three_pointers_made = parseInt(made) || 0
                stat.three_pointers_attempted = parseInt(att) || 0
              }
              if (label === 'FG') {
                const [made, att] = (val as string).split('-')
                stat.field_goals_made = parseInt(made) || 0
                stat.field_goals_attempted = parseInt(att) || 0
              }
              if (label === 'FT') {
                const [made, att] = (val as string).split('-')
                stat.free_throws_made = parseInt(made) || 0
                stat.free_throws_attempted = parseInt(att) || 0
              }
              if (label === 'MIN') stat.minutes_played = num

              // NFL
              if (label === 'YDS') stat.passing_yards = num
              if (label === 'TD') stat.passing_tds = num
              if (label === 'RUSH YDS') stat.rushing_yards = num
              if (label === 'REC YDS') stat.receiving_yards = num
              if (label === 'REC') stat.receptions = num

              // MLB
              if (label === 'H') stat.hits = num
              if (label === 'R') stat.runs = num
              if (label === 'RBI') stat.rbi = num
              if (label === 'HR') stat.home_runs = num
              if (label === 'SB') stat.stolen_bases = num

              // NHL
              if (label === 'G') stat.goals = num
              if (label === 'A') stat.assists_hockey = num
              if (label === 'SOG') stat.shots_on_goal = num

              // Soccer
              if (label === 'G') stat.goals_soccer = num
              if (label === 'A') stat.assists_soccer = num
              if (label === 'SH') stat.shots_soccer = num
              if (label === 'SOG') stat.shots_on_target = num
              if (label === 'T') stat.tackles = num
            })
            statsRows.push(stat)
          }
        }
      }

      if (statsRows.length > 0) {
        await supabase.from('player_game_stats').upsert(statsRows, { onConflict: 'player_id,game_id' })
        totalStats += statsRows.length
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error(`Stats error for game ${game.external_id}:`, e)
    }
  }
  return totalStats
}

// ── INGEST: INJURIES ──────────────────────────────────────────
async function ingestInjuries(supabase: any, sport: string) {
  const path = ESPN_PATHS[sport]
  if (!path) return 0
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/injuries`)
  if (!res.ok) return 0
  const data = await res.json()

  const { data: allPlayers } = await supabase.from('players').select('id, external_id').eq('sport', sport)
  const playerMap = new Map(allPlayers?.map((p: any) => [p.external_id, p.id]) || [])
  const injuries: any[] = []

  for (const team of (data.injuries || [])) {
    for (const item of (team.injuries || [])) {
      const playerId = playerMap.get(item.athlete?.id)
      if (!playerId) continue
      injuries.push({
        player_id: playerId, sport,
        status: item.status?.toLowerCase() || 'unknown',
        description: item.details?.detail || item.longComment || null,
        body_part: item.details?.type || null,
        last_updated: new Date().toISOString(),
      })
    }
  }

  await supabase.from('injury_tracking').delete().eq('sport', sport)
  if (injuries.length > 0) {
    await supabase.from('injury_tracking').insert(injuries)
  }
  return injuries.length
}

// ── PROPS ENGINE ──────────────────────────────────────────────
async function generateProps(supabase: any, sport: string, player_id?: string) {
  const config = PROP_CONFIGS[sport]
  if (!config) throw new Error(`Unsupported sport: ${sport}`)

  let query = supabase.from('players').select('id, full_name').eq('sport', sport)
  if (player_id) query = query.eq('id', player_id)
  const { data: players } = await query.limit(500)
  if (!players?.length) return { players_processed: 0, props_generated: 0 }

  const allProps: any[] = []
  let processed = 0

  for (const player of players) {
    const { data: stats } = await supabase
      .from('player_game_stats').select('*')
      .eq('player_id', player.id)
      .order('game_date', { ascending: false }).limit(20)

    if (!stats || stats.length < 3) continue

    const buildProp = (values: number[], statName: string, isCombo: boolean) => {
      if (values.length < 3) return null
      const last5  = values.slice(0,5)
      const last10 = values.slice(0,10)
      const last20 = values.slice(0,20)
      const avg5  = last5.reduce((a,b)=>a+b,0)/last5.length
      const avg10 = last10.reduce((a,b)=>a+b,0)/last10.length
      const avg20 = last20.reduce((a,b)=>a+b,0)/last20.length
      const projection = avg5*0.5 + avg10*0.3 + avg20*0.2
      const baseline = roundLine(projection)
      const hr5  = computeHitRate(last5,  baseline)
      const hr10 = computeHitRate(last10, baseline)
      const hr20 = computeHitRate(last20, baseline)
      const std = computeStdDev(last20)
      const trend = avg5>avg20*1.05?'up':avg5<avg20*0.95?'down':'stable'
      const edgeType = projection>baseline*1.08?'OVER':projection<baseline*0.92?'UNDER':'NONE'
      const confidence = Math.min(1, Math.max(0,
        hr20*0.3 + (trend==='up'?0.2:trend==='down'?-0.1:0.05) +
        (1-Math.min(std/(avg20||1),1))*0.3 + (values.length/20)*0.2
      ))
      return {
        player_id: player.id, sport,
        player_name: player.full_name,
        stat_type: statName, is_combo: isCombo,
        projected_value: Math.round(projection*100)/100,
        baseline_line: baseline,
        hit_rate_last5:  Math.round(hr5*100)/100,
        hit_rate_last10: Math.round(hr10*100)/100,
        hit_rate_last20: Math.round(hr20*100)/100,
        avg_last5:  Math.round(avg5*100)/100,
        avg_last10: Math.round(avg10*100)/100,
        avg_last20: Math.round(avg20*100)/100,
        trend, consistency: Math.round(std*100)/100,
        edge_type: edgeType,
        confidence_score: Math.round(confidence*100)/100,
        last_updated: new Date().toISOString(),
      }
    }

    // Standard props
    for (const field of config.statFields) {
      const values = stats.map((s: any) => s[field]).filter((v: any) => v != null) as number[]
      const prop = buildProp(values, field, false)
      if (prop) allProps.push(prop)
    }

    // Combo props
    for (const combo of config.combos) {
      const values = stats.map((s: any) =>
        combo.fields.reduce((acc: number, f: string) => acc + (s[f] || 0), 0)
      )
      const prop = buildProp(values, combo.name, true)
      if (prop) allProps.push(prop)
    }

    processed++
  }

  // Clear + insert
  if (player_id) {
    await supabase.from('player_props').delete().eq('player_id', player_id)
  } else {
    await supabase.from('player_props').delete().eq('sport', sport)
  }

  for (let i=0; i<allProps.length; i+=500) {
    const { error } = await supabase.from('player_props').insert(allProps.slice(i, i+500))
    if (error) console.error('Props insert error:', error)
  }

  return { players_processed: processed, props_generated: allProps.length }
}

// ── LIVE TRACKER (update scores + stats) ──────────────────────
async function updateLive(supabase: any, sport?: string) {
  const date = new Date().toISOString().split('T')[0]
  const sports = sport ? [sport] : ['nba','mlb','nhl','nfl','soccer']
  let gamesUpdated = 0
  let statsUpdated = 0

  for (const s of sports) {
    try {
      gamesUpdated += await ingestGames(supabase, s, date)
      statsUpdated += await ingestStats(supabase, s, date)
    } catch (e) {
      console.error(`Live update error [${s}]:`, e)
    }
  }
  return { games_updated: gamesUpdated, stats_updated: statsUpdated }
}

// ── MAIN HANDLER ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabase()

  try {
    const body = await req.json().catch(() => ({}))
    const { sport, operation, date, player_id } = body

    console.log('clever-action called:', { sport, operation, date, player_id })

    let result: any

    switch (operation) {
      case 'full': {
        const teams   = await ingestTeams(supabase, sport)
        const players = await ingestPlayers(supabase, sport)
        const games   = await ingestGames(supabase, sport, date)
        const injuries= await ingestInjuries(supabase, sport)
        result = { teams, players, games, injuries }
        break
      }

      case 'teams':
        result = { count: await ingestTeams(supabase, sport) }
        break

      case 'players':
        result = { count: await ingestPlayers(supabase, sport) }
        break

      case 'games':
        result = { count: await ingestGames(supabase, sport, date) }
        break

      case 'injuries':
        result = { count: await ingestInjuries(supabase, sport) }
        break

      case 'boxscores':
        result = { count: await ingestStats(supabase, sport, date || new Date().toISOString().split('T')[0]) }
        break

      case 'stats':
        result = { count: await ingestStats(supabase, sport, date || new Date().toISOString().split('T')[0]) }
        break

      case 'props':
        result = await generateProps(supabase, sport, player_id)
        break

      case 'live':
        result = await updateLive(supabase, sport)
        break

      case 'schedule': {
        const sports = sport ? [sport] : ['nba','mlb','nhl','nfl','soccer']
        const date_  = date || new Date().toISOString().split('T')[0]
        let total = 0
        for (const s of sports) {
          total += await ingestGames(supabase, s, date_)
        }
        result = { games_scheduled: total }
        break
      }

      case 'daily': {
        const sports = ['nba','mlb','nhl','nfl','soccer']
        const date_  = new Date().toISOString().split('T')[0]
        const results: any = {}
        for (const s of sports) {
          try {
            const teams   = await ingestTeams(supabase, s)
            const players = await ingestPlayers(supabase, s)
            const games   = await ingestGames(supabase, s, date_)
            const injuries= await ingestInjuries(supabase, s)
            const stats   = await ingestStats(supabase, s, date_)
            const props   = await generateProps(supabase, s)
            results[s] = { teams, players, games, injuries, stats, ...props }
          } catch (e: any) {
            results[s] = { error: e.message }
          }
        }
        result = results
        break
      }

      case 'make_first_admin': {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id').order('created_at').limit(1)
        if (!profiles?.length) throw new Error('No users found')
        await supabase.from('user_roles').upsert(
          { user_id: profiles[0].user_id, role: 'admin' },
          { onConflict: 'user_id,role' }
        )
        result = { message: 'First user promoted to admin', user_id: profiles[0].user_id }
        break
      }

      case 'make_admin': {
        if (!body.email) throw new Error('email required')
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const user = users?.find((u: any) => u.email === body.email)
        if (!user) throw new Error(`User not found: ${body.email}`)
        const { data: profile } = await supabase
          .from('profiles').select('user_id').eq('user_id', user.id).single()
        if (!profile) throw new Error('Profile not found')
        await supabase.from('user_roles').upsert(
          { user_id: user.id, role: 'admin' },
          { onConflict: 'user_id,role' }
        )
        result = { message: `${body.email} is now admin` }
        break
      }

      default:
        throw new Error(`Unknown operation: "${operation}". Valid: full, teams, players, games, injuries, boxscores, stats, props, live, schedule, daily, make_admin, make_first_admin`)
    }

    return new Response(JSON.stringify({ success: true, operation, sport, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('clever-action error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
