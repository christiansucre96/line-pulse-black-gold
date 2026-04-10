// supabase/functions/clever-action/index.ts
// Fetches real prop lines from odds-api.io (free tier)
// All sports: NBA, NFL, MLB, NHL, Soccer
// All prop types: single + combo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSB() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── ODDS-API.IO SPORT KEYS ────────────────────────────────────
const SPORT_KEYS: Record<string, string> = {
  nba:    "basketball_nba",
  nfl:    "americanfootball_nfl",
  mlb:    "baseball_mlb",
  nhl:    "icehockey_nhl",
  soccer: "soccer_epl",         // EPL — change to soccer_usa_mls for MLS
};

// ── ALL PROP MARKETS PER SPORT ────────────────────────────────
// These are the exact market keys odds-api.io uses
const SPORT_MARKETS: Record<string, { single: string[]; combo: { key: string; label: string; components: string[] }[] }> = {
  nba: {
    single: [
      "player_points",
      "player_rebounds",
      "player_assists",
      "player_steals",
      "player_blocks",
      "player_turnovers",
      "player_threes",
      "player_points_alternate",
      "player_rebounds_alternate",
      "player_assists_alternate",
    ],
    combo: [
      { key: "player_points_rebounds",           label: "Pts+Reb",     components: ["player_points", "player_rebounds"] },
      { key: "player_points_assists",             label: "Pts+Ast",     components: ["player_points", "player_assists"] },
      { key: "player_rebounds_assists",           label: "Reb+Ast",     components: ["player_rebounds", "player_assists"] },
      { key: "player_points_rebounds_assists",    label: "PRA",         components: ["player_points", "player_rebounds", "player_assists"] },
      { key: "player_double_double",              label: "Dbl-Dbl",     components: [] },  // native market
      { key: "player_triple_double",              label: "Trpl-Dbl",    components: [] },  // native market
    ],
  },
  nfl: {
    single: [
      "player_pass_yds",
      "player_rush_yds",
      "player_reception_yds",
      "player_pass_tds",
      "player_rush_tds",
      "player_reception_tds",
      "player_receptions",
      "player_pass_attempts",
      "player_pass_completions",
      "player_pass_interceptions",
      "player_anytime_td",
      "player_pass_yds_alternate",
      "player_rush_yds_alternate",
      "player_reception_yds_alternate",
    ],
    combo: [
      { key: "player_pass_rush_yds",   label: "Pass+Rush Yds",  components: ["player_pass_yds", "player_rush_yds"] },
      { key: "player_rush_rec_yds",    label: "Rush+Rec Yds",   components: ["player_rush_yds", "player_reception_yds"] },
    ],
  },
  mlb: {
    single: [
      "batter_hits",
      "batter_runs_scored",
      "batter_rbis",
      "batter_total_bases",
      "batter_home_runs",
      "batter_stolen_bases",
      "batter_walks",
      "batter_strikeouts",
      "pitcher_strikeouts",
      "pitcher_hits_allowed",
      "pitcher_walks",
      "pitcher_earned_runs",
      "pitcher_outs",
      "batter_hits_alternate",
      "batter_total_bases_alternate",
      "pitcher_strikeouts_alternate",
    ],
    combo: [
      { key: "batter_hits_runs_rbis", label: "H+R+RBI", components: ["batter_hits", "batter_runs_scored", "batter_rbis"] },
    ],
  },
  nhl: {
    single: [
      "player_points",
      "player_goals",
      "player_assists",
      "player_shots_on_goal",
      "player_blocked_shots",
      "player_goals_alternate",
      "player_shots_on_goal_alternate",
    ],
    combo: [
      { key: "player_goals_assists",        label: "G+A",         components: ["player_goals", "player_assists"] },
      { key: "player_points_alternate",     label: "Pts Ladder",  components: [] },
    ],
  },
  soccer: {
    single: [
      "player_shots_on_target",
      "player_shots",
      "player_goal_scorer_anytime",
      "player_goal_scorer_first",
      "player_assists",
      "player_passes",
      "player_tackles",
    ],
    combo: [
      { key: "player_goal_and_assist", label: "G+A", components: ["player_goal_scorer_anytime", "player_assists"] },
    ],
  },
};

// ── HUMAN-READABLE MARKET LABELS ─────────────────────────────
const MARKET_LABELS: Record<string, string> = {
  // NBA
  player_points:                    "Points",
  player_rebounds:                  "Rebounds",
  player_assists:                   "Assists",
  player_steals:                    "Steals",
  player_blocks:                    "Blocks",
  player_turnovers:                 "Turnovers",
  player_threes:                    "3PT Made",
  player_points_rebounds:           "Pts+Reb",
  player_points_assists:            "Pts+Ast",
  player_rebounds_assists:          "Reb+Ast",
  player_points_rebounds_assists:   "PRA",
  player_double_double:             "Double Double",
  player_triple_double:             "Triple Double",
  player_points_alternate:          "Alt Points",
  player_rebounds_alternate:        "Alt Rebounds",
  player_assists_alternate:         "Alt Assists",
  // NFL
  player_pass_yds:                  "Pass Yards",
  player_rush_yds:                  "Rush Yards",
  player_reception_yds:             "Rec Yards",
  player_pass_tds:                  "Pass TDs",
  player_rush_tds:                  "Rush TDs",
  player_reception_tds:             "Rec TDs",
  player_receptions:                "Receptions",
  player_pass_attempts:             "Pass Attempts",
  player_pass_completions:          "Completions",
  player_pass_interceptions:        "INTs",
  player_anytime_td:                "Anytime TD",
  player_pass_rush_yds:             "Pass+Rush Yds",
  player_rush_rec_yds:              "Rush+Rec Yds",
  player_pass_yds_alternate:        "Alt Pass Yds",
  player_rush_yds_alternate:        "Alt Rush Yds",
  player_reception_yds_alternate:   "Alt Rec Yds",
  // MLB
  batter_hits:                      "Hits",
  batter_runs_scored:               "Runs",
  batter_rbis:                      "RBIs",
  batter_total_bases:               "Total Bases",
  batter_home_runs:                 "Home Runs",
  batter_stolen_bases:              "Stolen Bases",
  batter_walks:                     "Walks",
  batter_strikeouts:                "Strikeouts (B)",
  pitcher_strikeouts:               "Strikeouts (P)",
  pitcher_hits_allowed:             "Hits Allowed",
  pitcher_walks:                    "Walks (P)",
  pitcher_earned_runs:              "Earned Runs",
  pitcher_outs:                     "Outs",
  batter_hits_runs_rbis:            "H+R+RBI",
  batter_hits_alternate:            "Alt Hits",
  batter_total_bases_alternate:     "Alt Total Bases",
  pitcher_strikeouts_alternate:     "Alt K",
  // NHL
  player_goals:                     "Goals",
  player_shots_on_goal:             "Shots on Goal",
  player_blocked_shots:             "Blocked Shots",
  player_goals_assists:             "G+A",
  player_goals_alternate:           "Alt Goals",
  player_shots_on_goal_alternate:   "Alt SOG",
  // Soccer
  player_shots_on_target:           "Shots on Target",
  player_shots:                     "Shots",
  player_goal_scorer_anytime:       "Anytime Scorer",
  player_goal_scorer_first:         "First Scorer",
  player_passes:                    "Passes",
  player_tackles:                   "Tackles",
  player_goal_and_assist:           "G+A",
};

// ── FETCH ONE MARKET from odds-api.io ─────────────────────────
async function fetchMarket(
  apiKey: string,
  sport: string,
  market: string,
  regions = "us,uk",
  bookmakers = "draftkings,fanduel,betmgm,caesars,pointsbetus"
) {
  const sportKey = SPORT_KEYS[sport];
  if (!sportKey) return [];

  // odds-api.io v3 endpoint
  const url = new URL(`https://api.odds-api.io/v3/sports/${sportKey}/events`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", regions);
  url.searchParams.set("markets", market);
  url.searchParams.set("bookmakers", bookmakers);
  url.searchParams.set("oddsFormat", "american");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`odds-api.io ${res.status}: ${sport}/${market} — ${await res.text()}`);
      return [];
    }
    const events = await res.json();
    const rows: any[] = [];

    for (const event of (Array.isArray(events) ? events : [])) {
      const homeTeam = event.home_team;
      const awayTeam = event.away_team;
      const gameLabel = `${awayTeam} @ ${homeTeam}`;
      const gameTime  = event.commence_time;

      for (const bk of (event.bookmakers || [])) {
        for (const mkt of (bk.markets || [])) {
          if (mkt.key !== market) continue;

          // Group outcomes by player name
          const playerMap = new Map<string, { over?: any; under?: any }>();
          for (const outcome of (mkt.outcomes || [])) {
            // odds-api.io puts player name in `description` for player props
            const playerName = outcome.description || outcome.name;
            if (!playerName) continue;
            if (!playerMap.has(playerName)) playerMap.set(playerName, {});
            const entry = playerMap.get(playerName)!;
            const side = outcome.name?.toLowerCase();
            if (side === "over")  entry.over  = outcome;
            if (side === "under") entry.under = outcome;
          }

          for (const [playerName, sides] of playerMap) {
            const line = sides.over?.point ?? sides.under?.point ?? null;
            if (line === null) continue;
            rows.push({
              sport,
              player_name:   playerName,
              bookmaker:     bk.title,
              market_key:    market,
              market_label:  MARKET_LABELS[market] || market,
              game:          gameLabel,
              game_time:     gameTime,
              line:          line,
              over_odds:     sides.over?.price  ?? null,
              under_odds:    sides.under?.price ?? null,
              is_combo:      false,
              last_updated:  new Date().toISOString(),
            });
          }
        }
      }
    }
    return rows;
  } catch (e) {
    console.error(`fetchMarket error [${sport}/${market}]:`, e);
    return [];
  }
}

// ── SYNC ALL PROPS for one sport ──────────────────────────────
async function syncSport(sb: any, apiKey: string, sport: string) {
  const config  = SPORT_MARKETS[sport];
  if (!config) throw new Error(`No market config for sport: ${sport}`);

  const allRows: any[] = [];
  const marketDataCache = new Map<string, any[]>();

  // 1. Fetch all single markets
  console.log(`[${sport}] Fetching ${config.single.length} single markets...`);
  for (const market of config.single) {
    const rows = await fetchMarket(apiKey, sport, market);
    marketDataCache.set(market, rows);
    // Mark all as single
    for (const row of rows) { row.is_combo = false; }
    allRows.push(...rows);
    // Respect free tier rate limits
    await new Promise(r => setTimeout(r, 800));
  }

  // 2. Build computed combos (summing component lines)
  for (const combo of config.combo) {
    if (combo.components.length === 0) continue; // native markets already fetched above

    // Get player sets from first component
    const firstData = marketDataCache.get(combo.components[0]) || [];

    for (const firstRow of firstData) {
      const playerName = firstRow.player_name;
      const bookmaker  = firstRow.bookmaker;
      const game       = firstRow.game;

      // Check all component markets have this player from the same bookmaker
      let totalLine   = 0;
      let overOdds    = 1.0;
      let underOdds   = 1.0;
      let hasAll      = true;

      for (const compMarket of combo.components) {
        const compData = marketDataCache.get(compMarket) || [];
        const match = compData.find(
          r => r.player_name === playerName && r.bookmaker === bookmaker
        );
        if (!match) { hasAll = false; break; }
        totalLine  += match.line;
        overOdds   *= decimalOdds(match.over_odds);
        underOdds  *= decimalOdds(match.under_odds);
      }

      if (!hasAll) continue;

      allRows.push({
        sport,
        player_name:   playerName,
        bookmaker,
        market_key:    combo.key,
        market_label:  combo.label,
        game,
        game_time:     firstRow.game_time,
        line:          Math.round(totalLine * 2) / 2,   // round to 0.5
        over_odds:     americanOdds(overOdds),
        under_odds:    americanOdds(underOdds),
        is_combo:      true,
        last_updated:  new Date().toISOString(),
      });
    }
  }

  // 3. Wipe old data and insert fresh
  const { error: delError } = await sb
    .from("player_props_cache")
    .delete()
    .eq("sport", sport);
  if (delError) console.error("Delete error:", delError);

  let inserted = 0;
  for (let i = 0; i < allRows.length; i += 500) {
    const { error } = await sb
      .from("player_props_cache")
      .insert(allRows.slice(i, i + 500));
    if (error) console.error("Insert error:", error);
    else inserted += Math.min(500, allRows.length - i);
  }

  return { sport, total_props: allRows.length, inserted, markets_fetched: config.single.length };
}

function decimalOdds(american: number | null): number {
  if (!american) return 1.91;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

function americanOdds(decimal: number): number {
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

// ── GET PROPS from cache (with optional filters) ──────────────
async function getProps(sb: any, sport: string, opts: {
  bookmaker?: string;
  marketKey?: string;
  playerName?: string;
  comboOnly?: boolean;
  singleOnly?: boolean;
}) {
  let q = sb.from("player_props_cache").select("*").eq("sport", sport);
  if (opts.bookmaker)   q = q.ilike("bookmaker", `%${opts.bookmaker}%`);
  if (opts.marketKey)   q = q.eq("market_key", opts.marketKey);
  if (opts.playerName)  q = q.ilike("player_name", `%${opts.playerName}%`);
  if (opts.comboOnly)   q = q.eq("is_combo", true);
  if (opts.singleOnly)  q = q.eq("is_combo", false);
  const { data, error } = await q.order("player_name").limit(2000);
  if (error) throw error;
  return data || [];
}

// ── CHECK REMAINING API QUOTA ─────────────────────────────────
async function checkQuota(apiKey: string) {
  const res = await fetch(`https://api.odds-api.io/v3/remaining?apiKey=${apiKey}`);
  if (!res.ok) return null;
  return res.json();
}

// ── MAIN HANDLER ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb     = getSB();
    const apiKey = Deno.env.get("ODDS_API_KEY");
    const body   = await req.json().catch(() => ({}));
    const { operation, sport, bookmaker, market_key, player_name, combo_only, single_only } = body;

    console.log(`[clever-action] op=${operation} sport=${sport}`);

    switch (operation) {

      // ── Sync ONE sport ────────────────────────────────────────
      case "sync": {
        if (!apiKey) return respond({ success: false, error: "ODDS_API_KEY not set" }, 400);
        if (!sport)  return respond({ success: false, error: "sport required" }, 400);
        const result = await syncSport(sb, apiKey, sport);
        return respond({ success: true, ...result });
      }

      // ── Sync ALL sports ───────────────────────────────────────
      case "sync_all": {
        if (!apiKey) return respond({ success: false, error: "ODDS_API_KEY not set" }, 400);
        const sports  = ["nba", "mlb", "nhl", "soccer"]; // NFL only during season
        const results: any[] = [];
        for (const s of sports) {
          try {
            const r = await syncSport(sb, apiKey, s);
            results.push(r);
          } catch (e: any) {
            results.push({ sport: s, error: e.message });
          }
          await new Promise(r => setTimeout(r, 2000)); // pause between sports
        }
        return respond({ success: true, results });
      }

      // ── Get cached props (for frontend) ───────────────────────
      case "get_props": {
        if (!sport) return respond({ success: false, error: "sport required" }, 400);
        const props = await getProps(sb, sport, {
          bookmaker:  bookmaker,
          marketKey:  market_key,
          playerName: player_name,
          comboOnly:  combo_only === true,
          singleOnly: single_only === true,
        });
        return respond({ success: true, props, count: props.length, sport });
      }

      // ── List available markets for a sport ────────────────────
      case "get_markets": {
        if (!sport) return respond({ success: false, error: "sport required" }, 400);
        const config = SPORT_MARKETS[sport];
        if (!config) return respond({ success: false, error: `Unknown sport: ${sport}` }, 400);
        return respond({
          success: true,
          sport,
          single_markets: config.single.map(k => ({ key: k, label: MARKET_LABELS[k] || k })),
          combo_markets:  config.combo.map(c => ({ key: c.key, label: c.label })),
        });
      }

      // ── Check API quota remaining ─────────────────────────────
      case "quota": {
        if (!apiKey) return respond({ success: false, error: "ODDS_API_KEY not set" }, 400);
        const quota = await checkQuota(apiKey);
        return respond({ success: true, quota });
      }

      // ── Health: count props in cache ──────────────────────────
      case "health": {
        const counts: any = {};
        for (const s of ["nba","nfl","mlb","nhl","soccer"]) {
          const { count } = await sb
            .from("player_props_cache")
            .select("*", { count: "exact", head: true })
            .eq("sport", s);
          counts[s] = count || 0;
        }
        return respond({ success: true, props_cache: counts });
      }

      case "test":
        return respond({ success: true, message: "clever-action function is alive!", has_api_key: !!apiKey });

      default:
        return respond({
          success: false,
          error: `Unknown operation: "${operation}"`,
          valid_operations: ["sync","sync_all","get_props","get_markets","quota","health","test"],
        }, 400);
    }

  } catch (e: any) {
    console.error("[clever-action] fatal:", e);
    return respond({ success: false, error: e.message }, 500);
  }
});
