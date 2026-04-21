// src/services/playerService.ts
import { supabase } from '../lib/supabase'  // ✅ Correct path: up one folder, then into lib

// ✅ TypeScript Interfaces
export interface RollingStats {
  avg_points: number | null;
  hit_rate: number | null;
  games_analyzed: number | null;
  target_games: number | null;
  is_complete: boolean | null;
}

export interface PlayerWithRollingStats {
  id: string;
  full_name: string;
  position?: string | null;
  team_abbreviation?: string | null;
  status?: string | null;
  sport?: string;
  rolling_stats?: RollingStats | null;
}

// ✅ Fetch single player with rolling stats
export async function fetchPlayerWithRollingStats(
  playerId: string, 
  sport: string = 'nba'
): Promise<PlayerWithRollingStats> {
  const {  playerWithStats, error } = await supabase
    .from('players')
    .select(`
      *,
      rolling_stats:player_rolling_stats(
        avg_points,
        hit_rate,
        games_analyzed,
        target_games,
        is_complete
      )
    `)
    .eq('id', playerId)
    .eq('sport', sport)
    .single();

  if (error) throw error;
  return playerWithStats;
}

// ✅ Fetch multiple players with rolling stats
export async function fetchPlayersWithRollingStats(
  sport: string = 'nba',
  limit: number = 100
): Promise<PlayerWithRollingStats[]> {
  const {  players, error } = await supabase
    .from('players')
    .select(`
      *,
      rolling_stats:player_rolling_stats(
        avg_points,
        hit_rate,
        games_analyzed,
        target_games,
        is_complete
      )
    `)
    .eq('sport', sport)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return players || [];
}
