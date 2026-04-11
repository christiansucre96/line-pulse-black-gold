// supabase/functions/clever-action/index.ts
// Handles: get_player_details + get_players_with_stats

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
    // Read body
    let rawBody = await req.text();
    let requestBody;
    
    try {
      requestBody = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON", details: e.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { operation } = requestBody;
    
    // 👇 Route to different handlers based on operation
    if (operation === "get_player_details") {
      return await handleGetPlayerDetails(requestBody);
    } else if (operation === "get_players_with_stats") {
      return await handleGetPlayersWithStats(requestBody);
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unknown operation: ${operation}`,
          available: ["get_player_details", "get_players_with_stats"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error: any) {
    console.error("❌ Edge Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// 👇 HANDLER 1: Get single player details (for PlayerDetailView)
async function handleGetPlayerDetails(requestBody: any) {
  const { player_id } = requestBody;
  
  if (!player_id || typeof player_id !== "string") {
    return new Response(
      JSON.stringify({ success: false, error: "Missing player_id" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Check cache
  const {  cached } = await supabase
    .from("player_cache")
    .select("*")
    .eq("player_id", player_id)
    .eq("sport", "nba")
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

  // Fetch fresh (MOCK DATA - replace with real API)
  const freshPlayerData = await fetchFreshPlayerData(player_id);
  
  if (!freshPlayerData) {
    return new Response(
      JSON.stringify({ success: false, error: "Player not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
    );
  }

  // Cache it
  await supabase.from("player_cache").upsert({
    player_id,
    sport: "nba",
    data: freshPlayerData,
    cached_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    stats_hash: generateStatsHash(freshPlayerData.stats)
  }, { onConflict: "player_id,sport" });

  return new Response(
    JSON.stringify({ success: true, player: freshPlayerData, cached: false }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// 👇 HANDLER 2: Get all players with stats (for Scanner page)
async function handleGetPlayersWithStats(requestBody: any) {
  const { sport, search } = requestBody;
  
  if (!sport) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing sport parameter" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 👇 Check if you have a players table in Supabase
  // For now, return mock data
  const mockPlayers = [
    { player_id: "jamesle01", full_name: "LeBron James", team: "LAL", position: "F", avg_points: 25.3, avg_rebounds: 7.2, avg_assists: 7.8 },
    { player_id: "curryst01", full_name: "Stephen Curry", team: "GSW", position: "G", avg_points: 28.1, avg_rebounds: 4.5, avg_assists: 6.2 },
    { player_id: "duranke01", full_name: "Kevin Durant", team: "PHX", position: "F", avg_points: 27.5, avg_rebounds: 6.8, avg_assists: 5.1 },
    { player_id: "jokicni01", full_name: "Nikola Jokic", team: "DEN", position: "C", avg_points: 26.2, avg_rebounds: 12.1, avg_assists: 9.3 },
    { player_id: "doncilu01", full_name: "Luka Doncic", team: "DAL", position: "G", avg_points: 32.1, avg_rebounds: 8.5, avg_assists: 8.9 },
  ];

  // Filter if search provided
  const filtered = search 
    ? mockPlayers.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
    : mockPlayers;

  return new Response(
    JSON.stringify({ success: true, players: filtered, count: filtered.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// 👇 MOCK DATA FUNCTIONS (replace with real API later)
async function fetchFreshPlayerData(playerId: string): Promise<any | null> {
  const mockGames = Array.from({ length: 20 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      game_date: date.toISOString().split("T")[0],
      opponent: ["GSW", "LAC", "PHX", "DEN", "DAL", "SAC", "MEM"][i % 7],
      points: Math.floor(Math.random() * 20) + 10,
      rebounds: Math.floor(Math.random() * 10) + 2,
      assists: Math.floor(Math.random() * 10) + 1,
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

function generateStatsHash(stats: any[]): string {
  const recent = stats.slice(0, 5);
  const sum = recent.reduce((acc, g) => 
    acc + (g.points || 0) + (g.rebounds || 0) + (g.assists || 0), 0);
  return `hash_${sum}_${recent.length}`;
}
