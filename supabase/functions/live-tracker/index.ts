import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

const SPORT_ENDPOINTS: Record<string, string> = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  soccer: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
}

function getStatFields(sport: string): string[] {
  switch (sport) {
    case 'nba': return ['points', 'rebounds', 'assists', 'three_pointers_made']
    case 'mlb': return ['hits', 'runs', 'rbi', 'total_bases']
    case 'nhl': return ['goals', 'assists_hockey', 'shots_on_goal']
    case 'nfl': return ['passing_yards', 'rushing_yards', 'receiving_yards']
    case 'soccer': return ['goals_soccer', 'assists_soccer', 'shots_soccer']
    default: return []
  }
}

function getGameProgress(sport: string, period: number, timeRemaining: string): number {
  // Returns estimated % of game completed
  switch (sport) {
    case 'nba': return Math.min(1, ((period - 1) * 12 + (12 - parseMinutes(timeRemaining))) / 48)
    case 'mlb': return Math.min(1, period / 9)
    case 'nhl': return Math.min(1, ((period - 1) * 20 + (20 - parseMinutes(timeRemaining))) / 60)
    case 'nfl': return Math.min(1, ((period - 1) * 15 + (15 - parseMinutes(timeRemaining))) / 60)
    case 'soccer': return Math.min(1, parseMinutes(timeRemaining) / 90)
    default: return 0.5
  }
}

function parseMinutes(time: string): number {
  if (!time) return 0
  const parts = time.split(':')
  return parseInt(parts[0] || '0') + (parseInt(parts[1] || '0') / 60)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabase()

  try {
    const body = await req.json().catch(() => ({}))
    const sport = body.sport
    const operation = body.operation || 'update_live'

    if (operation === 'update_live') {
      // Update all live games across all sports or a specific sport
      const sports = sport ? [sport] : Object.keys(SPORT_ENDPOINTS)
      let totalUpdated = 0
      let edgesGenerated = 0

      for (const s of sports) {
        const endpoint = SPORT_ENDPOINTS[s]
        if (!endpoint) continue

        try {
          const res = await fetch(endpoint)
          if (!res.ok) continue
          const data = await res.json()

          const events = data.events || []
          const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', s)
          const teamMap = new Map(teams?.map((t: any) => [t.external_id, t.id]) || [])

          for (const event of events) {
            const comp = event.competitions?.[0]
            const statusType = comp?.status?.type?.name
            const status = statusType === 'STATUS_FINAL' ? 'finished' :
                          statusType === 'STATUS_IN_PROGRESS' ? 'live' : 'upcoming'

            const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
            const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')

            // Update game
            await supabase.from('games_data').upsert({
              external_id: event.id,
              sport: s,
              home_team_id: teamMap.get(home?.team?.id) || null,
              away_team_id: teamMap.get(away?.team?.id) || null,
              game_date: event.date?.split('T')[0] || new Date().toISOString().split('T')[0],
              start_time: event.date || null,
              status,
              home_score: parseInt(home?.score || '0'),
              away_score: parseInt(away?.score || '0'),
              current_period: comp?.status?.period ? `${comp.status.period}` : null,
              time_remaining: comp?.status?.displayClock || null,
              venue: comp?.venue?.fullName || null,
            }, { onConflict: 'sport,external_id' })

            totalUpdated++

            // For finished games, trigger box score ingestion
            if (status === 'finished' && s === 'nba') {
              // Fetch box score for finished NBA games
              try {
                const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${event.id}`)
                if (summaryRes.ok) {
                  const summaryData = await summaryRes.json()
                  const { data: game } = await supabase.from('games_data')
                    .select('id')
                    .eq('external_id', event.id)
                    .eq('sport', 'nba')
                    .single()

                  if (game) {
                    // Process box score (simplified)
                    const { data: allPlayers } = await supabase.from('players').select('id, external_id').eq('sport', 'nba')
                    const playerMap = new Map(allPlayers?.map((p: any) => [p.external_id, p.id]) || [])

                    for (const teamBox of (summaryData.boxscore?.players || [])) {
                      for (const statGroup of (teamBox.statistics || [])) {
                        const labels = statGroup.labels || []
                        for (const athlete of (statGroup.athletes || [])) {
                          const playerId = playerMap.get(athlete.athlete?.id)
                          if (!playerId) continue

                          const statValues = athlete.stats || []
                          const statObj: any = {}
                          labels.forEach((label: string, i: number) => {
                            const val = statValues[i]
                            if (label === 'MIN') statObj.minutes_played = parseFloat(val) || 0
                            if (label === 'PTS') statObj.points = parseInt(val) || 0
                            if (label === 'REB') statObj.rebounds = parseInt(val) || 0
                            if (label === 'AST') statObj.assists = parseInt(val) || 0
                            if (label === 'STL') statObj.steals = parseInt(val) || 0
                            if (label === 'BLK') statObj.blocks = parseInt(val) || 0
                            if (label === 'TO') statObj.turnovers = parseInt(val) || 0
                            if (label === '3PT') {
                              const [m, a] = (val || '0-0').split('-')
                              statObj.three_pointers_made = parseInt(m) || 0
                              statObj.three_pointers_attempted = parseInt(a) || 0
                            }
                            if (label === 'FG') {
                              const [m, a] = (val || '0-0').split('-')
                              statObj.field_goals_made = parseInt(m) || 0
                              statObj.field_goals_attempted = parseInt(a) || 0
                            }
                            if (label === 'FT') {
                              const [m, a] = (val || '0-0').split('-')
                              statObj.free_throws_made = parseInt(m) || 0
                              statObj.free_throws_attempted = parseInt(a) || 0
                            }
                          })

                          await supabase.from('player_game_stats').upsert({
                            player_id: playerId,
                            game_id: game.id,
                            sport: 'nba',
                            player_name: athlete.athlete?.displayName,
                            team_abbreviation: teamBox.team?.abbreviation,
                            game_date: event.date?.split('T')[0],
                            started: athlete.starter || false,
                            ...statObj,
                          }, { onConflict: 'player_id,game_id' })
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('Box score fetch error:', e)
              }
            }

            // Generate live edges for in-progress games
            if (status === 'live') {
              const { data: game } = await supabase.from('games_data')
                .select('id')
                .eq('external_id', event.id)
                .eq('sport', s)
                .single()

              if (game) {
                const period = comp?.status?.period || 1
                const clock = comp?.status?.displayClock || '0:00'
                const progress = getGameProgress(s, period, clock)

                if (progress > 0.1) {
                  // Get current stats for players in this game
                  const { data: currentStats } = await supabase
                    .from('player_game_stats')
                    .select('*')
                    .eq('game_id', game.id)

                  const statFields = getStatFields(s)

                  for (const stat of (currentStats || [])) {
                    // Get historical averages
                    const { data: historicalStats } = await supabase
                      .from('player_game_stats')
                      .select('*')
                      .eq('player_id', stat.player_id)
                      .neq('game_id', game.id)
                      .order('game_date', { ascending: false })
                      .limit(10)

                    if (!historicalStats?.length) continue

                    for (const field of statFields) {
                      const current = stat[field] || 0
                      const historicalValues = historicalStats.map((h: any) => h[field]).filter((v: any) => v != null)
                      if (historicalValues.length < 3) continue

                      const historicalAvg = historicalValues.reduce((a: number, b: number) => a + b, 0) / historicalValues.length
                      const projected = progress > 0 ? current / progress : current

                      let edgeType = 'NONE'
                      if (projected > historicalAvg * 1.15) edgeType = 'OVER'
                      else if (projected < historicalAvg * 0.85) edgeType = 'UNDER'

                      const confidence = Math.min(1, Math.max(0, progress * 0.4 + (edgeType !== 'NONE' ? 0.3 : 0) + 0.3))

                      await supabase.from('live_edges').upsert({
                        player_id: stat.player_id,
                        game_id: game.id,
                        sport: s,
                        player_name: stat.player_name,
                        stat_type: field,
                        current_value: current,
                        projected_value: Math.round(projected * 100) / 100,
                        historical_avg: Math.round(historicalAvg * 100) / 100,
                        edge_type: edgeType,
                        confidence_score: Math.round(confidence * 100) / 100,
                        last_updated: new Date().toISOString(),
                      }, { onConflict: 'player_id,game_id' })

                      edgesGenerated++
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Live tracker error for ${s}:`, e)
        }
      }

      // Clean up edges for finished games
      const { data: finishedGames } = await supabase
        .from('games_data')
        .select('id')
        .eq('status', 'finished')

      if (finishedGames?.length) {
        const ids = finishedGames.map(g => g.id)
        await supabase.from('live_edges').delete().in('game_id', ids)
      }

      return new Response(JSON.stringify({
        success: true,
        games_updated: totalUpdated,
        edges_generated: edgesGenerated,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else if (operation === 'schedule') {
      // Fetch today's schedule for all sports
      const today = new Date().toISOString().split('T')[0]
      const formatted = today.replace(/-/g, '')
      let totalGames = 0

      for (const [s, endpoint] of Object.entries(SPORT_ENDPOINTS)) {
        try {
          const url = s === 'mlb'
            ? `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`
            : `${endpoint}?dates=${formatted}`

          const res = await fetch(url)
          if (!res.ok) continue

          const data = await res.json()
          const { data: teams } = await supabase.from('teams').select('id, external_id').eq('sport', s)
          const teamMap = new Map(teams?.map((t: any) => [t.external_id, t.id]) || [])

          if (s === 'mlb') {
            for (const d of (data.dates || [])) {
              for (const g of (d.games || [])) {
                await supabase.from('games_data').upsert({
                  external_id: String(g.gamePk),
                  sport: 'mlb',
                  home_team_id: teamMap.get(String(g.teams?.home?.team?.id)) || null,
                  away_team_id: teamMap.get(String(g.teams?.away?.team?.id)) || null,
                  game_date: today,
                  start_time: g.gameDate || null,
                  status: 'upcoming',
                  season: '2025',
                }, { onConflict: 'sport,external_id' })
                totalGames++
              }
            }
          } else {
            for (const event of (data.events || [])) {
              const comp = event.competitions?.[0]
              const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
              const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')

              await supabase.from('games_data').upsert({
                external_id: event.id,
                sport: s,
                home_team_id: teamMap.get(home?.team?.id) || null,
                away_team_id: teamMap.get(away?.team?.id) || null,
                game_date: today,
                start_time: event.date || null,
                status: 'upcoming',
              }, { onConflict: 'sport,external_id' })
              totalGames++
            }
          }
        } catch (e) {
          console.error(`Schedule error for ${s}:`, e)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        games_scheduled: totalGames,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown operation' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Live tracker error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
