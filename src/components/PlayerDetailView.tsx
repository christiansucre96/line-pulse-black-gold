// src/components/PlayerDetailView.tsx
import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, Activity, Filter } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface PlayerDetailViewProps {
  playerId: string;
  sport: string;
  selectedProps: string[];
  onBack: () => void;
}

export function PlayerDetailView({ playerId, sport, selectedProps, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);
  const [viewMode, setViewMode] = useState<"all" | "over" | "under">("all");

  useEffect(() => { fetchPlayer(); }, [playerId, selectedProps]);

  const fetchPlayer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_player_details", player_id: playerId, sport, props: selectedProps }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setPlayer(data.player);
      setLine(parseFloat(calcAvg(data.player.stats, 10).toFixed(1)));
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally { setLoading(false); }
  };

  const calcCombo = (g: any) => selectedProps.reduce((sum, stat) => sum + (g[stat] || 0), 0);
  const calcAvg = (games: any[], n: number) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    return slice.length ? slice.reduce((a, g) => a + calcCombo(g), 0) / slice.length : 0;
  };
  const hitRate = (games: any[], n: number) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    return slice.length ? Math.round((slice.filter((g: any) => calcCombo(g) > line).length / slice.length) * 100) : 0;
  };
  const maxStat = (key: string) => {
    if (!player?.stats?.length) return 0;
    const vals = player.stats.map((g: any) => g[key] || 0).filter((v: any) => typeof v === "number");
    return vals.length ? Math.max(...vals) : 0;
  };

  if (loading) return <DashboardLayout><div className="p-10 flex flex-col items-center justify-center min-h-[400px]"><div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mb-4" /><p className="text-gray-400">Loading...</p></div></DashboardLayout>;
  if (error || !player) return <DashboardLayout><div className="p-10"><button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-yellow-400"><ArrowLeft size={16} /> Back</button><div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center"><p className="text-red-400">❌ {error || "No data"}</p><Button onClick={fetchPlayer} className="mt-4 bg-yellow-600 hover:bg-yellow-700">Retry</Button></div></div></DashboardLayout>;

  const games = player.stats?.slice(0, 15) || [];
  const chartData = viewMode === "all" ? games : games.filter(g => {
    const val = calcCombo(g);
    return viewMode === "over" ? val > line : val <= line;
  });
  const maxVal = Math.max(...games.map(g => calcCombo(g)), line * 1.2, 1);
  const chartHeight = 300;

  const getTopPos = (val: number) => chartHeight - (val / maxVal) * chartHeight;
  const getBarHeight = (val: number) => (val / maxVal) * chartHeight;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-yellow-400 transition"><ArrowLeft size={16} /> Back</button>
        
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">{player.full_name}</h1>
            <p className="text-gray-400">{player.team} • {player.position}</p>
          </div>
          <div className="bg-[#0f172a] p-4 rounded-xl border border-gray-800 w-full md:w-auto">
            <h3 className="text-yellow-400 font-semibold mb-2">Max Stats</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <p className="text-gray-300">PTS: <span className="text-yellow-400 font-bold">{maxStat("points")}</span></p>
              <p className="text-gray-300">REB: <span className="text-yellow-400 font-bold">{maxStat("rebounds")}</span></p>
              <p className="text-gray-300">AST: <span className="text-yellow-400 font-bold">{maxStat("assists")}</span></p>
              <p className="text-gray-300">3PM: <span className="text-yellow-400 font-bold">{maxStat("threes")}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-[#0f172a] p-4 rounded-xl mb-6 border border-gray-800">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-gray-400">Line:</span>
            <button onClick={() => setLine(v => Math.max(0, parseFloat((v - 0.5).toFixed(1))))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400 font-bold">-</button>
            <span className="text-2xl font-bold text-yellow-400 min-w-[80px] text-center bg-[#020617] px-4 py-2 rounded">{line.toFixed(1)}</span>
            <button onClick={() => setLine(v => parseFloat((v + 0.5).toFixed(1)))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400 font-bold">+</button>
            <button onClick={() => setLine(parseFloat(calcAvg(player.stats, 10).toFixed(1)))} className="text-sm text-gray-400 hover:text-yellow-400 underline ml-auto">Reset to avg</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(["all", "over", "under"] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${viewMode === mode ? "bg-yellow-500 text-black" : "bg-[#0f172a] text-gray-400 border border-gray-700 hover:border-yellow-600"}`}>
              <Filter className="h-4 w-4" /> {mode.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[5, 10, 15, 20].map(n => (
            <div key={n} className="bg-[#020617] p-4 rounded-xl border border-gray-800 text-center">
              <p className="text-xs text-gray-400 mb-1">L{n}</p>
              <p className={`text-2xl font-bold ${hitRate(player.stats, n) >= 50 ? "text-green-400" : "text-red-400"}`}>{hitRate(player.stats, n)}%</p>
              <p className="text-xs text-gray-500 mt-1">Avg {calcAvg(player.stats, n).toFixed(1)}</p>
            </div>
          ))}
        </div>

        {/* FIXED CHART */}
        <div className="bg-[#020617] p-6 rounded-xl mb-6 border border-gray-800">
          <h3 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Last 15 Games ({selectedProps.join("+").toUpperCase()})</h3>
          <div className="relative" style={{ height: `${chartHeight + 60}px` }}>
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2 pointer-events-none">
              <span>{Math.round(maxVal)}</span><span>{Math.round(maxVal * 0.75)}</span><span>{Math.round(maxVal * 0.5)}</span><span>{Math.round(maxVal * 0.25)}</span><span>0</span>
            </div>
            <div className="ml-12 flex items-end gap-2 h-full pb-12 overflow-x-auto">
              {chartData.map((g: any, i: number) => {
                const val = calcCombo(g);
                const isOver = val > line;
                return (
                  <div key={i} className="flex flex-col items-center flex-shrink-0 w-14 group relative">
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-16 bg-[#0f172a] border border-gray-700 rounded px-2 py-1 text-xs z-20 pointer-events-none whitespace-nowrap">
                      <p className="text-yellow-400 font-bold">{g.opponent}</p>
                      <p className="text-gray-300">PTS:{g.points} REB:{g.rebounds} AST:{g.assists}</p>
                      <p className={isOver ? "text-green-400" : "text-red-400"}>{val} {isOver ? "✓ OVER" : "✗ UNDER"}</p>
                    </div>
                    <div className={`w-full rounded-t transition-all ${isOver ? "bg-gradient-to-t from-green-700 to-green-400" : "bg-gradient-to-t from-red-700 to-red-400"}`} style={{ height: `${getBarHeight(val)}px` }} />
                    <p className="text-[10px] mt-2 text-gray-400 truncate w-full text-center">{g.opponent}</p>
                    <p className="text-[10px] text-gray-500">{val}</p>
                  </div>
                );
              })}
            </div>
            {/* LINE MARKER - FIXED MATH */}
            <div className="absolute left-12 right-0 border-t-2 border-dashed border-yellow-500 pointer-events-none" style={{ top: `${getTopPos(line)}px` }}>
              <div className="absolute -left-16 -top-3 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">Line: {line.toFixed(1)}</div>
            </div>
            <div className="absolute left-12 right-0 top-0 h-full pointer-events-none">
              {[0.25, 0.5, 0.75].map(r => <div key={r} className="absolute w-full border-t border-gray-800" style={{ top: `${r * chartHeight}px` }} />)}
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gradient-to-t from-green-700 to-green-400 rounded" /><span className="text-gray-400">Over</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gradient-to-t from-red-700 to-red-400 rounded" /><span className="text-gray-400">Under</span></div>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-yellow-400 font-semibold">Game Log</h3>
            <Button variant="outline" size="sm" onClick={fetchPlayer} className="border-gray-700 text-yellow-400"><Activity className="h-4 w-4 mr-2" /> Refresh</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr>
                  <th className="p-3 text-left text-yellow-400">Opp</th>
                  <th className="p-3 text-left text-yellow-400">Date</th>
                  <th className="p-3 text-right text-yellow-400">PTS</th>
                  <th className="p-3 text-right text-yellow-400">REB</th>
                  <th className="p-3 text-right text-yellow-400">AST</th>
                  <th className="p-3 text-right text-yellow-400">Total</th>
                  <th className="p-3 text-center text-yellow-400">Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g: any, i: number) => {
                  const total = calcCombo(g);
                  const isOver = total > line;
                  return (
                    <tr key={i} className={`border-b border-gray-800 hover:bg-[#0f172a] ${isOver ? "bg-green-900/5" : "bg-red-900/5"}`}>
                      <td className="p-3 text-gray-300">{g.opponent}</td>
                      <td className="p-3 text-gray-400">{g.game_date}</td>
                      <td className="p-3 text-right">{g.points}</td>
                      <td className="p-3 text-right">{g.rebounds}</td>
                      <td className="p-3 text-right">{g.assists}</td>
                      <td className={`p-3 text-right font-bold ${isOver ? "text-green-400" : "text-red-400"}`}>{total}</td>
                      <td className="p-3 text-center"><Badge variant={isOver ? "default" : "destructive"} className="text-xs">{isOver ? "OVER ✓" : "UNDER ✗"}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
