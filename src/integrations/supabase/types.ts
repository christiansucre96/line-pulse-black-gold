export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      game_lineups: {
        Row: {
          batting_order: number | null
          created_at: string
          game_id: string
          id: string
          is_starter: boolean | null
          player_id: string
          position: string | null
          team_id: string | null
        }
        Insert: {
          batting_order?: number | null
          created_at?: string
          game_id: string
          id?: string
          is_starter?: boolean | null
          player_id: string
          position?: string | null
          team_id?: string | null
        }
        Update: {
          batting_order?: number | null
          created_at?: string
          game_id?: string
          id?: string
          is_starter?: boolean | null
          player_id?: string
          position?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      games_data: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string
          current_period: string | null
          external_id: string | null
          game_date: string
          home_score: number | null
          home_team_id: string | null
          id: string
          season: string | null
          season_type: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          start_time: string | null
          status: string
          time_remaining: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          current_period?: string | null
          external_id?: string | null
          game_date: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          season?: string | null
          season_type?: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          start_time?: string | null
          status?: string
          time_remaining?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          current_period?: string | null
          external_id?: string | null
          game_date?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          season?: string | null
          season_type?: string | null
          sport?: Database["public"]["Enums"]["sport_type"]
          start_time?: string | null
          status?: string
          time_remaining?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_data_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_data_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          operation: string
          records_processed: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          operation: string
          records_processed?: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          operation?: string
          records_processed?: number | null
          sport?: Database["public"]["Enums"]["sport_type"]
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      injury_tracking: {
        Row: {
          body_part: string | null
          created_at: string
          description: string | null
          expected_return: string | null
          id: string
          last_updated: string
          player_id: string
          sport: Database["public"]["Enums"]["sport_type"]
          status: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          description?: string | null
          expected_return?: string | null
          id?: string
          last_updated?: string
          player_id: string
          sport: Database["public"]["Enums"]["sport_type"]
          status?: string
        }
        Update: {
          body_part?: string | null
          created_at?: string
          description?: string | null
          expected_return?: string | null
          id?: string
          last_updated?: string
          player_id?: string
          sport?: Database["public"]["Enums"]["sport_type"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "injury_tracking_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      live_edges: {
        Row: {
          confidence_score: number | null
          current_value: number | null
          edge_type: string | null
          game_id: string
          historical_avg: number | null
          id: string
          last_updated: string
          player_id: string
          player_name: string | null
          projected_value: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          stat_type: string | null
        }
        Insert: {
          confidence_score?: number | null
          current_value?: number | null
          edge_type?: string | null
          game_id: string
          historical_avg?: number | null
          id?: string
          last_updated?: string
          player_id: string
          player_name?: string | null
          projected_value?: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          stat_type?: string | null
        }
        Update: {
          confidence_score?: number | null
          current_value?: number | null
          edge_type?: string | null
          game_id?: string
          historical_avg?: number | null
          id?: string
          last_updated?: string
          player_id?: string
          player_name?: string | null
          projected_value?: number | null
          sport?: Database["public"]["Enums"]["sport_type"]
          stat_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_edges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_edges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_stats: {
        Row: {
          assists: number | null
          assists_hockey: number | null
          assists_soccer: number | null
          at_bats: number | null
          blocks: number | null
          created_at: string
          earned_runs: number | null
          field_goals_attempted: number | null
          field_goals_made: number | null
          free_throws_attempted: number | null
          free_throws_made: number | null
          game_date: string | null
          game_id: string
          goals: number | null
          goals_soccer: number | null
          hits: number | null
          home_runs: number | null
          id: string
          innings_pitched: number | null
          interceptions_thrown: number | null
          minutes_played: number | null
          passes_completed: number | null
          passing_tds: number | null
          passing_yards: number | null
          penalty_minutes: number | null
          player_id: string
          player_name: string | null
          plus_minus: number | null
          points: number | null
          rbi: number | null
          rebounds: number | null
          receiving_tds: number | null
          receiving_yards: number | null
          receptions: number | null
          runs: number | null
          rushing_tds: number | null
          rushing_yards: number | null
          shots_on_goal: number | null
          shots_on_target: number | null
          shots_soccer: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          started: boolean | null
          steals: number | null
          stolen_bases: number | null
          strikeouts_batting: number | null
          strikeouts_pitching: number | null
          tackles: number | null
          targets: number | null
          team_abbreviation: string | null
          three_pointers_attempted: number | null
          three_pointers_made: number | null
          total_bases: number | null
          turnovers: number | null
          walks: number | null
        }
        Insert: {
          assists?: number | null
          assists_hockey?: number | null
          assists_soccer?: number | null
          at_bats?: number | null
          blocks?: number | null
          created_at?: string
          earned_runs?: number | null
          field_goals_attempted?: number | null
          field_goals_made?: number | null
          free_throws_attempted?: number | null
          free_throws_made?: number | null
          game_date?: string | null
          game_id: string
          goals?: number | null
          goals_soccer?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          innings_pitched?: number | null
          interceptions_thrown?: number | null
          minutes_played?: number | null
          passes_completed?: number | null
          passing_tds?: number | null
          passing_yards?: number | null
          penalty_minutes?: number | null
          player_id: string
          player_name?: string | null
          plus_minus?: number | null
          points?: number | null
          rbi?: number | null
          rebounds?: number | null
          receiving_tds?: number | null
          receiving_yards?: number | null
          receptions?: number | null
          runs?: number | null
          rushing_tds?: number | null
          rushing_yards?: number | null
          shots_on_goal?: number | null
          shots_on_target?: number | null
          shots_soccer?: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          started?: boolean | null
          steals?: number | null
          stolen_bases?: number | null
          strikeouts_batting?: number | null
          strikeouts_pitching?: number | null
          tackles?: number | null
          targets?: number | null
          team_abbreviation?: string | null
          three_pointers_attempted?: number | null
          three_pointers_made?: number | null
          total_bases?: number | null
          turnovers?: number | null
          walks?: number | null
        }
        Update: {
          assists?: number | null
          assists_hockey?: number | null
          assists_soccer?: number | null
          at_bats?: number | null
          blocks?: number | null
          created_at?: string
          earned_runs?: number | null
          field_goals_attempted?: number | null
          field_goals_made?: number | null
          free_throws_attempted?: number | null
          free_throws_made?: number | null
          game_date?: string | null
          game_id?: string
          goals?: number | null
          goals_soccer?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          innings_pitched?: number | null
          interceptions_thrown?: number | null
          minutes_played?: number | null
          passes_completed?: number | null
          passing_tds?: number | null
          passing_yards?: number | null
          penalty_minutes?: number | null
          player_id?: string
          player_name?: string | null
          plus_minus?: number | null
          points?: number | null
          rbi?: number | null
          rebounds?: number | null
          receiving_tds?: number | null
          receiving_yards?: number | null
          receptions?: number | null
          runs?: number | null
          rushing_tds?: number | null
          rushing_yards?: number | null
          shots_on_goal?: number | null
          shots_on_target?: number | null
          shots_soccer?: number | null
          sport?: Database["public"]["Enums"]["sport_type"]
          started?: boolean | null
          steals?: number | null
          stolen_bases?: number | null
          strikeouts_batting?: number | null
          strikeouts_pitching?: number | null
          tackles?: number | null
          targets?: number | null
          team_abbreviation?: string | null
          three_pointers_attempted?: number | null
          three_pointers_made?: number | null
          total_bases?: number | null
          turnovers?: number | null
          walks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_game_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_props: {
        Row: {
          avg_last10: number | null
          avg_last20: number | null
          avg_last5: number | null
          baseline_line: number | null
          combo_type: string | null
          confidence_score: number | null
          consistency: number | null
          created_at: string
          edge_type: string | null
          hit_rate_last10: number | null
          hit_rate_last20: number | null
          hit_rate_last5: number | null
          id: string
          is_combo: boolean | null
          last_updated: string
          player_id: string
          player_name: string | null
          projected_value: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          stat_type: string
          trend: string | null
        }
        Insert: {
          avg_last10?: number | null
          avg_last20?: number | null
          avg_last5?: number | null
          baseline_line?: number | null
          combo_type?: string | null
          confidence_score?: number | null
          consistency?: number | null
          created_at?: string
          edge_type?: string | null
          hit_rate_last10?: number | null
          hit_rate_last20?: number | null
          hit_rate_last5?: number | null
          id?: string
          is_combo?: boolean | null
          last_updated?: string
          player_id: string
          player_name?: string | null
          projected_value?: number | null
          sport: Database["public"]["Enums"]["sport_type"]
          stat_type: string
          trend?: string | null
        }
        Update: {
          avg_last10?: number | null
          avg_last20?: number | null
          avg_last5?: number | null
          baseline_line?: number | null
          combo_type?: string | null
          confidence_score?: number | null
          consistency?: number | null
          created_at?: string
          edge_type?: string | null
          hit_rate_last10?: number | null
          hit_rate_last20?: number | null
          hit_rate_last5?: number | null
          id?: string
          is_combo?: boolean | null
          last_updated?: string
          player_id?: string
          player_name?: string | null
          projected_value?: number | null
          sport?: Database["public"]["Enums"]["sport_type"]
          stat_type?: string
          trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_props_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          created_at: string
          external_id: string | null
          first_name: string | null
          full_name: string
          headshot_url: string | null
          height: string | null
          id: string
          jersey_number: string | null
          last_name: string | null
          position: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          status: string | null
          team_id: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          external_id?: string | null
          first_name?: string | null
          full_name: string
          headshot_url?: string | null
          height?: string | null
          id?: string
          jersey_number?: string | null
          last_name?: string | null
          position?: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          status?: string | null
          team_id?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          external_id?: string | null
          first_name?: string | null
          full_name?: string
          headshot_url?: string | null
          height?: string | null
          id?: string
          jersey_number?: string | null
          last_name?: string | null
          position?: string | null
          sport?: Database["public"]["Enums"]["sport_type"]
          status?: string | null
          team_id?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_parlays: {
        Row: {
          created_at: string
          id: string
          legs: Json
          name: string | null
          potential_payout: number | null
          result: string | null
          stake: number | null
          total_odds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legs?: Json
          name?: string | null
          potential_payout?: number | null
          result?: string | null
          stake?: number | null
          total_odds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legs?: Json
          name?: string | null
          potential_payout?: number | null
          result?: string | null
          stake?: number | null
          total_odds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          abbreviation: string | null
          city: string | null
          conference: string | null
          created_at: string
          division: string | null
          external_id: string | null
          id: string
          logo_url: string | null
          name: string
          sport: Database["public"]["Enums"]["sport_type"]
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          city?: string | null
          conference?: string | null
          created_at?: string
          division?: string | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          sport: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          city?: string | null
          conference?: string | null
          created_at?: string
          division?: string | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          sport?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      sport_type: "nba" | "nfl" | "mlb" | "nhl" | "soccer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      sport_type: ["nba", "nfl", "mlb", "nhl", "soccer"],
    },
  },
} as const
