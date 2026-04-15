// supabase/functions/clever-action/index.ts
// All sports — soccer powered by api-football.com, others by free APIs
// + Quant Betting Engine: EV detection, Kelly staking, Poisson prediction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────
// 🌐 CORS CONFIG
// ─────────────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

function respond( any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// ─────────────────────────────────────────────────────────────
// 🔐 SUPABASE CLIENT HELPER
// ─────────────────────────────────────────────────────────────
function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ─────────────────────────────────────────────────────────────
// 📐 QUANT HELPERS (NEW - Added for EV/Kelly/Poisson)
// ─────────────────────────────────────────────────────────────
function americanToImpliedProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

function americanToDecimal(odds: number): number {
  if (odds > 0) return (odds / 100) + 1
  return (100 / Math.abs(odds)) + 1
}

function calculateEV(modelProb: number, odds: number): { ev: number; edge: number } {
  const decimalOdds = americanToDecimal(odds)
  const profitPerUnit = decimalOdds - 1
  const ev = (modelProb * profitPerUnit) - ((1 - modelProb) * 1)
  const impliedProb = americanToImpliedProb(odds)
  const edge = modelProb - impliedProb
  return { ev, edge }
}

function calculateKelly(modelProb: number, odds: number, kellyFraction: number = 0.5): number {
  const decimalOdds = americanToDecimal(odds)
  const b = decimalOdds - 1
  const q = 1 - modelProb
  const kelly = (b * modelProb - q) / b
  return Math.max(0, kelly * kellyFraction)
}

function calculatePoissonProbability(avgValue: number, line: number, trendFactor: number = 1.0): number {
  if (!avgValue || avgValue <= 0) return 0.5
  const lambda = avgValue * trendFactor
  let probOver = 0
  const start = Math.floor(line) + 1
  const cap = Math.ceil(lambda * 4)
  for (let k = start; k <= cap; k++) {
    probOver += (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k)
  }
  return Math.min(0.99, Math.max(0.01, probOver))
}

function factorial(n: number): number {
  if (n <= 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

async function buildPlayerFeatures(playerId: string, propType: string, sport: string, supabaseClient: any) {
  const {  logs } = await supabaseClient.from("player_game_logs").select("stats, game_date").eq("player_id", playerId).eq("sport", sport).order("game_date", { ascending: false }).limit(20)
  if (!logs || logs.length < 3) return null
  const values: number[] = []
  for (const log of logs) {
    const s = log.stats
    let val = s?.[propType]
    if (val === undefined) {
      if (propType === "points") val = s?.pts
      else if (propType === "rebounds") val = s?.reb
      else if (propType === "assists") val = s?.ast
      else if (propType === "PRA") val = (s?.pts||0) + (s?.reb||0) + (s?.ast||0)
      else val = 0
    }
    if (typeof val === "number" && val >= 0) values.push(val)
  }
  if (values.length < 3) return null
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const stdDev = (arr: number[], m: number) => Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length)
  const mean = avg(values), std = stdDev(values, mean), cv = mean > 0 ? std / mean : 1
  return {
    avg_l5: avg(values.slice(0, 5)), avg_l10: avg(values.slice(0, 10)), avg_l20: avg(values),
    std_l10: stdDev(values.slice(0, 10), avg(values.slice(0, 10))),
    trend_ratio: avg(values.slice(0, 5)) / avg(values), consistency: 1 - cv, sample_size: values.length
  }
}

// ─────────────────────────────────────────────────────────────
// ⚽ API-FOOTBALL CONFIG (Your existing code - unchanged)
// ─────────────────────────────────────────────────────────────
const AF_BASE = 'https://v3.football.api-sports.io'

function afHeaders() {
  const key = Deno.env.get('API_FOOTBALL_KEY')
  if (!key) throw new Error('Missing API_FOOTBALL_KEY secret')
  return { 'x-apisports-key': key }
}

async function afGet(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${AF_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { 
    headers: afHeaders(),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`api-football ${res.status}: ${path}`)
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`api-football error: ${JSON.stringify(data.errors)}`)
  }
  return data.response ?? []
}

const SOCCER_LEAGUES: Record<string, number> = {
  epl:        39,   // English Premier League
  la_liga:    140,  // La Liga
  bundesliga: 78,   // Bundesliga
  serie_a:    135,  // Serie A
  ligue_1:    61,   // Ligue 1
  ucl:        2,    // Champions League
  mls:        253,  // MLS
}
const SOCCER_SEASON = 2024

// ─────────────────────────────────────────────────────────────
// 🏈 ESPN PATHS & STAT FIELDS (Your existing code - unchanged)
// ─────────────────────────────────────────────────────────────
const ESPN_PATH: Record<string, string> = {
  nba:    'basketball/nba',
  nfl:    'football/nfl',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
}

const STAT_FIELDS: Record<string, string[]> = {
  nba:    ['points','rebounds','assists','steals','blocks','turnovers','three_pointers_made'],
  mlb:    ['hits','runs','rbi','total_bases','home_runs','stolen_bases'],
  nhl:    ['goals','assists_hockey','shots_on_goal'],
  nfl:    ['passing_yards','rushing_yards','receiving_yards','passing_tds','receptions'],
  soccer: ['goals_soccer','assists_soccer','shots_soccer','shots_on_target','tackles'],
}

const COMBOS: Record<string, { name: string; fields: string[] }[]> = {
  nba: [
    { name: 'Pts+Reb',     fields: ['points','rebounds'] },
    { name: 'Pts+Ast',     fields: ['points','assists'] },
    { name: 'Reb+Ast',     fields: ['rebounds','assists'] },
    { name: 'Pts+Reb+Ast', fields: ['points','rebounds','assists'] },
  ],
  mlb:    [{ name: 'H+R+RBI',       fields: ['hits','runs','rbi'] }],
  nhl:    [{ name: 'G+A',           fields: ['goals','assists_hockey'] }],
  nfl:    [
    { name: 'Pass+Rush Yds', fields: ['passing_yards','rushing_yards'] },
    { name: 'Rush+Rec Yds',  fields: ['rushing_yards','receiving_yards'] },
  ],
  soccer: [{ name: 'G+A', fields: ['goals_soccer','assists_soccer'] }],
}

// ─────────────────────────────────────────────────────────────
// 🧮 EXISTING HELPERS (Your existing code - unchanged)
// ─────────────────────────────────────────────────────────────
const roundHalf = (n: number) => Math.round(n / 0.5) * 0.5
const hitRate   = (vals: number[], line: number) =>
  vals.length ? vals.filter(v => v >= line).length / vals.length : 0
const avg = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
const stdDev = (vals: number[]) => {
  if (vals.length < 2) return 0
  const m = avg(vals)
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length)
}
const streak = (vals: number[], line: number) => {
  let s = 0
  for (const v of vals) { if (v >= line) s++; else break }
  return s
}
const pct = (n: number) => Math.round(n * 100)

async function logOp(sb: any, sport: string, op: string, status: string, count = 0, error?: string) {
  await sb.from('ingestion_logs').insert({
    sport, operation: op, status,
    records_processed: count,
    error_message: error || null,
    completed_at: status !== 'running' ? new Date().toISOString() : null,
  }).catch(() => {})
}

// ─────────────────────────────────────────────────────────────
// ⚽ SOCCER FUNCTIONS (Your existing code - FULL, unchanged)
// ─────────────────────────────────────────────────────────────
async function af_fetchTeams(sb: any, leagueKey?: string) {
  const leagues = leagueKey && SOCCER_LEAGUES[leagueKey]
    ? { [leagueKey]: SOCCER_LEAGUES[leagueKey] }
    : SOCCER_LEAGUES

  let total = 0
  for (const [slug, leagueId] of Object.entries(leagues)) {
    try {
      const rows = await afGet('/teams', { league: leagueId, season: SOCCER_SEASON })
      const teams = rows.map((r: any) => ({
        external_id: String(r.team.id),
        sport: 'soccer',
        name: r.team.name,
        abbreviation: r.team.code || r.team.name.slice(0, 3).toUpperCase(),
        city: r.venue?.city || null,
        logo_url: r.team.logo || null,
        conference: slug,
      }))
      if (teams.length) {
        await sb.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
        total += teams.length
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e) { console.error(`af_fetchTeams [${slug}]:`, e) }
  }
  return total
}

async function af_fetchPlayers(sb: any) {
  const { data: teams } = await sb
    .from('teams').select('id,external_id,conference').eq('sport', 'soccer')
  if (!teams?.length) return 0
  let total = 0

  for (const team of teams) {
    try {
      const leagueId = SOCCER_LEAGUES[team.conference] || 39
      const rows = await afGet('/players', {
        team: team.external_id,
        season: SOCCER_SEASON,
        league: leagueId,
      })

      const players = rows.map((r: any) => {
        const p = r.player
        const s = r.statistics?.[0]
        return {
          external_id: String(p.id),
          sport: 'soccer',
          full_name: p.name,
          first_name: p.firstname || null,
          last_name: p.lastname || null,
          team_id: team.id,
          position: s?.games?.position || null,
          jersey_number: p.number ? String(p.number) : null,
          birth_date: p.birth?.date || null,
          headshot_url: p.photo || null,
          height: p.height || null,
          weight: p.weight || null,
          status: 'active',
        }
      })

      if (players.length) {
        await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (e) { console.error(`af_fetchPlayers [${team.external_id}]:`, e) }
  }
  return total
}

async function af_fetchGames(sb: any, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]
  const { data: teams } = await sb
    .from('teams').select('id,external_id').eq('sport', 'soccer')
  const teamMap = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])
  const games: any[] = []

  for (const leagueId of Object.values(SOCCER_LEAGUES)) {
    try {
      const rows = await afGet('/fixtures', { league: leagueId, season: SOCCER_SEASON, date: today })
      for (const f of rows) {
        const fix = f.fixture
        const teams_data = f.teams
        const goals = f.goals

        const statusCode = fix.status?.short
        const status = ['FT','AET','PEN'].includes(statusCode) ? 'finished'
          : ['1H','2H','ET','HT','LIVE'].includes(statusCode) ? 'live'
          : 'upcoming'

        games.push({
          external_id: String(fix.id),
          sport: 'soccer',
          home_team_id: teamMap.get(String(teams_data.home?.id)) || null,
          away_team_id: teamMap.get(String(teams_data.away?.id)) || null,
          game_date: today,
          start_time: fix.date || null,
          status,
          home_score: goals?.home ?? 0,
          away_score: goals?.away ?? 0,
          venue: fix.venue?.name || null,
          season: String(SOCCER_SEASON),
        })
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e) { console.error(`af_fetchGames [league ${leagueId}]:`, e) }
  }

  if (games.length) await sb.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  return games.length
}

async function af_fetchFixtureStats(sb: any, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]
  const { data: games } = await sb
    .from('games_data').select('id,external_id,home_team_id,away_team_id')
    .eq('sport', 'soccer').eq('game_date', today).eq('status', 'finished')
  if (!games?.length) return 0

  const { data: allPlayers } = await sb
    .from('players').select('id,external_id').eq('sport', 'soccer')
  const playerMap = new Map(allPlayers?.map((p: any) => [String(p.external_id), p.id]) || [])
  const { data: allTeams } = await sb
    .from('teams').select('id,external_id').eq('sport', 'soccer')
  const teamExtMap = new Map(allTeams?.map((t: any) => [t.id, String(t.external_id)]) || [])

  let total = 0

  for (const game of games) {
    try {
      const teamDbIds = [game.home_team_id, game.away_team_id].filter(Boolean)
      const statRows: any[] = []

      for (const teamDbId of teamDbIds) {
        const teamExtId = teamExtMap.get(teamDbId)
        if (!teamExtId) continue

        const rows = await afGet('/fixtures/players', {
          fixture: game.external_id,
          team: teamExtId,
        })

        for (const teamData of rows) {
          for (const playerData of (teamData.players || [])) {
            const p = playerData.player
            const s = playerData.statistics?.[0]
            if (!p || !s) continue

            const playerId = playerMap.get(String(p.id))
            if (!playerId) continue

            statRows.push({
              player_id:   playerId,
              game_id:     game.id,
              sport:       'soccer',
              game_date:   today,
              player_name: p.name,
              started:     s.games?.captain !== undefined ? true : (s.games?.minutes > 45),
              minutes_played: s.games?.minutes || 0,
              goals_soccer:    s.goals?.total  || 0,
              assists_soccer:  s.goals?.assists || 0,
              shots_soccer:    s.shots?.total  || 0,
              shots_on_target: s.shots?.on     || 0,
              passes_soccer:   s.passes?.total || 0,
              key_passes:      s.passes?.key   || 0,
              pass_accuracy:   s.passes?.accuracy ? parseFloat(s.passes.accuracy) : null,
              tackles:         s.tackles?.total        || 0,
              interceptions:   s.tackles?.interceptions || 0,
              clearances:      s.tackles?.blocks        || 0,
              fouls_drawn:     s.fouls?.drawn     || 0,
              fouls_committed: s.fouls?.committed || 0,
              yellow_cards:    s.cards?.yellow    || 0,
              red_cards:       s.cards?.red       || 0,
              dribbles_attempted: s.dribbles?.attempts || 0,
              dribbles_success:   s.dribbles?.success  || 0,
              rating: s.games?.rating ? parseFloat(s.games.rating) : null,
            })
          }
        }
        await new Promise(r => setTimeout(r, 400))
      }

      if (statRows.length) {
        await sb.from('player_game_stats').upsert(statRows, { onConflict: 'player_id,game_id' })
        total += statRows.length
      }
    } catch (e) { console.error(`af_fetchFixtureStats [${game.external_id}]:`, e) }
  }
  return total
}

async function af_fetchHistoricalStats(sb: any, leagueKey = 'epl', limit = 10) {
  const leagueId = SOCCER_LEAGUES[leagueKey]
  if (!leagueId) throw new Error(`Unknown league: ${leagueKey}`)

  const rows = await afGet('/fixtures', {
    league: leagueId,
    season: SOCCER_SEASON,
    status: 'FT',
    last: limit,
  })

  const { data: teams } = await sb
    .from('teams').select('id,external_id').eq('sport', 'soccer')
  const teamExtMap = new Map(teams?.map((t: any) => [t.id, String(t.external_id)]) || [])
  const teamIdMap  = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])
  const { data: allPlayers } = await sb
    .from('players').select('id,external_id').eq('sport', 'soccer')
  const playerMap = new Map(allPlayers?.map((p: any) => [String(p.external_id), p.id]) || [])

  let total = 0

  for (const f of rows) {
    const fix     = f.fixture
    const teamsData = f.teams
    const gameDate  = fix.date?.split('T')[0]
    if (!gameDate) continue

    const homeTeamId = teamIdMap.get(String(teamsData.home?.id))
    const awayTeamId = teamIdMap.get(String(teamsData.away?.id))

    const { data: gameRow } = await sb.from('games_data').upsert({
      external_id: String(fix.id), sport: 'soccer',
      home_team_id: homeTeamId || null,
      away_team_id: awayTeamId || null,
      game_date: gameDate, status: 'finished',
      home_score: f.goals?.home ?? 0,
      away_score: f.goals?.away ?? 0,
      season: String(SOCCER_SEASON),
    }, { onConflict: 'sport,external_id' }).select('id').single()

    const gameId = gameRow?.id
    if (!gameId) continue

    for (const teamId of [String(teamsData.home?.id), String(teamsData.away?.id)]) {
      try {
        const playerRows = await afGet('/fixtures/players', {
          fixture: fix.id,
          team: teamId,
        })

        const statRows: any[] = []
        for (const teamData of playerRows) {
          for (const pd of (teamData.players || [])) {
            const p = pd.player
            const s = pd.statistics?.[0]
            if (!p || !s) continue
            const playerId = playerMap.get(String(p.id))
            if (!playerId) continue

            statRows.push({
              player_id: playerId, game_id: gameId,
              sport: 'soccer', game_date: gameDate,
              player_name: p.name,
              minutes_played:    s.games?.minutes || 0,
              goals_soccer:      s.goals?.total  || 0,
              assists_soccer:    s.goals?.assists || 0,
              shots_soccer:      s.shots?.total  || 0,
              shots_on_target:   s.shots?.on     || 0,
              passes_soccer:     s.passes?.total || 0,
              key_passes:        s.passes?.key   || 0,
              tackles:           s.tackles?.total || 0,
              interceptions:     s.tackles?.interceptions || 0,
              fouls_committed:   s.fouls?.committed || 0,
              yellow_cards:      s.cards?.yellow || 0,
              red_cards:         s.cards?.red || 0,
              dribbles_attempted:s.dribbles?.attempts || 0,
              dribbles_success:  s.dribbles?.success  || 0,
              rating: s.games?.rating ? parseFloat(s.games.rating) : null,
            })
          }
        }

        if (statRows.length) {
          await sb.from('player_game_stats').upsert(statRows, { onConflict: 'player_id,game_id' })
          total += statRows.length
        }
        await new Promise(r => setTimeout(r, 400))
      } catch (e) { console.error(`af_historical [fixture ${fix.id}, team ${teamId}]:`, e) }
    }
  }
  return total
}

// ─────────────────────────────────────────────────────────────
// 🏈 NON-SOCCER FUNCTIONS (Your existing code - FULL, with safeFetch)
// ─────────────────────────────────────────────────────────────
async function safeFetch(url: string, options: RequestInit = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'LinePulse/1.0 (Contact: admin@linepulse.app)'
  }
  return fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
    signal: AbortSignal.timeout(10000)
  })
}

async function fetchTeams(sb: any, sport: string) {
  let teams: any[] = []
  if (sport === 'mlb') {
    const r = await safeFetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
    const d = await r.json()
    teams = (d.teams || []).map((t: any) => ({
      external_id: String(t.id), sport,
      name: t.name, abbreviation: t.abbreviation, city: t.locationName || null,
    }))
  } else if (sport === 'nhl') {
    const r = await safeFetch('https://api-web.nhle.com/v1/standings/now')
    const d = await r.json()
    teams = (d.standings || []).map((t: any) => ({
      external_id: t.teamAbbrev?.default, sport,
      name: t.teamName?.default, abbreviation: t.teamAbbrev?.default,
      city: t.placeName?.default || null, logo_url: t.teamLogo || null,
    }))
  } else {
    const r = await safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams?limit=50`)
    const d = await r.json()
    const raw = d.sports?.[0]?.leagues?.[0]?.teams || []
    teams = raw.map((t: any) => ({
      external_id: String(t.team.id), sport,
      name: t.team.displayName, abbreviation: t.team.abbreviation,
      city: t.team.location || null, logo_url: t.team.logos?.[0]?.href || null,
    }))
  }
  if (teams.length) await sb.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  return teams.length
}

async function fetchPlayers(sb: any, sport: string) {
  const { data: teams } = await sb
    .from('teams').select('id,external_id,abbreviation').eq('sport', sport)
  if (!teams?.length) return 0
  let total = 0

  for (const team of teams) {
    try {
      let players: any[] = []
      if (sport === 'mlb') {
        const r = await safeFetch(`https://statsapi.mlb.com/api/v1/teams/${team.external_id}/roster?rosterType=active`)
        const d = await r.json()
        players = (d.roster || []).map((p: any) => ({
          external_id: String(p.person.id), sport,
          full_name: p.person.fullName, team_id: team.id,
          position: p.position?.abbreviation || null, status: 'active',
        }))
      } else if (sport === 'nhl') {
        const r = await safeFetch(`https://api-web.nhle.com/v1/roster/${team.abbreviation || team.external_id}/current`)
        const d = await r.json()
        const all = [...(d.forwards||[]),...(d.defensemen||[]),...(d.goalies||[])]
        players = all.map((p: any) => ({
          external_id: String(p.id), sport,
          full_name: `${p.firstName?.default||''} ${p.lastName?.default||''}`.trim(),
          team_id: team.id, position: p.positionCode || null,
          headshot_url: p.headshot || null, status: 'active',
        }))
      } else {
        const r = await safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${team.external_id}/roster`)
        const d = await r.json()
        const flat = Array.isArray(d.athletes)
          ? d.athletes.flatMap((g: any) => Array.isArray(g.items) ? g.items : [g])
          : []
        players = flat.map((a: any) => ({
          external_id: String(a.id), sport,
          full_name: a.fullName || a.displayName,
          team_id: team.id, position: a.position?.abbreviation || null,
          headshot_url: a.headshot?.href || null, status: 'active',
        }))
      }
      if (players.length) {
        await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 200))
    } catch (e) { console.error(`fetchPlayers [${sport}/${team.external_id}]:`, e) }
  }
  return total
}

async function fetchGames(sb: any, sport: string, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]
  const { data: teams } = await sb
    .from('teams').select('id,external_id,abbreviation').eq('sport', sport)
  const teamMap = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])
  const games: any[] = []

  if (sport === 'mlb') {
    const r = await safeFetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`)
    const d = await r.json()
    for (const day of (d.dates || [])) for (const g of (day.games || [])) {
      const status = g.status?.abstractGameState === 'Final' ? 'finished'
        : g.status?.abstractGameState === 'Live' ? 'live' : 'upcoming'
      games.push({
        external_id: String(g.gamePk), sport,
        home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
        away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
        game_date: today, start_time: g.gameDate || null, status,
        home_score: g.teams?.home?.score || 0, away_score: g.teams?.away?.score || 0,
      })
    }
  } else if (sport === 'nhl') {
    const r = await safeFetch(`https://api-web.nhle.com/v1/schedule/${today}`)
    const d = await r.json()
    for (const g of (d.gameWeek?.[0]?.games || [])) {
      const gs = g.gameState
      const status = gs==='OFF'?'finished':gs==='LIVE'||gs==='CRIT'?'live':'upcoming'
      games.push({
        external_id: String(g.id), sport,
        home_team_id: teamMap.get(g.homeTeam?.abbrev)||null,
        away_team_id: teamMap.get(g.awayTeam?.abbrev)||null,
        game_date: today, status,
        home_score: g.homeTeam?.score||0, away_score: g.awayTeam?.score||0,
      })
    }
  } else {
    const fmt = today.replace(/-/g, '')
    let gamesData = []
    try {
      const endpoints = [
        `https://www.balldontlie.io/api/v1/games?start_date=${today}&end_date=${today}&per_page=25`,
        `https://api.balldontlie.io/api/v1/games?start_date=${today}&end_date=${today}&per_page=25`
      ]
      for (const url of endpoints) {
        const r = await safeFetch(url)
        if (r.ok) {
          const d = await r.json()
          gamesData = d.data || []
          break
        }
      }
    } catch (e) {
      console.log(`balldontlie.io failed for ${sport}, falling back to ESPN`)
    }
    
    if (gamesData.length === 0) {
      const r = await safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/scoreboard?dates=${fmt}`)
      const d = await r.json()
      gamesData = (d.events || []).map((ev: any) => {
        const comp = ev.competitions?.[0]
        const home = comp?.competitors?.find((c: any) => c.homeAway==='home')
        const away = comp?.competitors?.find((c: any) => c.homeAway==='away')
        return {
          id: ev.id,
          date: ev.date,
          status: comp?.status,
          home_team: home?.team,
          away_team: away?.team,
          home_score: parseInt(home?.score||'0'),
          away_score: parseInt(away?.score||'0')
        }
      })
    }
    
    for (const g of gamesData) {
      const st = g.status?.type?.name || g.status?.short
      const status = st==='STATUS_FINAL'||st==='FT'?'finished':st==='STATUS_IN_PROGRESS'||st==='LIVE'?'live':'upcoming'
      games.push({
        external_id: String(g.id), sport,
        home_team_id: teamMap.get(String(g.home_team?.id))||null,
        away_team_id: teamMap.get(String(g.away_team?.id))||null,
        game_date: today, start_time: g.date||null, status,
        home_score: g.home_score||0, away_score: g.away_score||0,
        current_period: g.status?.period ? String(g.status.period) : null,
        time_remaining: g.status?.displayClock||null, venue: g.venue?.fullName||null,
      })
    }
  }

  if (games.length) await sb.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  return games.length
}

async function fetchHistoricalStats(sb: any, sport: string) {
  const { data: players } = await sb
    .from('players').select('id,external_id,position').eq('sport', sport).limit(500)
  if (!players?.length) return 0

  let total = 0

  for (const player of players) {
    try {
      let statRows: any[] = []

      if (sport === 'nba') {
        const endpoints = [
          `https://www.balldontlie.io/api/v1/stats?player_ids[]=${player.external_id}&seasons[]=2024&per_page=20`,
          `https://api.balldontlie.io/api/v1/stats?player_ids[]=${player.external_id}&seasons[]=2024&per_page=20`
        ]
        let r, d
        for (const url of endpoints) {
          r = await safeFetch(url)
          if (r.ok) {
            d = await r.json()
            break
          }
        }
        if (!r?.ok) continue
        for (const g of (d.data || [])) {
          statRows.push({
            player_id: player.id, sport,
            game_date: g.game?.date?.split('T')[0],
            points: g.pts||0, rebounds: g.reb||0, assists: g.ast||0,
            steals: g.stl||0, blocks: g.blk||0, turnovers: g.turnover||0,
            three_pointers_made: g.fg3m||0, minutes_played: parseFloat(g.min||'0')||0,
            player_name: `${g.player?.first_name||''} ${g.player?.last_name||''}`.trim(),
          })
        }
      } else if (sport === 'mlb') {
        const isPitcher = ['SP','RP','P'].includes(player.position||'')
        const group = isPitcher ? 'pitching' : 'hitting'
        const r = await safeFetch(`https://statsapi.mlb.com/api/v1/people/${player.external_id}/stats?stats=gameLog&season=2025&group=${group}`)
        if (!r.ok) continue
        const d = await r.json()
        for (const sp of (d.stats?.[0]?.splits||[]).slice(0,20)) {
          const st = sp.stat||{}
          statRows.push({
            player_id: player.id, sport,
            game_date: sp.date?.split('T')[0]||sp.date,
            hits: st.hits||0, runs: st.runs||0, rbi: st.rbi||0,
            total_bases: st.totalBases||0, home_runs: st.homeRuns||0,
            stolen_bases: st.stolenBases||0,
            strikeouts_pitching: st.strikeOuts||0,
            hits_allowed: isPitcher ? st.hits||0 : 0,
          })
        }
      } else if (sport === 'nhl') {
        const r = await safeFetch(`https://api-web.nhle.com/v1/player/${player.external_id}/game-log/20242025/2`)
        if (!r.ok) continue
        const d = await r.json()
        for (const g of (d.gameLog||[]).slice(0,20)) {
          statRows.push({
            player_id: player.id, sport,
            game_date: g.gameDate,
            goals: g.goals||0, assists_hockey: g.assists||0,
            shots_on_goal: g.shots||0, plus_minus: g.plusMinus||0,
          })
        }
      } else if (sport === 'nfl') {
        const r = await safeFetch(`https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.external_id}/gamelog`)
        if (!r.ok) continue
        const d = await r.json()
        const events = d.events || {}
        for (const ev of Object.values(events as any)) {
          const stats: any = {}
          for (const cat of ((ev as any).categories||[])) {
            for (let i=0; i<(cat.names||[]).length; i++) stats[cat.names[i]] = cat.totals?.[i]??0
          }
          statRows.push({
            player_id: player.id, sport,
            game_date: (ev as any).gameDate?.split('T')[0],
            passing_yards: parseFloat(stats['passingYards']||'0')||0,
            rushing_yards: parseFloat(stats['rushingYards']||'0')||0,
            receiving_yards: parseFloat(stats['receivingYards']||'0')||0,
            passing_tds: parseInt(stats['passingTouchdowns']||'0')||0,
            receptions: parseInt(stats['receptions']||'0')||0,
          })
          if (statRows.length >= 20) break
        }
      }

      if (statRows.length) {
        await sb.from('player_game_stats').upsert(statRows, {
          onConflict: 'player_id,game_date', ignoreDuplicates: false,
        }).catch(async () => {
          await sb.from('player_game_stats').insert(statRows).catch(() => {})
        })
        total += statRows.length
      }
      await new Promise(r => setTimeout(r, 150))
    } catch (e) { console.error(`fetchHistoricalStats [${sport}/${player.external_id}]:`, e) }
  }
  return total
}

async function fetchBoxScores(sb: any, sport: string, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]
  const { data: games } = await sb
    .from('games_data').select('id,external_id')
    .eq('sport', sport).eq('game_date', today).in('status',['finished','live'])
  if (!games?.length) return 0

  const { data: allPlayers } = await sb
    .from('players').select('id,external_id').eq('sport', sport)
  const playerMap = new Map(allPlayers?.map((p: any) => [String(p.external_id), p.id]) || [])
  let total = 0

  for (const game of games) {
    try {
      const path = ESPN_PATH[sport]
      const r = await safeFetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${game.external_id}`)
      if (!r.ok) continue
      const data = await r.json()
      const rows: any[] = []

      for (const teamBox of (data.boxscore?.players||[])) {
        for (const sg of (teamBox.statistics||[])) {
          const labels: string[] = sg.labels||[]
          for (const athlete of (sg.athletes||[])) {
            const pid = playerMap.get(String(athlete.athlete?.id))
            if (!pid) continue
            const s = athlete.stats||[]
            const row: any = {
              player_id: pid, game_id: game.id, sport,
              game_date: today, player_name: athlete.athlete?.displayName,
              team_abbreviation: teamBox.team?.abbreviation, started: athlete.starter||false,
            }
            labels.forEach((lbl: string, i: number) => {
              const raw = s[i]; if (raw===undefined||raw==='--') return
              const n = parseFloat(String(raw).replace(/[^0-9.\-]/g,''))||0
              if (sport==='nba') {
                if (lbl==='PTS') row.points=n; if (lbl==='REB') row.rebounds=n
                if (lbl==='AST') row.assists=n; if (lbl==='STL') row.steals=n
                if (lbl==='BLK') row.blocks=n;  if (lbl==='TO')  row.turnovers=n
                if (lbl==='MIN') row.minutes_played=n
                if (lbl==='3PT'){const[m,a]=String(raw).split('-');row.three_pointers_made=parseInt(m)||0;row.three_pointers_attempted=parseInt(a)||0}
                if (lbl==='FG'){const[m,a]=String(raw).split('-');row.field_goals_made=parseInt(m)||0;row.field_goals_attempted=parseInt(a)||0}
              } else if (sport==='nfl') {
                const cat = sg.name?.toLowerCase()||''
                if (cat.includes('pass')){ if(lbl==='YDS')row.passing_yards=n; if(lbl==='TD')row.passing_tds=n }
                if (cat.includes('rush')){ if(lbl==='YDS')row.rushing_yards=n; if(lbl==='TD')row.rushing_tds=n }
                if (cat.includes('receiv')){ if(lbl==='YDS')row.receiving_yards=n; if(lbl==='REC')row.receptions=n }
              } else if (sport==='mlb') {
                if(lbl==='H')row.hits=n; if(lbl==='R')row.runs=n; if(lbl==='RBI')row.rbi=n
                if(lbl==='HR')row.home_runs=n; if(lbl==='TB')row.total_bases=n
              } else if (sport==='nhl') {
                if(lbl==='G')row.goals=n; if(lbl==='A')row.assists_hockey=n; if(lbl==='SOG')row.shots_on_goal=n
              }
            })
            rows.push(row)
          }
        }
      }
      if (rows.length) {
        await sb.from('player_game_stats').upsert(rows, { onConflict: 'player_id,game_id' })
        total += rows.length
      }
      await new Promise(r => setTimeout(r, 250))
    } catch (e) { console.error(`fetchBoxScores [${sport}/${game.external_id}]:`, e) }
  }
  return total
}

// ─────────────────────────────────────────────────────────────
// 🎯 PROPS ENGINE & GET PLAYERS (Your existing code - FULL)
// ─────────────────────────────────────────────────────────────
async function computeProps(sb: any, sport: string, player_id?: string) {
  const statFields = STAT_FIELDS[sport] || []
  const combos     = COMBOS[sport] || []

  let q = sb.from('players').select('id,full_name,position').eq('sport', sport)
  if (player_id) q = q.eq('id', player_id)
  const { data: players } = await q.limit(500)
  if (!players?.length) return { players_processed: 0, props_generated: 0 }

  const allProps: any[] = []

  for (const player of players) {
    const { data: logs } = await sb.from('player_game_stats')
      .select(['game_date',...statFields].join(','))
      .eq('player_id', player.id)
      .order('game_date', { ascending: false }).limit(20)
    if (!logs || logs.length < 3) continue

    const buildProp = (values: number[], statName: string, isCombo: boolean) => {
      if (values.length < 3) return null
      const l5  = values.slice(0,5);  const l10 = values.slice(0,10)
      const l15 = values.slice(0,15); const l20 = values.slice(0,20)
      const a5=avg(l5); const a10=avg(l10); const a20=avg(l20)
      const proj = a5*0.5 + a10*0.3 + a20*0.2
      const line = roundHalf(proj)
      const hr5=hitRate(l5,line); const hr10=hitRate(l10,line); const hr20=hitRate(l20,line)
      const sd=stdDev(l20)
      const trend = a5>a20*1.05?'up':a5<a20*0.95?'down':'stable'
      const strk  = streak(values, line)
      const edge  = proj>line*1.08?'OVER':proj<line*0.92?'UNDER':'NONE'
      const conf  = Math.min(1,Math.max(0,
        hr20*0.3 + (trend==='up'?0.2:trend==='down'?-0.1:0.05) +
        (1-Math.min(sd/(a20||1),1))*0.3 + (values.length/20)*0.2
      ))
      return {
        player_id: player.id, sport, player_name: player.full_name,
        stat_type: statName, is_combo: isCombo,
        projected_value: Math.round(proj*100)/100, baseline_line: line,
        hit_rate_last5:  Math.round(hr5*100)/100,
        hit_rate_last10: Math.round(hr10*100)/100,
        hit_rate_last20: Math.round(hr20*100)/100,
        avg_last5: Math.round(a5*100)/100,
        avg_last10: Math.round(a10*100)/100,
        avg_last20: Math.round(a20*100)/100,
        trend, consistency: Math.round(sd*100)/100,
        edge_type: edge, confidence_score: Math.round(conf*100)/100,
        last_updated: new Date().toISOString(),
      }
    }

    for (const field of statFields) {
      const vals = logs.map((g: any) => Number(g[field]??0))
      const p = buildProp(vals, field, false); if (p) allProps.push(p)
    }
    for (const combo of combos) {
      const vals = logs.map((g: any) =>
        combo.fields.reduce((acc: number, f: string) => acc + Number(g[f]??0), 0))
      const p = buildProp(vals, combo.name, true); if (p) allProps.push(p)
    }
  }

  if (player_id) await sb.from('player_props').delete().eq('player_id', player_id)
  else           await sb.from('player_props').delete().eq('sport', sport)

  for (let i=0; i<allProps.length; i+=500) {
    const { error } = await sb.from('player_props').insert(allProps.slice(i,i+500))
    if (error) console.error('Props insert error:', error)
  }
  return { players_processed: players.length, props_generated: allProps.length }
}

async function getPlayers(sb: any, sport: string) {
  const { data: preProps } = await sb.from('player_props')
    .select('*').eq('sport', sport)
    .order('confidence_score', { ascending: false, nullsFirst: false }).limit(2000)

  const { data: players } = await sb.from('players')
    .select('id,full_name,position,team_id,teams:team_id(name,abbreviation)').eq('sport', sport).limit(300)
  if (!players?.length) return []

  const today = new Date().toISOString().split('T')[0]
  const { data: todayGames } = await sb.from('games_data')
    .select('home_team_id,away_team_id').eq('sport', sport).eq('game_date', today)

  const oppMap = new Map<string,string>()
  for (const g of (todayGames||[])) {
    if (g.home_team_id) oppMap.set(g.home_team_id, g.away_team_id)
    if (g.away_team_id) oppMap.set(g.away_team_id, g.home_team_id)
  }
  const oppIds = [...new Set([...oppMap.values()].filter(Boolean))]
  const { data: oppTeams } = oppIds.length
    ? await sb.from('teams').select('id,abbreviation').in('id', oppIds)
    : { data: [] }
  const oppAbbrMap = new Map(oppTeams?.map((t: any) => [t.id, t.abbreviation])||[])

  if (preProps?.length) {
    const byPlayer = new Map<string,any[]>()
    for (const p of preProps) {
      if (!byPlayer.has(p.player_id)) byPlayer.set(p.player_id, [])
      byPlayer.get(p.player_id)!.push(p)
    }
    const result: any[] = []
    for (const player of players) {
      const props = byPlayer.get(player.id)||[]
      const oppId = oppMap.get(player.team_id)
      const opponent = oppId ? oppAbbrMap.get(oppId)||'TBD' : 'TBD'
      for (const prop of props) {
        result.push({
          id: `${player.id}_${prop.stat_type}`,
          player_id: player.id,
          name: player.full_name, position: player.position||'N/A',
          team: player.teams?.name, team_abbr: player.teams?.abbreviation,
          opponent, prop_type: prop.stat_type, is_combo: prop.is_combo,
          line: prop.baseline_line, avg_last10: prop.avg_last10,
          diff: Math.round((prop.avg_last10 - prop.baseline_line)*10)/10,
          l5: pct(prop.hit_rate_last5), l10: pct(prop.hit_rate_last10),
          l15: pct(prop.hit_rate_last20), l20: pct(prop.hit_rate_last20),
          streak: 0, edge_type: prop.edge_type, trend: prop.trend,
          confidence: Math.round((prop.confidence_score||0)*100),
        })
      }
    }
    return result
  }

  const statFields = STAT_FIELDS[sport]||[]
  const { data: allStats } = await sb.from('player_game_stats')
    .select(`player_id,game_date,${statFields.join(',')}`)
    .eq('sport', sport).order('game_date', { ascending: false })

  const logsByPlayer = new Map<string,any[]>()
  allStats?.forEach((s: any) => {
    if (!logsByPlayer.has(s.player_id)) logsByPlayer.set(s.player_id, [])
    logsByPlayer.get(s.player_id)!.push(s)
  })

  const result: any[] = []
  for (const player of players) {
    const logs = logsByPlayer.get(player.id)||[]
    const oppId = oppMap.get(player.team_id)
    const opponent = oppId ? oppAbbrMap.get(oppId)||'TBD' : 'TBD'
    for (const field of statFields) {
      const vals = logs.map((g: any) => Number(g[field]??0))
      if (!vals.length) continue
      const l10 = vals.slice(0,10); const a10 = avg(l10)
      const line = roundHalf(a10)
      result.push({
        id: `${player.id}_${field}`, player_id: player.id,
        name: player.full_name, position: player.position||'N/A',
        team: player.teams?.name, team_abbr: player.teams?.abbreviation,
        opponent, prop_type: field, is_combo: false, line,
        avg_last10: Math.round(a10*10)/10,
        diff: Math.round((a10-line)*10)/10,
        l5:  pct(hitRate(vals.slice(0,5),  line)),
        l10: pct(hitRate(vals.slice(0,10), line)),
        l15: pct(hitRate(vals.slice(0,15), line)),
        l20: pct(hitRate(vals.slice(0,20), line)),
        streak: streak(vals, line), edge_type: 'NONE', trend: 'stable', confidence: 50,
      })
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// 🚀 MAIN HANDLER (Your existing switch + NEW quant operations)
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const sb   = getSB()
    const body = await req.json().catch(() => ({}))
    const { operation, sport, date, player_id, league, bankroll = 1000, min_edge = 0.03 } = body
    console.log(`[clever-action] op=${operation} sport=${sport} league=${league} date=${date}`)

    switch (operation) {
      // ── YOUR EXISTING OPERATIONS (unchanged) ───────────────
      case 'soccer_teams':
        return respond({ success: true, count: await af_fetchTeams(sb, league) })

      case 'soccer_players':
        return respond({ success: true, count: await af_fetchPlayers(sb) })

      case 'soccer_games':
        return respond({ success: true, count: await af_fetchGames(sb, date) })

      case 'soccer_fixture_stats':
        return respond({ success: true, count: await af_fetchFixtureStats(sb, date) })

      case 'soccer_historical': {
        const count = await af_fetchHistoricalStats(sb, league||'epl', 10)
        return respond({ success: true, count })
      }

      case 'soccer_full': {
        await logOp(sb, 'soccer', 'soccer_full', 'running')
        const teams   = await af_fetchTeams(sb, league)
        const players = await af_fetchPlayers(sb)
        const games   = await af_fetchGames(sb, date)
        const stats   = await af_fetchFixtureStats(sb, date)
        const history = await af_fetchHistoricalStats(sb, league||'epl', 10)
        const props   = await computeProps(sb, 'soccer')
        await logOp(sb, 'soccer', 'soccer_full', 'completed', teams+players+games+stats+history)
        return respond({ success: true, teams, players, games, fixture_stats: stats, historical_stats: history, props_generated: props.props_generated })
      }

      case 'full': {
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        if (sport === 'soccer') {
          const teams   = await af_fetchTeams(sb)
          const players = await af_fetchPlayers(sb)
          const games   = await af_fetchGames(sb, date)
          const history = await af_fetchHistoricalStats(sb, league||'epl', 10)
          const props   = await computeProps(sb, 'soccer')
          return respond({ success: true, teams, players, games, historical_stats: history, ...props })
        }
        await logOp(sb, sport, 'full', 'running')
        const teams   = await fetchTeams(sb, sport)
        const players = await fetchPlayers(sb, sport)
        const games   = await fetchGames(sb, sport, date)
        const history = await fetchHistoricalStats(sb, sport)
        const props   = await computeProps(sb, sport)
        await logOp(sb, sport, 'full', 'completed', teams+players+games+history)
        return respond({ success: true, teams, players, games, historical_stats: history, props_generated: props.props_generated })
      }

      case 'teams':
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        return respond({ success: true, count: sport==='soccer' ? await af_fetchTeams(sb,league) : await fetchTeams(sb,sport) })

      case 'players':
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        return respond({ success: true, count: sport==='soccer' ? await af_fetchPlayers(sb) : await fetchPlayers(sb,sport) })

      case 'games':
        return respond({ success: true, count: sport==='soccer' ? await af_fetchGames(sb,date) : await fetchGames(sb,sport,date) })

      case 'historical_stats':
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        return respond({ success: true,
          count: sport==='soccer'
            ? await af_fetchHistoricalStats(sb, league||'epl', 10)
            : await fetchHistoricalStats(sb, sport)
        })

      case 'boxscores':
        return respond({ success: true,
          count: sport==='soccer'
            ? await af_fetchFixtureStats(sb, date)
            : await fetchBoxScores(sb, sport, date)
        })

      case 'props':
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        return respond({ success: true, ...(await computeProps(sb, sport, player_id)) })

      case 'get_players':
        if (!sport) return respond({ success: false, error: 'sport required' }, 400)
        const players = await getPlayers(sb, sport)
        return respond({ success: true, players, count: players.length, sport })

      case 'live': {
        const sports = sport ? [sport] : ['nba','mlb','nhl','nfl']
        let total = 0
        for (const s of sports) {
          total += await fetchGames(sb, s, date)
          total += await fetchBoxScores(sb, s, date)
        }
        if (!sport || sport==='soccer') total += await af_fetchGames(sb, date)
        if (!sport || sport==='soccer') total += await af_fetchFixtureStats(sb, date)
        return respond({ success: true, records_updated: total })
      }

      case 'schedule': {
        const sports = sport ? [sport] : ['nba','mlb','nhl','nfl','soccer']
        let total = 0
        for (const s of sports) {
          if (s==='soccer') total += await af_fetchGames(sb, date)
          else              total += await fetchGames(sb, s, date)
        }
        return respond({ success: true, games_scheduled: total })
      }

      case 'daily': {
        const results: any = {}
        for (const s of ['nba','mlb','nhl','nfl']) {
          try {
            const t = await fetchTeams(sb,s); const p = await fetchPlayers(sb,s)
            const g = await fetchGames(sb,s,date); const h = await fetchHistoricalStats(sb,s)
            const pr = await computeProps(sb,s)
            results[s] = { teams:t, players:p, games:g, history:h, ...pr }
          } catch(e:any) { results[s] = { error: e.message } }
        }
        try {
          const t = await af_fetchTeams(sb); const p = await af_fetchPlayers(sb)
          const g = await af_fetchGames(sb,date)
          const h = await af_fetchHistoricalStats(sb,'epl',10)
          const pr = await computeProps(sb,'soccer')
          results.soccer = { teams:t, players:p, games:g, history:h, ...pr }
        } catch(e:any) { results.soccer = { error: e.message } }
        return respond({ success: true, results })
      }

      case 'make_first_admin': {
        const { data: profiles } = await sb.from('profiles').select('user_id').order('created_at').limit(1)
        if (!profiles?.length) return respond({ success: false, error: 'No users found' })
        await sb.from('user_roles').upsert({ user_id: profiles[0].user_id, role: 'admin' }, { onConflict: 'user_id,role' })
        return respond({ success: true, message: 'First user promoted to admin' })
      }

      case 'make_admin': {
        if (!body.email) return respond({ success: false, error: 'email required' }, 400)
        const { data: { users } } = await sb.auth.admin.listUsers()
        const user = users?.find((u: any) => u.email === body.email)
        if (!user) return respond({ success: false, error: `User not found: ${body.email}` })
        await sb.from('user_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' })
        return respond({ success: true, message: `${body.email} is now admin` })
      }

      case 'health': {
        const counts: any = {}
        for (const t of ['teams','players','games_data','player_game_stats','player_props']) {
          const { count } = await sb.from(t).select('*',{count:'exact',head:true})
          counts[t] = count||0
        }
        const remaining = await afGet('/status').catch(() => null)
        if (remaining) counts.api_football_requests_remaining = remaining[0]?.requests?.limit_day - remaining[0]?.requests?.current || 'unknown'
        return respond({ success: true, ...counts })
      }

      case 'test':
        return respond({ success: true, message: 'clever-action alive!', ts: new Date().toISOString() })

      // ── 🆕 NEW QUANT OPERATIONS (ADDED HERE) ───────────────

      case 'predict_prop': {
        const { player_id, prop_type, line } = body
        if (!player_id || !prop_type || line === undefined) return respond({ success: false, error: "Missing required params: player_id, prop_type, line" }, 400)
        
        const {  cached } = await sb.from("feature_cache").select("features, valid_until").eq("player_id", player_id).eq("sport", sport).eq("prop_type", prop_type).gte("valid_until", new Date().toISOString()).maybeSingle()
        
        let features
        if (cached) {
          features = cached.features
        } else {
          features = await buildPlayerFeatures(player_id, prop_type, sport, sb)
          if (features) {
            await sb.from("feature_cache").upsert({ player_id, sport, prop_type, features, valid_until: new Date(Date.now() + 3600000).toISOString() })
          }
        }
        
        if (!features) return respond({ success: false, error: "Not enough historical data" }, 404)
        
        const probability = calculatePoissonProbability(features.avg_l10, line, features.trend_ratio)
        const confidence = Math.min(0.95, 0.5 + (features.consistency || 0.5) * 0.3)
        
        return respond({ success: true, probability, confidence, features_used: features })
      }

      case 'ev_scan': {
        if (!sport) return respond({ success: false, error: "sport required" }, 400)
        
        const props = await getPlayers(sb, sport)
        if (!props?.length) return respond({ success: true, opportunities: [], message: "No props found" })
        
        const opportunities = []
        for (const prop of props) {
          const features = await buildPlayerFeatures(prop.player_id, prop.prop_type, sport, sb)
          const modelProb = features ? calculatePoissonProbability(features.avg_l10, prop.line, features.trend_ratio) : 0.5
          const exampleOdds = -110
          const { ev, edge } = calculateEV(modelProb, exampleOdds)
          
          if (Math.abs(edge) >= min_edge) {
            const kellyStake = calculateKelly(modelProb, exampleOdds) * bankroll
            opportunities.push({
              ...prop,
              model_probability: modelProb,
              edge_pct: (edge * 100).toFixed(1),
              ev: ev.toFixed(3),
              kelly_stake: (kellyStake).toFixed(2),
              confidence: (modelProb * 100).toFixed(0)
            })
          }
        }
        
        opportunities.sort((a, b) => parseFloat(b.ev) - parseFloat(a.ev))
        return respond({ success: true, opportunities: opportunities.slice(0, 20), count: opportunities.length })
      }

      case 'place_bet': {
        const { player_name, prop_type, side, line, odds, stake, bankroll_before, edge_pct, ev, kelly_stake_pct, bookmaker } = body
        if (!player_name || !prop_type || !side || line === undefined || odds === undefined) {
          return respond({ success: false, error: "Missing required bet params" }, 400)
        }
        
        const {  bet, error } = await sb.from("bet_tracking").insert({
          player_name, sport: sport || "nba", prop_type, side, line, odds,
          stake_amount: stake, bankroll_before, outcome: "pending",
          edge_pct: edge_pct ? parseFloat(edge_pct) : null,
          ev: ev ? parseFloat(ev) : null,
          kelly_stake_pct: kelly_stake_pct ? parseFloat(kelly_stake_pct) : null,
          bookmaker: bookmaker || "Consensus"
        }).select().single()
        
        if (error) return respond({ success: false, error: error.message }, 500)
        return respond({ success: true, bet_id: bet.id })
      }

      case 'settle_bet': {
        const { bet_id, outcome, profit, bankroll_after } = body
        if (!bet_id || !outcome || profit === undefined) {
          return respond({ success: false, error: "Missing required settle params" }, 400)
        }
        
        const {  updated, error } = await sb.from("bet_tracking").update({
          outcome, profit, bankroll_after, settled_at: new Date().toISOString()
        }).eq("id", bet_id).select().single()
        
        if (error) return respond({ success: false, error: error.message }, 500)
        return respond({ success: true, bet: updated })
      }

      case 'run_backtest': {
        const { start_date, end_date } = body
        if (!sport || !start_date || !end_date) {
          return respond({ success: false, error: "Missing required backtest params" }, 400)
        }
        
        const {  results, error } = await sb.rpc("calculate_backtest_metrics", {
          p_sport: sport, p_start_date: start_date, p_end_date: end_date
        })
        
        if (error) return respond({ success: false, error: error.message }, 500)
        
        await sb.from("backtest_results").insert({
          sport, start_date, end_date,
          total_bets: results?.[0]?.total_bets || 0,
          win_rate: results?.[0]?.win_rate || 0,
          roi: results?.[0]?.roi || 0,
          sharpe_ratio: results?.[0]?.sharpe_ratio || 0,
          max_drawdown: results?.[0]?.max_drawdown || 0,
          clv_beat_rate: results?.[0]?.clv_beat_rate || 0,
          final_bankroll: results?.[0]?.final_bankroll || 0,
          metrics: results?.[0] || {}
        })
        
        return respond({ success: true, metrics: results?.[0] || {} })
      }

      // ── DEFAULT: Unknown operation ─────────────────────────
      default:
        return respond({
          success: false, error: `Unknown operation: "${operation}"`,
          valid_operations: [
            'full','teams','players','games','historical_stats','boxscores','props','get_players',
            'soccer_full','soccer_teams','soccer_players','soccer_games','soccer_fixture_stats','soccer_historical',
            'live','schedule','daily','health','test','make_admin','make_first_admin',
            'predict_prop','ev_scan','place_bet','settle_bet','run_backtest'
          ]
        }, 400)
    }
  } catch (e: any) {
    console.error('[clever-action] fatal:', e)
    return respond({ success: false, error: e.message }, 500)
  }
})
