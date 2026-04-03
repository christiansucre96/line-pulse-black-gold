// src/lib/api/sportsApi.ts
// Fixed version with proper error handling for edge function failures

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

async function safeInvoke(functionName: string, body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: {
        // Explicitly pass content-type — prevents some CORS preflight failures
        "Content-Type": "application/json",
      },
    });

    if (error) {
      // Log the raw error for debugging
      console.error(`❌ Edge function [${functionName}] error:`, {
        message: error.message,
        context: (error as any).context,
        status: (error as any).status,
      });

      // Common causes:
      // "FunctionsHttpError" → function exists but threw an error (check function logs)
      // "FunctionsRelayError" → function not deployed or wrong project
      // "FunctionsFetchError" → network/CORS issue or function crashed at startup
      throw new Error(`${functionName} failed: ${error.message}`);
    }

    if (!data) throw new Error(`No response from ${functionName}`);
    return data;

  } catch (err: any) {
    console.error(`🚨 [${functionName}] invoke failed:`, err.message);
    throw err;
  }
}

export const sportsApi = {
  // ── INGEST DATA ──────────────────────────────────────────────
  async ingest(sport: string, operation: string) {
    return safeInvoke("sports-ingest", { sport, operation });
  },

  // ── GENERATE PROPS ───────────────────────────────────────────
  async generateProps(sport: string) {
    return safeInvoke("props-engine", { sport });
  },

  // ── LIVE TRACKER ─────────────────────────────────────────────
  async updateLive(sport?: string) {
    return safeInvoke("live-tracker", { operation: "update_live", sport });
  },

  async fetchSchedule() {
    return safeInvoke("live-tracker", { operation: "schedule" });
  },

  // ── DAILY AUTOMATION ─────────────────────────────────────────
  async runDailyAutomation() {
    return safeInvoke("daily-automation", {});
  },

  // ── ADMIN ────────────────────────────────────────────────────
  async makeAdmin(email: string) {
    return safeInvoke("admin-setup", { email, operation: "make_admin" });
  },

  async makeFirstAdmin() {
    return safeInvoke("admin-setup", { operation: "make_first_admin" });
  },

  // ── DIRECT DB QUERIES (these work without edge functions) ─────
  async getPlayers(sport?: SportType) {
    const q = supabase.from("players").select("*, teams(name, abbreviation)");
    const { data, error } = await (sport ? q.eq("sport", sport) : q).limit(100);
    if (error) throw error;
    return data || [];
  },

  async getProps(sport?: SportType) {
    const q = supabase.from("player_props").select("*").order("confidence_score", { ascending: false, nullsFirst: false });
    const { data, error } = await (sport ? q.eq("sport", sport) : q).limit(200);
    if (error) throw error;
    return data || [];
  },

  async getInjuries(sport?: SportType) {
    const q = supabase.from("injury_tracking").select("*, players(full_name, position, teams(abbreviation))");
    const { data, error } = await (sport ? q.eq("sport", sport) : q).limit(200);
    if (error) throw error;
    return data || [];
  },

  async getGames(sport?: SportType, date?: string) {
    let q = supabase.from("games_data").select(`
      *,
      home_team:teams!games_data_home_team_id_fkey(name, abbreviation),
      away_team:teams!games_data_away_team_id_fkey(name, abbreviation)
    `).order("start_time", { ascending: true });
    if (sport) q = q.eq("sport", sport);
    if (date)  q = q.eq("game_date", date);
    const { data, error } = await q.limit(50);
    if (error) throw error;
    return data || [];
  },

  async getIngestionLogs() {
    const { data, error } = await supabase
      .from("ingestion_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  // ── HEALTH CHECK — test if edge functions are deployed ────────
  async healthCheck(): Promise<{
    functionsDeployed: boolean;
    dbConnected: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let dbConnected = false;
    let functionsDeployed = false;

    // Test DB
    try {
      const { error } = await supabase.from("teams").select("id").limit(1);
      dbConnected = !error;
      if (error) errors.push(`DB: ${error.message}`);
    } catch (e: any) {
      errors.push(`DB: ${e.message}`);
    }

    // Test one edge function
    try {
      const { error } = await supabase.functions.invoke("sports-ingest", {
        body: { sport: "nba", operation: "teams" },
      });
      functionsDeployed = !error;
      if (error) errors.push(`Functions: ${error.message}`);
    } catch (e: any) {
      errors.push(`Functions: ${e.message}`);
    }

    return { functionsDeployed, dbConnected, errors };
  },
};
