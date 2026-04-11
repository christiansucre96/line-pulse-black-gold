// supabase/functions/clever-action/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    let rawBody = await req.text();
    let requestBody = rawBody ? JSON.parse(rawBody) : {};
    const { operation, sport = "nba" } = requestBody;

    if (operation === "get_player_details") {
      return await handleGetPlayerDetails(requestBody, sport);
    } else if (operation === "get_players_with_stats") {
      return await handleGetPlayersWithStats(requestBody, sport);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown operation: ${operation}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function handleGetPlayerDetails(requestBody: any, sport: string) {
  const { player_id, props = ["points"] } = requestBody;
  
  if (!player_id) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing player_id" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const {  cached } = await supabase
    .from("player_cache")
    .select("*")
    .eq("player_id", player_id)
    .eq("sport", sport)
    .maybeSingle();

  const now = new Date();
  const CACHE_TTL_HOURS = 6;
  
  if (cached) {
    const cacheAge = (now.getTime() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60);
    if (cacheAge < CACHE_TTL_HOURS) {
      return new Response(
        JSON.stringify({ success: true, player: cached.data, cached: true, cache_age_hours: cacheAge }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const freshPlayerData = await fetchFreshPlayerData(player_id, sport, props);
  
  if (!freshPlayerData) {
    return new Response(
      JSON.stringify({ success: false, error: "Player not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
    );
  }

  await supabase.from("player_cache").upsert({
    player_id,
    sport,
    data: freshPlayerData,
    cached_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "player_id,sport" });

  return new Response(
    JSON.stringify({ success: true, player: freshPlayerData, cached: false }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleGetPlayersWithStats(requestBody: any, sport: string) {
  const { search, props = ["points"], bookmakers = ["Stake", "BetOnline"] } = requestBody;

  // Generate mock players with stats
  const mockPlayers = [
    { player_id: "jamesle01", full_name: "LeBron James", team: "LAL", position: "F", injury_status: null },
    { player_id: "curryst01", full_name: "Stephen Curry", team: "GSW", position: "G", injury_status: null },
    { player_id: "duranke01", full_name: "Kevin Durant", team: "PHX", position: "F", injury_status: null },
    { player_id: "jokicni01", full_name: "Nikola Jokic", team: "DEN", position: "C", injury_status: null },
    { player_id: "doncilu01", full_name: "Luka Doncic", team: "DAL", position: "G", injury_status: null },
    { player_id: "goberru01", full_name: "Rudy Gobert", team: "MIN", position: "C", injury_status: null },
  ];

  const filtered = search 
    ? mockPlayers.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
    : mockPlayers;

  // Add stats for each player
  const playersWithStats = await Promise.all(
    filtered.map(async player => {
      const data = await fetchFreshPlayerData(player.player_id, sport, props);
      const stats = data?.stats || [];
      const recentStats = stats.slice(0, 10);
      
      const avgL10 = recentStats.reduce((sum, g) => sum + calcCombo(g, props), 0) / recentStats.length;
      const line = avgL10 - 2; // Mock line (2 points below avg)
      const diff = avgL10 - line;
      
      const l5Hits = stats.slice(0, 5).filter(g => calcCombo(g, props) > line).length;
      const l10Hits = stats.slice(0, 10).filter(g => calcCombo(g, props) > line).length;
      const l15Hits = stats.slice(0, 15).filter(g => calcCombo(g, props) > line).length;
      
      // Calculate streak
      let streak = 0;
      for (const g of stats) {
        if (calcCombo(g, props) > line) streak++;
        else break;
      }

      return {
        ...player,
        bookmaker: bookmakers[0],
        line: line.toFixed(1),
        avgL10,
        diff,
        l5HitRate: Math.round((l5Hits / 5) * 100),
        l10HitRate: Math.round((l10Hits / 10) * 100),
        l15HitRate: Math.round((l15Hits / 15) * 100),
        streak,
      };
    })
  );

  return new Response(
    JSON.stringify({ success: true, players: playersWithStats, count: playersWithStats.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function calcCombo(g: any, props: string[]) {
  return props.reduce((sum, stat) => sum + (g[stat] || 0), 0);
}

async function fetchFreshPlayerData(playerId: string, sport: string, props: string[]) {
  const mockGames = Array.from({ length: 20 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const opponents = ["GSW", "LAC", "PHX", "DEN", "DAL", "SAC", "MEM", "UTA", "POR", "MIN"];
    
    return {
      game_date: date.toISOString().split("T")[0],
      opponent: opponents[i % opponents.length],
      points: Math.floor(Math.random() * 20) + 10,
      rebounds: Math.floor(Math.random() * 10) + 2,
      assists: Math.floor(Math.random() * 10) + 1,
      steals: Math.floor(Math.random() * 3),
      blocks: Math.floor(Math.random() * 3),
      threes: Math.floor(Math.random() * 5),
    };
  });

  return {
    player_id: playerId,
    full_name: playerId === "jamesle01" ? "LeBron James" : `Player ${playerId}`,
    team: "LAL",
    position: "F",
    injury_status: null,
    injury_description: null,
    stats: mockGames,
  };
}
