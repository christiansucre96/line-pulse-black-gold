import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Sport } from "@/data/mockPlayers";

type DbSport = "nba" | "nfl" | "mlb" | "nhl" | "soccer";

const sportMap: Record<Sport, DbSport> = {
  NBA: "nba", NFL: "nfl", MLB: "mlb", NHL: "nhl", Soccer: "soccer",
};

export interface LivePlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  initials: string;
  sport: Sport;
  headshot_url?: string | null;
}

export interface LivePlayerProp {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  initials: string;
  avgL10: number;
  diff: number;
  l5: number;
  l10: number;
  l15: number;
  streak: number;
  categories: string[];
  sport: Sport;
}

export interface LiveInjury {
  id: string;
  name: string;
  team: string;
  position: string;
  initials: string;
  status: string;
  injury: string;
  updated: string;
  sport: Sport;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const dbSportToSport: Record<string, Sport> = {
  nba: "NBA", nfl: "NFL", mlb: "MLB", nhl: "NHL", soccer: "Soccer",
};

// ── Props / Scanner data ──
export function usePlayerProps(sport: Sport) {
  return useQuery({
    queryKey: ["player-props", sport],
    queryFn: async (): Promise<LivePlayerProp[]> => {
      const dbSport = sportMap[sport];
      const { data, error } = await supabase
        .from("player_props")
        .select("*, players(full_name, position, team_id, teams(abbreviation))")
        .eq("sport", dbSport)
        .eq("is_combo", false)
        .order("confidence_score", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((p: any) => {
        const name = p.players?.full_name || p.player_name || "Unknown";
        const teamAbbr = p.players?.teams?.abbreviation || "—";
        const position = p.players?.position || "—";
        const avg5 = Number(p.avg_last5) || 0;
        const avg10 = Number(p.avg_last10) || 0;
        const avg20 = Number(p.avg_last20) || 0;
        const line = Number(p.baseline_line) || 0;
        return {
          id: p.player_id,
          name,
          position,
          team: teamAbbr,
          opponent: "—",
          initials: getInitials(name),
          avgL10: avg10,
          diff: +(avg10 - line).toFixed(1),
          l5: Math.round(Number(p.hit_rate_last5) || 0),
          l10: Math.round(Number(p.hit_rate_last10) || 0),
          l15: Math.round(((Number(p.hit_rate_last10) || 0) + (Number(p.hit_rate_last20) || 0)) / 2),
          streak: 0,
          categories: [p.stat_type || ""],
          sport,
        };
      });
    },
    staleTime: 60_000,
  });
}

// ── Roster data ──
export function useRosterData(sport: Sport) {
  return useQuery({
    queryKey: ["roster", sport],
    queryFn: async () => {
      const dbSport = sportMap[sport];
      const { data, error } = await supabase
        .from("players")
        .select("*, teams(name, abbreviation)")
        .eq("sport", dbSport)
        .order("full_name")
        .limit(1000);
      if (error) throw error;
      if (!data || data.length === 0) return {};

      const teams: Record<string, LivePlayer[]> = {};
      data.forEach((p: any) => {
        const teamAbbr = p.teams?.abbreviation || p.teams?.name || "Unknown";
        if (!teams[teamAbbr]) teams[teamAbbr] = [];
        teams[teamAbbr].push({
          id: p.id,
          name: p.full_name,
          position: p.position || "—",
          team: teamAbbr,
          initials: getInitials(p.full_name),
          sport,
          headshot_url: p.headshot_url,
        });
      });
      return teams;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Injuries ──
export function useInjuryData(sport: Sport) {
  return useQuery({
    queryKey: ["injuries", sport],
    queryFn: async (): Promise<LiveInjury[]> => {
      const dbSport = sportMap[sport];
      const { data, error } = await supabase
        .from("injury_tracking")
        .select("*, players(full_name, position, team_id, teams(abbreviation))")
        .eq("sport", dbSport)
        .order("last_updated", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((i: any) => {
        const name = i.players?.full_name || "Unknown";
        return {
          id: i.id,
          name,
          team: i.players?.teams?.abbreviation || "—",
          position: i.players?.position || "—",
          initials: getInitials(name),
          status: i.status || "Unknown",
          injury: [i.body_part, i.description].filter(Boolean).join(" — ") || "—",
          updated: new Date(i.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          sport,
        };
      });
    },
    staleTime: 60_000,
  });
}

// ── Leaderboard (reuses props) ──
export function useLeaderboard(sport: Sport) {
  return usePlayerProps(sport);
}
