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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabase()
  const url = new URL(req.url)
  const path = url.pathname.replace('/sports-api', '')
  const params = Object.fromEntries(url.searchParams)

  try {
    let result: any

    // GET /players?sport=nba&team_id=xxx&search=lebron
    if (path === '/players' || path === '/players/') {
      let query = supabase.from('players').select('*, teams(name, abbreviation)')
      if (params.sport) query = query.eq('sport', params.sport)
      if (params.team_id) query = query.eq('team_id', params.team_id)
      if (params.search) query = query.ilike('full_name', `%${params.search}%`)
      if (params.status) query = query.eq('status', params.status)
      const limit = parseInt(params.limit || '100')
      const offset = parseInt(params.offset || '0')
      query = query.range(offset, offset + limit - 1).order('full_name')
      const { data, error } = await query
      if (error) throw error
      result = data

    // GET /player/:id/stats?last=10
    } else if (path.match(/^\/player\/[^/]+\/stats/)) {
      const playerId = path.split('/')[2]
      const last = parseInt(params.last || '20')
      const { data, error } = await supabase
        .from('player_game_stats')
        .select('*, games_data(status, home_score, away_score, venue)')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(last)
      if (error) throw error
      result = data

    // GET /player/:id/trends
    } else if (path.match(/^\/player\/[^/]+\/trends/)) {
      const playerId = path.split('/')[2]
      const { data: player } = await supabase.from('players').select('sport').eq('id', playerId).single()
      const { data: stats, error } = await supabase
        .from('player_game_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(20)
      if (error) throw error

      const sport = player?.sport || 'nba'
      const trends = computeTrends(stats || [], sport)
      result = trends

    // GET /player/:id/props
    } else if (path.match(/^\/player\/[^/]+\/props/)) {
      const playerId = path.split('/')[2]
      const { data, error } = await supabase
        .from('player_props')
        .select('*')
        .eq('player_id', playerId)
        .order('stat_type')
      if (error) throw error
      result = data

    // GET /games?sport=nba&status=live&date=2025-01-01
    } else if (path === '/games' || path === '/games/') {
      let query = supabase.from('games_data').select('*, home_team:teams!games_data_home_team_id_fkey(name, abbreviation), away_team:teams!games_data_away_team_id_fkey(name, abbreviation)')
      if (params.sport) query = query.eq('sport', params.sport)
      if (params.status) query = query.eq('status', params.status)
      if (params.date) query = query.eq('game_date', params.date)
      const limit = parseInt(params.limit || '50')
      query = query.limit(limit).order('game_date', { ascending: false })
      const { data, error } = await query
      if (error) throw error
      result = data

    // GET /games/live
    } else if (path === '/games/live') {
      let query = supabase.from('games_data').select('*, home_team:teams!games_data_home_team_id_fkey(name, abbreviation), away_team:teams!games_data_away_team_id_fkey(name, abbreviation)')
        .eq('status', 'live')
      if (params.sport) query = query.eq('sport', params.sport)
      const { data, error } = await query
      if (error) throw error
      result = data

    // GET /games/upcoming
    } else if (path === '/games/upcoming') {
      let query = supabase.from('games_data').select('*, home_team:teams!games_data_home_team_id_fkey(name, abbreviation), away_team:teams!games_data_away_team_id_fkey(name, abbreviation)')
        .eq('status', 'upcoming')
        .order('start_time', { ascending: true })
      if (params.sport) query = query.eq('sport', params.sport)
      const { data, error } = await query.limit(50)
      if (error) throw error
      result = data

    // GET /games/finished
    } else if (path === '/games/finished') {
      let query = supabase.from('games_data').select('*, home_team:teams!games_data_home_team_id_fkey(name, abbreviation), away_team:teams!games_data_away_team_id_fkey(name, abbreviation)')
        .eq('status', 'finished')
        .order('game_date', { ascending: false })
      if (params.sport) query = query.eq('sport', params.sport)
      const { data, error } = await query.limit(50)
      if (error) throw error
      result = data

    // GET /teams?sport=nba
    } else if (path === '/teams' || path === '/teams/') {
      let query = supabase.from('teams').select('*')
      if (params.sport) query = query.eq('sport', params.sport)
      query = query.order('name')
      const { data, error } = await query
      if (error) throw error
      result = data

    // GET /injuries?sport=nba
    } else if (path === '/injuries' || path === '/injuries/') {
      let query = supabase.from('injury_tracking').select('*, players(full_name, position, team_id, teams(name, abbreviation))')
      if (params.sport) query = query.eq('sport', params.sport)
      query = query.order('last_updated', { ascending: false })
      const { data, error } = await query.limit(200)
      if (error) throw error
      result = data

    // GET /props?sport=nba&combo=true
    } else if (path === '/props' || path === '/props/') {
      let query = supabase.from('player_props').select('*')
      if (params.sport) query = query.eq('sport', params.sport)
      if (params.combo === 'true') query = query.eq('is_combo', true)
      if (params.combo === 'false') query = query.eq('is_combo', false)
      if (params.stat_type) query = query.eq('stat_type', params.stat_type)
      query = query.order('confidence_score', { ascending: false, nullsFirst: false })
      const { data, error } = await query.limit(parseInt(params.limit || '100'))
      if (error) throw error
      result = data

    // GET /props/edges
    } else if (path === '/props/edges') {
      let query = supabase.from('player_props').select('*')
        .neq('edge_type', 'NONE')
        .not('edge_type', 'is', null)
      if (params.sport) query = query.eq('sport', params.sport)
      query = query.order('confidence_score', { ascending: false, nullsFirst: false })
      const { data, error } = await query.limit(50)
      if (error) throw error
      result = data

    // GET /edge/live
    } else if (path === '/edge/live') {
      let query = supabase.from('live_edges').select('*')
      if (params.sport) query = query.eq('sport', params.sport)
      query = query.order('confidence_score', { ascending: false, nullsFirst: false })
      const { data, error } = await query.limit(50)
      if (error) throw error
      result = data

    } else {
      return new Response(JSON.stringify({
        error: 'Not found',
        available_endpoints: [
          '/players', '/player/:id/stats', '/player/:id/trends', '/player/:id/props',
          '/games', '/games/live', '/games/upcoming', '/games/finished',
          '/teams', '/injuries', '/props', '/props/edges', '/edge/live'
        ]
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, data: result, count: Array.isArray(result) ? result.length : 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('API error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Compute trends for a player
function computeTrends(stats: any[], sport: string) {
  const statFields = getStatFields(sport)
  const trends: any = {}

  for (const field of statFields) {
    const values = stats.map(s => s[field]).filter(v => v != null)
    if (values.length === 0) continue

    const last5 = values.slice(0, 5)
    const last10 = values.slice(0, 10)
    const last20 = values.slice(0, 20)

    const avg5 = last5.reduce((a: number, b: number) => a + b, 0) / last5.length
    const avg10 = last10.reduce((a: number, b: number) => a + b, 0) / last10.length
    const avg20 = last20.reduce((a: number, b: number) => a + b, 0) / last20.length

    const projection = (avg5 * 0.5) + (avg10 * 0.3) + (avg20 * 0.2)
    const stdDev = Math.sqrt(last20.reduce((sum: number, v: number) => sum + Math.pow(v - avg20, 2), 0) / last20.length)
    const trend = avg5 > avg20 * 1.05 ? 'up' : avg5 < avg20 * 0.95 ? 'down' : 'stable'

    trends[field] = {
      avg_last5: round(avg5),
      avg_last10: round(avg10),
      avg_last20: round(avg20),
      projection: round(projection),
      consistency: round(stdDev),
      trend,
      games_played: values.length,
    }
  }
  return trends
}

function getStatFields(sport: string): string[] {
  switch (sport) {
    case 'nba': return ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'three_pointers_made']
    case 'mlb': return ['hits', 'runs', 'rbi', 'total_bases', 'home_runs', 'stolen_bases', 'strikeouts_pitching']
    case 'nhl': return ['goals', 'assists_hockey', 'shots_on_goal', 'plus_minus']
    case 'nfl': return ['passing_yards', 'passing_tds', 'rushing_yards', 'rushing_tds', 'receiving_yards', 'receiving_tds', 'receptions']
    case 'soccer': return ['goals_soccer', 'assists_soccer', 'shots_soccer', 'shots_on_target', 'tackles']
    default: return []
  }
}

function round(n: number, decimals = 2) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
}
