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

interface PropConfig {
  statFields: string[]
  combos: { name: string; type: string; fields: string[] }[]
}

const SPORT_CONFIGS: Record<string, PropConfig> = {
  nba: {
    statFields: ['points', 'rebounds', 'assists', 'three_pointers_made', 'steals', 'blocks'],
    combos: [
      { name: 'Pts+Reb', type: 'PR', fields: ['points', 'rebounds'] },
      { name: 'Pts+Ast', type: 'PA', fields: ['points', 'assists'] },
      { name: 'Reb+Ast', type: 'RA', fields: ['rebounds', 'assists'] },
      { name: 'Pts+Reb+Ast', type: 'PRA', fields: ['points', 'rebounds', 'assists'] },
    ],
  },
  mlb: {
    statFields: ['hits', 'runs', 'rbi', 'total_bases', 'home_runs', 'stolen_bases'],
    combos: [
      { name: 'H+R+RBI', type: 'HRR', fields: ['hits', 'runs', 'rbi'] },
      { name: 'TB+H', type: 'TBH', fields: ['total_bases', 'hits'] },
    ],
  },
  nhl: {
    statFields: ['goals', 'assists_hockey', 'shots_on_goal'],
    combos: [
      { name: 'G+A', type: 'GA', fields: ['goals', 'assists_hockey'] },
      { name: 'SOG+G', type: 'SG', fields: ['shots_on_goal', 'goals'] },
    ],
  },
  nfl: {
    statFields: ['passing_yards', 'rushing_yards', 'receiving_yards', 'passing_tds', 'rushing_tds', 'receiving_tds', 'receptions'],
    combos: [
      { name: 'Pass+Rush Yds', type: 'PRY', fields: ['passing_yards', 'rushing_yards'] },
      { name: 'Rush+Rec Yds', type: 'RRY', fields: ['rushing_yards', 'receiving_yards'] },
      { name: 'Total Yards', type: 'TY', fields: ['passing_yards', 'rushing_yards', 'receiving_yards'] },
    ],
  },
  soccer: {
    statFields: ['goals_soccer', 'assists_soccer', 'shots_soccer', 'shots_on_target', 'tackles'],
    combos: [
      { name: 'G+A', type: 'GA', fields: ['goals_soccer', 'assists_soccer'] },
    ],
  },
}

function round(n: number, to = 0.5): number {
  return Math.round(n / to) * to
}

function computeHitRate(values: number[], line: number): number {
  if (values.length === 0) return 0
  const hits = values.filter(v => v >= line).length
  return Math.round((hits / values.length) * 100) / 100
}

function computeStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabase()

  try {
    const { sport, player_id } = await req.json()

    if (!sport) {
      return new Response(JSON.stringify({ error: 'sport is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const config = SPORT_CONFIGS[sport]
    if (!config) {
      return new Response(JSON.stringify({ error: `Unsupported sport: ${sport}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get players
    let playersQuery = supabase.from('players').select('id, full_name').eq('sport', sport)
    if (player_id) playersQuery = playersQuery.eq('id', player_id)
    const { data: players, error: pErr } = await playersQuery.limit(500)
    if (pErr) throw pErr

    const allProps: any[] = []
    let processed = 0

    for (const player of (players || [])) {
      const { data: stats } = await supabase
        .from('player_game_stats')
        .select('*')
        .eq('player_id', player.id)
        .order('game_date', { ascending: false })
        .limit(20)

      if (!stats || stats.length < 3) continue

      // Standard props
      for (const field of config.statFields) {
        const values = stats.map(s => s[field]).filter((v: any) => v != null) as number[]
        if (values.length < 3) continue

        const last5 = values.slice(0, 5)
        const last10 = values.slice(0, 10)
        const last20 = values.slice(0, 20)
        const avg5 = last5.reduce((a, b) => a + b, 0) / last5.length
        const avg10 = last10.reduce((a, b) => a + b, 0) / last10.length
        const avg20 = last20.reduce((a, b) => a + b, 0) / last20.length

        const projection = (avg5 * 0.5) + (avg10 * 0.3) + (avg20 * 0.2)
        const baseline = round(projection)
        const consistency = computeStdDev(last20)
        const trend = avg5 > avg20 * 1.05 ? 'up' : avg5 < avg20 * 0.95 ? 'down' : 'stable'

        const hitRate5 = computeHitRate(last5, baseline)
        const hitRate10 = computeHitRate(last10, baseline)
        const hitRate20 = computeHitRate(last20, baseline)

        let edgeType = 'NONE'
        if (projection > baseline * 1.08) edgeType = 'OVER'
        else if (projection < baseline * 0.92) edgeType = 'UNDER'

        const confidence = Math.min(1, Math.max(0,
          (hitRate20 * 0.3) + (trend === 'up' ? 0.2 : trend === 'down' ? -0.1 : 0.05) +
          (1 - Math.min(consistency / (avg20 || 1), 1)) * 0.3 + (values.length / 20) * 0.2
        ))

        allProps.push({
          player_id: player.id,
          sport,
          player_name: player.full_name,
          stat_type: field,
          is_combo: false,
          combo_type: null,
          projected_value: Math.round(projection * 100) / 100,
          baseline_line: baseline,
          hit_rate_last5: hitRate5,
          hit_rate_last10: hitRate10,
          hit_rate_last20: hitRate20,
          avg_last5: Math.round(avg5 * 100) / 100,
          avg_last10: Math.round(avg10 * 100) / 100,
          avg_last20: Math.round(avg20 * 100) / 100,
          trend,
          consistency: Math.round(consistency * 100) / 100,
          edge_type: edgeType,
          confidence_score: Math.round(confidence * 100) / 100,
          last_updated: new Date().toISOString(),
        })
      }

      // Combo props
      for (const combo of config.combos) {
        const comboValues = stats.map((s: any) => {
          const sum = combo.fields.reduce((acc, f) => acc + (s[f] || 0), 0)
          return sum
        })

        if (comboValues.length < 3) continue

        const last5 = comboValues.slice(0, 5)
        const last10 = comboValues.slice(0, 10)
        const last20 = comboValues.slice(0, 20)
        const avg5 = last5.reduce((a, b) => a + b, 0) / last5.length
        const avg10 = last10.reduce((a, b) => a + b, 0) / last10.length
        const avg20 = last20.reduce((a, b) => a + b, 0) / last20.length

        const projection = (avg5 * 0.5) + (avg10 * 0.3) + (avg20 * 0.2)
        const baseline = round(projection)
        const consistency = computeStdDev(last20)
        const trend = avg5 > avg20 * 1.05 ? 'up' : avg5 < avg20 * 0.95 ? 'down' : 'stable'

        const hitRate5 = computeHitRate(last5, baseline)
        const hitRate10 = computeHitRate(last10, baseline)
        const hitRate20 = computeHitRate(last20, baseline)

        let edgeType = 'NONE'
        if (projection > baseline * 1.08) edgeType = 'OVER'
        else if (projection < baseline * 0.92) edgeType = 'UNDER'

        const confidence = Math.min(1, Math.max(0,
          (hitRate20 * 0.3) + (trend === 'up' ? 0.2 : trend === 'down' ? -0.1 : 0.05) +
          (1 - Math.min(consistency / (avg20 || 1), 1)) * 0.3 + (comboValues.length / 20) * 0.2
        ))

        allProps.push({
          player_id: player.id,
          sport,
          player_name: player.full_name,
          stat_type: combo.name,
          is_combo: true,
          combo_type: combo.type,
          projected_value: Math.round(projection * 100) / 100,
          baseline_line: baseline,
          hit_rate_last5: hitRate5,
          hit_rate_last10: hitRate10,
          hit_rate_last20: hitRate20,
          avg_last5: Math.round(avg5 * 100) / 100,
          avg_last10: Math.round(avg10 * 100) / 100,
          avg_last20: Math.round(avg20 * 100) / 100,
          trend,
          consistency: Math.round(consistency * 100) / 100,
          edge_type: edgeType,
          confidence_score: Math.round(confidence * 100) / 100,
          last_updated: new Date().toISOString(),
        })
      }

      processed++
    }

    // Batch upsert props - clear old ones first for the sport
    if (player_id) {
      await supabase.from('player_props').delete().eq('player_id', player_id)
    } else {
      await supabase.from('player_props').delete().eq('sport', sport)
    }

    // Insert in batches of 500
    for (let i = 0; i < allProps.length; i += 500) {
      const batch = allProps.slice(i, i + 500)
      const { error } = await supabase.from('player_props').insert(batch)
      if (error) {
        console.error('Batch insert error:', error)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sport,
      players_processed: processed,
      props_generated: allProps.length,
      standard_props: allProps.filter(p => !p.is_combo).length,
      combo_props: allProps.filter(p => p.is_combo).length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Props engine error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
