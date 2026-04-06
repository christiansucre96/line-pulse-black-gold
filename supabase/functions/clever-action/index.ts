import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSB() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

const ESPN_PATH: Record<string, string> = {
  nba: 'basketball/nba',
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  soccer: 'soccer/eng.1',
}

const STAT_FIELDS: any = {
  nba: ['points','rebounds','assists'],
  nfl: ['passing_yards','rushing_yards','receiving_yards'],
  mlb: ['hits','runs','rbi'],
  nhl: ['goals','assists_hockey'],
  soccer: ['goals_soccer','assists_soccer'],
}

const avg = (arr:number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
const hitRate = (arr:number[], line:number) => arr.filter(v=>v>=line).length/arr.length

// ───────────── ROSTER + INJURY ─────────────
async function updateRoster(sb:any, sport:string) {
  const { data: players } = await sb.from('players').select('*').eq('sport', sport)
  if (!players) return

  for (const p of players) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/athletes/${p.external_id}`)
      const d = await r.json()

      const injury = d.injuries?.[0]

      await sb.from('players').update({
        status: injury ? 'injured' : 'active',
        is_starter: !injury,
        injury_note: injury?.details || null
      }).eq('id', p.id)

    } catch {}
  }
}

// ───────────── PROPS ENGINE ─────────────
async function computeProps(sb:any, sport:string) {
  const { data: players } = await sb.from('players').select('*').eq('sport', sport)

  const allProps:any[] = []

  for (const p of players || []) {
    const { data: logs } = await sb
      .from('player_game_stats')
      .select('*')
      .eq('player_id', p.id)
      .order('game_date', { ascending:false })
      .limit(20)

    if (!logs || logs.length < 5) continue

    for (const stat of STAT_FIELDS[sport]) {
      const vals = logs.map((g:any)=>Number(g[stat] || 0))

      const l5 = vals.slice(0,5)
      const l10 = vals.slice(0,10)
      const l15 = vals.slice(0,15)
      const l20 = vals.slice(0,20)

      const line = Math.round(avg(l10) * 2) / 2

      const hr10 = hitRate(l10, line)

      // 🔴 INJURY IMPACT
      let injuryImpact = 0
      if (p.status === 'injured') injuryImpact = -0.4

      const confidence = Math.max(0, Math.min(1,
        hr10 * 0.6 + (p.is_starter ? 0.2 : -0.2) + injuryImpact
      ))

      const edge =
        avg(l10) > line ? 'OVER' :
        avg(l10) < line ? 'UNDER' : 'NONE'

      allProps.push({
        player_id: p.id,
        sport,
        player_name: p.full_name,
        stat_type: stat,
        baseline_line: line,
        hit_rate_last5: hitRate(l5, line),
        hit_rate_last10: hr10,
        hit_rate_last15: hitRate(l15, line),
        hit_rate_last20: hitRate(l20, line),
        injury_impact: injuryImpact,
        final_confidence: confidence,
        edge_type: edge
      })
    }
  }

  await sb.from('player_props').delete().eq('sport', sport)
  await sb.from('player_props').insert(allProps)

  return allProps
}

// ───────────── TOP PICKS ─────────────
async function generateTopPicks(sb:any, sport:string) {
  const { data: props } = await sb
    .from('player_props')
    .select('*')
    .eq('sport', sport)
    .order('final_confidence', { ascending:false })
    .limit(20)

  const top = (props || []).filter(p => p.final_confidence > 0.65)

  await sb.from('top_picks').delete().eq('sport', sport)

  await sb.from('top_picks').insert(
    top.map(p => ({
      player_id: p.player_id,
      sport,
      player_name: p.player_name,
      prop_type: p.stat_type,
      line: p.baseline_line,
      edge_type: p.edge_type,
      confidence: p.final_confidence
    }))
  )

  return top
}

// ───────────── GET PLAYERS ─────────────
async function getPlayers(sb:any, sport:string) {
  const { data: players } = await sb.from('players').select('*').eq('sport', sport)
  const { data: props } = await sb.from('player_props').select('*').eq('sport', sport)

  const map = new Map()
  for (const p of props || []) {
    if (!map.has(p.player_id)) map.set(p.player_id, [])
    map.get(p.player_id).push(p)
  }

  const result:any[] = []

  for (const pl of players || []) {
    const pList = map.get(pl.id) || []

    for (const prop of pList) {
      result.push({
        id: pl.id + "_" + prop.stat_type,
        name: pl.full_name,
        position: pl.position,
        team: pl.team_id,
        opponent: "TBD",
        line: prop.baseline_line,
        edge_type: prop.edge_type,
        confidence: Math.round(prop.final_confidence * 100),
        hit_rate: Math.round(prop.hit_rate_last10 * 100),
        trend: prop.hit_rate_last5 > prop.hit_rate_last20 ? "up" : "down",
        status: pl.status,
        is_starter: pl.is_starter
      })
    }
  }

  return result
}

// ───────────── MAIN ─────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const sb = getSB()
  const { operation, sport } = await req.json()

  if (operation === "full") {
    await updateRoster(sb, sport)
    await computeProps(sb, sport)
    const top = await generateTopPicks(sb, sport)
    return new Response(JSON.stringify({ success:true, top }))
  }

  if (operation === "get_players") {
    const players = await getPlayers(sb, sport)
    return new Response(JSON.stringify({ players }))
  }

  if (operation === "top_picks") {
    const { data } = await sb.from('top_picks').select('*').eq('sport', sport)
    return new Response(JSON.stringify({ picks:data }))
  }

  return new Response(JSON.stringify({ error:"invalid op" }), { status:400 })
})
