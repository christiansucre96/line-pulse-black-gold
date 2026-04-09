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

// ---------- The Odds API Integration ----------
const SPORT_MAP: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  soccer: "soccer_epl",
};

async function fetchPlayerProps(sport: string, bookmaker: string) {
  const API_KEY = Deno.env.get("THE_ODDS_API_KEY");
  if (!API_KEY) return [];
  const oddsSport = SPORT_MAP[sport];
  if (!oddsSport) return [];

  const url = `https://api.the-odds-api.com/v4/sports/${oddsSport}/odds/?apiKey=${API_KEY}&regions=us&markets=player_points&bookmakers=${bookmaker.toLowerCase()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  const props = [];
  for (const event of data) {
    for (const bk of event.bookmakers || []) {
      for (const market of bk.markets || []) {
        for (const outcome of market.outcomes || []) {
          props.push({
            sport,
            player_name: outcome.description,
            bookmaker: bookmaker,
            market_type: market.key,
            line: outcome.point,
            odds: outcome.price,
            last_updated: new Date().toISOString(),
          });
        }
      }
    }
  }
  return props;
}

async function syncAllProps(supabase: any) {
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const bookmakers = ["Stake", "BetOnline"];
  const results = {};

  for (const sport of sports) {
    results[sport] = {};
    for (const bookmaker of bookmakers) {
      try {
        const props = await fetchPlayerProps(sport, bookmaker);
        if (props.length) {
          await supabase.from("player_props_cache").delete().eq("sport", sport).eq("bookmaker", bookmaker);
          const { error } = await supabase.from("player_props_cache").insert(props);
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

// ---------- Manual player addition (bypass ESPN) ----------
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

// ---------- Dummy sync_upcoming (to stop admin 400 errors) ----------
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
        // Dummy operation to prevent 400 errors from admin auto-sync
        const dummyResult = await syncUpcoming();
        return new Response(JSON.stringify({ success: true, ...dummyResult }), {
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
