// src/services/playerService.ts
import { supabase } from './supabase' // your existing supabase client

export async function fetchPlayerWithRollingStats(playerId: string, sport: string = 'nba') {
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
    .single()

  if (error) throw error
  return playerWithStats
}
