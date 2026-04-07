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

const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')
const ODDS_API_URL = 'https://api.odds-api.io/v4'

const SPORT_MAP: Record<string, string> = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  soccer: 'soccer_epl',
}

const BOOKMAKERS = ['Stake', 'BetOnline']

// =====================================================
// Helper functions
// =====================================================

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 500 * i))
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      })
      if (res.ok) return await res.json()
    } catch { /* retry */ }
  }
  throw new Error(`Failed to fetch ${url}`)
}

async function fetchOddsForEvents(sport: string, eventIds: string[] = []) {
  const oddsSport = SPORT_MAP[sport]
  if (!oddsSport) return []

  const url = `${ODDS_API_URL}/sports/${oddsSport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals,player_points,player_rebounds,player_assists`

  try {
    const data = await fetchWithRetry(url)
    const lines = []
    for (const event of data) {
      if (eventIds.length && !eventIds.includes(event.id)) continue
      for (const bookmaker of event.bookmakers) {
        if (!BOOKMAKERS.includes(bookmaker.key)) continue
        for (const market of bookmaker.markets) {
          lines.push({
            sport,
            event_id: event.id,
            event_name: `${event.home_team} vs ${event.away_team}`,
            game_date: event.commence_time?.split('T')[0],
            bookmaker: bookmaker.key,
            market_type: market.key,
            line: market.outcomes[0]?.point ?? null,
            odds: market.outcomes[0]?.price ?? null,
            last_updated: new Date().toISOString(),
          })
        }
      }
    }
    return lines
  } catch (err) {
    console.error(`Odds fetch failed for ${sport}:`, err)
    return []
  }
}

async function fetchGamesForDateRange(sport: string, startDate: Date, endDate: Date) {
  const games = []
  const current = new Date(startDate)
  while (current <= endDate) {
    const fmt = current.toISOString().split('T')[0].replace(/-/g, '')
    const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_MAP[sport]}/scoreboard?dates=${fmt}`
    try {
      const data = await fetchWithRetry(url)
      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0]
        games.push({
          id: ev.id,
          date: current.toISOString().split('T')[0],
          home_team_id: comp?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.id,
          away_team_id: comp?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.id,
          home_team: comp?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.displayName,
          away_team: comp?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.displayName,
        })
      }
    } catch { /* ignore */ }
    current.setDate(current.getDate() + 1)
  }
  return games
}

async function syncTeamsAndPlayers(sb: any, sport: string) {
  const today = new Date()
  const sevenDays = new Date(today)
  sevenDays.setDate(today.getDate() + 7)
  const games = await fetchGamesForDateRange(sport, today, sevenDays)

  const teamExtIds = new Set<string>()
  for (const g of games) {
    if (g.home_team_id) teamExtIds.add(g.home_team_id)
    if (g.away_team_id) teamExtIds.add(g.away_team_id)
  }
  if (teamExtIds.size === 0) return { teams: 0, players: 0 }

  // Upsert teams
  for (const extId of teamExtIds) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_MAP[sport]}/teams/${extId}`
      const teamData = await fetchWithRetry(url)
      const team = teamData.team || teamData
      await sb.from('teams').upsert(
        {
          external_id: String(team.id),
          sport,
          name: team.displayName,
          abbreviation: team.abbreviation,
          logo_url: team.logos?.[0]?.href,
        },
        { onConflict: 'sport,external_id' }
      )
    } catch { /* ignore */ }
  }

  // Get internal team ids
  const { data: teams } = await sb
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport)
    .in('external_id', Array.from(teamExtIds))
  const teamIdMap = new Map(teams?.map(t => [t.external_id, t.id]))

  let playersCount = 0
  for (const extId of teamExtIds) {
    const teamInternalId = teamIdMap.get(extId)
    if (!teamInternalId) continue
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_MAP[sport]}/teams/${extId}/roster`
      const data = await fetchWithRetry(url)
      const athletes = data.athletes || []
      const flat = Array.isArray(athletes) ? athletes.flatMap((g: any) => g.items || [g]) : []
      for (let idx = 0; idx < flat.length; idx++) {
        const a = flat[idx]
        await sb.from('players').upsert(
          {
            external_id: String(a.id),
            sport,
            full_name: a.fullName || a.displayName,
            position: a.position?.abbreviation,
            headshot_url: a.headshot?.href,
            team_id: teamInternalId,
            roster_order: idx,
            is_starter: idx < (sport === 'soccer' ? 11 : sport === 'nfl' ? 22 : 5),
          },
          { onConflict: 'sport,external_id' }
        )
        playersCount++
      }
    } catch { /* ignore */ }
  }
  return { teams: teamExtIds.size, players: playersCount }
}

async function generateTopPicks(sb: any, sport: string) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const games = await fetchGamesForDateRange(sport, today, tomorrow)
  if (games.length === 0) return { picks: [], message: 'No games in next 48 hours' }

  const eventIds = games.map(g => g.id)
  const odds = await fetchOddsForEvents(sport, eventIds)
  if (odds.length === 0) return { picks: [], message: 'No odds available' }

  const teamExtIds = new Set<string>()
  for (const g of games) {
    if (g.home_team_id) teamExtIds.add(g.home_team_id)
    if (g.away_team_id) teamExtIds.add(g.away_team_id)
  }

  const { data: teams } = await sb.from('teams').select('id').eq('sport', sport).in('external_id', Array.from(teamExtIds))
  const teamIds = teams?.map(t => t.id) || []

  const { data: players } = await sb
    .from('players')
    .select(`
      id, full_name, team_id, teams:team_id(name, abbreviation),
      player_averages(last10_avg_points, avg_points, hit_rate_10, points_consistency, avg_minutes)
    `)
    .eq('sport', sport)
    .in('team_id', teamIds)
    .eq('status', 'active')

  if (!players?.length) return { picks: [], message: 'No players' }

  const picks = []
  for (const player of players) {
    const avg = player.player_averages || {}
    const projection = avg.last10_avg_points || avg.avg_points || 15

    // Find best points line for this player
    const playerOdds = odds.filter(o => 
      o.market_type === 'player_points' && 
      o.event_name?.includes(player.teams?.name || '')
    )
    if (playerOdds.length === 0) continue

    const bestLine = playerOdds.reduce((best, curr) => (curr.line > best.line ? curr : best), playerOdds[0])
    const edge = ((projection - bestLine.line) / bestLine.line) * 100
    const consistency = avg.points_consistency || 0.7
    const hitRate = avg.hit_rate_10 || 0.5
    const minutesTrend = Math.min(1, (avg.avg_minutes || 20) / 36)

    let confidence = 50
    confidence += Math.min(30, Math.abs(edge) * 2)
    confidence += consistency * 10
    confidence += hitRate * 10
    confidence += minutesTrend * 5
    confidence = Math.min(100, Math.max(0, Math.round(confidence)))

    if (confidence >= 65 && Math.abs(edge) >= 3) {
      picks.push({
        player_id: player.id,
        player_name: player.full_name,
        sport,
        team: player.teams?.name,
        opponent: games.find(g => g.home_team_id === player.team_id || g.away_team_id === player.team_id)?.away_team || 'TBD',
        stat_type: 'points',
        line: bestLine.line,
        projection: projection,
        edge: Math.round(edge * 10) / 10,
        confidence,
        pick_type: projection > bestLine.line ? 'OVER' : 'UNDER',
        bookmaker: bestLine.bookmaker,
        reasoning: `${projection.toFixed(1)} avg vs ${bestLine.line} line (${Math.abs(edge).toFixed(1)}% edge)`,
        generated_at: new Date().toISOString(),
        expires_at: tomorrow,
      })
    }
  }

  picks.sort((a, b) => b.confidence - a.confidence)
  const topPicks = picks.slice(0, 20)

  if (topPicks.length) {
    await sb.from('top_picks').delete().eq('sport', sport).lt('generated_at', new Date().toISOString())
    await sb.from('top_picks').insert(topPicks)
  }

  return { picks: topPicks, count: topPicks.length }
}

async function smartSync(sb: any, sport: string) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const games = await fetchGamesForDateRange(sport, today, tomorrow)
  if (games.length === 0) return { updated: false, reason: 'no_games' }

  const eventIds = games.map(g => g.id)
  const freshLines = await fetchOddsForEvents(sport, eventIds)
  if (!freshLines.length) return { updated: false, reason: 'no_lines' }

  // Store fresh odds
  await sb.from('odds_cache').delete().in('event_id', eventIds)
  await sb.from('odds_cache').insert(freshLines)

  // Update game check status
  for (const eventId of eventIds) {
    await sb.from('game_check_status').upsert({
      event_id: eventId,
      sport,
      game_date: games.find(g => g.id === eventId)?.date,
      last_checked: new Date().toISOString(),
      needs_update: false,
    }, { onConflict: 'event_id' })
  }

  // Regenerate picks after odds update
  await generateTopPicks(sb, sport)
  return { updated: true, records: freshLines.length }
}

async function fullInitialSync(sb: any, sport: string) {
  const roster = await syncTeamsAndPlayers(sb, sport)
  const today = new Date()
  const sevenDays = new Date(today)
  sevenDays.setDate(today.getDate() + 7)
  const games = await fetchGamesForDateRange(sport, today, sevenDays)
  const eventIds = games.map(g => g.id)
  const lines = await fetchOddsForEvents(sport, eventIds)
  if (lines.length) {
    await sb.from('odds_cache').delete().eq('sport', sport)
    await sb.from('odds_cache').insert(lines)
  }
  await generateTopPicks(sb, sport)
  return { teams: roster.teams, players: roster.players, odds: lines.length }
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport, mode } = body

    if (!operation && sport) operation = 'get_odds'
    if (!operation) throw new Error('Missing operation')

    console.log(`[clever-action] op=${operation} sport=${sport} mode=${mode}`)

    switch (operation) {
      case 'get_odds': {
        const { data: odds } = await sb
          .from('odds_cache')
          .select('*')
          .eq('sport', sport)
          .order('last_updated', { ascending: false })
        return new Response(JSON.stringify({ success: true, odds, count: odds?.length || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_top_picks': {
        const { data: picks } = await sb
          .from('top_picks')
          .select('*')
          .eq('sport', sport)
          .order('confidence', { ascending: false })
          .limit(20)
        return new Response(JSON.stringify({ success: true, picks, count: picks?.length || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_players': {
        const { data: players } = await sb
          .from('players')
          .select(`
            id, full_name, position, status, injury_description, is_starter,
            teams:team_id(name, abbreviation),
            player_averages(last10_avg_points, hit_rate_10, points_consistency)
          `)
          .eq('sport', sport)
          .limit(500)
        const formatted = players?.map(p => ({
          id: p.id,
          name: p.full_name,
          position: p.position || 'N/A',
          team: p.teams?.name,
          team_abbr: p.teams?.abbreviation,
          status: p.status,
          injury_description: p.injury_description,
          is_starter: p.is_starter,
          last10_avg: p.player_averages?.last10_avg_points || 0,
          hit_rate: Math.round((p.player_averages?.hit_rate_10 || 0) * 100),
          consistency: Math.round((p.player_averages?.points_consistency || 0) * 100),
        })) || []
        return new Response(JSON.stringify({ success: true, players: formatted, count: formatted.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'smart_sync': {
        const sports = ['nba', 'nfl', 'mlb', 'nhl', 'soccer']
        const results = {}
        for (const s of sports) {
          const { count } = await sb.from('odds_cache').select('*', { count: 'exact', head: true }).eq('sport', s)
          results[s] = count === 0 ? await fullInitialSync(sb, s) : await smartSync(sb, s)
        }
        return new Response(JSON.stringify({ success: true, results }), { headers: corsHeaders })
      }

      case 'force_sync': {
        if (!sport) throw new Error('sport required')
        const result = await fullInitialSync(sb, sport)
        return new Response(JSON.stringify({ success: true, ...result }), { headers: corsHeaders })
      }

      case 'generate_picks': {
        if (!sport) throw new Error('sport required')
        const result = await generateTopPicks(sb, sport)
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
