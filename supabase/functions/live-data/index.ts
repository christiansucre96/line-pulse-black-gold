import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Helper: Fetch with better error handling ---
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// --- NBA Player Stats (balldontlie) ---
async function fetchNBAPlayers() {
  try {
    // This public endpoint does not require an API key
    const response = await fetchWithTimeout("https://www.balldontlie.io/api/v1/players?per_page=100", {}, 5000);
    if (!response.ok) throw new Error(`balldontlie error: ${response.status}`);
    const data = await response.json();
    return data.data.map((player: any) => ({
      external_id: player.id.toString(),
      name: `${player.first_name} ${player.last_name}`,
      position: player.position,
      team: player.team?.full_name,
    }));
  } catch (error) {
    console.error("Error fetching NBA players:", error);
    return [];
  }
}

// --- Odds (Odds-API.io) ---
async function fetchOdds(sport: string, apiKey: string) {
  try {
    // Map your sport names to Odds-API.io's format
    const sportMap: Record<string, string> = {
      nba: "basketball_nba",
      nfl: "americanfootball_nfl",
      mlb: "baseball_mlb",
      nhl: "icehockey_nhl",
      soccer: "soccer_epl",
    };
    const apiSport = sportMap[sport];
    if (!apiSport) return [];

    const url = `https://api.odds-api.io/v4/sports/${apiSport}/odds/?apiKey=${apiKey}&regions=us&markets=spreads,totals,player_points`;
    const response = await fetchWithTimeout(url, {}, 10000);
    if (!response.ok) throw new Error(`Odds API error: ${response.status}`);
    const data = await response.json();
    // Process the odds data and format it for your database
    const odds = [];
    for (const event of data) {
      for (const bookmaker of event.bookmakers) {
        if (!bookmaker.key) continue;
        for (const market of bookmaker.markets) {
          odds.push({
            sport,
            event_id: event.id,
            bookmaker: bookmaker.key,
            market_type: market.key,
            line: market.outcomes[0]?.point,
            odds: market.outcomes[0]?.price,
          });
        }
      }
    }
    return odds;
  } catch (error) {
    console.error(`Error fetching odds for ${sport}:`, error);
    return [];
  }
}

// --- Main handler ---
serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { operation, sport } = await req.json();

    // Get API keys from environment variables
    const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY");

    switch (operation) {
      case "sync_all":
        // --- NBA Players ---
        const nbaPlayers = await fetchNBAPlayers();
        if (nbaPlayers.length) {
          const { error } = await supabase.from("players").upsert(
            nbaPlayers.map((p: any) => ({ ...p, sport: "nba" })),
            { onConflict: "sport,external_id" }
          );
          if (error) console.error("Error upserting players:", error);
        }

        // --- Odds for all sports ---
        const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
        if (ODDS_API_KEY) {
          for (const s of sports) {
            const odds = await fetchOdds(s, ODDS_API_KEY);
            if (odds.length) {
              const { error } = await supabase.from("odds_cache").upsert(odds);
              if (error) console.error(`Error upserting odds for ${s}:`, error);
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      default:
        return new Response(JSON.stringify({ error: "Unknown operation" }), { status: 400 });
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
