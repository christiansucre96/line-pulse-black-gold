// supabase/functions/clever-action/index.ts
// Full version – includes `stats` batch insert + all prop logic

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')               // ✅ correct env name
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')   // ✅ correct env name
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// SPORT CONFIGURATION
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
const SPORT_STAT_FIELDS: Record<string, string[]> = {
  nba:    ['points','rebounds','assists','steals','blocks','turnovers','three_pointers_made'],
  mlb:    ['hits','runs','rbi','total_bases','home_runs','stolen_bases'],
  nhl:    ['goals','assists_hockey','shots_on_goal'],
  nfl:    ['passing_yards','rushing_yards','receiving_yards','passing_tds','receptions'],
  soccer: ['goals_soccer','assists_soccer','shots_soccer','shots_on_target'],
}

const SPORT_COMBOS: Record<string, { name: string; fields: string[] }[]> = {
  nba: [
    { name: 'Pts+Reb',     fields: ['points','rebounds'] },
    { name: 'Pts+Ast',     fields: ['points','assists'] },
    { name: 'Reb+Ast',     fields: ['rebounds','assists'] },
    { name: 'Pts+Reb+Ast', fields: ['points','rebounds','assists'] },
  ],
  mlb: [{ name: 'H+R+RBI', fields: ['hits','runs','rbi'] }],
  nhl: [{ name: 'G+A',     fields: ['goals','assists_hockey'] }],
  nfl: [
    { name: 'Pass+Rush Yds', fields: ['passing_yards','rushing_yards'] },
    { name: 'Rush+Rec Yds',  fields: ['rushing_yards','receiving_yards'] },
  ],
  soccer: [{ name: 'G+A', fields: ['goals_soccer','assists_soccer'] }],
}

const ESPN: Record<string, string> = {
  nba:    'basketball/nba',
  nfl:    'football/nfl',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/eng.1',
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// HELPERS
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
function roundLine(n: number) { return Math.round(n / 0.5) * 0.5 }
function hitRate(vals: number[], line: number) {
  if (!vals.length) return 0
  return vals.filter(v => v >= line).length / vals.length
}
function stdDev(vals: number[]) {
  if (!vals.length) return 0
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)
}
function ok(data: any) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}
function err(msg: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// REAL INGESTION (teams, players, games, box scores)
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
async function fetchTeams(sb: any, sport: string) {
  let teams: any[] = []
  if (sport === 'mlb') {
    const r = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1')
    const d = await r.json()
    teams = (d.teams || []).map((t: any) => ({
      external_id: String(t.id), sport,
      name: t.name, abbreviation: t.abbreviation,
      city: t.locationName, conference: t.league?.name || null,
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
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN[sport]}/teams?limit=50`)
    const d = await r.json()
    const raw = d.sports?.[0]?.leagues?.[0]?.teams || []
    teams = raw.map((t: any) => ({
      external_id: t.team.id, sport,
      name: t.team.displayName, abbreviation: t.team.abbreviation,
      city: t.team.location || null, logo_url: t.team.logos?.[0]?.href || null,
    }))
  }
  if (teams.length) await sb.from('teams').upsert(teams, { onConflict: 'sport,external_id' })
  return teams.length
}

async function fetchPlayers(sb: any, sport: string) {
  const { data: teams } = await sb.from('teams').select('id, external_id, abbreviation').eq('sport', sport)
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
          headshot_url: p.headshot || null, status: 'active',
        }))
      } else {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN[sport]}/teams/${team.external_id}/roster`)
        const d = await r.json()
        const athletes = d.athletes?.flatMap((g: any) => g.items || []) || d.athletes || []
        players = athletes.map((a: any) => ({
          external_id: a.id, sport,
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
    } catch (e) { console.error(`Player fetch error [${sport}/${team.external_id}]:`, e) }
  }
  return total
}

async function fetchGames(sb: any, sport: string, date?: string) {
  const d = date || new Date().toISOString().split('T')[0]
  const { data: teams } = await sb.from('teams').select('id, external_id, abbreviation').eq('sport', sport)
  const teamMap = new Map(teams?.map((t: any) => [String(t.external_id), t.id]) || [])
  const games: any[] = []
  if (sport === 'mlb') {
    const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${d}`)
    const j = await r.json()
    for (const dd of (j.dates || [])) for (const g of (dd.games || [])) {
      const status = g.status?.abstractGameState === 'Final' ? 'finished' :
                     g.status?.abstractGameState === 'Live'  ? 'live' : 'upcoming'
      games.push({ external_id: String(g.gamePk), sport,
        home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
        away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
        game_date: d, start_time: g.gameDate || null, status,
        home_score: g.teams?.home?.score||0, away_score: g.teams?.away?.score||0, season:'2025',
      })
    }
  } else if (sport === 'nhl') {
    const r = await fetch(`https://api-web.nhle.com/v1/schedule/${d}`)
    const j = await r.json()
    for (const g of (j.gameWeek?.[0]?.games || [])) {
      const status = g.gameState==='OFF'?'finished':g.gameState==='LIVE'||g.gameState==='CRIT'?'live':'upcoming'
      games.push({ external_id: String(g.id), sport,
        home_team_id: teamMap.get(g.homeTeam?.abbrev)||null,
        away_team_id: teamMap.get(g.awayTeam?.abbrev)||null,
        game_date: d, status,
        home_score: g.homeTeam?.score||0, away_score: g.awayTeam?.score||0,
      })
    }
  } else {
    const formatted = d.replace(/-/g,'')
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN[sport]}/scoreboard?dates=${formatted}`)
    const j = await r.json()
    for (const ev of (j.events || [])) {
      const comp = ev.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway==='home')
      const away = comp?.competitors?.find((c: any) => c.homeAway==='away')
      const st = comp?.status?.type?.name
      const status = st==='STATUS_FINAL'?'finished':st==='STATUS_IN_PROGRESS'?'live':'upcoming'
      games.push({ external_id: ev.id, sport,
        home_team_id: teamMap.get(home?.team?.id)||null,
        away_team_id: teamMap.get(away?.team?.id)||null,
        game_date: d, start_time: ev.date||null, status,
        home_score: parseInt(home?.score||'0'), away_score: parseInt(away?.score||'0'),
        current_period: comp?.status?.period?String(comp.status.period):null,
        time_remaining: comp?.status?.displayClock||null, venue: comp?.venue?.fullName||null,
      })
    }
  }
  if (games.length) await sb.from('games_data').upsert(games, { onConflict: 'sport,external_id' })
  return games.length
}

async function fetchBoxScores(sb: any, date?: string) {
  const d = date || new Date().toISOString().split('T')[0]
  const { data: games } = await sb.from('games_data').select('id,external_id')
    .eq('sport','nba').eq('game_date',d).in('status',['finished','live'])
  const { data: allPlayers } = await sb.from('players').select('id,external_id').eq('sport','nba')
  const playerMap = new Map(allPlayers?.map((p: any) => [p.external_id, p.id]) || [])
  let total = 0
  for (const game of (games || [])) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.external_id}`)
      if (!r.ok) continue
      const data = await r.json()
      const stats: any[] = []
      for (const teamBox of (data.boxscore?.players || [])) {
        for (const sg of (teamBox.statistics || [])) {
          const labels: string[] = sg.labels || []
          for (const athlete of (sg.athletes || [])) {
            const pid = playerMap.get(athlete.athlete?.id)
            if (!pid) continue
            const s = athlete.stats || []
            const stat: any = {
              player_id: pid, game_id: game.id, sport: 'nba',
              player_name: athlete.athlete?.displayName,
              team_abbreviation: teamBox.team?.abbreviation,
              game_date: d, started: athlete.starter || false,
            }
            labels.forEach((lbl: string, i: number) => {
              const v = s[i]
              if (lbl==='PTS') stat.points = parseInt(v)||0
              if (lbl==='REB') stat.rebounds = parseInt(v)||0
              if (lbl==='AST') stat.assists = parseInt(v)||0
              if (lbl==='STL') stat.steals = parseInt(v)||0
              if (lbl==='BLK') stat.blocks = parseInt(v)||0
              if (lbl==='TO')  stat.turnovers = parseInt(v)||0
              if (lbl==='MIN') stat.minutes_played = parseFloat(v)||0
              if (lbl==='3PT') {
                const [m,a] = (v||'0-0').split('-')
                stat.three_pointers_made = parseInt(m)||0
                stat.three_pointers_attempted = parseInt(a)||0
              }
              if (lbl==='FG') {
                const [m,a] = (v||'0-0').split('-')
                stat.field_goals_made = parseInt(m)||0
                stat.field_goals_attempted = parseInt(a)||0
              }
              if (lbl==='FT') {
                const [m,a] = (v||'0-0').split('-')
                stat.free_throws_made = parseInt(m)||0
                stat.free_throws_attempted = parseInt(a)||0
              }
            })
            stats.push(stat)
          }
        }
      }
      if (stats.length) {
        await sb.from('player_game_stats').upsert(stats, { onConflict: 'player_id,game_id' })
        total += stats.length
      }
      await new Promise(r => setTimeout(r, 250))
    } catch (e) { console.error('Box score error:', e) }
  }
  return total
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// PROPS ENGINE (uses player_game_stats)
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
async function computeProps(sb: any, sport: string, player_id?: string) {
  const statFields = SPORT_STAT_FIELDS[sport] || []
  const combos     = SPORT_COMBOS[sport] || []
  let q = sb.from('players').select('id,full_name').eq('sport', sport)
  if (player_id) q = q.eq('id', player_id)
  const { data: players } = await q.limit(500)
  if (!players?.length) return { players_processed: 0, props_generated: 0 }
  const allProps: any[] = []
  let processed = 0
  for (const player of players) {
    const { data: stats } = await sb.from('player_game_stats').select('*')
      .eq('player_id', player.id).order('game_date', { ascending: false }).limit(20)
    if (!stats || stats.length < 3) continue
    const buildProp = (values: number[], name: string, isCombo: boolean) => {
      if (values.length < 3) return null
      const l5  = values.slice(0,5)
      const l10 = values.slice(0,10)
      const l20 = values.slice(0,20)
      const avg5  = l5.reduce((a,b)=>a+b,0)/l5.length
      const avg10 = l10.reduce((a,b)=>a+b,0)/l10.length
      const avg20 = l20.reduce((a,b)=>a+b,0)/l20.length
      const proj  = avg5*0.5 + avg10*0.3 + avg20*0.2
      const line  = roundLine(proj)
      const hr5   = hitRate(l5,  line)
      const hr10  = hitRate(l10, line)
      const hr20  = hitRate(l20, line)
      const sd    = stdDev(l20)
      const trend = avg5>avg20*1.05?'up':avg5<avg20*0.95?'down':'stable'
      const edge  = proj>line*1.08?'OVER':proj<line*0.92?'UNDER':'NONE'
      const conf  = Math.min(1,Math.max(0,
        hr20*0.3 + (trend==='up'?0.2:trend==='down'?-0.1:0.05) +
        (1-Math.min(sd/(avg20||1),1))*0.3 + (values.length/20)*0.2
      ))
      return {
        player_id: player.id, sport, player_name: player.full_name,
        stat_type: name, is_combo: isCombo,
        projected_value: Math.round(proj*100)/100,
        baseline_line: line,
        hit_rate_last5:  Math.round(hr5*100)/100,
        hit_rate_last10: Math.round(hr10*100)/100,
        hit_rate_last20: Math.round(hr20*100)/100,
        avg_last5:  Math.round(avg5*100)/100,
        avg_last10: Math.round(avg10*100)/100,
        avg_last20: Math.round(avg20*100)/100,
        trend, consistency: Math.round(sd*100)/100,
        edge_type: edge, confidence_score: Math.round(conf*100)/100,
        last_updated: new Date().toISOString(),
      }
    }
    for (const field of statFields) {
      const vals = stats.map((s: any) => s[field]).filter((v: any) => v != null) as number[]
      const p = buildProp(vals, field, false)
      if (p) allProps.push(p)
    }
    for (const combo of combos) {
      const vals = stats.map((s: any) =>
        combo.fields.reduce((acc: number, f: string) => acc + (Number(s[f])||0), 0)
      )
      const p = buildProp(vals, combo.name, true)
      if (p) allProps.push(p)
    }
    processed++
  }
  if (player_id) {
    await sb.from('player_props').delete().eq('player_id', player_id)
  } else {
    await sb.from('player_props').delete().eq('sport', sport)
  }
  for (let i=0; i<allProps.length; i+=500) {
    await sb.from('player_props').insert(allProps.slice(i,i+500))
  }
  return { players_processed: processed, props_generated: allProps.length }
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// GET PLAYERS WITH HIT RATES (for scanner)
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
async function getPlayers(sb: any, sport: string) {
  const statFields = SPORT_STAT_FIELDS[sport] || ['points']
  const selectFields = ['player_id','game_date',...statFields].join(',')
  const { data: players } = await sb.from('players')
    .select('id,full_name,position,sport,team_id,teams:team_id(name,abbreviation)')
    .eq('sport', sport).limit(300)
  if (!players?.length) return []
  const { data: allStats } = await sb.from('player_game_stats')
    .select(selectFields).eq('sport', sport)
    .order('game_date', { ascending: false })
  const byPlayer = new Map<string, any[]>()
  allStats?.forEach((s: any) => {
    if (!byPlayer.has(s.player_id)) byPlayer.set(s.player_id, [])
    byPlayer.get(s.player_id)!.push(s)
  })
  return players.map((player: any) => {
    const stats = byPlayer.get(player.id) || []
    const mainField = statFields[0]
    const vals = stats.map((s: any) => Number(s[mainField]||0))
    const avg10 = vals.length
      ? vals.slice(0,10).reduce((a,b)=>a+b,0) / Math.min(10, vals.length)
      : 0
    const calcHR = (n: number) => {
      const slice = vals.slice(0, n)
      if (!slice.length) return 0
      return Math.round(slice.filter(v => v >= avg10).length / slice.length * 100)
    }
    let trend = 'stable'
    if (vals.length >= 10) {
      const l5avg = vals.slice(0,5).reduce((a,b)=>a+b,0)/5
      const p5avg = vals.slice(5,10).reduce((a,b)=>a+b,0)/5
      trend = l5avg>p5avg*1.05?'up':l5avg<p5avg*0.95?'down':'stable'
    }
    return {
      id: player.id,
      name: player.full_name,
      position: player.position || 'N/A',
      team: player.teams?.name,
      team_abbr: player.teams?.abbreviation,
      opponent: 'TBD',
      avg_last10: Math.round(avg10*10)/10,
      hit_rate_last5:  calcHR(5),
      hit_rate_last10: calcHR(10),
      hit_rate_last15: calcHR(15),
      hit_rate_last20: calcHR(20),
      trend,
      games_count: stats.length,
    }
  })
}

// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
// MAIN HANDLER – includes `stats` batch insert
// ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const sb = getSupabase()
    const body = await req.json().catch(() => ({}))
    const { operation, sport, data, player_id, date } = body

    console.log('clever-action:', { operation, sport, date, player_id })

    switch (operation) {

      // ── batch inserts from frontend ──────────────────────────
      case 'teams':
        if (data?.length) await sb.from('teams').upsert(data, { onConflict: 'sport,external_id' })
        return ok({ inserted: data?.length || 0 })

      case 'players':
        if (data?.length) {
          for (let i=0; i<data.length; i+=200)
            await sb.from('players').upsert(data.slice(i,i+200), { onConflict: 'sport,external_id' })
        }
        return ok({ inserted: data?.length || 0 })

      case 'games':
        if (data?.length) {
          for (let i=0; i<data.length; i+=100)
            await sb.from('games_data').upsert(data.slice(i,i+100), { onConflict: 'sport,external_id' })
        }
        return ok({ inserted: data?.length || 0 })

      // 🔥 NEW: batch insert for player_game_stats
      case 'stats':
        if (!data?.length) return ok({ inserted: 0 })
        for (let i=0; i<data.length; i+=200) {
          await sb.from('player_game_stats').upsert(data.slice(i,i+200), { onConflict: 'player_id,game_id' })
        }
        return ok({ inserted: data.length })

      // ── ingestion helpers (calls external APIs) ──────────────
      case 'full':
        if (!sport) return err('sport required', 400)
        return ok({
          teams: await fetchTeams(sb, sport),
          players: await fetchPlayers(sb, sport),
          games: await fetchGames(sb, sport, date)
        })

      case 'ingest_teams':
        return ok({ count: await fetchTeams(sb, sport) })
      case 'ingest_players':
        return ok({ count: await fetchPlayers(sb, sport) })
      case 'ingest_games':
        return ok({ count: await fetchGames(sb, sport, date) })
      case 'boxscores':
        return ok({ count: await fetchBoxScores(sb, date) })

      // ── props & hit rates ───────────────────────────────────
      case 'props':
        if (!sport) return err('sport required', 400)
        return ok(await computeProps(sb, sport, player_id))

      case 'get_players':
        if (!sport) return err('sport required', 400)
        const playersList = await getPlayers(sb, sport)
        return ok({ players: playersList, count: playersList.length, sport })

      // ── daily / live / schedule ─────────────────────────────
      case 'daily': {
        const sports = ['nba','mlb','nhl','nfl','soccer']
        const results: any = {}
        for (const s of sports) {
          try {
            const t = await fetchTeams(sb, s)
            const p = await fetchPlayers(sb, s)
            const g = await fetchGames(sb, s, date)
            const pr = await computeProps(sb, s)
            results[s] = { teams: t, players: p, games: g, ...pr }
          } catch (e: any) { results[s] = { error: e.message } }
        }
        return ok({ results })
      }

      case 'live': {
        const sports = sport ? [sport] : ['nba','mlb','nhl','nfl','soccer']
        let total = 0
        for (const s of sports) total += await fetchGames(sb, s, date)
        if (!sport || sport === 'nba') total += await fetchBoxScores(sb, date)
        return ok({ games_updated: total })
      }

      case 'schedule': {
        const sports = sport ? [sport] : ['nba','mlb','nhl','nfl','soccer']
        let total = 0
        for (const s of sports) total += await fetchGames(sb, s, date)
        return ok({ games_scheduled: total })
      }

      // ── health / test ───────────────────────────────────────
      case 'test':
        return ok({ message: 'clever-action is working!' })

      case 'health': {
        const { count: pc } = await sb.from('players').select('*',{count:'exact',head:true})
        const { count: gc } = await sb.from('games_data').select('*',{count:'exact',head:true})
        const { count: sc } = await sb.from('player_game_stats').select('*',{count:'exact',head:true})
        const { count: prc }= await sb.from('player_props').select('*',{count:'exact',head:true})
        return ok({ players: pc||0, games: gc||0, stats: sc||0, props: prc||0 })
      }

      // ── admin helpers ───────────────────────────────────────
      case 'make_first_admin': {
        const { data: profiles } = await sb.from('profiles').select('user_id').order('created_at').limit(1)
        if (!profiles?.length) return err('No users found')
        await sb.from('user_roles').upsert({ user_id: profiles[0].user_id, role: 'admin' }, { onConflict: 'user_id,role' })
        return ok({ message: 'First user promoted to admin', user_id: profiles[0].user_id })
      }

      case 'make_admin': {
        if (!body.email) return err('email required', 400)
        const { data: { users } } = await sb.auth.admin.listUsers()
        const user = users?.find((u: any) => u.email === body.email)
        if (!user) return err(`User not found: ${body.email}`)
        await sb.from('user_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' })
        return ok({ message: `${body.email} is now admin` })
      }

      default:
        return err(`Unknown operation: "${operation}"`, 400)
    }
  } catch (e: any) {
    console.error('clever-action fatal:', e)
    return err(e.message || 'Unknown error')
  }
})
