export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          external_id: string
          sport: string
          full_name: string
          first_name: string | null
          last_name: string | null
          position: string | null
          team_id: string | null
          jersey_number: string | null
          height: string | null
          weight: string | null
          headshot_url: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {}
        Update: {}
      }
      player_props: {
        Row: {
          id: string
          player_id: string
          sport: string
          player_name: string
          stat_type: string
          is_combo: boolean
          projected_value: number
          baseline_line: number
          hit_rate_last5: number
          hit_rate_last10: number
          hit_rate_last20: number
          avg_last5: number
          avg_last10: number
          avg_last20: number
          trend: string
          consistency: number
          edge_type: string
          confidence_score: number
          last_updated: string
        }
        Insert: {}
        Update: {}
      }
      player_game_stats: {
        Row: {
          id: string
          player_id: string
          game_id: string
          sport: string
          player_name: string
          team_abbreviation: string
          game_date: string
          started: boolean
          minutes_played: number
          points: number
          rebounds: number
          assists: number
          steals: number
          blocks: number
          turnovers: number
          field_goals_made: number
          field_goals_attempted: number
          three_pointers_made: number
          three_pointers_attempted: number
          free_throws_made: number
          free_throws_attempted: number
        }
        Insert: {}
        Update: {}
      }
      teams: {
        Row: {
          id: string
          external_id: string
          sport: string
          name: string
          abbreviation: string
          city: string | null
          logo_url: string | null
          conference: string | null
          division: string | null
        }
        Insert: {}
        Update: {}
      }
      games_data: {
        Row: {
          id: string
          external_id: string
          sport: string
          home_team_id: string | null
          away_team_id: string | null
          game_date: string
          start_time: string | null
          status: string
          home_score: number
          away_score: number
          current_period: string | null
          time_remaining: string | null
          venue: string | null
          season: string | null
        }
        Insert: {}
        Update: {}
      }
    }
  }
}
