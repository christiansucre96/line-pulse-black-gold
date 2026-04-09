// src/hooks/useOddsProps.ts
// React hooks for reading prop lines from odds-api.io cache

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PropLine } from "@/lib/api/oddsApi";
import type { Sport } from "@/data/mockPlayers";

const SPORT_MAP: Record<Sport, string> = {
  NBA: "nba", NFL: "nfl", MLB: "mlb", NHL: "nhl", Soccer: "soccer",
};

// ── All props for a sport — powers the main scanner table ─────
export function usePropLines(sport: Sport, opts?: {
  marketKey?: string;
  isCombo?: boolean;
  playerName?: string;
}) {
  return useQuery({
    queryKey: ["prop-lines", sport, opts],
    queryFn: async (): Promise<PropLine[]> => {
      let q = supabase
        .from("player_props_cache")
        .select("*")
        .eq("sport", SPORT_MAP[sport])
        .order("player_name");

      if (opts?.marketKey)   q = q.eq("market_key", opts.marketKey);
      if (opts?.playerName)  q = q.ilike("player_name", `%${opts.playerName}%`);
      if (opts?.isCombo !== undefined) q = q.eq("is_combo", opts.isCombo);

      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data ?? []) as PropLine[];
    },
    staleTime: 5 * 60_000,          // re-fetch every 5 min
    refetchInterval: 10 * 60_000,   // auto-refresh every 10 min
  });
}

// ── Props grouped by player — for the player detail view ──────
export function usePlayerPropLines(playerName: string, sport: Sport) {
  return useQuery({
    queryKey: ["player-prop-lines", playerName, sport],
    queryFn: async (): Promise<PropLine[]> => {
      const { data, error } = await supabase
        .from("player_props_cache")
        .select("*")
        .eq("sport", SPORT_MAP[sport])
        .ilike("player_name", `%${playerName}%`)
        .order("market_key");
      if (error) throw error;
      return (data ?? []) as PropLine[];
    },
    staleTime: 5 * 60_000,
    enabled: !!playerName,
  });
}

// ── Unique market types available for a sport ─────────────────
export function useAvailableMarkets(sport: Sport) {
  return useQuery({
    queryKey: ["available-markets", sport],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_props_cache")
        .select("market_key,market_label,is_combo")
        .eq("sport", SPORT_MAP[sport]);
      if (error) throw error;

      const seen = new Set<string>();
      const single: { key: string; label: string }[] = [];
      const combo:  { key: string; label: string }[] = [];

      for (const row of (data ?? [])) {
        if (seen.has(row.market_key)) continue;
        seen.add(row.market_key);
        const entry = { key: row.market_key, label: row.market_label || row.market_key };
        if (row.is_combo) combo.push(entry);
        else              single.push(entry);
      }

      return { single, combo };
    },
    staleTime: 10 * 60_000,
  });
}

// ── Count of cached props per sport (Admin / health) ──────────
export function usePropCacheHealth() {
  return useQuery({
    queryKey: ["prop-cache-health"],
    queryFn: async () => {
      const sports = ["nba","nfl","mlb","nhl","soccer"];
      const counts: Record<string, number> = {};
      for (const s of sports) {
        const { count } = await supabase
          .from("player_props_cache")
          .select("*", { count: "exact", head: true })
          .eq("sport", s);
        counts[s] = count ?? 0;
      }
      return counts;
    },
    staleTime: 60_000,
  });
}

// ── Utility: convert PropLine array → scanner format ──────────
export function propsToScannerRows(props: PropLine[]) {
  // Group by player+market, pick best line (highest confidence bookmaker)
  const grouped = new Map<string, PropLine>();
  for (const p of props) {
    const key = `${p.player_name}||${p.market_key}`;
    // Prefer DraftKings > FanDuel > others
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, p);
    } else {
      const pref = ["draftkings", "fanduel", "betmgm"];
      const newRank = pref.indexOf(p.bookmaker.toLowerCase());
      const oldRank = pref.indexOf(existing.bookmaker.toLowerCase());
      if (newRank !== -1 && (oldRank === -1 || newRank < oldRank)) {
        grouped.set(key, p);
      }
    }
  }
  return [...grouped.values()];
}
