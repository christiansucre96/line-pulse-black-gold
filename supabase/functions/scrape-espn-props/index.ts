// supabase/functions/espn-scraper/index.ts
// ESPN-Only Version: Box scores + lines from ESPN public API
// No scraping, no auth, no external dependencies

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ✅ Proper CORS handling for ALL requests
const handleCors = (req: Request) => {
  const origin = req.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Max-Age': '86400', // 24h cache for preflight
  }
}

function respond(data: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSB() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

async function safeFetch(url: string, headers: Record<string, string> = {}) {
  try {
    const r = await fetch(url, {
      headers: { 
        'User-Agent': 'LinePulse/1.0 (Sports Analytics)', 
        'Accept': 'application/json',
        ...headers 
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) {
      console.error(`HTTP ${r.status}: ${url}`)
      return null
    }
    return await r.json()
  } catch (e) {
    console.error(`Fetch error: ${url}`, e)
    return null
  }
}

const ESPN_SPORT_PATH: Record<string, string> = {
  nba: 'basketball/nba', 
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',   
  nhl: 'hockey/nhl',
}

// ✅ Fetch box score stats from ESPN public API
async function fetchBoxScore(sb: any, espnGameId: string, sport = 'nba') {
  const path = ESPN_SPORT_PATH[sport] || 'basketball/nba'
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${espnGameId}`
  
  console.log(`[ESPN] Fetching: ${url}`)
  const data = await safeFetch(url)
  if (!data) return { error: 'Failed to fetch ESPN data' }

  const gameDate = data.header?.competitions?.[0]?.date?.split('T')[0] || new Date().toISOString().split('T')[0]
  const isFinished = data.header?.competitions?.[0]?.status?.type?.completed || false

  // Map ESPN player IDs to our DB IDs
  const {  dbPlayers } = await sb.from('players')
    .select('id,external_id')
    .eq('sport', sport)
  
  const playerMap = new Map<string, string>(
    (dbPlayers || []).map((p: any) => [String(p.external_id), p.id])
  )

  const rows: any[] = []
  const missing: string[] = []

  for (const teamBox of (data.boxscore?.players || [])) {
    const teamAbbr = teamBox.team?.abbreviation || '?'
    
    for (const sg of (teamBox.statistics || [])) {
      const labels: string[] = sg.labels || []
      const catName = (sg.name || sg.type || '').toLowerCase()

      for (const athlete of (sg.athletes || [])) {
        const espnId = String(athlete.athlete?.id || '')
        const dbId = playerMap.get(espnId)
        
        if (!dbId) { 
          missing.push(athlete.athlete?.displayName || espnId)
          continue 
        }

        const stats = athlete.stats || []
        const row: any = {
          player_id: dbId, 
          sport, 
          game_date: gameDate,
          player_name: athlete.athlete?.displayName,
          team_abbreviation: teamAbbr,
          started: athlete.starter || false,
        }

        labels.forEach((lbl: string, i: number) => {
          const raw = stats[i]
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
            if (lbl === '3PT') { 
              const [m,a] = String(raw).split('-')
              row.three_pointers_made = parseInt(m) || 0
              row.three_pointers_attempted = parseInt(a) || 0 
            }
            if (lbl === 'FG') { 
              const [m,a] = String(raw).split('-')
              row.field_goals_made = parseInt(m) || 0
              row.field_goals_attempted = parseInt(a) || 0 
            }
            if (lbl === 'FT') { 
              const [m,a] = String(raw).split('-')
              row.free_throws_made = parseInt(m) || 0
              row.free_throws_attempted = parseInt(a) || 0 
            }
          }
          // Add NFL/MLB/NHL parsing here if needed
        })

        // Only insert if we have at least one stat
        if (row.points !== undefined || row.rebounds !== undefined || row.assists !== undefined) {
          rows.push(row)
        }
      }
    }
  }

  // Insert stats (upsert to avoid duplicates)
  if (rows.length) {
    const { error } = await sb.from('player_game_stats')
      .upsert(rows, { onConflict: 'player_id,game_date,sport' })
    
    if (error) {
      console.error('DB upsert error:', error.message)
      return { error: error.message }
    }
  }

  // Mark game as finished
  await sb.from('games_data')
    .update({ status: 'finished' })
    .eq('sport', sport)
    .eq('external_id', espnGameId)

  console.log(`[ESPN] ✅ ${sport} game ${espnGameId}: ${rows.length} players archived`)
  
  return { 
    success: true, 
    inserted: rows.length, 
    game_date: gameDate, 
    is_finished: isFinished,
    players_not_in_db: missing.length 
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request): Promise<Response> => {
  // ✅ Handle CORS preflight FIRST
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: handleCors(req) 
    })
  }

  const corsHeaders = handleCors(req)

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({})) as any
    const { operation, game_id, sport = 'nba' } = body

    // ✅ Operation: Archive a finished game's box score
    if (operation === 'box_score' || (!operation && game_id)) {
      if (!game_id) {
        return respond({ error: 'game_id (ESPN event ID) required' }, 400, corsHeaders)
      }
      
      console.log(`📊 Box score: ${sport} game ${game_id}`)
      const result = await fetchBoxScore(sb, String(game_id), sport)
      
      if (result.error) {
        return respond({ success: false, error: result.error }, 500, corsHeaders)
      }
      
      return respond({ success: true, operation: 'box_score', game_id, sport, ...result }, 200, corsHeaders)
    }

    // ✅ Operation: Health check
    if (operation === 'test') {
      const { count: statsCount } = await sb.from('player_game_stats')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
      
      return respond({
        success: true, 
        message: 'espn-scraper alive!',
        player_stats_in_db: statsCount || 0,
        supported_operations: ['box_score', 'test'],
      }, 200, corsHeaders)
    }

    // ✅ Default: Show available operations
    return respond({
      success: true,
      message: 'espn-scraper ready',
      operations: {
        box_score: 'Archive ESPN box score stats. Needs: game_id, sport',
        test: 'Health check',
      },
      example: {
        operation: 'box_score',
        game_id: '401585722', // Example NBA game ID
        sport: 'nba'
      }
    }, 200, corsHeaders)

  } catch (e: any) {
    console.error('[espn-scraper] fatal:', e)
    return respond({ 
      success: false, 
      error: e.message || 'Internal server error' 
    }, 500, corsHeaders)
  }
})
