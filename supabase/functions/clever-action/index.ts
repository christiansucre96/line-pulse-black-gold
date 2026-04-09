import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

// Sport key mapping for Odds-API.io
const SPORT_MAP: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  soccer: "soccer_epl",
};

// Available combo markets for each sport
const COMBO_MARKETS: Record<string, string[]> = {
  nba: ["player_points_rebounds_assists", "player_points_rebounds", "player_points_assists", "player_rebounds_assists"],
  nfl: ["player_passing_yards", "player_rushing_yards", "player_receiving_yards", "player_passing_tds"],
  mlb: ["player_strikeouts", "player_hits", "player_home_runs", "player_runs_batted_in"],
  nhl: ["player_points", "player_shots_on_goal", "player_assists", "player_goals"],
  soccer: ["player_goals", "player_assists", "player_shots", "player_shots_on_target"],
};

// Individual markets (used for combo estimation fallback)
const INDIVIDUAL_MARKETS = ["player_points", "player_rebounds", "player_assists"];

async function fetchComboProps(sport: string, bookmaker: string) {
  const API_KEY = Deno.env.get("ODDS_API_KEY");
  if (!API_KEY) throw new Error("Missing ODDS_API_KEY");

  const oddsSport = SPORT_MAP[sport];
  if (!oddsSport) return [];

  const comboMarkets = COMBO_MARKETS[sport] || [];
  const allProps = [];

  // Fetch combo markets if available
  for (const market of comboMarkets) {
    const url = `https://api.odds-api.io/v4/sports/${oddsSport}/odds/?apiKey=${API_KEY}&regions=us&markets=${market}&bookmakers=${bookmaker}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    for (const event of data) {
      for (const bk of event.bookmakers || []) {
        if (bk.key !== bookmaker) continue;
        for (const mkt of bk.markets || []) {
          if (mkt.key === market) {
            for (const outcome of mkt.outcomes || []) {
              allProps.push({
                sport,
                event_id: event.id,
                event_name: `${outcome.description} ${market.replace("player_", "").replace(/_/g, " + ")}`,
                player_name: outcome.description,
                bookmaker: bk.key,
                market_type: market,
                line: outcome.point,
                odds: outcome.price,
                is_combo: true,
                last_updated: new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  }

  // Also fetch individual markets for combo estimation fallback
  for (const market of INDIVIDUAL_MARKETS) {
    const url = `https://api.odds-api.io/v4/sports/${oddsSport}/odds/?apiKey=${API_KEY}&regions=us&markets=${market}&bookmakers=${bookmaker}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    for (const event of data) {
      for (const bk of event.bookmakers || []) {
        if (bk.key !== bookmaker) continue;
        for (const mkt of bk.markets || []) {
          if (mkt.key === market) {
            for (const outcome of mkt.outcomes || []) {
              allProps.push({
                sport,
                event_id: event.id,
                event_name: `${outcome.description} ${market === "player_points" ? "Points" : market === "player_rebounds" ? "Rebounds" : "Assists"}`,
                player_name: outcome.description,
                bookmaker: bk.key,
                market_type: market,
                line: outcome.point,
                odds: outcome.price,
                is_combo: false,
                last_updated: new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  }

  return allProps;
}

async function syncAllComboProps(supabase: any) {
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const bookmakers = ["Stake", "BetOnline"];
  const results = {};

  for (const sport of sports) {
    results[sport] = {};
    for (const bookmaker of bookmakers) {
      try {
        const props = await fetchComboProps(sport, bookmaker);
        if (props.length) {
          // Delete old props for this sport+bookmaker
          await supabase
            .from("combo_props_cache")
            .delete()
            .eq("sport", sport)
            .eq("bookmaker", bookmaker);
          // Insert fresh props
          const { error } = await supabase.from("combo_props_cache").insert(props);
          if (error) throw error;
          results[sport][bookmaker] = { success: true, count: props.length };
        } else {
          results[sport][bookmaker] = { success: false, count: 0 };
        }
      } catch (err) {
        results[sport][bookmaker] = { success: false, error: err.message };
      }
    }
  }
  return results;
}

// Get combo props from cache
async function getComboProps(supabase: any, sport: string, bookmaker: string, marketType?: string) {
  let query = supabase
    .from("combo_props_cache")
    .select("*")
    .eq("sport", sport)
    .eq("bookmaker", bookmaker);
  
  if (marketType) {
    query = query.eq("market_type", marketType);
  }
  
  const { data, error } = await query.order("last_updated", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Get players from database (with team names)
async function getPlayers(supabase: any, sport: string) {
  const { data: players, error } = await supabase
    .from("players")
    .select(`
      id, full_name, position, status, injury_description, is_starter,
      teams:team_id ( name, abbreviation )
    `)
    .eq("sport", sport)
    .limit(500);
  if (error) throw error;
  return players.map((p: any) => ({
    id: p.id,
    name: p.full_name,
    position: p.position || "N/A",
    team: p.teams?.name || "Unknown",
    teamAbbr: p.teams?.abbreviation || "N/A",
    opponent: "TBD",
    status: p.status || "active",
    injury_description: p.injury_description,
    is_starter: p.is_starter || false,
  }));
}

// ---------- Main handler ----------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    let { operation, sport, bookmaker, market, player_id } = body;

    if (!operation && sport) operation = "get_players";
    if (!operation) throw new Error("Missing operation");

    switch (operation) {
      case "get_players": {
        const players = await getPlayers(supabase, sport);
        return new Response(JSON.stringify({ success: true, players, count: players.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_combo_props": {
        if (!bookmaker) bookmaker = "Stake";
        const props = await getComboProps(supabase, sport, bookmaker, market);
        return new Response(JSON.stringify({ success: true, props, count: props.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_player_details": {
        if (!player_id) throw new Error("Missing player_id");
        const { data: player, error } = await supabase
          .from("players")
          .select(`
            id, full_name, position, status, injury_description, is_starter,
            teams:team_id ( name, abbreviation, logo_url ),
            player_averages (
              last10_avg_points, last5_avg_points, avg_points,
              last10_avg_rebounds, last5_avg_rebounds, avg_rebounds,
              last10_avg_assists, last5_avg_assists, avg_assists
            )
          `)
          .eq("id", player_id)
          .single();
        if (error) throw error;
        
        // Get props for this player
        const { data: props } = await supabase
          .from("combo_props_cache")
          .select("*")
          .eq("player_name", player.full_name)
          .order("last_updated", { ascending: false });
        
        return new Response(JSON.stringify({ 
          success: true, 
          player: { ...player, props: props || [] },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_combo_props": {
        const results = await syncAllComboProps(supabase);
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
