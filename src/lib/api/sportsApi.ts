// src/lib/api/sportsApi.ts
// Merged version – includes all functionality from both files,
// with proper error handling and support for multiple edge functions.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

/**
 * Safely invokes a Supabase Edge Function with consistent error handling.
 * @param functionName - Name of the edge function (e.g., 'sports-ingest')
 * @param body - Request payload
 * @returns The function’s response data
 * @throws Error if the invocation fails or returns an error
 */
async function safeInvoke(functionName: string, body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (error) {
      console.error(`❌ Edge function [${functionName}] error:`, {
        message: error.message,
        context: (error as any).context,
        status: (error as any).status,
      });
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
  // ── EDGE FUNCTION CALLS (DATA INGESTION & PROCESSING) ──────────────

  /** Ingest data for a given sport and operation (e.g., 'teams', 'players') */
  async ingest(sport: string, operation: string) {
    return safeInvoke("sports-ingest", { sport, operation });
  },

  /** Generate prop bets for a sport using the props engine */
  async generateProps(sport: string) {
    return safeInvoke("props-engine", { sport });
  },

  /** Update live game data (optionally filtered by sport) */
  async updateLive(sport?: string) {
    return safeInvoke("live-tracker", { operation: "update_live", sport });
  },

  /** Fetch today’s schedule from the live tracker */
  async fetchSchedule() {
    return safeInvoke("live-tracker", { operation: "schedule" });
  },

  /** Run the daily automation (ingest → props → publish) */
  async runDailyAutomation() {
    return safeInvoke("daily-automation", {});
  },

  /** Grant admin privileges to a user by email */
  async makeAdmin(email: string) {
    return safeInvoke("admin-setup", { email, operation: "make_admin" });
  },

  /** Make the first user an admin (useful for initial setup) */
  async makeFirstAdmin() {
    return safeInvoke("admin-setup", { operation: "make_first_admin" });
  },

  // ── DIRECT DATABASE QUERIES (no edge functions) ─────────────────────

  /** Get players, optionally filtered by sport, with team information */
  async getPlayers(sport?: SportType) {
    const q = supabase
      .from("players")
      .select("*, teams(name, abbreviation)");
    const { data, error } = await (sport
      ? q.eq("sport", sport)
      : q
    ).limit(100);
    if (error) throw error;
    return data || [];
  },

  /** Get player props, ordered by confidence score */
  async getProps(sport?: SportType) {
    const q = supabase
      .from("player_props")
      .select("*")
      .order("confidence_score", { ascending: false, nullsFirst: false });
    const { data, error } = await (sport
      ? q.eq("sport", sport)
      : q
    ).limit(200);
    if (error) throw error;
    return data || [];
  },

  /** Get injury reports with player and team details */
  async getInjuries(sport?: SportType) {
    const q = supabase
      .from("injury_tracking")
      .select("*, players(full_name, position, teams(abbreviation))");
    const { data, error } = await (sport
      ? q.eq("sport", sport)
      : q
    ).limit(200);
    if (error) throw error;
    return data || [];
  },

  /** Get games, optionally filtered by sport and/or date */
  async getGames(sport?: SportType, date?: string) {
    let q = supabase
      .from("games_data")
      .select(`
        *,
        home_team:teams!games_data_home_team_id_fkey(name, abbreviation),
        away_team:teams!games_data_away_team_id_fkey(name, abbreviation)
      `)
      .order("start_time", { ascending: true });
    if (sport) q = q.eq("sport", sport);
    if (date) q = q.eq("game_date", date);
    const { data, error } = await q.limit(50);
    if (error) throw error;
    return data || [];
  },

  /** Get recent ingestion logs for monitoring */
  async getIngestionLogs() {
    const { data, error } = await supabase
      .from("ingestion_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  // ── HEALTH CHECK ────────────────────────────────────────────────────

  /**
   * Check if the database is reachable and edge functions are deployed.
   * @returns Object with booleans and any error messages.
   */
  async healthCheck(): Promise<{
    functionsDeployed: boolean;
    dbConnected: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let dbConnected = false;
    let functionsDeployed = false;

    // Test database connection
    try {
      const { error } = await supabase.from("teams").select("id").limit(1);
      dbConnected = !error;
      if (error) errors.push(`DB: ${error.message}`);
    } catch (e: any) {
      errors.push(`DB: ${e.message}`);
    }

    // Test one edge function (sports-ingest is a good candidate)
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
