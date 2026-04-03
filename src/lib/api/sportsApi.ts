import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

async function safeInvoke(functionName: string, body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      console.error("❌ Function error:", error);
      throw new Error(error.message);
    }

    // 🔥 FIX: handle HTML / invalid JSON
    if (!data) {
      throw new Error("No response from function");
    }

    return data;
  } catch (err: any) {
    console.error("🚨 Invoke failed:", err.message);
    throw err;
  }
}

export const sportsApi = {
  // ✅ INGEST DATA
  async ingest(sport: string, operation: string) {
    return await safeInvoke("sports-ingest", { sport, operation });
  },

  // ✅ GENERATE PROPS
  async generateProps(sport: string) {
    return await safeInvoke("props-engine", { sport });
  },

  // ✅ LIVE TRACKER
  async updateLive(sport?: string) {
    return await safeInvoke("live-tracker", {
      operation: "update_live",
      sport,
    });
  },

  async fetchSchedule() {
    return await safeInvoke("live-tracker", {
      operation: "schedule",
    });
  },

  // ✅ DAILY AUTO
  async runDailyAutomation() {
    return await safeInvoke("daily-automation", {});
  },

  // ✅ ADMIN
  async makeAdmin(email: string) {
    return await safeInvoke("admin-setup", {
      email,
      operation: "make_admin",
    });
  },

  async makeFirstAdmin() {
    return await safeInvoke("admin-setup", {
      operation: "make_first_admin",
    });
  },

  // ============================
  // 🔥 DIRECT DATABASE (REAL DATA)
  // ============================

  async getPlayers(sport?: SportType) {
    const { data, error } = await supabase
      .from("players")
      .select("*, teams(name, abbreviation)")
      .eq("sport", sport)
      .limit(100);

    if (error) throw error;
    return data || [];
  },

  async getProps(sport?: SportType) {
    const { data, error } = await supabase
      .from("player_props")
      .select("*")
      .eq("sport", sport)
      .limit(100);

    if (error) throw error;
    return data || [];
  },

  async getInjuries(sport?: SportType) {
    const { data, error } = await supabase
      .from("injury_tracking")
      .select("*")
      .eq("sport", sport)
      .limit(100);

    if (error) throw error;
    return data || [];
  },

  async getGames(sport?: SportType) {
    const { data, error } = await supabase
      .from("games_data")
      .select("*")
      .eq("sport", sport)
      .limit(50);

    if (error) throw error;
    return data || [];
  },
};
