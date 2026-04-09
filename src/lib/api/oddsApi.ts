// src/lib/api/oddsApi.ts
// Frontend interface for the odds-props edge function
// Reads real prop lines from odds-api.io via Supabase cache

import { supabase } from "@/integrations/supabase/client";

export interface PropLine {
  id: string;
  sport: string;
  player_name: string;
  bookmaker: string;
  market_key: string;
  market_label: string;
  game: string;
  game_time: string | null;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  is_combo: boolean;
  last_updated: string;
}

export interface MarketInfo {
  key: string;
  label: string;
}

// ── INVOKE WRAPPER ────────────────────────────────────────────
async function invoke(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("odds-props", { body });
  if (error) {
    console.error("[odds-props]", error);
    throw new Error(error.message ?? "odds-props function failed");
  }
  if (!data?.success) throw new Error(data?.error ?? "Unknown error from odds-props");
  return data;
}

export const oddsApi = {

  // ── ADMIN: trigger a sync (call from Admin panel) ──────────
  async sync(sport: string) {
    return invoke({ operation: "sync", sport });
  },

  async syncAll() {
    return invoke({ operation: "sync_all" });
  },

  // ── READ: get all props for a sport ──────────────────────
  async getProps(sport: string, opts?: {
    bookmaker?: string;
    marketKey?: string;
    playerName?: string;
    comboOnly?: boolean;
    singleOnly?: boolean;
  }): Promise<PropLine[]> {
    const data = await invoke({ operation: "get_props", sport, ...opts });
    return data.props ?? [];
  },

  // ── READ: direct DB query (faster, no function call) ─────
  async getPropsDirect(sport: string, opts?: {
    marketKey?: string;
    playerName?: string;
    isCombo?: boolean;
  }): Promise<PropLine[]> {
    let q = supabase
      .from("player_props_cache")
      .select("*")
      .eq("sport", sport)
      .order("player_name");

    if (opts?.marketKey)   q = q.eq("market_key", opts.marketKey);
    if (opts?.playerName)  q = q.ilike("player_name", `%${opts.playerName}%`);
    if (opts?.isCombo !== undefined) q = q.eq("is_combo", opts.isCombo);

    const { data, error } = await q.limit(2000);
    if (error) throw error;
    return (data ?? []) as PropLine[];
  },

  // ── READ: get available markets for a sport ───────────────
  async getMarkets(sport: string): Promise<{ single: MarketInfo[]; combo: MarketInfo[] }> {
    const data = await invoke({ operation: "get_markets", sport });
    return { single: data.single_markets ?? [], combo: data.combo_markets ?? [] };
  },

  // ── READ: all unique bookmakers in cache for a sport ──────
  async getBookmakers(sport: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("player_props_cache")
      .select("bookmaker")
      .eq("sport", sport);
    if (error) throw error;
    return [...new Set((data ?? []).map((r: any) => r.bookmaker))].sort();
  },

  // ── READ: all props for ONE player ───────────────────────
  async getPlayerProps(playerName: string, sport: string): Promise<PropLine[]> {
    const { data, error } = await supabase
      .from("player_props_cache")
      .select("*")
      .eq("sport", sport)
      .ilike("player_name", `%${playerName}%`)
      .order("market_key");
    if (error) throw error;
    return (data ?? []) as PropLine[];
  },

  // ── READ: single lines grouped by player ─────────────────
  async getSingleProps(sport: string): Promise<Record<string, PropLine[]>> {
    const props = await this.getPropsDirect(sport, { isCombo: false });
    const grouped: Record<string, PropLine[]> = {};
    for (const p of props) {
      if (!grouped[p.player_name]) grouped[p.player_name] = [];
      grouped[p.player_name].push(p);
    }
    return grouped;
  },

  // ── READ: combo lines grouped by player ──────────────────
  async getComboProps(sport: string): Promise<Record<string, PropLine[]>> {
    const props = await this.getPropsDirect(sport, { isCombo: true });
    const grouped: Record<string, PropLine[]> = {};
    for (const p of props) {
      if (!grouped[p.player_name]) grouped[p.player_name] = [];
      grouped[p.player_name].push(p);
    }
    return grouped;
  },

  // ── ADMIN: check API quota remaining ─────────────────────
  async checkQuota() {
    return invoke({ operation: "quota" });
  },

  // ── ADMIN: health check ───────────────────────────────────
  async health() {
    return invoke({ operation: "health" });
  },

  async test() {
    return invoke({ operation: "test" });
  },
};
