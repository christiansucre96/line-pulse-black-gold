// supabase/functions/espn-scraper/index.ts
// What this actually does:
//   1. ESPN public API → real box score stats for finished NBA/NFL/MLB/NHL games
//      (same data that powers ESPN.com — no scraping, no auth needed)
//   2. the-odds-api.com → real prop lines from DraftKings, FanDuel, BetOnline
//      (free tier: 500 req/month — set ODDS_API_KEY secret in Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing env vars')
  return createClient(url, key)
}
async function get(url: string, hdrs: Record<string, string> = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'LinePulse/1.0', ...hdrs },
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url.slice(0,80)}`)
  return r.json()
}

// ═══════════════════════════════════════════════════════════════
// PART 1 — ESPN PUBLIC API BOX SCORES
// espn.com game pages DO have real stats via their public JSON API
// No scraping, no auth — this is what ESPN.com itself fetches
// ═══════════════════════════════════════════════════════════════

const ESPN_SPORT_PATH: Record<string, string> = {
  nba: 'basketball/nba', nfl: 'football/nfl',
  mlb: 'baseball/mlb',   nhl: 'hockey/nhl',
}

async function fetchBoxScore(sb: any, espnGameId: string, sport = 'nba') {
  const path = ESPN_SPORT_PATH[sport] || 'basketball/nba'
  const data = await get(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${espnGameId}`)

  const gameDate = data.header?.competitions?.[0]?.date?.split('T')[0]
    || new Date().toISOString().split('T')[0]
  const isFinished = data.header?.competitions?.[0]?.status?.type?.completed || false

  // Load player external_id → DB uuid map
  const { data: dbPlayers } = await sb.from('players').select('id,external_id').eq('sport', sport)
  const playerMap = new Map<string,string>((dbPlayers||[]).map((p: any) => [String(p.external_id), p.id]))

  const rows: any[] = []
  const missing: string[] = []

  for (const teamBox of (data.boxscore?.players || [])) {
    const teamAbbr = teamBox.team?.abbreviation || '?'
    for (const sg of (teamBox.statistics || [])) {
      const labels: string[] = sg.labels || []
      const catName = (sg.name || sg.type || '').toLowerCase()

      for (const athlete of (sg.athletes || [])) {
        const espnId = String(athlete.athlete?.id || '')
        const dbId   = playerMap.get(espnId)
        if (!dbId) { missing.push(athlete.athlete?.displayName || espnId); continue }

        const s = athlete.stats || []
        const row: any = {
          player_id: dbId, sport, game_date: gameDate,
          player_name: athlete.athlete?.displayName,
          team_abbreviation: teamAbbr,
          started: athlete.starter || false,
        }

        labels.forEach((lbl: string, i: number) => {
          const raw = s[i]
          if (raw === undefined || raw === '--') return
          const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, '')) || 0

          if (sport === 'nba') {
            if (lbl === 'PTS') row.points = n
            if (lbl === 'REB') row.rebounds = n
            if (lbl === 'AST') row.assists = n
            if (lbl === 'STL') row.steals = n
            if (lbl === 'BLK') row.blocks = n
            if (lbl === 'TO')  row.turnovers = n
            if (lbl === 'MIN') row.minutes_played = n
            if (lbl === 'PF')  row.personal_fouls = n
            if (lbl === '3PT') { const [m,a]=String(raw).split('-'); row.three_pointers_made=parseInt(m)||0; row.three_pointers_attempted=parseInt(a)||0 }
            if (lbl === 'FG')  { const [m,a]=String(raw).split('-'); row.field_goals_made=parseInt(m)||0;    row.field_goals_attempted=parseInt(a)||0 }
            if (lbl === 'FT')  { const [m,a]=String(raw).split('-'); row.free_throws_made=parseInt(m)||0;    row.free_throws_attempted=parseInt(a)||0 }
          } else if (sport === 'nfl') {
            if (catName.includes('pass'))   { if (lbl==='YDS') row.passing_yards=n; if (lbl==='TD') row.passing_tds=n; if (lbl==='INT') row.interceptions=n }
            if (catName.includes('rush'))   { if (lbl==='YDS') row.rushing_yards=n; if (lbl==='TD') row.rushing_tds=n }
            if (catName.includes('receiv')) { if (lbl==='YDS') row.receiving_yards=n; if (lbl==='REC') row.receptions=n; if (lbl==='TD') row.receiving_tds=n }
          } else if (sport === 'mlb') {
            if (lbl==='H')   row.hits=n; if (lbl==='R')   row.runs=n
            if (lbl==='RBI') row.rbi=n;  if (lbl==='HR')  row.home_runs=n
            if (lbl==='TB')  row.total_bases=n
            if (lbl==='SO'||lbl==='K') row.strikeouts_pitching=n
          } else if (sport === 'nhl') {
            if (lbl==='G')   row.goals=n
            if (lbl==='A')   row.assists_hockey=n
            if (lbl==='SOG') row.shots_on_goal=n
            if (lbl==='+/-') row.plus_minus=n
          }
        })

        if ((row.points||0)+(row.rebounds||0)+(row.assists||0)+(row.goals||0)+(row.hits||0)+(row.passing_yards||0) > 0) {
          rows.push(row)
        }
      }
    }
  }

  if (rows.length) {
    // Delete existing stats for these players on this date, then insert fresh
    await sb.from('player_game_stats').delete()
      .eq('sport', sport).eq('game_date', gameDate)
      .in('player_id', rows.map(r => r.player_id))
    const { error } = await sb.from('player_game_stats').insert(rows)
    if (error) throw new Error(`DB insert: ${error.message}`)
  }

  // Mark game as finished in games_data
  await sb.from('games_data').update({ status: 'finished' })
    .eq('sport', sport).eq('external_id', espnGameId)

  console.log(`[box_score] ${sport} game ${espnGameId}: ${rows.length} players archived, ${missing.length} not in DB`)
  return { inserted: rows.length, game_date: gameDate, is_finished: isFinished, players_not_in_db: missing.length }
}

// ═══════════════════════════════════════════════════════════════
// PART 2 — PROP LINES FROM THE-ODDS-API.COM
// Free 500 req/month — covers DraftKings, FanDuel, BetOnline
// Get free key: https://the-odds-api.com
// Set secret:   supabase secrets set ODDS_API_KEY=your_key
// ═══════════════════════════════════════════════════════════════

const ODDS_BASE = 'https://api.the-odds-api.com/v4'
const BOOKMAKERS = 'draftkings,fanduel,betonlineag'

// Markets available on free tier
const PROP_MARKETS: Record<string, string[]> = {
  nba: [
    'player_points', 'player_rebounds', 'player_assists',
    'player_steals', 'player_blocks', 'player_turnovers', 'player_threes',
    'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists',
    'player_points_rebounds_assists', 'player_double_double',
    'player_points_alternate', 'player_rebounds_alternate', 'player_assists_alternate',
  ],
  nfl: [
    'player_pass_yds', 'player_rush_yds', 'player_reception_yds',
    'player_pass_tds', 'player_anytime_td', 'player_receptions',
    'player_pass_yds_alternate', 'player_rush_yds_alternate',
  ],
  mlb: [
    'batter_hits', 'batter_runs_scored', 'batter_rbis', 'batter_total_bases',
    'batter_home_runs', 'pitcher_strikeouts', 'pitcher_hits_allowed',
    'batter_hits_runs_rbis',
  ],
  nhl: [
    'player_points', 'player_goals', 'player_assists',
    'player_shots_on_goal', 'player_blocked_shots', 'player_goals_assists',
  ],
  soccer: [
    'player_shots_on_target', 'player_shots',
    'player_goal_scorer_anytime', 'player_goal_scorer_first', 'player_assists',
  ],
}

const MARKET_LABELS: Record<string, string> = {
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
  player_steals: 'Steals', player_blocks: 'Blocks', player_turnovers: 'Turnovers',
  player_threes: '3PT Made', player_points_rebounds: 'Pts+Reb',
  player_points_assists: 'Pts+Ast', player_rebounds_assists: 'Reb+Ast',
  player_points_rebounds_assists: 'PRA', player_double_double: 'Double Double',
  player_points_alternate: 'Alt Points', player_rebounds_alternate: 'Alt Rebounds',
  player_assists_alternate: 'Alt Assists',
  player_pass_yds: 'Pass Yards', player_rush_yds: 'Rush Yards',
  player_reception_yds: 'Rec Yards', player_pass_tds: 'Pass TDs',
  player_anytime_td: 'Anytime TD', player_receptions: 'Receptions',
  batter_hits: 'Hits', batter_runs_scored: 'Runs', batter_rbis: 'RBIs',
  batter_total_bases: 'Total Bases', batter_home_runs: 'HR',
  pitcher_strikeouts: 'Strikeouts', pitcher_hits_allowed: 'Hits Allowed',
  batter_hits_runs_rbis: 'H+R+RBI',
  player_goals: 'Goals', player_shots_on_goal: 'Shots on Goal',
  player_blocked_shots: 'Blocked Shots', player_goals_assists: 'G+A',
  player_shots_on_target: 'Shots on Target', player_shots: 'Shots',
  player_goal_scorer_anytime: 'Anytime Scorer', player_goal_scorer_first: 'First Scorer',
}

const ODDS_SPORT_KEY: Record<string, string> = {
  nba: 'basketball_nba', nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',   nhl: 'icehockey_nhl', soccer: 'soccer_epl',
}

const COMBO_MARKETS = new Set([
  'player_points_rebounds','player_points_assists','player_rebounds_assists',
  'player_points_rebounds_assists','player_double_double',
  'player_goals_assists','batter_hits_runs_rbis',
])

async function fetchPropLines(sb: any, sport = 'nba') {
  const apiKey = Deno.env.get('ODDS_API_KEY')
  if (!apiKey) throw new Error('ODDS_API_KEY not set. Get free key at https://the-odds-api.com → supabase secrets set ODDS_API_KEY=...')

  const sportKey = ODDS_SPORT_KEY[sport] || ODDS_SPORT_KEY.nba
  const markets  = PROP_MARKETS[sport] || PROP_MARKETS.nba

  // Get events first
  const events = await get(`${ODDS_BASE}/sports/${sportKey}/events?apiKey=${apiKey}&regions=us`)
  console.log(`[odds-api] ${events.length} events for ${sport}`)

  const allRows: any[] = []
  let quotaUsed = 0

  for (const event of events.slice(0, 8)) {  // cap at 8 games to save quota
    const home = event.home_team
    const away = event.away_team
    const gameTime = event.commence_time

    for (const market of markets) {
      try {
        const data = await get(
          `${ODDS_BASE}/sports/${sportKey}/events/${event.id}/odds?apiKey=${apiKey}&regions=us&markets=${market}&bookmakers=${BOOKMAKERS}&oddsFormat=american`
        )
        quotaUsed++

        for (const bk of (data.bookmakers || [])) {
          for (const mkt of (bk.markets || [])) {
            if (mkt.key !== market) continue

            // Group outcomes by player name
            const byPlayer = new Map<string,{ line:number|null; over:number|null; under:number|null }>()
            for (const outcome of (mkt.outcomes || [])) {
              const name  = outcome.description || outcome.name
              if (!name) continue
              const side  = outcome.name?.toLowerCase()
              if (!byPlayer.has(name)) byPlayer.set(name, { line:null, over:null, under:null })
              const e = byPlayer.get(name)!
              if (side === 'over')  { e.line = outcome.point ?? null; e.over  = outcome.price ?? null }
              if (side === 'under') { e.line = outcome.point ?? null; e.under = outcome.price ?? null }
            }

            for (const [playerName, info] of byPlayer) {
              if (info.line === null) continue
              allRows.push({
                sport, player_name: playerName,
                bookmaker: bk.title,
                market_key: market,
                market_label: MARKET_LABELS[market] || market,
                game: `${away} @ ${home}`,
                game_time: gameTime,
                line: info.line,
                over_odds:  info.over,
                under_odds: info.under,
                is_combo: COMBO_MARKETS.has(market),
                last_updated: new Date().toISOString(),
              })
            }
          }
        }
        await new Promise(r => setTimeout(r, 150))
      } catch(e) { console.error(`[odds-api] ${market}:`, e) }
    }
  }

  if (!allRows.length) return { inserted: 0, quota_used: quotaUsed, events: events.length }

  await sb.from('player_props_cache').delete().eq('sport', sport)
  let inserted = 0
  for (let i = 0; i < allRows.length; i += 500) {
    const { error } = await sb.from('player_props_cache').insert(allRows.slice(i, i+500))
    if (!error) inserted += Math.min(500, allRows.length - i)
    else console.error('props insert:', error.message)
  }

  console.log(`[odds-api] ${sport}: ${inserted} prop lines, ${quotaUsed} API calls used`)
  return { inserted, quota_used: quotaUsed, events: events.length }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  try {
    const sb   = getSB()
    const body = await req.json().catch(() => ({})) as any
    const { operation, game_id, sport = 'nba' } = body

    // box_score: archive a specific finished game
    if (operation === 'box_score' || (!operation && game_id)) {
      if (!game_id) return respond({ error: 'game_id (ESPN event ID) required' }, 400)
      console.log(`📊 Box score: ${sport} game ${game_id}`)
      const result = await fetchBoxScore(sb, String(game_id), sport)
      return respond({ success: true, operation: 'box_score', game_id, sport, ...result })
    }

    // prop_lines: fetch live lines from the-odds-api.com
    if (operation === 'prop_lines') {
      console.log(`📈 Prop lines: ${sport}`)
      const result = await fetchPropLines(sb, sport)
      return respond({ success: true, operation: 'prop_lines', sport, ...result })
    }

    // scrape_today: archive all finished games + refresh prop lines
    if (operation === 'scrape_today') {
      const today = new Date().toISOString().split('T')[0]
      const { data: games } = await sb.from('games_data')
        .select('external_id').eq('sport', sport).eq('game_date', today)
        .in('status', ['finished', 'live'])

      let archived = 0
      for (const g of (games || [])) {
        try { const r = await fetchBoxScore(sb, g.external_id, sport); archived += r.inserted }
        catch(e) { console.error(`box_score [${g.external_id}]:`, e) }
        await new Promise(r => setTimeout(r, 400))
      }

      const props = await fetchPropLines(sb, sport)
      return respond({
        success: true, operation: 'scrape_today', sport, date: today,
        games_processed: games?.length || 0, stats_archived: archived,
        prop_lines_inserted: props.inserted, quota_used: props.quota_used,
      })
    }

    // test: health check
    if (operation === 'test') {
      const apiKey = Deno.env.get('ODDS_API_KEY')
      const { count: statsCount } = await sb.from('player_game_stats').select('*',{ count:'exact', head:true })
      const { count: propsCount } = await sb.from('player_props_cache').select('*',{ count:'exact', head:true })
      return respond({
        success: true, message: 'espn-scraper alive!',
        odds_api_key: apiKey ? '✅ set' : '❌ missing — supabase secrets set ODDS_API_KEY=...',
        player_stats_in_db:  statsCount || 0,
        prop_lines_in_cache: propsCount || 0,
      })
    }

    return respond({
      error: 'operation required',
      valid_operations: {
        box_score:    'Archive ESPN box score stats → player_game_stats. Needs: game_id (ESPN event ID), sport',
        prop_lines:   'Fetch DraftKings/FanDuel/BetOnline lines → player_props_cache. Needs: sport',
        scrape_today: 'Both of the above for all of today\'s games. Needs: sport',
        test:         'Health check — shows API key status and row counts',
      },
      example_calls: [
        { operation: 'box_score',    game_id: '401585722', sport: 'nba' },
        { operation: 'prop_lines',   sport: 'nba' },
        { operation: 'scrape_today', sport: 'nba' },
        { operation: 'test' },
      ],
    }, 400)

  } catch(e: any) {
    console.error('[espn-scraper] fatal:', e)
    return respond({ success: false, error: e.message }, 500)
  }
})
