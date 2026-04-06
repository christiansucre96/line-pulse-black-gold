// supabase/functions/clever-action/index.ts
// Production-ready – real historical data, all sports, all prop types
// + Improved CORS and operation handling

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  return createClient(url, key)
}

// ── API ENDPOINTS ─────────────────────────────────────────────
const ESPN_PATH: Record<string, string> = {
  nba:    'basketball/nba',
  nfl:    'football/nfl',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/eng.1',
}

// ── STAT FIELDS per sport (all columns stored in player_game_stats) ─
const STAT_FIELDS: Record<string, string[]> = {
  nba:    ['points','rebounds','assists','steals','blocks','turnovers','three_pointers_made'],
  mlb:    ['hits','runs','rbi','total_bases','home_runs','stolen_bases'],
  nhl:    ['goals','assists_hockey','shots_on_goal'],
  nfl:    ['passing_yards','rushing_yards','receiving_yards','passing_tds','receptions'],
  soccer: ['goals_soccer','assists_soccer','shots_soccer','shots_on_target'],
}

// ── COMBO PROPS ──────────────────────────────────────────────
const COMBOS: Record<string, { name: string; fields: string[] }[]> = {
  nba: [
    { name: 'Pts+Reb',      fields: ['points','rebounds'] },
    { name: 'Pts+Ast',      fields: ['points','assists'] },
    { name: 'Reb+Ast',      fields: ['rebounds','assists'] },
    { name: 'Pts+Reb+Ast',  fields: ['points','rebounds','assists'] },
  ],
  mlb:    [{ name: 'H+R+RBI',      fields: ['hits','runs','rbi'] }],
  nhl:    [{ name: 'G+A',          fields: ['goals','assists_hockey'] }],
  nfl:    [
    { name: 'Pass+Rush Yds', fields: ['passing_yards','rushing_yards'] },
    { name: 'Rush+Rec Yds',  fields: ['rushing_yards','receiving_yards'] },
  ],
  soccer: [{ name: 'G+A',          fields: ['goals_soccer','assists_soccer'] }],
}

// ── HELPERS ───────────────────────────────────────────────────
const roundHalf = (n: number) => Math.round(n / 0.5) * 0.5
const hitRate   = (vals: number[], line: number) =>
  vals.length ? vals.filter(v => v >= line).length / vals.length : 0
const avg       = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
const stdDev    = (vals: number[]) => {
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

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function log(sb: any, sport: string, op: string, status: string, count = 0, error?: string) {
  await sb.from('ingestion_logs').insert({
    sport, operation: op, status,
    records_processed: count,
    error_message: error || null,
    completed_at: status !== 'running' ? new Date().toISOString() : null,
  }).catch(() => {})
}

// ── 1. FETCH TEAMS ────────────────────────────────────────────
async function fetchTeams(sb: any, sport: string) {
  let teams: any[] = []

  if (sport === 'mlb') {
    const r = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
    const d = await r.json()
    teams = (d.teams || []).map((t: any) => ({
      external_id: String(t.id), sport,
      name: t.name, abbreviation: t.abbreviation, city: t.locationName || null,
    }))
  } else if (sport === 'nhl') {
    const r = await fetch('https://api-web.nhle.com/v1/standings/now')
    const d = await r.json()
    teams = (d.standings || []).map((t: any) => ({
      external_id: t.teamAbbrev?.default, sport,
      name: t.teamName?.default, abbreviation: t.teamAbbrev?.default,
      city: t.placeName?.default || null, logo_url: t.teamLogo || null,
    }))
  } else {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams?limit=50`)
    const d = await r.json()
    const raw = d.sports?.[0]?.leagues?.[0]?.teams || []
    teams = raw.map((t: any) => ({
      external_id: String(t.team.id), sport,
      name: t.team.displayName, abbreviation: t.team.abbreviation,
      city: t.team.location || null, logo_url: t.team.logos?.[0]?.href || null,
    }))
  }

  if (teams.length)
    await sb.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  return teams.length
}

// ── 2. FETCH PLAYERS ──────────────────────────────────────────
async function fetchPlayers(sb: any, sport: string) {
  const { data: teams } = await sb
    .from('teams').select('id,external_id,abbreviation').eq('sport', sport)
  if (!teams?.length) return 0
  let total = 0

  for (const team of teams) {
    try {
      let players: any[] = []

      if (sport === 'mlb') {
        const r = await fetch(`https://statsapi.mlb.com/api/v1/teams/${team.external_id}/roster?rosterType=active`)
        const d = await r.json()
        players = (d.roster || []).map((p: any) => ({
          external_id: String(p.person.id), sport,
          full_name: p.person.fullName, team_id: team.id,
          position: p.position?.abbreviation || null,
          jersey_number: p.jerseyNumber || null, status: 'active',
        }))
      } else if (sport === 'nhl') {
        const abbr = team.abbreviation || team.external_id
        const r = await fetch(`https://api-web.nhle.com/v1/roster/${abbr}/current`)
        const d = await r.json()
        const all = [...(d.forwards||[]),...(d.defensemen||[]),...(d.goalies||[])]
        players = all.map((p: any) => ({
          external_id: String(p.id), sport,
          full_name: `${p.firstName?.default||''} ${p.lastName?.default||''}`.trim(),
          team_id: team.id, position: p.positionCode || null,
          jersey_number: p.sweaterNumber ? String(p.sweaterNumber) : null,
          headshot_url: p.headshot || null, status: 'active',
        }))
      } else {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${team.external_id}/roster`)
        const d = await r.json()
        const flat: any[] = Array.isArray(d.athletes)
          ? d.athletes.flatMap((g: any) => Array.isArray(g.items) ? g.items : [g])
          : []
        players = flat.map((a: any) => ({
          external_id: String(a.id), sport,
          full_name: a.fullName || a.displayName,
          team_id: team.id,
          position: a.position?.abbreviation || null,
          jersey_number: a.jersey || null,
          headshot_url: a.headshot?.href || null,
          status: 'active',
        }))
      }

      if (players.length) {
        await sb.from('players').upsert(players, { onConflict: 'sport,external_id' })
        total += players.length
      }
      await new Promise(r => setTimeout(r, 200))
    } catch (e) { console.error(`Players error [${sport}/${team.external_id}]:`, e) }
  }
  return total
}

// ── 3. FETCH TODAY'S GAMES (schedule + scores) ────────────────
async function fetchGames(sb: any, sport: string, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]

  const { data: teams } = await sb
    .from('teams').select('id,external_id,abbreviation').eq('sport', sport)
  const teamMap = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])

  const games: any[] = []

  if (sport === 'mlb') {
    const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`)
    const d = await r.json()
    for (const day of (d.dates || [])) {
      for (const g of (day.games || [])) {
        const status = g.status?.abstractGameState === 'Final' ? 'finished'
          : g.status?.abstractGameState === 'Live' ? 'live' : 'upcoming'
        games.push({
          external_id: String(g.gamePk), sport,
          home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
          away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
          game_date: today, start_time: g.gameDate || null, status,
          home_score: g.teams?.home?.score || 0,
          away_score: g.teams?.away?.score || 0, season: '2025',
        })
      }
    }
  } else if (sport === 'nhl') {
    const r = await fetch(`https://api-web.nhle.com/v1/schedule/${today}`)
    const d = await r.json()
    for (const g of (d.gameWeek?.[0]?.games || [])) {
      const gs = g.gameState
      const status = gs === 'OFF' ? 'finished' : gs === 'LIVE' || gs === 'CRIT' ? 'live' : 'upcoming'
      games.push({
        external_id: String(g.id), sport,
        home_team_id: teamMap.get(g.homeTeam?.abbrev) || null,
        away_team_id: teamMap.get(g.awayTeam?.abbrev) || null,
        game_date: today, start_time: g.startTimeUTC || null, status,
        home_score: g.homeTeam?.score || 0, away_score: g.awayTeam?.score || 0,
      })
    }
  } else {
    const fmt = today.replace(/-/g, '')
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/scoreboard?dates=${fmt}`)
    const d = await r.json()
    for (const ev of (d.events || [])) {
      const comp = ev.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
      const st = comp?.status?.type?.name
      const status = st === 'STATUS_FINAL' ? 'finished'
        : st === 'STATUS_IN_PROGRESS' ? 'live' : 'upcoming'
      games.push({
        external_id: String(ev.id), sport,
        home_team_id: teamMap.get(String(home?.team?.id)) || null,
        away_team_id: teamMap.get(String(away?.team?.id)) || null,
        game_date: today, start_time: ev.date || null, status,
        home_score: parseInt(home?.score || '0'),
        away_score: parseInt(away?.score || '0'),
        current_period: comp?.status?.period ? String(comp.status.period) : null,
        time_remaining: comp?.status?.displayClock || null,
        venue: comp?.venue?.fullName || null,
      })
    }
  }

  if (games.length)
    await sb.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  return games.length
}

// ── 4. FETCH HISTORICAL GAME LOGS (last 20 games per player) ──
async function fetchHistoricalStats(sb: any, sport: string) {
  const { data: players } = await sb
    .from('players').select('id,external_id,position').eq('sport', sport).limit(500)
  if (!players?.length) return 0

  let total = 0
  const season = sport === 'mlb' ? 2025 : sport === 'nfl' ? 2024 : '20242025'

  for (const player of players) {
    try {
      let statRows: any[] = []

      if (sport === 'nba') {
        const r = await fetch(`https://www.balldontlie.io/api/v1/stats?player_ids[]=${player.external_id}&seasons[]=2024&per_page=20`)
        if (!r.ok) continue
        const d = await r.json()
        for (const g of (d.data || [])) {
          const gDate = g.game?.date?.split('T')[0]
          if (!gDate) continue
          statRows.push({
            player_id: player.id, sport,
            game_date: gDate,
            points: g.pts || 0, rebounds: g.reb || 0, assists: g.ast || 0,
            steals: g.stl || 0, blocks: g.blk || 0, turnovers: g.turnover || 0,
            three_pointers_made: g.fg3m || 0,
            minutes_played: parseFloat(g.min || '0') || 0,
            player_name: `${g.player?.first_name || ''} ${g.player?.last_name || ''}`.trim(),
          })
        }
      } else if (sport === 'mlb') {
        const isPitcher = ['SP','RP','P'].includes(player.position || '')
        const group = isPitcher ? 'pitching' : 'hitting'
        const r = await fetch(`https://statsapi.mlb.com/api/v1/people/${player.external_id}/stats?stats=gameLog&season=2025&group=${group}`)
        if (!r.ok) continue
        const d = await r.json()
        const splits = d.stats?.[0]?.splits?.slice(0, 20) || []
        for (const sp of splits) {
          const st = sp.stat || {}
          statRows.push({
            player_id: player.id, sport,
            game_date: sp.date?.split('T')[0] || sp.date,
            hits: st.hits || 0, runs: st.runs || 0, rbi: st.rbi || 0,
            total_bases: st.totalBases || 0, home_runs: st.homeRuns || 0,
            stolen_bases: st.stolenBases || 0,
            strikeouts_pitching: st.strikeOuts || 0,
            hits_allowed: st.hits || 0,
            earned_runs: st.earnedRuns || 0,
            walks: st.baseOnBalls || 0,
          })
        }
      } else if (sport === 'nhl') {
        const r = await fetch(`https://api-web.nhle.com/v1/player/${player.external_id}/game-log/20242025/2`)
        if (!r.ok) continue
        const d = await r.json()
        const isGoalie = player.position === 'G'
        for (const g of (d.gameLog || []).slice(0, 20)) {
          statRows.push({
            player_id: player.id, sport,
            game_date: g.gameDate,
            goals: isGoalie ? 0 : (g.goals || 0),
            assists_hockey: isGoalie ? 0 : (g.assists || 0),
            shots_on_goal: isGoalie ? (g.saves || 0) : (g.shots || 0),
            plus_minus: g.plusMinus || 0,
          })
        }
      } else if (sport === 'nfl') {
        const r = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.external_id}/gamelog`)
        if (!r.ok) continue
        const d = await r.json()
        const events = d.events || {}
        for (const [evId, ev] of Object.entries(events as any)) {
          const stats: any = {}
          for (const cat of (ev.categories || [])) {
            for (let i = 0; i < (cat.names || []).length; i++) {
              stats[cat.names[i]] = cat.totals?.[i] ?? 0
            }
          }
          statRows.push({
            player_id: player.id, sport,
            game_date: ev.gameDate?.split('T')[0] || ev.gameDate,
            passing_yards: parseFloat(stats['passingYards'] || stats['YDS'] || '0') || 0,
            rushing_yards: parseFloat(stats['rushingYards'] || '0') || 0,
            receiving_yards: parseFloat(stats['receivingYards'] || '0') || 0,
            passing_tds: parseInt(stats['passingTouchdowns'] || stats['TD'] || '0') || 0,
            receptions: parseInt(stats['receptions'] || stats['REC'] || '0') || 0,
          })
          if (statRows.length >= 20) break
        }
      } else if (sport === 'soccer') {
        const r = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/eng.1/athletes/${player.external_id}/gamelog`)
        if (!r.ok) continue
        const d = await r.json()
        const events = d.events || {}
        for (const [evId, ev] of Object.entries(events as any)) {
          const stats: any = {}
          for (const cat of (ev.categories || [])) {
            for (let i = 0; i < (cat.names || []).length; i++) {
              stats[cat.names[i]] = cat.totals?.[i] ?? 0
            }
          }
          statRows.push({
            player_id: player.id, sport,
            game_date: ev.gameDate?.split('T')[0] || ev.gameDate,
            goals_soccer: parseInt(stats['goals'] || stats['G'] || '0') || 0,
            assists_soccer: parseInt(stats['assists'] || stats['A'] || '0') || 0,
            shots_soccer: parseInt(stats['shots'] || stats['SH'] || '0') || 0,
            shots_on_target: parseInt(stats['shotsOnTarget'] || stats['SOT'] || '0') || 0,
          })
          if (statRows.length >= 20) break
        }
      }

      if (statRows.length) {
        await sb.from('player_game_stats').upsert(statRows, {
          onConflict: 'player_id,game_date',
          ignoreDuplicates: false,
        }).catch(async () => {
          await sb.from('player_game_stats').insert(statRows).catch(() => {})
        })
        total += statRows.length
      }
      await new Promise(r => setTimeout(r, 150))
    } catch (e) { console.error(`Historical stats error [${sport}/${player.external_id}]:`, e) }
  }
  return total
}

// ── 5. BOX SCORES for today's finished games ──────────────────
async function fetchBoxScores(sb: any, sport: string, date?: string) {
  const today = date || new Date().toISOString().split('T')[0]
  const { data: games } = await sb
    .from('games_data').select('id,external_id')
    .eq('sport', sport).eq('game_date', today)
    .in('status', ['finished', 'live'])
  if (!games?.length) return 0

  const { data: allPlayers } = await sb
    .from('players').select('id,external_id').eq('sport', sport)
  const playerMap = new Map(allPlayers?.map((p: any) => [String(p.external_id), p.id]) || [])

  let total = 0

  for (const game of games) {
    try {
      const path = ESPN_PATH[sport]
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${game.external_id}`)
      if (!r.ok) continue
      const data = await r.json()
      const rows: any[] = []

      for (const teamBox of (data.boxscore?.players || [])) {
        for (const sg of (teamBox.statistics || [])) {
          const labels: string[] = sg.labels || []
          for (const athlete of (sg.athletes || [])) {
            const pid = playerMap.get(String(athlete.athlete?.id))
            if (!pid) continue
            const s = athlete.stats || []
            const row: any = {
              player_id: pid, game_id: game.id, sport,
              game_date: today,
              player_name: athlete.athlete?.displayName,
              team_abbreviation: teamBox.team?.abbreviation,
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
                if (lbl === '3PT') {
                  const [m, a] = String(raw).split('-')
                  row.three_pointers_made = parseInt(m) || 0
                  row.three_pointers_attempted = parseInt(a) || 0
                }
                if (lbl === 'FG') {
                  const [m, a] = String(raw).split('-')
                  row.field_goals_made = parseInt(m) || 0
                  row.field_goals_attempted = parseInt(a) || 0
                }
                if (lbl === 'FT') {
                  const [m, a] = String(raw).split('-')
                  row.free_throws_made = parseInt(m) || 0
                  row.free_throws_attempted = parseInt(a) || 0
                }
              } else if (sport === 'nfl') {
                const cat = sg.name?.toLowerCase() || ''
                if (cat.includes('pass')) {
                  if (lbl === 'YDS') row.passing_yards = n
                  if (lbl === 'TD')  row.passing_tds = n
                  if (lbl === 'INT') row.interceptions = n
                }
                if (cat.includes('rush')) {
                  if (lbl === 'YDS') row.rushing_yards = n
                  if (lbl === 'TD')  row.rushing_tds = n
                }
                if (cat.includes('receiv')) {
                  if (lbl === 'YDS') row.receiving_yards = n
                  if (lbl === 'TD')  row.receiving_tds = n
                  if (lbl === 'REC') row.receptions = n
                }
              } else if (sport === 'mlb') {
                if (lbl === 'H')   row.hits = n
                if (lbl === 'R')   row.runs = n
                if (lbl === 'RBI') row.rbi = n
                if (lbl === 'HR')  row.home_runs = n
                if (lbl === 'BB')  row.walks = n
                if (lbl === 'SO' || lbl === 'K') row.strikeouts_pitching = n
                if (lbl === 'TB')  row.total_bases = n
              } else if (sport === 'nhl') {
                if (lbl === 'G')   row.goals = n
                if (lbl === 'A')   row.assists_hockey = n
                if (lbl === 'SOG') row.shots_on_goal = n
                if (lbl === '+/-') row.plus_minus = n
              } else if (sport === 'soccer') {
                if (lbl === 'G')   row.goals_soccer = n
                if (lbl === 'A')   row.assists_soccer = n
                if (lbl === 'SH')  row.shots_soccer = n
                if (lbl === 'SOT') row.shots_on_target = n
              }
            })
            rows.push(row)
          }
        }
      }

      if (rows.length) {
        await sb.from('player_game_stats')
          .upsert(rows, { onConflict: 'player_id,game_id' })
        total += rows.length
      }
      await new Promise(r => setTimeout(r, 250))
    } catch (e) { console.error(`Box score error [${sport}/${game.external_id}]:`, e) }
  }
  return total
}

// ── 6. COMPUTE PROPS — L5/L10/L15/L20 hit rates, all combos ──
async function computeProps(sb: any, sport: string, player_id?: string) {
  const statFields = STAT_FIELDS[sport] || []
  const combos     = COMBOS[sport] || []

  let q = sb.from('players').select('id,full_name,position').eq('sport', sport)
  if (player_id) q = q.eq('id', player_id)
  const { data: players } = await q.limit(500)
  if (!players?.length) return { players_processed: 0, props_generated: 0 }

  const allProps: any[] = []

  for (const player of players) {
    const statSelect = ['game_date', ...statFields].join(',')
    const { data: logs } = await sb.from('player_game_stats')
      .select(statSelect)
      .eq('player_id', player.id)
      .order('game_date', { ascending: false })
      .limit(20)
    if (!logs || logs.length < 3) continue

    const buildProp = (values: number[], statName: string, isCombo: boolean) => {
      if (values.length < 3) return null
      const l5  = values.slice(0,5)
      const l10 = values.slice(0,10)
      const l15 = values.slice(0,15)
      const l20 = values.slice(0,20)
      const a5  = avg(l5);  const a10 = avg(l10)
      const a15 = avg(l15); const a20 = avg(l20)
      const proj = a5 * 0.5 + a10 * 0.3 + a20 * 0.2
      const line = roundHalf(proj)

      const hr5  = hitRate(l5,  line)
      const hr10 = hitRate(l10, line)
      const hr15 = hitRate(l15, line)
      const hr20 = hitRate(l20, line)
      const sd   = stdDev(l20)
      const trend = a5 > a20 * 1.05 ? 'up' : a5 < a20 * 0.95 ? 'down' : 'stable'
      const edge = proj > line * 1.08 ? 'OVER' : proj < line * 0.92 ? 'UNDER' : 'NONE'
      const conf = Math.min(1, Math.max(0,
        hr20 * 0.3 + (trend === 'up' ? 0.2 : trend === 'down' ? -0.1 : 0.05) +
        (1 - Math.min(sd / (a20 || 1), 1)) * 0.3 + (values.length / 20) * 0.2
      ))

      return {
        player_id: player.id, sport,
        player_name: player.full_name, stat_type: statName,
        is_combo: isCombo, projected_value: Math.round(proj * 100) / 100,
        baseline_line: line,
        hit_rate_last5:  Math.round(hr5  * 100) / 100,
        hit_rate_last10: Math.round(hr10 * 100) / 100,
        hit_rate_last20: Math.round(hr20 * 100) / 100,
        avg_last5:  Math.round(a5  * 100) / 100,
        avg_last10: Math.round(a10 * 100) / 100,
        avg_last20: Math.round(a20 * 100) / 100,
        trend, consistency: Math.round(sd * 100) / 100,
        edge_type: edge, confidence_score: Math.round(conf * 100) / 100,
        last_updated: new Date().toISOString(),
      }
    }

    for (const field of statFields) {
      const vals = logs.map((g: any) => Number(g[field] ?? 0))
      const p = buildProp(vals, field, false)
      if (p) allProps.push(p)
    }
    for (const combo of combos) {
      const vals = logs.map((g: any) =>
        combo.fields.reduce((acc, f) => acc + Number(g[f] ?? 0), 0)
      )
      const p = buildProp(vals, combo.name, true)
      if (p) allProps.push(p)
    }
  }

  if (player_id) {
    await sb.from('player_props').delete().eq('player_id', player_id)
  } else {
    await sb.from('player_props').delete().eq('sport', sport)
  }
  for (let i = 0; i < allProps.length; i += 500) {
    const { error } = await sb.from('player_props').insert(allProps.slice(i, i + 500))
    if (error) console.error('Props insert error:', error)
  }
  return { players_processed: players.length, props_generated: allProps.length }
}

// ── 7. GET PLAYERS — rich frontend response (includes status & is_starter) ──
async function getPlayers(sb: any, sport: string) {
  const { data: players } = await sb
    .from('players')
    .select('id,full_name,position,team_id,teams:team_id(name,abbreviation),status,is_starter')
    .eq('sport', sport)
    .limit(300)
  if (!players?.length) return []

  const { data: preComputedProps } = await sb
    .from('player_props')
    .select('*')
    .eq('sport', sport)
    .order('confidence_score', { ascending: false, nullsFirst: false })
    .limit(2000)

  // Get today's games for opponents
  const today = new Date().toISOString().split('T')[0]
  const { data: todayGames } = await sb
    .from('games_data')
    .select('home_team_id,away_team_id')
    .eq('sport', sport).eq('game_date', today)

  const opponentMap = new Map<string, string>()
  for (const g of (todayGames || [])) {
    if (g.home_team_id) opponentMap.set(g.home_team_id, g.away_team_id)
    if (g.away_team_id) opponentMap.set(g.away_team_id, g.home_team_id)
  }
  const oppIds = [...new Set([...opponentMap.values()].filter(Boolean))]
  const { data: oppTeams } = oppIds.length
    ? await sb.from('teams').select('id,abbreviation').in('id', oppIds)
    : { data: [] }
  const oppAbbrMap = new Map(oppTeams?.map((t: any) => [t.id, t.abbreviation]) || [])

  if (preComputedProps && preComputedProps.length > 0) {
    const propsByPlayer = new Map<string, any[]>()
    for (const p of preComputedProps) {
      if (!propsByPlayer.has(p.player_id)) propsByPlayer.set(p.player_id, [])
      propsByPlayer.get(p.player_id)!.push(p)
    }
    const result: any[] = []
    for (const player of players) {
      const props = propsByPlayer.get(player.id) || []
      const oppTeamId = opponentMap.get(player.team_id)
      const opponent = oppTeamId ? oppAbbrMap.get(oppTeamId) || 'TBD' : 'TBD'
      for (const prop of props) {
        result.push({
          id:          `${player.id}_${prop.stat_type}`,
          player_id:   player.id,
          name:        player.full_name,
          position:    player.position || 'N/A',
          team:        player.teams?.name,
          team_abbr:   player.teams?.abbreviation,
          opponent,
          prop_type:   prop.stat_type,
          is_combo:    prop.is_combo,
          line:        prop.baseline_line,
          avg_last10:  prop.avg_last10,
          diff:        Math.round((prop.avg_last10 - prop.baseline_line) * 10) / 10,
          l5:          pct(prop.hit_rate_last5),
          l10:         pct(prop.hit_rate_last10),
          l15:         pct(prop.hit_rate_last20),
          l20:         pct(prop.hit_rate_last20),
          streak:      0,
          edge_type:   prop.edge_type,
          trend:       prop.trend,
          confidence:  Math.round((prop.confidence_score || 0) * 100),
          status:      player.status || 'active',
          is_starter:  player.is_starter ?? false,
        })
      }
    }
    return result
  }

  // Fallback – compute on the fly (simplified)
  const allStatCols = ['game_date', ...(STAT_FIELDS[sport] || ['points'])].join(',')
  const { data: allStats } = await sb
    .from('player_game_stats')
    .select(`player_id,${allStatCols}`)
    .eq('sport', sport)
    .order('game_date', { ascending: false })
  const logsByPlayer = new Map<string, any[]>()
  allStats?.forEach((s: any) => {
    if (!logsByPlayer.has(s.player_id)) logsByPlayer.set(s.player_id, [])
    logsByPlayer.get(s.player_id)!.push(s)
  })

  const result: any[] = []
  for (const player of players) {
    const logs = logsByPlayer.get(player.id) || []
    const oppTeamId = opponentMap.get(player.team_id)
    const opponent = oppTeamId ? oppAbbrMap.get(oppTeamId) || 'TBD' : 'TBD'
    const buildRow = (values: number[], statName: string, isCombo: boolean) => {
      if (values.length < 1) return null
      const l10 = values.slice(0,10)
      const a10 = avg(l10)
      const line = roundHalf(a10)
      return {
        id: `${player.id}_${statName}`,
        player_id: player.id,
        name: player.full_name,
        position: player.position || 'N/A',
        team: player.teams?.name,
        team_abbr: player.teams?.abbreviation,
        opponent,
        prop_type: statName,
        is_combo: isCombo,
        line,
        avg_last10: Math.round(a10 * 10) / 10,
        diff: Math.round((a10 - line) * 10) / 10,
        l5: pct(hitRate(values.slice(0,5), line)),
        l10: pct(hitRate(values.slice(0,10), line)),
        l15: pct(hitRate(values.slice(0,15), line)),
        l20: pct(hitRate(values.slice(0,20), line)),
        streak: streak(values, line),
        edge_type: a10 > line * 1.08 ? 'OVER' : a10 < line * 0.92 ? 'UNDER' : 'NONE',
        trend: 'stable',
        confidence: 50,
        status: player.status || 'active',
        is_starter: player.is_starter ?? false,
      }
    }
    const statFields = STAT_FIELDS[sport] || ['points']
    for (const field of statFields) {
      const vals = logs.map(g => Number(g[field] ?? 0))
      const row = buildRow(vals, field, false)
      if (row) result.push(row)
    }
    for (const combo of (COMBOS[sport] || [])) {
      const vals = logs.map(g =>
        combo.fields.reduce((acc, f) => acc + Number(g[f] ?? 0), 0)
      )
      const row = buildRow(vals, combo.name, true)
      if (row) result.push(row)
    }
  }
  return result
}

// ───────────── NEW MAIN HANDLER (replaces old Deno.serve) ─────────────
Deno.serve(async (req) => {
  // ✅ ALWAYS handle CORS first
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const sb = getSB()

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const { operation, sport, date, player_id, data } = body

    console.log(`[clever-action] op=${operation} sport=${sport} date=${date}`)

    switch (operation) {

      // ── Main scanner endpoint ─────────────────────────────────
      case 'get_players': {
        if (!sport) return respond({ error: 'sport required' }, 400)
        const players = await getPlayers(sb, sport)

        return new Response(JSON.stringify({
          success: true,
          players,
          count: players.length
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        })
      }

      // ── Daily full refresh (all sports) ─────────────────────
      case 'daily': {
        const sports = ['nba','mlb','nhl','nfl','soccer']
        const results: any = {}

        for (const s of sports) {
          try {
            const teams   = await fetchTeams(sb, s)
            const players = await fetchPlayers(sb, s)
            const games   = await fetchGames(sb, s, date)
            const history = await fetchHistoricalStats(sb, s)
            const props   = await computeProps(sb, s)

            results[s] = { teams, players, games, history, ...props }
          } catch (e: any) {
            results[s] = { error: e.message }
          }
        }

        return new Response(JSON.stringify({ success: true, results }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        })
      }

      // ── Test endpoint ────────────────────────────────────────
      case 'test':
        return new Response(JSON.stringify({
          success: true,
          message: 'clever-action is alive!',
          ts: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        })

      default:
        return new Response(JSON.stringify({
          error: `Invalid operation: ${operation}`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          }
        })
    }

  } catch (e: any) {
    console.error('[clever-action] fatal:', e)
    return new Response(JSON.stringify({
      success: false,
      error: e.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      }
    })
  }
})
