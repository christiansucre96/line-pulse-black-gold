// supabase/functions/clever-action/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    let rawBody = await req.text();
    let requestBody = rawBody ? JSON.parse(rawBody) : {};
    const { operation, sport = "nba" } = requestBody;

    if (operation === "sync_sport") return await handleSyncSport(requestBody, sport);
    if (operation === "get_player_details") return await handleGetPlayerDetails(requestBody, sport);
    if (operation === "get_players_with_stats") return await handleGetPlayersWithStats(requestBody, sport);
    
    return new Response(JSON.stringify({ success: false, error: "Unknown op" }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────
// 🔄 ADMIN SYNC OPERATION
// ─────────────────────────────────────────────────────────────

async function handleSyncSport(requestBody: any, sport: string) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // ✅ Correct player IDs per sport/API
  const playersBySport: Record<string, Array<{id: string, name: string, team: string}>> = {
    nba: [
      { id: "237", name: "LeBron James", team: "LAL" },
      { id: "115", name: "Stephen Curry", team: "GSW" },
      { id: "140", name: "Kevin Durant", team: "PHX" },
      { id: "246", name: "Nikola Jokic", team: "DEN" },
      { id: "666", name: "Luka Doncic", team: "DAL" }
    ],
    nfl: [
      { id: "1845", name: "Patrick Mahomes", team: "KC" },
      { id: "4035", name: "Josh Allen", team: "BUF" },
      { id: "4046", name: "Justin Jefferson", team: "MIN" }
    ],
    mlb: [
      { id: "660673", name: "Aaron Judge", team: "NYY" },
      { id: "592450", name: "Mookie Betts", team: "LAD" },
      { id: "665742", name: "Ronald Acuña Jr.", team: "ATL" }
    ],
    nhl: [
      { id: "8478402", name: "Auston Matthews", team: "TOR" },
      { id: "8477934", name: "Connor McDavid", team: "EDM" },
      { id: "8479318", name: "Nathan MacKinnon", team: "COL" }
    ],
    soccer: [
      { id: "276", name: "Erling Haaland", team: "MCI" },
      { id: "874", name: "Kylian Mbappé", team: "PSG" },
      { id: "154", name: "Mohamed Salah", team: "LIV" }
    ]
  };

  const players = playersBySport[sport] || [];
  let inserted = 0;
  
  for (const p of players) {
    try { 
      await getOrFetchPlayerData(p.id, sport, supabase); 
      inserted++; 
    } catch (e) {
      console.error(`Failed to sync ${p.name}:`, e);
    }
  }
  
  return new Response(JSON.stringify({ success: true, inserted, sport }), 
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ─────────────────────────────────────────────────────────────
// 📐 SHARP LINE GENERATOR
// ─────────────────────────────────────────────────────────────

function stdDev(arr: number[]): number {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
}

function probToAmericanOdds(prob: number): number {
  if (prob >= 1) return -999; if (prob <= 0) return 999;
  return prob > 0.5 ? Math.round(-100 * prob / (1 - prob)) : Math.round(100 * (1 - prob) / prob);
}

function generateLineFromHistory(values: number[], sport: string, prop: string) {
  if (!values || values.length < 3) return { line: 0, projection: 0, confidence: 0, stdDev: 0, ev: 0, hitRate: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const deviation = stdDev(sorted);
  const baseLine = sorted[Math.floor(0.47 * (sorted.length - 1))];
  
  const l3 = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const l10 = values.slice(0, Math.min(10, values.length)).reduce((a, b) => a + b, 0) / Math.min(10, values.length);
  const trendAdj = (l3 - l10) * 0.25;
  
  let finalLine = baseLine + trendAdj;
  if (sport === "nfl" && (prop.includes("Yards") || prop.includes("Yds"))) finalLine = Math.round(finalLine / 5) * 5;
  else if (["doubleDouble","tripleDouble","anytimeTD","firstTD","anytimeGoal"].includes(prop)) finalLine = 0.5;
  else finalLine = Math.round(finalLine * 2) / 2;
  if (finalLine < 0.5 && !["doubleDouble","tripleDouble","anytimeTD","firstTD","anytimeGoal"].includes(prop)) finalLine = 0.5;

  const projection = mean + ((l3 - l10) * 0.4);
  const cv = mean > 0 ? deviation / mean : 1;
  const confidence = Math.max(15, Math.min(95, 100 - (cv * 180)));
  const overProb = values.filter(v => v > finalLine).length / values.length;
  
  return {
    line: finalLine, projection: +projection.toFixed(2), confidence: Math.round(confidence),
    stdDev: +deviation.toFixed(2), ev: +(overProb * 1.909 - 1).toFixed(3), hitRate: Math.round(overProb * 100)
  };
}

// ─────────────────────────────────────────────────────────────
// 🌍 PROP DEFINITIONS (All 5 Sports)
// ─────────────────────────────────────────────────────────────

const SPORT_PROPS: Record<string, any> = {
  nba: { 
    singles: ["points","rebounds","assists","threes","steals","blocks","turnovers","minutes"], 
    combos: [
      {id:"PR",keys:["points","rebounds"]},{id:"PA",keys:["points","assists"]},
      {id:"RA",keys:["rebounds","assists"]},{id:"PRA",keys:["points","rebounds","assists"]},
      {id:"STL+BLK",keys:["steals","blocks"]}
    ], 
    booleans: ["doubleDouble","tripleDouble"] 
  },
  nfl: { 
    singles: ["passYards","passTD","completions","attempts","interceptions","rushYards","rushAtt","rushTD","receptions","recYards","recTD","sacks","tackles"], 
    combos: [
      {id:"Pass+Rush",keys:["passYards","rushYards"]},{id:"Rush+Rec",keys:["rushYards","recYards"]},
      {id:"Pass+Rush+Rec",keys:["passYards","rushYards","recYards"]}
    ], 
    booleans: ["anytimeTD","firstTD"] 
  },
  mlb: { 
    singles: ["hits","runs","rbi","homeRuns","totalBases","strikeouts","earnedRuns","hitsAllowed","walksAllowed"], 
    combos: [
      {id:"H+R+RBI",keys:["hits","runs","rbi"]},{id:"TB+HR",keys:["totalBases","homeRuns"]}
    ], 
    booleans: [] 
  },
  nhl: { 
    singles: ["goals","assists","shots","saves","goalsAllowed","hits","blocks"], 
    combos: [
      {id:"Pts",keys:["goals","assists"]},{id:"Pts+SOG",keys:["goals","assists","shots"]}
    ], 
    booleans: ["anytimeGoal"] 
  },
  soccer: { 
    singles: ["goals","assists","shots","shotsOnTarget","passes","tackles","saves"], 
    combos: [
      {id:"G+A",keys:["goals","assists"]},{id:"G+A+SOT",keys:["goals","assists","shotsOnTarget"]}
    ], 
    booleans: [] 
  }
};

function generateAllLines(player: any, sport: string) {
  if (!player?.stats) return [];
  const config = SPORT_PROPS[sport] || SPORT_PROPS.nba;
  const lines = [];
  const getArr = (k: string) => Array.isArray(player.stats?.[k]) ? player.stats[k] : [];

  config.singles.forEach((p: string) => {
    const d = getArr(p);
    if (d.length >= 3) {
      const r = generateLineFromHistory(d, sport, p);
      lines.push({ prop: p.toUpperCase(), line: r.line, projection: r.projection, americanOdds: probToAmericanOdds(0.5), confidence: r.confidence, ev: r.ev, edgePct: `${(r.confidence-50).toFixed(1)}%`, recommendation: r.ev>0.03?"STRONG OVER":r.ev>0.01?"OVER":r.ev<-0.03?"STRONG UNDER":r.ev<-0.01?"UNDER":"NO BET", hitRate: r.hitRate });
    }
  });
  config.combos.forEach((c: any) => {
    const first = getArr(c.keys[0]);
    if (!first.length) return;
    const combined = first.map((_: any, i: number) => c.keys.reduce((s: number, k: string) => s + (getArr(k)[i]||0), 0));
    if (combined.length >= 3) {
      const r = generateLineFromHistory(combined, sport, c.id);
      lines.push({ prop: c.id, line: r.line, projection: r.projection, americanOdds: probToAmericanOdds(0.5), confidence: r.confidence, ev: r.ev, edgePct: `${(r.confidence-50).toFixed(1)}%`, recommendation: r.ev>0.03?"STRONG OVER":r.ev>0.01?"OVER":r.ev<-0.03?"STRONG UNDER":r.ev<-0.01?"UNDER":"NO BET", hitRate: r.hitRate });
    }
  });
  config.booleans.forEach((p: string) => {
    const d = getArr(p);
    if (d.length >= 3) {
      const hr = d.filter((v: number) => v===1).length/d.length;
      const ev = hr*1.909-1;
      lines.push({ prop: p.toUpperCase(), line: 0.5, projection: +(hr*100).toFixed(1), americanOdds: probToAmericanOdds(hr), confidence: Math.round(hr*100), ev: +ev.toFixed(3), edgePct: `${((hr-0.5238)*100).toFixed(1)}%`, recommendation: ev>0.03?"YES":ev<-0.03?"NO":"PASS", hitRate: Math.round(hr*100) });
    }
  });
  return lines;
}

// ─────────────────────────────────────────────────────────────
// 🔌 LIVE DATA FETCHERS (All 5 Sports - No Mock Data)
// ─────────────────────────────────────────────────────────────

async function fetchNBAStats(playerId: string) {
  try {
    const res = await fetch(`https://www.balldontlie.io/api/v1/stats?player_ids[]=${playerId}&seasons[]=2023&per_page=100`);
    if (!res.ok) {
      console.error(`NBA API failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    console.log(`✅ NBA: Fetched ${json.data?.length || 0} games for player ${playerId}`);
    return json.data.map((g: any) => ({
      game_date: g.game.date.split("T")[0], 
      opponent: g.game.visitor_team.abbreviation === g.team.abbreviation ? g.game.home_team.abbreviation : g.game.visitor_team.abbreviation,
      is_home: g.team.abbreviation === g.game.home_team.abbreviation,
      points: g.pts, rebounds: g.reb, assists: g.ast, threes: g.fg3m, steals: g.stl, blocks: g.blk, turnovers: g.turnover, minutes: g.min
    }));
  } catch (e) {
    console.error("NBA Fetch Error:", e);
    return [];
  }
}

async function fetchNFLStats(playerId: string) {
  const API_KEY = Deno.env.get("API_SPORTS_KEY");
  if (!API_KEY) {
    console.error("❌ API_SPORTS_KEY not set for NFL");
    return [];
  }
  try {
    const res = await fetch(`https://api-american-football.com/players/statistics?player=${playerId}&season=2024`, { 
      headers: { "x-apisports-key": API_KEY } 
    });
    if (!res.ok) {
      console.error(`NFL API failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const allGames = (json.response || []).flatMap((r: any) => r.games || []);
    console.log(`✅ NFL: Fetched ${allGames.length} games for player ${playerId}`);
    return allGames.slice(0, 20).map((g: any) => ({
      game_date: g.date?.split("T")[0], opponent: g.teams?.away?.name || "OPP", is_home: false,
      passYards: g.statistics?.yards_passing || 0, passTD: g.statistics?.touchdowns_passing || 0,
      completions: g.statistics?.completions_passing || 0, attempts: g.statistics?.attempts_passing || 0,
      interceptions: g.statistics?.interceptions || 0, rushYards: g.statistics?.yards_rushing || 0,
      rushAtt: g.statistics?.attempts_rushing || 0, rushTD: g.statistics?.touchdowns_rushing || 0,
      receptions: g.statistics?.receptions || 0, recYards: g.statistics?.yards_receiving || 0, recTD: g.statistics?.touchdowns_receiving || 0,
      sacks: g.statistics?.sacks || 0, tackles: g.statistics?.tackles || 0
    }));
  } catch (e) {
    console.error("NFL Fetch Error:", e);
    return [];
  }
}

async function fetchMLBStats(playerId: string) {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&gameType=R&season=2024`);
    if (!res.ok) {
      console.error(`MLB API failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const splits = json.stats?.[0]?.splits || [];
    console.log(`✅ MLB: Fetched ${splits.length} games for player ${playerId}`);
    return splits.map((s: any) => ({
      game_date: s.date.split("T")[0], opponent: s.opponent?.abbreviation || "OPP", is_home: s.gameType === "R",
      hits: s.stat.hits, runs: s.stat.runs, rbi: s.stat.rbi, homeRuns: s.stat.homeRuns, totalBases: s.stat.totalBases,
      strikeouts: s.stat.strikeOuts, earnedRuns: s.stat.earnedRuns || 0, hitsAllowed: s.stat.hitsAllowed || 0, walksAllowed: s.stat.baseOnBalls || 0
    }));
  } catch (e) {
    console.error("MLB Fetch Error:", e);
    return [];
  }
}

async function fetchNHLStats(playerId: string) {
  try {
    const res = await fetch(`https://statsapi.web.nhl.com/api/v1/people/${playerId}/stats?stats=gameLog&season=20232024`);
    if (!res.ok) {
      console.error(`NHL API failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const splits = json.stats?.[0]?.splits || [];
    console.log(`✅ NHL: Fetched ${splits.length} games for player ${playerId}`);
    return splits.map((s: any) => ({
      game_date: s.date.split("T")[0], opponent: s.opponent?.abbreviation || "OPP", is_home: s.gameType === "R",
      goals: s.stat.goals, assists: s.stat.assists, shots: s.stat.shots, saves: s.stat.saves || 0, goalsAllowed: s.stat.goalsAgainst || 0, hits: s.stat.hits || 0, blocks: s.stat.blocked || 0
    }));
  } catch (e) {
    console.error("NHL Fetch Error:", e);
    return [];
  }
}

async function fetchSoccerStats(playerId: string) {
  const API_KEY = Deno.env.get("API_SPORTS_KEY");
  if (!API_KEY) {
    console.error("❌ API_SPORTS_KEY not set for Soccer");
    return [];
  }
  try {
    const res = await fetch(`https://api-football.com/players/statistics?player=${playerId}&season=2024`, { 
      headers: { "x-apisports-key": API_KEY } 
    });
    if (!res.ok) {
      console.error(`Soccer API failed: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const allStats = (json.response || []).flatMap((r: any) => r.statistics || []);
    const allGames = allStats.flatMap((s: any) => s.games || []);
    console.log(`✅ Soccer: Fetched ${allGames.length} games for player ${playerId}`);
    return allGames.slice(0, 20).map((g: any) => ({
      game_date: g.fixture?.date?.split("T")[0], opponent: g.fixture?.teams?.away?.name || "OPP", is_home: false,
      goals: g.statistics?.goals?.total || 0, assists: g.statistics?.goals?.assists || 0, shots: g.statistics?.shots?.total || 0,
      shotsOnTarget: g.statistics?.shots?.on || 0, passes: g.statistics?.passes?.total || 0, tackles: g.statistics?.tackles?.total || 0, saves: g.statistics?.goals?.saves || 0
    }));
  } catch (e) {
    console.error("Soccer Fetch Error:", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// 🔄 CACHE-AWARE DATA PIPELINE (NO MOCK DATA)
// ─────────────────────────────────────────────────────────────

async function getOrFetchPlayerData(playerId: string, sport: string, supabaseClient?: any) {
  const supabase = supabaseClient || createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // 1. Check Cache (Last 7 days)
  const {  cachedGames } = await supabase
    .from("player_game_logs")
    .select("stats, game_date")
    .eq("player_id", playerId)
    .eq("sport", sport)
    .gte("game_date", new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0])
    .order("game_date", { ascending: false });

  if (cachedGames && cachedGames.length >= 10) {
    console.log(`✅ Cache hit for ${playerId} (${cachedGames.length} games)`);
    const statsObj: Record<string, number[]> = {};
    cachedGames.forEach(g => {
      Object.entries(g.stats).forEach(([k, v]: any) => {
        if (!statsObj[k]) statsObj[k] = [];
        statsObj[k].push(Number(v) || 0);
      });
    });
    return { stats: statsObj, source: "cache" };
  }

  console.log(`🔄 Cache miss for ${playerId} (${sport}), fetching live...`);

  // 2. Fetch Live (NO MOCK FALLBACK)
  let rawGames: any[] = [];
  try {
    if (sport === "nba") rawGames = await fetchNBAStats(playerId);
    else if (sport === "nfl") rawGames = await fetchNFLStats(playerId);
    else if (sport === "mlb") rawGames = await fetchMLBStats(playerId);
    else if (sport === "nhl") rawGames = await fetchNHLStats(playerId);
    else if (sport === "soccer") rawGames = await fetchSoccerStats(playerId);
  } catch (e) {
    console.error("Fetch Error:", e);
    return { stats: {}, source: "error" };
  }

  if (!rawGames.length) {
    console.warn(`⚠️ No data returned for ${playerId} (${sport})`);
    return { stats: {}, source: "empty" };
  }

  console.log(`✅ Fetched ${rawGames.length} games for ${playerId}`);

  // 3. Upsert to Cache
  const inserts = rawGames.map(g => ({
    player_id: playerId, 
    sport, 
    season: "2024", 
    game_date: g.game_date, 
    opponent: g.opponent, 
    is_home: g.is_home,
    stats: { 
      points: g.points||0, 
      rebounds: g.rebounds||0, 
      assists: g.assists||0, 
      threes: g.threes||0, 
      steals: g.steals||0, 
      blocks: g.blocks||0, 
      turnovers: g.turnovers||0, 
      minutes: g.minutes||0, 
      passYards: g.passYards||0, 
      passTD: g.passTD||0, 
      completions: g.completions||0, 
      attempts: g.attempts||0, 
      interceptions: g.interceptions||0, 
      rushYards: g.rushYards||0, 
      rushAtt: g.rushAtt||0, 
      rushTD: g.rushTD||0, 
      receptions: g.receptions||0, 
      recYards: g.recYards||0, 
      recTD: g.recTD||0, 
      sacks: g.sacks||0, 
      tackles: g.tackles||0, 
      hits: g.hits||0, 
      runs: g.runs||0, 
      rbi: g.rbi||0, 
      homeRuns: g.homeRuns||0, 
      totalBases: g.totalBases||0, 
      strikeouts: g.strikeouts||0, 
      earnedRuns: g.earnedRuns||0, 
      hitsAllowed: g.hitsAllowed||0, 
      walksAllowed: g.walksAllowed||0, 
      goals: g.goals||0, 
      shots: g.shots||0, 
      saves: g.saves||0, 
      goalsAllowed: g.goalsAllowed||0, 
      blocks: g.blocks||0, 
      shotsOnTarget: g.shotsOnTarget||0, 
      passes: g.passes||0, 
      doubleDouble: (g.points>=10 && g.rebounds>=10)?1:0, 
      tripleDouble: (g.points>=10 && g.rebounds>=10 && g.assists>=10)?1:0, 
      anytimeTD: ((g.passTD||0)+(g.rushTD||0)+(g.recTD||0))>0?1:0, 
      anytimeGoal: (g.goals||0)>0?1:0 
    },
    updated_at: new Date().toISOString()
  }));

  if (inserts.length > 0) {
    await supabase.from("player_game_logs").upsert(inserts, { onConflict: "player_id,sport,game_date" });
    console.log(`💾 Cached ${inserts.length} games for ${playerId}`);
  }

  // 4. Transform
  const statsObj: Record<string, number[]> = {};
  if (inserts.length > 0) {
    const keys = Object.keys(inserts[0].stats);
    keys.forEach(k => { 
      if (Array.isArray(inserts[0].stats[k])) {
        statsObj[k] = inserts.map(i => i.stats[k]); 
      }
    });
  }
  return { stats: statsObj, source: "live" };
}

// ─────────────────────────────────────────────────────────────
// 🌐 HANDLERS
// ─────────────────────────────────────────────────────────────

async function handleGetPlayerDetails(requestBody: any, sport: string) {
  const { player_id } = requestBody;
  if (!player_id) return new Response(JSON.stringify({ success: false, error: "Missing ID" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

  const { stats, source } = await getOrFetchPlayerData(player_id, sport);
  if (!stats || Object.keys(stats).length === 0) {
    return new Response(JSON.stringify({ success: false, error: `No live data available for player ${player_id}. Check API keys and logs.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
  }

  const player = { player_id, full_name: `Player ${player_id}`, team: "LAL", position: "F", sport, stats };
  const lines = generateAllLines(player, sport);
  return new Response(JSON.stringify({ success: true, player, generated_lines: lines, cached: source === "cache" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleGetPlayersWithStats(requestBody: any, sport: string) {
  const { search, props = ["points"] } = requestBody;
  
  // ✅ Correct player IDs per sport/API
  const playersBySport: Record<string, Array<{player_id: string, full_name: string, team: string}>> = {
    nba: [
      { player_id: "237", full_name: "LeBron James", team: "LAL" },
      { player_id: "115", full_name: "Stephen Curry", team: "GSW" },
      { player_id: "140", full_name: "Kevin Durant", team: "PHX" },
      { player_id: "246", full_name: "Nikola Jokic", team: "DEN" },
      { player_id: "666", full_name: "Luka Doncic", team: "DAL" }
    ],
    nfl: [
      { player_id: "1845", full_name: "Patrick Mahomes", team: "KC" },
      { player_id: "4035", full_name: "Josh Allen", team: "BUF" },
      { player_id: "4046", full_name: "Justin Jefferson", team: "MIN" }
    ],
    mlb: [
      { player_id: "660673", full_name: "Aaron Judge", team: "NYY" },
      { player_id: "592450", full_name: "Mookie Betts", team: "LAD" },
      { player_id: "665742", full_name: "Ronald Acuña Jr.", team: "ATL" }
    ],
    nhl: [
      { player_id: "8478402", full_name: "Auston Matthews", team: "TOR" },
      { player_id: "8477934", full_name: "Connor McDavid", team: "EDM" },
      { player_id: "8479318", full_name: "Nathan MacKinnon", team: "COL" }
    ],
    soccer: [
      { player_id: "276", full_name: "Erling Haaland", team: "MCI" },
      { player_id: "874", full_name: "Kylian Mbappé", team: "PSG" },
      { player_id: "154", full_name: "Mohamed Salah", team: "LIV" }
    ]
  };

  const playersList = playersBySport[sport] || [];
  const filteredList = playersList.filter(p => 
    !search || p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  console.log(`🔍 Filtering for sport="${sport}", found ${filteredList.length} players to fetch`);

  const results = await Promise.all(filteredList.map(async (p) => {
    const { stats } = await getOrFetchPlayerData(p.player_id, sport);
    
    // ✅ NO MOCK DATA - Return null if no live data
    if (!stats || Object.keys(stats).length === 0) {
      console.warn(`⚠️ No data for ${p.full_name} (${p.player_id}), skipping...`);
      return null;
    }

    const player = { ...p, sport, stats };
    const lines = generateAllLines(player, sport);
    const target = lines.find(l => l.prop === props[0]?.toUpperCase());
    if (!target) return null;
    
    return {
      ...p, 
      bookmaker: "Consensus", 
      line: target.line.toFixed(1), 
      avgL10: target.projection,
      diff: parseFloat((target.projection - target.line).toFixed(1)),
      l5HitRate: target.hitRate || 50, 
      l10HitRate: target.hitRate || 50, 
      streak: 0,
      edgePct: target.edgePct, 
      ev: target.ev, 
      recommendation: target.recommendation
    };
  }));
  
  const validResults = results.filter(Boolean);
  console.log(`📊 Returning ${validResults.length} players with live data for ${sport}`);
  
  return new Response(JSON.stringify({ success: true, players: validResults }), { 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
}
