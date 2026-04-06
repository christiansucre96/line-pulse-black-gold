// src/lib/api/sportsApi.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

const FN = "clever-action";

async function invoke(body: Record<string, any>) {
  if (!body.operation) throw new Error("Missing operation");

  console.log("🚀 Sending to edge function:", body);

  const { data, error } = await supabase.functions.invoke(FN, { body });

  if (error) {
    console.error("❌ Edge function error:", error);
    throw new Error(error.message ?? "Edge function failed");
  }

  if (!data) throw new Error("No response from edge function");

  console.log("✅ Edge response:", data);
  return data;
}

export const sportsApi = {
  async getPlayers(sport: SportType) {
    const data = await invoke({ operation: "get_players", sport });
    return data.players || [];
  },

  async getTopPicks(sport: SportType) {
    const data = await invoke({ operation: "get_players", sport });
    return data.topPicks || [];
  },

  async runDaily() {
    return invoke({ operation: "daily" });
  },

  async fullSync(sport: SportType) {
    return invoke({ operation: "full", sport });
  },

  async fetchBoxScores(sport: SportType, date?: string) {
    return invoke({ operation: "boxscores", sport, date });
  },

  async fetchHistoricalStats(sport: SportType) {
    return invoke({ operation: "historical_stats", sport });
  },

  async generateProps(sport: SportType, player_id?: string) {
    return invoke({ operation: "props", sport, player_id });
  },

  async healthCheck() {
    return invoke({ operation: "health" });
  },

  // Direct DB queries (fallback)
  async getPlayersFromDB(sport?: SportType) {
    let q = supabase.from("players").select("*, teams(name, abbreviation)");
    if (sport) q = q.eq("sport", sport);
    const { data, error } = await q.limit(500);
    if (error) throw error;
    return data ?? [];
  },

  async getPropsFromDB(sport?: SportType) {
    let q = supabase.from("player_props").select("*").order("confidence_score", { ascending: false });
    if (sport) q = q.eq("sport", sport);
    const { data, error } = await q.limit(500);
    if (error) throw error;
    return data ?? [];
  },
};
