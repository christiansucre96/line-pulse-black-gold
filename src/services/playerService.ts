// src/services/playerService.ts
// Reads from v_player_rolling_stats view — always accurate, real-time
// L5/L10/L15/L20 calculated live from player_game_stats with correct date ordering

import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RollingWindow {
  avg: number           // average stat value over the window
  games: number         // number of games in window
  game_values: number[] // individual game scores newest→oldest
  hit_rate?: number     // % of games over their own avg
}

export interface PlayerRollingStats {
  // Points windows
  pts_l5:  RollingWindow
  pts_l10: RollingWindow
  pts_l15: RollingWindow
  pts_l20: RollingWindow
  // Rebounds windows
  reb_l5:  RollingWindow
  reb_l10: RollingWindow
  reb_l15: RollingWindow
  reb_l20: RollingWindow
  // Assists windows
  ast_l5:  RollingWindow
  ast_l10: RollingWindow
  ast_l15: RollingWindow
  ast_l20: RollingWindow
  // Steals/Blocks/3PM averages (L10)
  stl_l10_avg: number
  blk_l10_avg: number
  tpm_l10_avg: number
  // Hit rates
  pts_hit_rate_l10: number
  reb_hit_rate_l10: number
  ast_hit_rate_l10: number
  // Chart data (newest → oldest)
  game_dates:    string[]  // last 20 game dates
  tpm_l20_games: number[]  // 3PM last 20 games
  pts_l20_games: number[]  // points last 20 (for chart)
  reb_l20_games: number[]  // rebounds last 20
  ast_l20_games: number[]  // assists last 20
}

export interface PlayerWithRollingStats {
  id:                string
  full_name:         string
  position?:         string | null
  sport?:            string
  rolling_stats?:    PlayerRollingStats | null
  // Legacy compat
  team_abbreviation?: string | null
  status?:            string | null
}

// Legacy interface for backwards compatibility with existing scanner/detail views
export interface RollingStats {
  avg_points:     number | null
  hit_rate:       number | null
  games_analyzed: number | null
  target_games:   number | null
  is_complete:    boolean | null
}

// ─── Transform view row → PlayerRollingStats ──────────────────────────────────
function toWindow(avg: any, games: any, values: any, hitRate?: any): RollingWindow {
  return {
    avg:        Number(avg)   || 0,
    games:      Number(games) || 0,
    game_values: Array.isArray(values) ? values : [],
    hit_rate:   hitRate !== undefined ? Number(hitRate) || 0 : undefined,
  }
}

function transformRow(row: any): PlayerRollingStats {
  return {
    pts_l5:  toWindow(row.pts_l5_avg,  row.games_l5,  row.pts_l5_games,  row.pts_hit_rate_l10),
    pts_l10: toWindow(row.pts_l10_avg, row.games_l10, row.pts_l10_games, row.pts_hit_rate_l10),
    pts_l15: toWindow(row.pts_l15_avg, row.games_l15, row.pts_l15_games),
    pts_l20: toWindow(row.pts_l20_avg, row.games_l20, row.pts_l20_games),

    reb_l5:  toWindow(row.reb_l5_avg,  row.games_l5,  row.reb_l5_games,  row.reb_hit_rate_l10),
    reb_l10: toWindow(row.reb_l10_avg, row.games_l10, row.reb_l10_games, row.reb_hit_rate_l10),
    reb_l15: toWindow(row.reb_l15_avg, row.games_l15, row.reb_l15_games),
    reb_l20: toWindow(row.reb_l20_avg, row.games_l20, row.reb_l20_games),

    ast_l5:  toWindow(row.ast_l5_avg,  row.games_l5,  row.ast_l5_games,  row.ast_hit_rate_l10),
    ast_l10: toWindow(row.ast_l10_avg, row.games_l10, row.ast_l10_games, row.ast_hit_rate_l10),
    ast_l15: toWindow(row.ast_l15_avg, row.games_l15, row.ast_l15_games),
    ast_l20: toWindow(row.ast_l20_avg, row.games_l20, row.ast_l20_games),

    stl_l10_avg: Number(row.stl_l10_avg) || 0,
    blk_l10_avg: Number(row.blk_l10_avg) || 0,
    tpm_l10_avg: Number(row.tpm_l10_avg) || 0,

    pts_hit_rate_l10: Number(row.pts_hit_rate_l10) || 0,
    reb_hit_rate_l10: Number(row.reb_hit_rate_l10) || 0,
    ast_hit_rate_l10: Number(row.ast_hit_rate_l10) || 0,

    game_dates:    Array.isArray(row.game_dates_l20)  ? row.game_dates_l20  : [],
    tpm_l20_games: Array.isArray(row.tpm_l20_games)   ? row.tpm_l20_games   : [],
    pts_l20_games: Array.isArray(row.pts_l20_games)   ? row.pts_l20_games   : [],
    reb_l20_games: Array.isArray(row.reb_l20_games)   ? row.reb_l20_games   : [],
    ast_l20_games: Array.isArray(row.ast_l20_games)   ? row.ast_l20_games   : [],
  }
}

function toPlayer(row: any): PlayerWithRollingStats {
  return {
    id:            row.player_id,
    full_name:     row.full_name,
    position:      row.position  || null,
    sport:         row.sport,
    rolling_stats: transformRow(row),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single player's rolling stats by player UUID
 */
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
  return toPlayer(data)
}

/**
 * Fetch all players with rolling stats for a sport
 * Only returns players who have actual game data (games_l5 > 0)
 */
export async function fetchPlayersWithRollingStats(
  sport: string = 'nba',
  limit: number = 600
): Promise<PlayerWithRollingStats[]> {
  const { data, error } = await supabase
    .from('v_player_rolling_stats')
    .select('*')
    .eq('sport', sport)
    .gt('games_l5', 0)
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []).map(toPlayer)
}

/**
 * Fetch a single player by name
 */
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
  return toPlayer(data)
}

/**
 * Get prop-specific rolling windows for a player
 * Maps prop type string → correct L5/L10/L15/L20 windows
 */
export function getPropWindows(
  rs: PlayerRollingStats | null | undefined,
  prop: string
): { l5: RollingWindow; l10: RollingWindow; l15: RollingWindow; l20: RollingWindow } | null {
  if (!rs) return null

  // Combo props use points + rebounds + assists
  if (prop === 'combo_pra') {
    return {
      l5:  { avg: rs.pts_l5.avg  + rs.reb_l5.avg  + rs.ast_l5.avg,  games: rs.pts_l5.games,  game_values: [] },
      l10: { avg: rs.pts_l10.avg + rs.reb_l10.avg + rs.ast_l10.avg, games: rs.pts_l10.games, game_values: [] },
      l15: { avg: rs.pts_l15.avg + rs.reb_l15.avg + rs.ast_l15.avg, games: rs.pts_l15.games, game_values: [] },
      l20: { avg: rs.pts_l20.avg + rs.reb_l20.avg + rs.ast_l20.avg, games: rs.pts_l20.games, game_values: [] },
    }
  }
  if (prop === 'combo_pr') {
    return {
      l5:  { avg: rs.pts_l5.avg  + rs.reb_l5.avg,  games: rs.pts_l5.games,  game_values: [] },
      l10: { avg: rs.pts_l10.avg + rs.reb_l10.avg, games: rs.pts_l10.games, game_values: [] },
      l15: { avg: rs.pts_l15.avg + rs.reb_l15.avg, games: rs.pts_l15.games, game_values: [] },
      l20: { avg: rs.pts_l20.avg + rs.reb_l20.avg, games: rs.pts_l20.games, game_values: [] },
    }
  }
  if (prop === 'combo_pa') {
    return {
      l5:  { avg: rs.pts_l5.avg  + rs.ast_l5.avg,  games: rs.pts_l5.games,  game_values: [] },
      l10: { avg: rs.pts_l10.avg + rs.ast_l10.avg, games: rs.pts_l10.games, game_values: [] },
      l15: { avg: rs.pts_l15.avg + rs.ast_l15.avg, games: rs.pts_l15.games, game_values: [] },
      l20: { avg: rs.pts_l20.avg + rs.ast_l20.avg, games: rs.pts_l20.games, game_values: [] },
    }
  }

  // Direct prop mappings
  const map: Record<string, { l5: RollingWindow; l10: RollingWindow; l15: RollingWindow; l20: RollingWindow }> = {
    points:   { l5: rs.pts_l5, l10: rs.pts_l10, l15: rs.pts_l15, l20: rs.pts_l20 },
    rebounds: { l5: rs.reb_l5, l10: rs.reb_l10, l15: rs.reb_l15, l20: rs.reb_l20 },
    assists:  { l5: rs.ast_l5, l10: rs.ast_l10, l15: rs.ast_l15, l20: rs.ast_l20 },
  }

  return map[prop] || map.points
}

/**
 * Legacy helper — returns rolling stats in old format
 * Used by components that haven't been updated yet
 */
export function toLegacyRollingStats(rs: PlayerRollingStats | null | undefined): RollingStats | null {
  if (!rs) return null
  return {
    avg_points:     rs.pts_l20.avg,
    hit_rate:       rs.pts_hit_rate_l10,
    games_analyzed: rs.pts_l20.games,
    target_games:   20,
    is_complete:    rs.pts_l20.games >= 20,
  }
}
