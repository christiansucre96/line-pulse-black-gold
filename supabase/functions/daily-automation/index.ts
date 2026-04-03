import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const baseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  try {
    const results: any = {}
    const sports = ['nba', 'mlb', 'nhl', 'nfl', 'soccer']

    // 1. Fetch teams & rosters for all sports
    for (const sport of sports) {
      try {
        const res = await fetch(`${baseUrl}/functions/v1/sports-ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ sport, operation: 'full' }),
        })
        const data = await res.json()
        results[`${sport}_ingest`] = data
      } catch (e) {
        results[`${sport}_ingest`] = { error: e instanceof Error ? e.message : 'failed' }
      }
    }

    // 2. Fetch today's schedule
    try {
      const res = await fetch(`${baseUrl}/functions/v1/live-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ operation: 'schedule' }),
      })
      results.schedule = await res.json()
    } catch (e) {
      results.schedule = { error: e instanceof Error ? e.message : 'failed' }
    }

    // 3. Generate props for sports with enough data
    for (const sport of sports) {
      try {
        const res = await fetch(`${baseUrl}/functions/v1/props-engine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ sport }),
        })
        results[`${sport}_props`] = await res.json()
      } catch (e) {
        results[`${sport}_props`] = { error: e instanceof Error ? e.message : 'failed' }
      }
    }

    // Log the daily run
    await supabase.from('ingestion_logs').insert({
      sport: 'nba', // placeholder
      operation: 'daily_automation',
      status: 'completed',
      records_processed: Object.keys(results).length,
      completed_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Daily automation error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
