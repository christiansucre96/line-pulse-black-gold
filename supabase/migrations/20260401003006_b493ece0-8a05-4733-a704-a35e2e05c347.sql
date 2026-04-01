
-- Sport type enum
CREATE TYPE public.sport_type AS ENUM ('nba', 'nfl', 'mlb', 'nhl', 'soccer');

-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  sport public.sport_type NOT NULL,
  name text NOT NULL,
  abbreviation text,
  city text,
  conference text,
  division text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sport, external_id)
);

-- Players table
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  sport public.sport_type NOT NULL,
  first_name text,
  last_name text,
  full_name text NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  position text,
  jersey_number text,
  status text DEFAULT 'active',
  height text,
  weight text,
  birth_date date,
  headshot_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sport, external_id)
);

-- Games table
CREATE TABLE public.games_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  sport public.sport_type NOT NULL,
  home_team_id uuid REFERENCES public.teams(id),
  away_team_id uuid REFERENCES public.teams(id),
  game_date date NOT NULL,
  start_time timestamptz,
  status text NOT NULL DEFAULT 'upcoming',
  home_score int DEFAULT 0,
  away_score int DEFAULT 0,
  season text,
  season_type text,
  current_period text,
  time_remaining text,
  venue text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sport, external_id)
);

-- Player game stats (unified across all sports)
CREATE TABLE public.player_game_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  game_id uuid REFERENCES public.games_data(id) ON DELETE CASCADE NOT NULL,
  sport public.sport_type NOT NULL,
  player_name text,
  team_abbreviation text,
  game_date date,
  minutes_played numeric,
  -- NBA
  points int, rebounds int, assists int, steals int, blocks int, turnovers int,
  three_pointers_made int, three_pointers_attempted int,
  field_goals_made int, field_goals_attempted int,
  free_throws_made int, free_throws_attempted int,
  -- MLB batting
  hits int, runs int, rbi int, total_bases int, at_bats int, home_runs int,
  stolen_bases int, walks int, strikeouts_batting int,
  -- MLB pitching
  innings_pitched numeric, earned_runs int, strikeouts_pitching int,
  -- NHL
  goals int, assists_hockey int, shots_on_goal int, plus_minus int, penalty_minutes int,
  -- NFL
  passing_yards int, passing_tds int, interceptions_thrown int,
  rushing_yards int, rushing_tds int,
  receiving_yards int, receiving_tds int, receptions int, targets int,
  -- Soccer
  goals_soccer int, assists_soccer int, shots_soccer int, shots_on_target int,
  passes_completed int, tackles int,
  -- General
  started boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, game_id)
);

-- Injury tracking
CREATE TABLE public.injury_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  sport public.sport_type NOT NULL,
  status text NOT NULL DEFAULT 'active',
  description text,
  body_part text,
  expected_return date,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Game lineups
CREATE TABLE public.game_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games_data(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  is_starter boolean DEFAULT false,
  batting_order int,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- Player props
CREATE TABLE public.player_props (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  sport public.sport_type NOT NULL,
  player_name text,
  stat_type text NOT NULL,
  is_combo boolean DEFAULT false,
  combo_type text,
  projected_value numeric,
  baseline_line numeric,
  hit_rate_last5 numeric,
  hit_rate_last10 numeric,
  hit_rate_last20 numeric,
  avg_last5 numeric,
  avg_last10 numeric,
  avg_last20 numeric,
  trend text,
  consistency numeric,
  edge_type text,
  confidence_score numeric,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Live edges
CREATE TABLE public.live_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  game_id uuid REFERENCES public.games_data(id) ON DELETE CASCADE NOT NULL,
  sport public.sport_type NOT NULL,
  player_name text,
  stat_type text,
  current_value numeric,
  projected_value numeric,
  historical_avg numeric,
  edge_type text,
  confidence_score numeric,
  last_updated timestamptz NOT NULL DEFAULT now()
);

-- Ingestion logs
CREATE TABLE public.ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport public.sport_type NOT NULL,
  operation text NOT NULL,
  status text NOT NULL,
  records_processed int DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Public read policies for sports data
CREATE POLICY "Anyone can read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can read games" ON public.games_data FOR SELECT USING (true);
CREATE POLICY "Anyone can read stats" ON public.player_game_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can read injuries" ON public.injury_tracking FOR SELECT USING (true);
CREATE POLICY "Anyone can read lineups" ON public.game_lineups FOR SELECT USING (true);
CREATE POLICY "Anyone can read props" ON public.player_props FOR SELECT USING (true);
CREATE POLICY "Anyone can read edges" ON public.live_edges FOR SELECT USING (true);
CREATE POLICY "Admins can read logs" ON public.ingestion_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Performance indexes
CREATE INDEX idx_players_sport ON public.players(sport);
CREATE INDEX idx_players_team ON public.players(team_id);
CREATE INDEX idx_players_external ON public.players(sport, external_id);
CREATE INDEX idx_games_sport_date ON public.games_data(sport, game_date);
CREATE INDEX idx_games_status ON public.games_data(status);
CREATE INDEX idx_stats_player ON public.player_game_stats(player_id);
CREATE INDEX idx_stats_game ON public.player_game_stats(game_id);
CREATE INDEX idx_stats_date ON public.player_game_stats(game_date);
CREATE INDEX idx_stats_sport ON public.player_game_stats(sport);
CREATE INDEX idx_injuries_player ON public.injury_tracking(player_id);
CREATE INDEX idx_props_player ON public.player_props(player_id);
CREATE INDEX idx_props_sport ON public.player_props(sport);
CREATE INDEX idx_edges_game ON public.live_edges(game_id);

-- Enable realtime for live data
ALTER PUBLICATION supabase_realtime ADD TABLE public.games_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_edges;

-- Update triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
