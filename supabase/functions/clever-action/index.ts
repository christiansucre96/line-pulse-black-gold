// supabase/functions/clever-action/index.ts
// Complete – stats, props, betting lines (OVER/UNDER)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSB() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

const ESPN_PATH: Record<string, string> = {
  nba:    'basketball/nba',
  nfl:    'football/nfl',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/eng.1',
}

// Helper: normal distribution (Box‑Muller)
function normalRandom(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

// =======================
// FETCH TEAMS
// =======================
async function fetchTeams(sb: any, sport: string) {
  let teams: any[] = []
  if (sport === 'mlb') {
    const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
    const data = await res.json()
    teams = data.teams.map((t: any) => ({
      external_id: String(t.id), sport,
      name: t.name, abbreviation: t.abbreviation,
    }))
  } else {
    const path = ESPN_PATH[sport]
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams`)
    const data = await res.json()
    teams = data.sports[0].leagues[0].teams.map((t: any) => ({
      external_id: t.team.id, sport,
      name: t.team.displayName, abbreviation: t.team.abbreviation,
    }))
  }
  if (teams.length) await sb.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  return teams.length
}

// =======================
// FETCH PLAYERS
// =======================
async function fetchPlayers(sb: any, sport: string) {
  const { data: teams } = await sb.from('teams').select('id,external_id').eq('sport', sport)
  if (!teams?.length) return 0
  let total = 0
  const path = ESPN_PATH[sport]
  for (const team of teams) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team.external_id}/roster`)
      const data = await res.json()
      const players = (data.athletes || []).map((p: any) => ({
        external_id: p.id, sport,
        full_name: p.fullName, team_id: team.id,
      }))
      if (players.length) {
        await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
    } catch (e) { console.error(`Player error for team ${team.external_id}:`, e) }
  }
  return total
}

// =======================
// FETCH GAMES
// =======================
async function fetchGames(sb: any, sport: string) {
  const path = ESPN_PATH[sport]
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`)
  const data = await res.json()
  const games = (data.events || []).map((g: any) => ({
    external_id: g.id, sport,
    game_date: new Date(g.date).toISOString().split('T')[0],
  }))
  if (games.length) await sb.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  return games.length
}

// =======================
// GENERATE STATS (integer points)
// =======================
async function generateStats(sb: any, sport: string) {
  const { data: players } = await sb.from('players').select('id').eq('sport', sport)
  if (!players?.length) return 0

  const stats = []
  let mean = 20, std = 6
  if (sport === 'nfl') { mean = 220; std = 40 }
  if (sport === 'mlb') { mean = 2; std = 1.2 }
  if (sport === 'nhl') { mean = 0.8; std = 0.5 }
  if (sport === 'soccer') { mean = 0.7; std = 0.4 }

  for (const player of players) {
    for (let i = 0; i < 20; i++) {
      let points = normalRandom(mean, std)
      points = Math.max(0, Math.round(points))
      stats.push({
        player_id: player.id,
        game_date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        sport,
        points: points,
        rebounds: Math.floor(Math.random() * 10),
        assists: Math.floor(Math.random() * 8),
        steals: Math.floor(Math.random() * 3),
        blocks: Math.floor(Math.random() * 2),
      })
    }
  }

  let inserted = 0
  for (let i = 0; i < stats.length; i += 500) {
    const batch = stats.slice(i, i + 500)
    const { error } = await sb
      .from('player_game_stats')
      .upsert(batch, { onConflict: 'player_id,game_date' })
    if (error) {
      console.error(`Upsert error for ${sport}:`, error)
      throw new Error(`Failed to insert stats: ${error.message}`)
    }
    inserted += batch.length
  }
  return inserted
}

// =======================
// BUILD PROPS (standard + combo)
// =======================
async function buildProps(sb: any, sport: string) {
  const { data: players } = await sb.from('players').select('id,full_name').eq('sport', sport)
  if (!players?.length) return 0
  const allProps = []
  for (const player of players) {
    const { data: stats } = await sb
      .from('player_game_stats')
      .select('points,rebounds,assists')
      .eq('player_id', player.id)
      .order('game_date', { ascending: false })
      .limit(20)
    if (!stats || stats.length < 5) continue
    const points = stats.map(s => s.points)
    const avgPts = points.reduce((a, b) => a + b, 0) / points.length
    const line = Math.round(avgPts * 2) / 2
    allProps.push({
      player_id: player.id, sport, player_name: player.full_name,
      stat_type: 'points', projected_value: avgPts, baseline_line: line,
      confidence_score: 0.7, last_updated: new Date().toISOString(),
    })
    const pra = stats.map(s => s.points + s.rebounds + s.assists)
    const avgPra = pra.reduce((a, b) => a + b, 0) / pra.length
    allProps.push({
      player_id: player.id, sport, player_name: player.full_name,
      stat_type: 'PRA', projected_value: avgPra, baseline_line: line * 2,
      is_combo: true, confidence_score: 0.65, last_updated: new Date().toISOString(),
    })
  }
  await sb.from('player_props').delete().eq('sport', sport)
  for (let i = 0; i < allProps.length; i += 500) {
    await sb.from('player_props').insert(allProps.slice(i, i + 500))
  }
  return allProps.length
}

// =======================
// GET PLAYERS WITH BETTING LINES (OVER/UNDER)
// =======================
async function getPlayersWithLines(sb: any, sport: string) {
  const { data: players } = await sb
    .from('players')
    .select('id,full_name,position,team_id,teams:team_id(name,abbreviation)')
    .eq('sport', sport)
    .limit(300)
  if (!players?.length) return []

  const { data: allStats } = await sb
    .from('player_game_stats')
    .select('player_id,points,game_date')
    .eq('sport', sport)
    .order('game_date', { ascending: false })

  const statsByPlayer = new Map<string, number[]>()
  allStats?.forEach(stat => {
    if (!statsByPlayer.has(stat.player_id)) statsByPlayer.set(stat.player_id, [])
    statsByPlayer.get(stat.player_id)!.push(stat.points)
  })

  return players.map(player => {
    const points = statsByPlayer.get(player.id) || []
    const last10 = points.slice(0, 10)
    const avg10 = last10.length ? last10.reduce((a,b)=>a+b,0) / last10.length : 15
    const baseline = avg10   // the line to beat
    const projected = avg10   // same for simplicity

    const calcHR = (n: number) => {
      const slice = points.slice(0, n)
      if (!slice.length) return 0
      const hits = slice.filter(v => v >= baseline).length
      return Math.round((hits / slice.length) * 100)
    }

    let trend = 'stable'
    if (points.length >= 10) {
      const last5 = points.slice(0,5).reduce((a,b)=>a+b,0)/5
      const prev5 = points.slice(5,10).reduce((a,b)=>a+b,0)/5
      trend = last5 > prev5 * 1.05 ? 'up' : last5 < prev5 * 0.95 ? 'down' : 'stable'
    }

    const edge_type = projected > baseline ? 'OVER' : projected < baseline ? 'UNDER' : 'NONE'
    const confidence = 50 + Math.min(40, Math.floor((points.length / 20) * 40))

    return {
      id: player.id,
      name: player.full_name,
      position: player.position || 'N/A',
      team: player.teams?.name,
      team_abbr: player.teams?.abbreviation,
      opponent: 'TBD',
      line: baseline,
      edge_type,
      confidence,
      hit_rate: calcHR(10),
      trend,
    }
  })
}

// =======================
// HEALTH CHECK
// =======================
async function healthCheck(sb: any) {
  const { count: players } = await sb.from('players').select('*', { count: 'exact', head: true })
  const { count: games } = await sb.from('games_data').select('*', { count: 'exact', head: true })
  const { count: stats } = await sb.from('player_game_stats').select('*', { count: 'exact', head: true })
  const { count: props } = await sb.from('player_props').select('*', { count: 'exact', head: true })
  const { count: teams } = await sb.from('teams').select('*', { count: 'exact', head: true })
  return { players, games, stats, props, teams }
}

// =======================
// RESET STATS
// =======================
async function resetStats(sb: any, sport: string) {
  const { error } = await sb.from('player_game_stats').delete().eq('sport', sport)
  if (error) throw error
  return { deleted: true }
}

// =======================
// MAIN HANDLER
// =======================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    const { operation, sport } = body

    console.log('clever-action:', { operation, sport })

    switch (operation) {
      case 'full': {
        const teams = await fetchTeams(sb, sport)
        const players = await fetchPlayers(sb, sport)
        const games = await fetchGames(sb, sport)
        const stats = await generateStats(sb, sport)
        const props = await buildProps(sb, sport)
        return new Response(
          JSON.stringify({ success: true, teams, players, games, stats, props }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      case 'teams':
        return new Response(JSON.stringify({ success: true, count: await fetchTeams(sb, sport) }), { headers: cors })
      case 'players':
        return new Response(JSON.stringify({ success: true, count: await fetchPlayers(sb, sport) }), { headers: cors })
      case 'games':
        return new Response(JSON.stringify({ success: true, count: await fetchGames(sb, sport) }), { headers: cors })
      case 'stats':
        return new Response(JSON.stringify({ success: true, count: await generateStats(sb, sport) }), { headers: cors })
      case 'props':
        return new Response(JSON.stringify({ success: true, count: await buildProps(sb, sport) }), { headers: cors })
      case 'reset_stats':
        await resetStats(sb, sport)
        return new Response(JSON.stringify({ success: true, message: `Stats for ${sport} deleted` }), { headers: cors })
      case 'get_players': {
        const players = await getPlayersWithLines(sb, sport)
        return new Response(JSON.stringify({ success: true, players, count: players.length, sport }), { headers: cors })
      }
      case 'health': {
        const health = await healthCheck(sb)
        return new Response(JSON.stringify({ success: true, ...health }), { headers: cors })
      }
      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown operation: ${operation}` }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' }
        })
    }
  } catch (err: any) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
