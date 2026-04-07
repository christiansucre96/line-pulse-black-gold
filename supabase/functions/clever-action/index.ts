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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const sb = getSB()
    const body = await req.json().catch(() => ({}))
    let { operation, sport, mode } = body

    // ✅ CRITICAL FIX: default to 'get_players' if operation missing but sport given
    if (!operation && sport) {
      operation = 'get_players'
    }

    if (!operation) {
      return new Response(JSON.stringify({ error: 'Missing operation' }), { status: 400, headers: corsHeaders })
    }

    console.log(`[clever-action] op=${operation} sport=${sport} mode=${mode}`)

    switch (operation) {
      case 'get_players': {
        // Return players from database (with team info)
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
          status: p.status || 'active',
          injury_description: p.injury_description,
          is_starter: p.is_starter || false,
          line: 22.5, // placeholder, will be replaced by real odds later
          confidence: 50,
          hit_rate: Math.round((p.player_averages?.hit_rate_10 || 0) * 100),
        })) || []

        return new Response(JSON.stringify({ success: true, players: formatted, count: formatted.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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

      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders })
    }
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
