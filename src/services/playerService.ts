// src/services/playerService.ts
import { supabase } from './supabase'; // Your existing Supabase client

export interface PlayerWithRollingStats {
  id: string;
  full_name: string;
  position?: string | null;
  team_abbreviation?: string | null;
  status?: string | null;
  sport?: string;
  rolling_stats?: {
    avg_points: number | null;
    hit_rate: number | null;
    games_analyzed: number | null;
    target_games: number | null;
    is_complete: boolean | null;
  } | null;
}

export async function fetchPlayerWithRollingStats(
  playerId: string, 
  sport: string = 'nba'
): Promise<PlayerWithRollingStats> {
  const {  data: playerWithStats, error } = await supabase
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

export async function fetchPlayersWithRollingStats(
  sport: string = 'nba',
  limit: number = 50
): Promise<PlayerWithRollingStats[]> {
  const {  data: players, error } = await supabase
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
