import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

export const sportsApi = {
  // Data ingestion
  async ingest(sport: string, operation: string, options?: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke('sports-ingest', {
      body: { sport, operation, ...options },
    });
    if (error) throw error;
    return data;
  },

  // Props engine
  async generateProps(sport: string, playerId?: string) {
    const { data, error } = await supabase.functions.invoke('props-engine', {
      body: { sport, player_id: playerId },
    });
    if (error) throw error;
    return data;
  },

  // Live tracker
  async updateLive(sport?: string) {
    const { data, error } = await supabase.functions.invoke('live-tracker', {
      body: { operation: 'update_live', sport },
    });
    if (error) throw error;
    return data;
  },

  async fetchSchedule() {
    const { data, error } = await supabase.functions.invoke('live-tracker', {
      body: { operation: 'schedule' },
    });
    if (error) throw error;
    return data;
  },

  // Daily automation
  async runDailyAutomation() {
    const { data, error } = await supabase.functions.invoke('daily-automation', {
      body: {},
    });
    if (error) throw error;
    return data;
  },

  // Admin setup
  async makeAdmin(email: string) {
    const { data, error } = await supabase.functions.invoke('admin-setup', {
      body: { email, operation: 'make_admin' },
    });
    if (error) throw error;
    return data;
  },

  async makeFirstAdmin() {
    const { data, error } = await supabase.functions.invoke('admin-setup', {
      body: { operation: 'make_first_admin' },
    });
    if (error) throw error;
    return data;
  },

  // Direct DB queries (uses anon key / RLS)
  async getPlayers(sport?: SportType, search?: string, limit = 100) {
    let query = supabase.from('players').select('*, teams(name, abbreviation)');
    if (sport) query = query.eq('sport', sport);
    if (search) query = query.ilike('full_name', `%${search}%`);
    const { data, error } = await query.limit(limit).order('full_name');
    if (error) throw error;
    return data;
  },

  async getPlayerStats(playerId: string, last = 20) {
    const { data, error } = await supabase
      .from('player_game_stats')
      .select('*, games_data(status, home_score, away_score)')
      .eq('player_id', playerId)
      .order('game_date', { ascending: false })
      .limit(last);
    if (error) throw error;
    return data;
  },

  async getGames(sport?: SportType, status?: string, date?: string) {
    let query = supabase.from('games_data').select('*');
    if (sport) query = query.eq('sport', sport);
    if (status) query = query.eq('status', status);
    if (date) query = query.eq('game_date', date);
    const { data, error } = await query.order('game_date', { ascending: false }).limit(50);
    if (error) throw error;
    return data;
  },

  async getTeams(sport?: SportType) {
    let query = supabase.from('teams').select('*');
    if (sport) query = query.eq('sport', sport);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data;
  },

  async getInjuries(sport?: SportType) {
    let query = supabase.from('injury_tracking').select('*, players(full_name, position)');
    if (sport) query = query.eq('sport', sport);
    const { data, error } = await query.order('last_updated', { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },

  async getProps(sport?: SportType, combo?: boolean) {
    let query = supabase.from('player_props').select('*');
    if (sport) query = query.eq('sport', sport);
    if (combo !== undefined) query = query.eq('is_combo', combo);
    const { data, error } = await query.order('confidence_score', { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw error;
    return data;
  },

  async getLiveEdges(sport?: SportType) {
    let query = supabase.from('live_edges').select('*');
    if (sport) query = query.eq('sport', sport);
    const { data, error } = await query.order('confidence_score', { ascending: false, nullsFirst: false }).limit(50);
    if (error) throw error;
    return data;
  },

  async getIngestionLogs(limit = 20) {
    const { data, error } = await supabase
      .from('ingestion_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};
