// src/lib/api/sportsApi.ts
// Merged version – routes all operations through the single "clever-action" edge function.
// Includes batch sync for all sports, daily automation, per‑sport pipeline, and full DB helpers.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

const FN = "clever-action";
const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"] as const;

/**
 * Safely invoke the edge function with operation validation and logging.
 */
async function invoke(body: Record<string, any>) {
  // 🔒 Prevent missing operation (was causing crashes)
  if (!body.operation) {
    throw new Error("Missing operation (this was causing your crash)");
  }

  console.log("🚀 Sending to edge function:", body);

  const { data, error } = await supabase.functions.invoke(FN, { body });

  if (error) {
    // FunctionsRelayError  → function not deployed yet
    // FunctionsHttpError   → function threw an error (check Supabase logs)
    // FunctionsFetchError  → network / CORS problem
    console.error("❌ Edge function error:", error);
    throw new Error(error.message ?? "Edge function failed");
  }

  if (!data) throw new Error("No response from edge function");

  console.log("✅ Edge response:", data);
  return data;
}

export const sportsApi = {
  // ── BATCH OPERATIONS (from first file) ─────────────────────────

  /** Run FULL pipeline for all sports (teams+players+games+injuries + live + boxscores + props) */
  async fullSystemSync() {
    const results: Record<string, any> = {};

    for (const sport of SPORTS) {
      console.log(`🔥 Running FULL pipeline for ${sport.toUpperCase()}`);

      try {
        // 1. TEAMS + PLAYERS + GAMES + INJURIES
        const ingest = await invoke({ sport, operation: "full" });

        // 2. LIVE + BOX SCORES
        const live = await invoke({ sport, operation: "live" });

        // 3. FORCE BOX SCORES AGAIN (IMPORTANT)
        const box = await invoke({ sport, operation: "boxscores" });

        // 4. GENERATE PROPS (STANDARD + COMBOS)
        const props = await invoke({ sport, operation: "props" });

        results[sport] = { ingest, live, box, props };
      } catch (err: any) {
        console.error(`❌ ${sport} failed:`, err.message);
        results[sport] = { error: err.message };
      }
    }

    return results;
  },

  /** Daily automation for all sports (alias for runDailyAutomation) */
  async runDailyAllSports() {
    return this.runDailyAutomation();
  },

  /** Quick single‑sport pipeline: full ingest → live → props */
  async runSport(sport: string) {
    return {
      ingest: await invoke({ sport, operation: "full" }),
      live: await invoke({ sport, operation: "live" }),
      props: await invoke({ sport, operation: "props" }),
    };
  },

  // ── INDIVIDUAL EDGE FUNCTION OPERATIONS (from second file) ──────

  /** Fetch teams + players + games + injuries for one sport */
  async ingest(sport: string, operation = "full", date?: string) {
    return invoke({ sport, operation, date });
  },

  /** Ingest teams only */
  async ingestTeams(sport: string) {
    return invoke({ sport, operation: "teams" });
  },

  /** Ingest rosters only */
  async ingestPlayers(sport: string) {
    return invoke({ sport, operation: "players" });
  },

  /** Ingest today's games (schedule + scores) */
  async ingestGames(sport: string, date?: string) {
    return invoke({ sport, operation: "games", date });
  },

  /** Fetch injury report */
  async ingestInjuries(sport: string) {
    return invoke({ sport, operation: "injuries" });
  },

  /** Force boxscore refresh (useful after live updates) */
  async ingestBoxScores(sport: string) {
    return invoke({ sport, operation: "boxscores" });
  },

  /** Calculate hit rates + lines from stored game logs */
  async generateProps(sport: string, player_id?: string) {
    return invoke({ sport, operation: "props", player_id });
  },

  /** Update live scores + box scores */
  async updateLive(sport?: string) {
    return invoke({ operation: "live", sport });
  },

  /** Pull today's schedule for all sports */
  async fetchSchedule(sport?: string) {
    return invoke({ operation: "schedule", sport });
  },

  /** Run full pipeline for all 5 sports (daily automation) */
  async runDailyAutomation() {
    return invoke({ operation: "daily" });
  },

  /** Grant admin privileges by email */
  async makeAdmin(email: string) {
    return invoke({ operation: "make_admin", email });
  },

  /** Make the first user an admin (initial setup) */
  async makeFirstAdmin() {
    return invoke({ operation: "make_first_admin" });
  },

  // ── DIRECT DB QUERIES (always work, no edge function) ──────────

  async getPlayers(sport?: SportType) {
    let q = supabase
      .from("players")
      .select("*, teams(name, abbreviation)")
      .order("full_name");
    if (sport) q = q.eq("sport", sport);
    const { data, error } = await q.limit(500);
    if (error) throw error;
    return data ?? [];
  },

  async getProps(sport?: SportType, combo?: boolean) {
    let q = supabase
      .from("player_props")
      .select("*")
      .order("confidence_score", { ascending: false, nullsFirst: false });
    if (sport) q = q.eq("sport", sport);
    if (combo !== undefined) q = q.eq("is_combo", combo);
    const { data, error } = await q.limit(500);
    if (error) throw error;
    return data ?? [];
  },

  async getInjuries(sport?: SportType) {
    let q = supabase
      .from("injury_tracking")
      .select("*, players(full_name, position, teams(abbreviation))")
      .order("last_updated", { ascending: false });
    if (sport) q = q.eq("sport", sport);
    const { data, error } = await q.limit(300);
    if (error) throw error;
    return data ?? [];
  },

  async getGames(sport?: SportType, status?: string, date?: string) {
    let q = supabase
      .from("games_data")
      .select(`
        *,
        home_team:teams!games_data_home_team_id_fkey(name, abbreviation, logo_url),
        away_team:teams!games_data_away_team_id_fkey(name, abbreviation, logo_url)
      `)
      .order("start_time", { ascending: true });
    if (sport) q = q.eq("sport", sport);
    if (status) q = q.eq("status", status);
    if (date) q = q.eq("game_date", date);
    const { data, error } = await q.limit(50);
    if (error) throw error;
    return data ?? [];
  },

  async getPlayerStats(playerId: string, limit = 20) {
    const { data, error } = await supabase
      .from("player_game_stats")
      .select("*")
      .eq("player_id", playerId)
      .order("game_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getIngestionLogs() {
    const { data, error } = await supabase
      .from("ingestion_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },

  // ── HEALTH CHECK ──────────────────────────────────────────────

  async healthCheck() {
    const results: Record<string, string> = {};

    // Test DB directly
    try {
      const { error } = await supabase.from("teams").select("id").limit(1);
      results.database = error ? `❌ ${error.message}` : "✅ Connected";
    } catch (e: any) {
      results.database = `❌ ${e.message}`;
    }

    // Test edge function via a lightweight operation
    try {
      const data = await invoke({ operation: "schedule", sport: "nba" });
      results.edge_function = data?.success !== false
        ? "✅ Deployed & working"
        : `⚠️ ${JSON.stringify(data)}`;
    } catch (e: any) {
      results.edge_function = `❌ Not deployed — ${e.message}`;
    }

    // Count records in key tables
    for (const table of ["teams", "players", "player_props", "games_data"] as const) {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      results[table] = `${count ?? 0} rows`;
    }

    return results;
  },
};
