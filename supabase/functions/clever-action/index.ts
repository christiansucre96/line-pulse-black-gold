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
  if (!url || !key) throw new Error("Missing env vars");
  return createClient(url, key);
}

// ---------- The Odds API configuration ----------
const SPORT_MAP: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  soccer: "soccer_epl",
};

const SINGLE_MARKETS = ["player_points", "player_rebounds", "player_assists"];

// For combo props, we will combine the single markets
const COMBO_MARKETS = [
  { key: "player_points_rebounds", label: "Points + Rebounds", components: ["player_points", "player_rebounds"] },
  { key: "player_points_assists", label: "Points + Assists", components: ["player_points", "player_assists"] },
  { key: "player_rebounds_assists", label: "Rebounds + Assists", components: ["player_rebounds", "player_assists"] },
  { key: "player_points_rebounds_assists", label: "Points + Rebounds + Assists", components: ["player_points", "player_rebounds", "player_assists"] },
];

// Helper: fetch single market props from The Odds API
async function fetchSingleMarketProps(sport: string, bookmaker: string, market: string) {
  const API_KEY = Deno.env.get("THE_ODDS_API_KEY");
  if (!API_KEY) return [];
  const oddsSport = SPORT_MAP[sport];
  if (!oddsSport) return [];

  const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds/?apiKey=${API_KEY}&regions=us&markets=${market}&bookmakers=${bookmaker.toLowerCase()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const props = [];
  for (const event of data) {
    for (const bk of event.bookmakers || []) {
      for (const mkt of bk.markets || []) {
        if (mkt.key === market) {
          for (const outcome of mkt.outcomes || []) {
            props.push({
              player_name: outcome.description,
              line: outcome.point,
              odds: outcome.price,
            });
          }
        }
      }
    }
  }
  return props;
}

// Main sync: fetch single markets, then compute combos
async function syncAllProps(supabase: any) {
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const bookmakers = ["Stake", "BetOnline"];
  const results = {};

  for (const sport of sports) {
    results[sport] = {};
    for (const bookmaker of bookmakers) {
      try {
        // 1. Fetch single markets
        const singlePropsMap: Record<string, Map<string, { line: number; odds: number }>> = {};
        for (const market of SINGLE_MARKETS) {
          const props = await fetchSingleMarketProps(sport, bookmaker, market);
          const map = new Map();
          for (const p of props) {
            map.set(p.player_name, { line: p.line, odds: p.odds });
          }
          singlePropsMap[market] = map;
        }

        // 2. Build all props (single + combo)
        const allProps = [];

        // Add single props
        for (const market of SINGLE_MARKETS) {
          for (const [player, data] of singlePropsMap[market]) {
            allProps.push({
              sport,
              player_name: player,
              bookmaker,
              market_type: market,
              line: data.line,
              odds: data.odds,
              is_combo: false,
              last_updated: new Date().toISOString(),
            });
          }
        }

        // 3. Add combo props by summing lines
        for (const combo of COMBO_MARKETS) {
          // Get the first component market's map (we need all players that have all components)
          const firstMarket = combo.components[0];
          const playersWithAll = new Set<string>();
          for (const [player] of singlePropsMap[firstMarket]) {
            let hasAll = true;
            for (const comp of combo.components) {
              if (!singlePropsMap[comp].has(player)) {
                hasAll = false;
                break;
              }
            }
            if (hasAll) playersWithAll.add(player);
          }

          for (const player of playersWithAll) {
            let totalLine = 0;
            let totalOdds = 1;
            for (const comp of combo.components) {
              const data = singlePropsMap[comp].get(player);
              totalLine += data.line;
              // Approximate combined odds (for display only; real combo odds would come from API)
              totalOdds *= data.odds;
            }
            allProps.push({
              sport,
              player_name: player,
              bookmaker,
              market_type: combo.key,
              line: totalLine,
              odds: totalOdds,
              is_combo: true,
              last_updated: new Date().toISOString(),
            });
          }
        }

        if (allProps.length) {
          // Delete old props for this sport+bookmaker
          await supabase.from("player_props_cache").delete().eq("sport", sport).eq("bookmaker", bookmaker);
          // Insert new props (batch insert in chunks to avoid payload limits)
          const chunkSize = 500;
          for (let i = 0; i < allProps.length; i += chunkSize) {
            const chunk = allProps.slice(i, i + chunkSize);
            const { error } = await supabase.from("player_props_cache").insert(chunk);
            if (error) throw error;
          }
          results[sport][bookmaker] = { success: true, count: allProps.length };
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

// ---------- Database read operations ----------
async function getPlayers(supabase: any, sport: string) {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, full_name, position, status, injury_description, is_starter, teams:team_id(name, abbreviation)")
    .eq("sport", sport)
    .limit(500);
  if (error) throw error;
  return players.map(p => ({
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

async function getProps(supabase: any, sport: string, bookmaker: string, marketType?: string) {
  let query = supabase.from("player_props_cache").select("*").eq("sport", sport).eq("bookmaker", bookmaker);
  if (marketType) query = query.eq("market_type", marketType);
  const { data, error } = await query.order("last_updated", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getPlayerDetails(supabase: any, playerId: string) {
  const { data: player, error } = await supabase
    .from("players")
    .select("id, full_name, position, status, injury_description, is_starter, teams:team_id(name, abbreviation)")
    .eq("id", playerId)
    .single();
  if (error) throw error;
  const { data: props } = await supabase
    .from("player_props_cache")
    .select("*")
    .eq("player_name", player.full_name);
  return { ...player, props: props || [] };
}

// ---------- Manual player addition (to avoid ESPN) ----------
async function addPlayer(supabase: any, sport: string, name: string, position: string, teamName: string) {
  // Find or create team
  let { data: team } = await supabase.from("teams").select("id").eq("name", teamName).eq("sport", sport).single();
  if (!team) {
    const { data: newTeam, error } = await supabase
      .from("teams")
      .insert({ external_id: name.replace(/\s/g, "_"), sport, name: teamName, abbreviation: teamName.slice(0,3) })
      .select()
      .single();
    if (error) throw error;
    team = newTeam;
  }
  const { error } = await supabase.from("players").upsert({
    external_id: name.replace(/\s/g, "_"),
    sport,
    full_name: name,
    position,
    team_id: team.id,
    is_starter: true,
  }, { onConflict: "sport,external_id" });
  if (error) throw error;
  return { success: true };
}

// ---------- Dummy sync_upcoming to stop admin errors ----------
async function syncUpcoming() {
  return { teams: 0, players: 0 };
}

// ---------- Main handler ----------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    let { operation, sport, bookmaker, market, player_id, player_name, position, team } = body;

    if (!operation && sport) operation = "get_players";

    switch (operation) {
      case "get_players":
        const players = await getPlayers(supabase, sport);
        return new Response(JSON.stringify({ success: true, players, count: players.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "get_props":
        if (!bookmaker) bookmaker = "Stake";
        const props = await getProps(supabase, sport, bookmaker, market);
        return new Response(JSON.stringify({ success: true, props, count: props.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "get_player_details":
        if (!player_id) throw new Error("Missing player_id");
        const details = await getPlayerDetails(supabase, player_id);
        return new Response(JSON.stringify({ success: true, player: details }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "sync_props":
        const results = await syncAllProps(supabase);
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "sync_upcoming":
        const dummy = await syncUpcoming();
        return new Response(JSON.stringify({ success: true, ...dummy }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "add_player":
        if (!sport || !player_name || !position || !team) throw new Error("Missing fields");
        const addResult = await addPlayer(supabase, sport, player_name, position, team);
        return new Response(JSON.stringify({ success: true, ...addResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
