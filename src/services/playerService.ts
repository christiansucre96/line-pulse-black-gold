// src/services/playerService.ts
// ✅ Reads from v_player_rolling_stats view — always accurate, real-time
// ✅ L5/L10/L15/L20 all correct with proper date ordering (newest first)

import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RollingWindow {
  avg: number;
  games: number;
  game_values: number[];  // individual game scores, newest first
  hit_rate?: number;      // % of games over their own avg
}

export interface PlayerRollingStats {
  // Averages
  pts_l5:  RollingWindow;
  pts_l10: RollingWindow;
  pts_l15: RollingWindow;
  pts_l20: RollingWindow;
  reb_l5:  RollingWindow;
  reb_l10: RollingWindow;
  reb_l15: RollingWindow;
  reb_l20: RollingWindow;
  ast_l5:  RollingWindow;
  ast_l10: RollingWindow;
  ast_l15: RollingWindow;
  ast_l20: RollingWindow;
  // Hit rates
  pts_hit_rate_l10: number;
  reb_hit_rate_l10: number;
  ast_hit_rate_l10: number;
  // Chart data
  game_dates: string[];   // last 20 game dates, newest first
  tpm_l20_games: number[]; // 3PM last 20 games
}

export interface PlayerWithRollingStats {
  id: string;
  full_name: string;
  position?: string | null;
  sport?: string;
  rolling_stats?: PlayerRollingStats | null;
  // Legacy fields for backwards compatibility
  team_abbreviation?: string | null;
  status?: string | null;
}

// ─── Transform view row → PlayerRollingStats ──────────────────────────────────
function transformViewRow(row: any): PlayerRollingStats {
  return {
    pts_l5:  { avg: Number(row.pts_l5_avg),  games: row.games_l5,  game_values: row.pts_l5_games  || [], hit_rate: Number(row.pts_hit_rate_l10) },
    pts_l10: { avg: Number(row.pts_l10_avg), games: row.games_l10, game_values: row.pts_l10_games || [], hit_rate: Number(row.pts_hit_rate_l10) },
    pts_l15: { avg: Number(row.pts_l15_avg), games: row.games_l15, game_values: row.pts_l15_games || [] },
    pts_l20: { avg: Number(row.pts_l20_avg), games: row.games_l20, game_values: row.pts_l20_games || [] },

    reb_l5:  { avg: Number(row.reb_l5_avg),  games: row.games_l5,  game_values: row.reb_l5_games  || [] },
    reb_l10: { avg: Number(row.reb_l10_avg), games: row.games_l10, game_values: row.reb_l10_games || [] },
    reb_l15: { avg: Number(row.reb_l15_avg), games: row.games_l15, game_values: row.reb_l15_games || [] },
    reb_l20: { avg: Number(row.reb_l20_avg), games: row.games_l20, game_values: row.reb_l20_games || [] },

    ast_l5:  { avg: Number(row.ast_l5_avg),  games: row.games_l5,  game_values: row.ast_l5_games  || [] },
    ast_l10: { avg: Number(row.ast_l10_avg), games: row.games_l10, game_values: row.ast_l10_games || [] },
    ast_l15: { avg: Number(row.ast_l15_avg), games: row.games_l15, game_values: row.ast_l15_games || [] },
    ast_l20: { avg: Number(row.ast_l20_avg), games: row.games_l20, game_values: row.ast_l20_games || [] },

    pts_hit_rate_l10: Number(row.pts_hit_rate_l10) || 0,
    reb_hit_rate_l10: Number(row.reb_hit_rate_l10) || 0,
    ast_hit_rate_l10: Number(row.ast_hit_rate_l10) || 0,

    game_dates:    row.game_dates_l20  || [],
    tpm_l20_games: row.tpm_l20_games   || [],
  }
}

// ─── Fetch single player ──────────────────────────────────────────────────────
export async function fetchPlayerWithRollingStats(
  playerId: string,
  sport: string = 'nba'
): Promise<PlayerWithRollingStats> {
  const { data, error } = await supabase
    .from('v_player_rolling_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('sport', sport)
    .single()

  if (error) throw error

  return {
    id:            data.player_id,
    full_name:     data.full_name,
    position:      data.position,
    sport:         data.sport,
    rolling_stats: transformViewRow(data),
  }
}

// ─── Fetch multiple players ───────────────────────────────────────────────────
export async function fetchPlayersWithRollingStats(
  sport: string = 'nba',
  limit: number = 600
): Promise<PlayerWithRollingStats[]> {
  const { data, error } = await supabase
    .from('v_player_rolling_stats')
    .select('*')
    .eq('sport', sport)
    .gt('games_l5', 0)        // only players with actual game data
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data || []).map(row => ({
    id:            row.player_id,
    full_name:     row.full_name,
    position:      row.position,
    sport:         row.sport,
    rolling_stats: transformViewRow(row),
  }))
}

// ─── Fetch single player by name (for detail views) ──────────────────────────
export async function fetchPlayerStatsByName(
  fullName: string,
  sport: string = 'nba'
): Promise<PlayerWithRollingStats | null> {
  const { data, error } = await supabase
    .from('v_player_rolling_stats')
    .select('*')
    .eq('sport', sport)
    .ilike('full_name', fullName)
    .maybeSingle()

  if (error || !data) return null

  return {
    id:            data.player_id,
    full_name:     data.full_name,
    position:      data.position,
    sport:         data.sport,
    rolling_stats: transformViewRow(data),
  }
}

// ─── Helper: get prop-specific rolling stats ──────────────────────────────────
// Maps prop type string to the correct rolling window
export function getPropStats(
  rollingStats: PlayerRollingStats | null | undefined,
  prop: string
): { l5: RollingWindow; l10: RollingWindow; l15: RollingWindow; l20: RollingWindow } | null {
  if (!rollingStats) return null

  const propMap: Record<string, string> = {
    points:             'pts',
    rebounds:           'reb',
    assists:            'ast',
    three_pointers_made: 'tpm',
    steals:             'stl',
    blocks:             'blk',
  }

  const prefix = propMap[prop] || 'pts'

  // For props we have full data for
  if (['pts', 'reb', 'ast'].includes(prefix)) {
    return {
      l5:  (rollingStats as any)[`${prefix}_l5`],
      l10: (rollingStats as any)[`${prefix}_l10`],
      l15: (rollingStats as any)[`${prefix}_l15`],
      l20: (rollingStats as any)[`${prefix}_l20`],
    }
  }

  // Fallback to points for unsupported props
  return {
    l5:  rollingStats.pts_l5,
    l10: rollingStats.pts_l10,
    l15: rollingStats.pts_l15,
    l20: rollingStats.pts_l20,
  }
}
