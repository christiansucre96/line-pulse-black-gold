// src/components/PlayerDetailView.tsx
import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, Activity } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("overview");
  const [line, setLine] = useState(0);

  useEffect(() => {
    fetchPlayer();
  }, [playerId, selectedProps]);

  const fetchPlayer = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_player_details",
          player_id: playerId,
          sport,
          props: selectedProps,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch player");
      }

      setPlayer(data.player);
      const avg = calcAvg(data.player.stats, 10);
      setLine(avg);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load player data");
    } finally {
      setLoading(false);
    }
  };

  const calcCombo = (g: any) =>
    selectedProps.reduce((sum, stat) => sum + (g[stat] || 0), 0);

  const calcAvg = (games: any[], n: number) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    return slice.reduce((a, g) => a + calcCombo(g), 0) / slice.length;
  };

  const hitRate = (games: any[], n: number) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    const hits = slice.filter((g: any) => calcCombo(g) > line).length;
    return Math.round((hits / slice.length) * 100);
  };

  const maxStat = (key: string) => {
    if (!player?.stats?.length) return 0;
    const values = player.stats.map((g: any) => g[key] || 0).filter((v: any) => typeof v === "number");
    return values.length ? Math.max(...values) : 0;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mb-4" />
          <p className="text-gray-400">Loading player data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !player) {
    return (
      <DashboardLayout>
        <div className="p-10">
          <button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-yellow-400 transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-400 font-medium mb-2">❌ {error || "No player found"}</p>
            <Button onClick={fetchPlayer} className="mt-4 bg-yellow-600 hover:bg-yellow-700">
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const games = player.stats?.slice(0, 15) || [];
  const maxVal = Math.max(...games.map((g: any) => calcCombo(g)));

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">

        {/* Back Button */}
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-yellow-400 transition">
          <ArrowLeft size={16} /> Back to Scanner
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400 mb-1">{player.full_name}</h1>
            <p className="text-gray-400">
              {player.team} • {player.position}
            </p>
            {player.injury_status && (
              <Badge variant="destructive" className="mt-2">
                🚑 {player.injury_status}
              </Badge>
            )}
          </div>

          {/* Player Max Stats */}
          <div className="bg-[#0f172a] p-4 rounded-xl border border-gray-800">
            <h3 className="text-yellow-400 font-semibold mb-2">Player Max Stats</h3>
            <div className="space-y-1 text-sm">
              <p className="text-gray-300">Points: <span className="text-yellow-400 font-bold">{maxStat("points")}</span></p>
              <p className="text-gray-300">Rebounds: <span className="text-yellow-400 font-bold">{maxStat("rebounds")}</span></p>
              <p className="text-gray-300">Assists: <span className="text-yellow-400 font-bold">{maxStat("assists")}</span></p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {["overview", "points", "rebounds", "assists", "combo"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition ${
                activeTab === tab 
                  ? "text-yellow-400 border-b-2 border-yellow-400" 
                  : "text-gray-400 hover:text-yellow-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Line Control */}
        <div className="bg-[#0f172a] p-4 rounded-xl mb-6 border border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Line:</span>
            <button 
              onClick={() => setLine(prev => Math.max(0, prev - 0.5))}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400"
            >
              -
            </button>
            <span className="text-2xl font-bold text-yellow-400 min-w-[80px] text-center">
              {line.toFixed(1)}
            </span>
            <button 
              onClick={() => setLine(prev => prev + 0.5)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400"
            >
              +
            </button>
            <button
              onClick={() => setLine(calcAvg(player.stats, 10))}
              className="ml-4 text-sm text-gray-400 hover:text-yellow-400 underline"
            >
              Reset to avg
            </button>
          </div>
        </div>

        {/* Hit Rates */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[5, 10, 15, 20].map(n => (
            <div key={n} className="bg-[#020617] p-4 rounded-xl border border-gray-800 text-center">
              <p className="text-xs text-gray-400 mb-1">L{n}</p>
              <p className={`text-2xl font-bold ${hitRate(player.stats, n) >= 50 ? "text-green-400" : "text-red-400"}`}>
                {hitRate(player.stats, n)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Avg {calcAvg(player.stats, n).toFixed(1)}
              </p>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="bg-[#020617] p-6 rounded-xl mb-6 border border-gray-800">
          <h3 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Last 15 Games Performance
          </h3>
          
          <div className="flex items-end gap-2 h-64 overflow-x-auto pb-4">
            {games.map((g: any, i: number) => {
              const val = calcCombo(g);
              const height = (val / maxVal) * 100;
              const isOver = val > line;
              
              return (
                <div key={i} className="flex flex-col items-center flex-shrink-0 w-12">
                  <div
                    className={`w-full rounded-t transition-all hover:opacity-80 ${
                      isOver ? "bg-gradient-to-t from-green-600 to-green-400" : "bg-gradient-to-t from-red-600 to-red-400"
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${g.opponent}: ${val}`}
                  />
                  <p className="text-[10px] mt-2 text-gray-400 truncate w-full text-center">
                    {g.opponent}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {val}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Line Marker */}
          <div className="border-t-2 border-dashed border-yellow-500/50 mt-2 relative pt-2">
            <div className="absolute -top-6 left-0 text-xs text-yellow-500 font-medium bg-[#020617] px-2 py-1 rounded">
              Line: {line.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Game Log Table */}
        <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-yellow-400 font-semibold">Game Log - Last 15 Games</h3>
            <Button variant="outline" size="sm" onClick={fetchPlayer} className="border-gray-700 text-yellow-400 hover:bg-[#0f172a]">
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr>
                  <th className="p-3 text-left text-yellow-400">Opponent</th>
                  <th className="p-3 text-left text-yellow-400">Date</th>
                  <th className="p-3 text-right text-yellow-400">PTS</th>
                  <th className="p-3 text-right text-yellow-400">REB</th>
                  <th className="p-3 text-right text-yellow-400">AST</th>
                  <th className="p-3 text-right text-yellow-400">Combo</th>
                  <th className="p-3 text-center text-yellow-400">Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g: any, i: number) => {
                  const combo = calcCombo(g);
                  const isOver = combo > line;
                  return (
                    <tr 
                      key={i} 
                      className={`border-b border-gray-800 hover:bg-[#0f172a] transition ${
                        isOver ? "bg-green-900/5" : "bg-red-900/5"
                      }`}
                    >
                      <td className="p-3 text-gray-300">{g.opponent}</td>
                      <td className="p-3 text-gray-400">{g.game_date}</td>
                      <td className={`p-3 text-right ${isOver ? "text-green-400 font-medium" : ""}`}>{g.points}</td>
                      <td className="p-3 text-right text-gray-400">{g.rebounds}</td>
                      <td className="p-3 text-right text-gray-400">{g.assists}</td>
                      <td className={`p-3 text-right font-bold ${isOver ? "text-green-400" : "text-red-400"}`}>
                        {combo}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={isOver ? "default" : "destructive"} className="text-xs">
                          {isOver ? "OVER ✓" : "UNDER ✗"}
                        </Badge>
                      </td>
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
