import { useState, useEffect } from "react";
import { ArrowLeft, Minus, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [props, setProps] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [line, setLine] = useState(15.5);
  const [selectedRange, setSelectedRange] = useState(10);

  useEffect(() => {
    fetchPlayerData();
  }, [playerId]);

  const fetchPlayerData = async () => {
    setLoading(true);
    try {
      // Fetch player details
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          id,
          full_name,
          position,
          sport,
          team_id,
          teams:team_id (name, abbreviation)
        `)
        .eq('id', playerId)
        .single();
      
      if (playerError) throw playerError;
      
      // Fetch player props
      const { data: propsData, error: propsError } = await supabase
        .from('player_props')
        .select('*')
        .eq('player_id', playerId);
      
      if (propsError) throw propsError;
      
      // Fetch player stats
      const { data: statsData, error: statsError } = await supabase
        .from('player_game_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(20);
      
      if (statsError) throw statsError;
      
      // Get today's game for opponent
      const today = new Date().toISOString().split('T')[0];
      const { data: games } = await supabase
        .from('games_data')
        .select('*')
        .eq('sport', playerData.sport)
        .eq('game_date', today);
      
      let opponent = "TBD";
      if (games && games[0]) {
        if (games[0].home_team_id === playerData.team_id) {
          const { data: awayTeam } = await supabase.from('teams').select('abbreviation').eq('id', games[0].away_team_id).single();
          opponent = awayTeam?.abbreviation || "TBD";
        } else {
          const { data: homeTeam } = await supabase.from('teams').select('abbreviation').eq('id', games[0].home_team_id).single();
          opponent = homeTeam?.abbreviation || "TBD";
        }
      }
      
      // Set initial line from props
      if (propsData && propsData[0]) {
        setLine(propsData[0].projected_value || 15.5);
      }
      
      setPlayer({
        ...playerData,
        opponent,
        teamName: playerData.teams?.name,
        teamAbbr: playerData.teams?.abbreviation,
        initials: playerData.full_name?.split(' ').map((n: string) => n[0]).join('') || "??",
      });
      setProps(propsData || []);
      setStats(statsData || []);
      
    } catch (error) {
      console.error("Error fetching player details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatValue = (stat: any, type: string): number => {
    if (type === 'points') return stat.points || 0;
    if (type === 'rebounds') return stat.rebounds || 0;
    if (type === 'assists') return stat.assists || 0;
    if (type === 'steals') return stat.steals || 0;
    if (type === 'blocks') return stat.blocks || 0;
    return 0;
  };

  const calculateHitRate = (n: number) => {
    const logs = stats.slice(0, n);
    if (logs.length === 0) return { hr: 0, avg: 0 };
    const hits = logs.filter(log => getStatValue(log, 'points') >= line).length;
    const avg = logs.reduce((sum, log) => sum + getStatValue(log, 'points'), 0) / logs.length;
    return {
      hr: Math.round((hits / logs.length) * 100),
      avg: Math.round(avg * 10) / 10,
    };
  };

  const l5 = calculateHitRate(5);
  const l10 = calculateHitRate(10);
  const l15 = calculateHitRate(15);
  const l20 = calculateHitRate(20);

  const chartData = stats.slice().reverse().slice(0, selectedRange).map((stat, idx) => ({
    name: `Game ${idx + 1}`,
    value: stat.points || 0,
    aboveLine: (stat.points || 0) >= line,
  }));

  const hrColor = (hr: number) => {
    if (hr >= 80) return "text-green-400 border-green-400/30 bg-green-400/10";
    if (hr >= 60) return "text-primary border-primary/30 bg-primary/10";
    return "text-red-400 border-red-400/30 bg-red-400/10";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Player not found</p>
        <button onClick={onBack} className="mt-4 text-primary hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Player Detail</h1>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-4">
          {/* Hit Rate Selector */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">Points</h2>
              <p className="text-sm text-muted-foreground">Line</p>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setLine(l => +(l - 0.5).toFixed(1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center hover:bg-muted">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-16 text-center font-bold text-primary font-display text-xl">{line}</span>
                <button onClick={() => setLine(l => +(l + 0.5).toFixed(1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center hover:bg-muted">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "L5", n: 5, ...l5 },
                { label: "L10", n: 10, ...l10 },
                { label: "L15", n: 15, ...l15 },
                { label: "L20", n: 20, ...l20 }
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSelectedRange(s.n)}
                  className={`px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${hrColor(s.hr)} ${selectedRange === s.n ? "ring-2 ring-primary scale-105" : "opacity-75 hover:opacity-100"}`}
                >
                  <div className="font-bold text-muted-foreground">{s.label}</div>
                  <div className="font-bold">HR {s.hr}%</div>
                  <div className="text-muted-foreground text-xs">Avg {s.avg}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="h-64 mb-6">
              <div className="w-full h-full bg-card border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-2">Recent Games</div>
                <div className="flex items-end h-48 gap-2">
                  {chartData.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="text-xs text-muted-foreground mb-1">{item.value}</div>
                      <div 
                        className="w-full rounded-t transition-all duration-300"
                        style={{ 
                          height: `${Math.min((item.value / 40) * 100, 100)}%`,
                          backgroundColor: item.aboveLine ? "#22c55e" : "#ef4444",
                          minHeight: "4px"
                        }}
                      />
                      <div className="text-xs text-muted-foreground mt-1 truncate w-full text-center">{item.name}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-primary/50 mt-2 pt-1">
                  <div className="text-xs text-primary text-center">Line: {line}</div>
                </div>
              </div>
            </div>
          )}

          {/* Game Logs Table */}
          {stats.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-center font-display font-bold text-foreground mb-3">Game Log — Last {Math.min(selectedRange, stats.length)} Games</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 font-semibold text-center">Opp</th>
                      <th className="py-2 px-2 font-semibold text-center">Date</th>
                      <th className="py-2 px-2 font-semibold text-center">PTS</th>
                      <th className="py-2 px-2 font-semibold text-center">REB</th>
                      <th className="py-2 px-2 font-semibold text-center">AST</th>
                      <th className="py-2 px-2 font-semibold text-center">STL</th>
                      <th className="py-2 px-2 font-semibold text-center">BLK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.slice(0, selectedRange).map((stat, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="py-2 px-2 text-center font-medium">{player.opponent}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{new Date(stat.game_date).toLocaleDateString()}</td>
                        <td className="py-2 px-2 text-center font-semibold">{stat.points || 0}</td>
                        <td className="py-2 px-2 text-center">{stat.rebounds || 0}</td>
                        <td className="py-2 px-2 text-center">{stat.assists || 0}</td>
                        <td className="py-2 px-2 text-center">{stat.steals || 0}</td>
                        <td className="py-2 px-2 text-center">{stat.blocks || 0}</td>
                       </tr>
                    ))}
                  </tbody>
                 </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Player Info */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
              {player.initials}
            </div>
            <div>
              <div className="font-bold text-foreground">{player.full_name} ({player.position || "N/A"})</div>
              <div className="flex gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-gold text-primary-foreground">{player.teamAbbr || "N/A"}</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/20 text-primary">{player.sport?.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {props.length > 0 && (
            <>
              <h3 className="text-sm font-display font-bold text-primary mb-2 tracking-wider">PROJECTIONS</h3>
              <div className="space-y-1.5">
                {props.slice(0, 3).map((prop, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/50">
                    <span className="text-muted-foreground">{prop.stat_type?.toUpperCase() || "POINTS"}</span>
                    <span className="font-semibold text-foreground">{prop.projected_value}</span>
                    <span className="text-xs text-muted-foreground">Conf: {Math.round((prop.confidence_score || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
