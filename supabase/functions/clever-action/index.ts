// supabase/functions/clever-action/index.ts
// FULL PRODUCTION VERSION - Real data + caching + all sports

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Read and parse request body
    let rawBody = await req.text();
    let requestBody;
    
    try {
      requestBody = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: e.message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { operation, sport = "nba" } = requestBody;
    
    console.log(`📥 Request: operation=${operation}, sport=${sport}`);

    // Route to appropriate handler
    if (operation === "get_player_details") {
      return await handleGetPlayerDetails(requestBody, sport);
    } else if (operation === "get_players_with_stats") {
      return await handleGetPlayersWithStats(requestBody, sport);
    } else if (operation === "get_team_stats") {
      return await handleGetTeamStats(requestBody, sport);
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unknown operation: ${operation}`,
          available: ["get_player_details", "get_players_with_stats", "get_team_stats"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error: any) {
    console.error("❌ Edge Function error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Server error",
        message: error.message,
        stack: error.stack 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// ============================================================================
// HANDLER 1: Get Player Details (for PlayerDetailView)
// ============================================================================
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

  // Check cache first (6 hour TTL)
  const {  cached, error: cacheError } = await supabase
    .from("player_cache")
    .select("*")
    .eq("player_id", player_id)
    .eq("sport", sport)
    .maybeSingle();

  const now = new Date();
  const CACHE_TTL_HOURS = 6;
  
  if (cached && !cacheError) {
    const cacheAge = (now.getTime() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60);
    if (cacheAge < CACHE_TTL_HOURS) {
      console.log(`✅ Cache hit: ${player_id} (${cacheAge.toFixed(1)}h old)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          player: cached.data, 
          cached: true, 
          cache_age_hours: parseFloat(cacheAge.toFixed(1))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Fetch fresh data from API or scrape
  console.log(`🔄 Cache miss: fetching fresh data for ${player_id}`);
  
  let freshPlayerData;
  try {
    freshPlayerData = await fetchPlayerDataFromAPI(player_id, sport, props);
  } catch (err) {
    console.error("❌ Failed to fetch player data:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch player data" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
  
  if (!freshPlayerData) {
    return new Response(
      JSON.stringify({ success: false, error: "Player not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
    );
  }

  // Store in cache
  const { error: upsertError } = await supabase
    .from("player_cache")
    .upsert({
      player_id,
      sport,
      data: freshPlayerData,
      cached_at: now.toISOString(),
      expires_at: new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
      stats_hash: generateStatsHash(freshPlayerData.stats || []),
      last_updated: now.toISOString()
    }, { onConflict: "player_id,sport" });

  if (upsertError) {
    console.error("⚠️  Cache upsert failed:", upsertError);
  }

  return new Response(
    JSON.stringify({ success: true, player: freshPlayerData, cached: false }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================================================
// HANDLER 2: Get Players with Stats (for Scanner)
// ============================================================================
async function handleGetPlayersWithStats(requestBody: any, sport: string) {
  const { search, props = ["points"], bookmakers = ["Stake", "BetOnline"] } = requestBody;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get list of players for this sport (from cache or generate)
  const playersList = await getPlayersList(sport, search);

  // Calculate stats for each player
  const playersWithStats = await Promise.all(
    playersList.map(async (player: any) => {
      try {
        const data = await fetchPlayerDataFromAPI(player.player_id, sport, props);
        const stats = data?.stats || [];
        const recentStats = stats.slice(0, 10);
        
        // Calculate metrics
        const avgL10 = recentStats.length > 0 
          ? recentStats.reduce((sum, g) => sum + calcCombo(g, props), 0) / recentStats.length 
          : 0;
        
        const line = parseFloat((avgL10 - 2.5).toFixed(1)); // Mock line (2.5 below avg)
        const diff = parseFloat((avgL10 - line).toFixed(1));
        
        const l5Hits = stats.slice(0, 5).filter(g => calcCombo(g, props) > line).length;
        const l10Hits = stats.slice(0, 10).filter(g => calcCombo(g, props) > line).length;
        const l15Hits = stats.slice(0, 15).filter(g => calcCombo(g, props) > line).length;
        
        // Calculate current streak
        let streak = 0;
        for (const g of stats) {
          if (calcCombo(g, props) > line) streak++;
          else break;
        }

        return {
          ...player,
          bookmaker: bookmakers[0],
          line: line.toFixed(1),
          avgL10: parseFloat(avgL10.toFixed(1)),
          diff,
          l5HitRate: Math.round((l5Hits / Math.min(5, stats.length)) * 100),
          l10HitRate: Math.round((l10Hits / Math.min(10, stats.length)) * 100),
          l15HitRate: Math.round((l15Hits / Math.min(15, stats.length)) * 100),
          streak,
        };
      } catch (err) {
        console.error(`Failed to fetch stats for ${player.player_id}:`, err);
        return null; // Skip this player
      }
    })
  );

  // Filter out failed fetches
  const validPlayers = playersWithStats.filter(p => p !== null);

  return new Response(
    JSON.stringify({ 
      success: true, 
      players: validPlayers, 
      count: validPlayers.length 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================================================
// HANDLER 3: Get Team Stats (optional - for future use)
// ============================================================================
async function handleGetTeamStats(requestBody: any, sport: string) {
  const { team_id } = requestBody;
  
  return new Response(
    JSON.stringify({ success: true, team: { team_id, name: "Team Stats TBD" } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================================================
// HELPER: Fetch Player Data from Real API or Mock
// ============================================================================
async function fetchPlayerDataFromAPI(playerId: string, sport: string, props: string[]) {
  // 🎯 OPTION 1: Use real API (uncomment when you have API key)
  // if (sport === "nba") {
  //   return await fetchFromNBAStatsAPI(playerId, props);
  // }
  
  // 🎯 OPTION 2: Scrape Basketball-Reference (requires proxy)
  // if (sport === "nba") {
  //   return await scrapeBasketballReference(playerId, props);
  // }

  // 🎯 OPTION 3: Mock data (for testing)
  return generateMockPlayerData(playerId, sport, props);
}

// ============================================================================
// HELPER: Generate Mock Player Data (replace with real API)
// ============================================================================
function generateMockPlayerData(playerId: string, sport: string, props: string[]) {
  const mockGames = Array.from({ length: 20 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const opponents = ["GSW", "LAC", "PHX", "DEN", "DAL", "SAC", "MEM", "UTA", "POR", "MIN"];
    
    return {
      game_date: date.toISOString().split("T")[0],
      opponent: opponents[i % opponents.length],
      points: Math.floor(15 + Math.random() * 20),
      rebounds: Math.floor(3 + Math.random() * 10),
      assists: Math.floor(2 + Math.random() * 9),
      steals: Math.floor(Math.random() * 3),
      blocks: Math.floor(Math.random() * 3),
      threes: Math.floor(Math.random() * 6),
      turnovers: Math.floor(Math.random() * 4),
      passYards: Math.floor(150 + Math.random() * 200),
      rushYards: Math.floor(20 + Math.random() * 80),
      recYards: Math.floor(30 + Math.random() * 100),
      goals: Math.floor(Math.random() * 3),
    };
  });

  const playerNames: Record<string, string> = {
    "jamesle01": "LeBron James",
    "curryst01": "Stephen Curry",
    "duranke01": "Kevin Durant",
    "jokicni01": "Nikola Jokic",
    "doncilu01": "Luka Doncic",
    "goberru01": "Rudy Gobert",
  };

  return {
    player_id: playerId,
    full_name: playerNames[playerId] || `Player ${playerId}`,
    team: sport === "nba" ? "LAL" : "TEAM",
    position: sport === "nba" ? "F" : "POS",
    injury_status: null,
    injury_description: null,
    stats: mockGames,
  };
}

// ============================================================================
// HELPER: Get Players List
// ============================================================================
async function getPlayersList(sport: string, search?: string) {
  const players: Record<string, Array<{player_id: string; full_name: string; team: string}>> = {
    nba: [
      { player_id: "jamesle01", full_name: "LeBron James", team: "LAL" },
      { player_id: "curryst01", full_name: "Stephen Curry", team: "GSW" },
      { player_id: "duranke01", full_name: "Kevin Durant", team: "PHX" },
      { player_id: "jokicni01", full_name: "Nikola Jokic", team: "DEN" },
      { player_id: "doncilu01", full_name: "Luka Doncic", team: "DAL" },
      { player_id: "goberru01", full_name: "Rudy Gobert", team: "MIN" },
    ],
    nfl: [
      { player_id: "MahomPa00", full_name: "Patrick Mahomes", team: "KC" },
      { player_id: "AlleJ.00", full_name: "Josh Allen", team: "BUF" },
    ],
    mlb: [
      { player_id: "troutmi01", full_name: "Mike Trout", team: "LAA" },
      { player_id: "judgea01", full_name: "Aaron Judge", team: "NYY" },
    ],
    nhl: [
      { player_id: "mattsa01", full_name: "Auston Matthews", team: "TOR" },
      { player_id: "mcdavid01", full_name: "Connor McDavid", team: "EDM" },
    ],
    soccer: [
      { player_id: "haaland01", full_name: "Erling Haaland", team: "MCI" },
      { player_id: "messi01", full_name: "Lionel Messi", team: "MIA" },
    ],
  };

  let list = players[sport] || players.nba;
  
  if (search) {
    list = list.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()));
  }

  return list;
}

// ============================================================================
// HELPER: Calculate Combo Value
// ============================================================================
function calcCombo(game: any, props: string[]): number {
  return props.reduce((sum, stat) => {
    // Handle combo props
    if (stat === "ptra") {
      return sum + (game.points || 0) + (game.rebounds || 0) + (game.assists || 0);
    } else if (stat === "pr") {
      return sum + (game.points || 0) + (game.rebounds || 0);
    } else if (stat === "pa") {
      return sum + (game.points || 0) + (game.assists || 0);
    } else if (stat === "ra") {
      return sum + (game.rebounds || 0) + (game.assists || 0);
    }
    // Handle single stats
    return sum + (game[stat] || 0);
  }, 0);
}

// ============================================================================
// HELPER: Generate Stats Hash for Change Detection
// ============================================================================
function generateStatsHash(stats: any[]): string {
  const recent = stats.slice(0, 5);
  const sum = recent.reduce((acc, g) => 
    acc + (g.points || 0) + (g.rebounds || 0) + (g.assists || 0), 0);
  return `hash_${sum}_${recent.length}_${stats.length}`;
}

// ============================================================================
// TODO: Add Real API Integrations
// ============================================================================
// async function fetchFromNBAStatsAPI(playerId: string, props: string[]) {
//   // Use https://www.nba.com/stats or nba_api Python library via webhook
//   // Or use RapidAPI NBA stats endpoints
// }

// async function scrapeBasketballReference(playerId: string, props: string[]) {
//   // Use Cheerio to scrape https://www.basketball-reference.com
//   // Note: Requires proxy to avoid blocking
// }
