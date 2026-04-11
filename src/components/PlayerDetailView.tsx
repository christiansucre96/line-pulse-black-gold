// src/components/PlayerDetailView.tsx
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, RefreshCw, Database } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProps, setSelectedProps] = useState<string[]>(["points"]);
  const [line, setLine] = useState(0);
  const [cacheInfo, setCacheInfo] = useState<{ cached: boolean; age?: number } | null>(null);
  
  // 👇 Prevents React StrictMode from double-fetching
  const fetchTriggeredRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any pending timeout on unmount or playerId change
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!playerId || typeof playerId !== "string" || playerId.trim() === "") {
      setLoading(false);
      setError("Invalid player ID");
      return;
    }

    // 👇 Micro-delay bypasses React 18 StrictMode double-invocation race condition
    timeoutRef.current = window.setTimeout(() => {
      fetchTriggeredRef.current = false;
      fetchPlayer();
    }, 50);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playerId]);

  const fetchPlayer = async () => {
    if (fetchTriggeredRef.current) return;
    fetchTriggeredRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        operation: "get_player_details",
        player_id: playerId.trim(),
      };

      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Request failed");
      }

      setPlayer(data.player);
      setCacheInfo({ cached: data.cached, age: data.cache_age_hours });
      setLine(calcAvg(data.player.stats, 10));
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load player data");
    } finally {
      setLoading(false);
    }
  };

  // -------- LOGIC --------
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

  // -------- UI STATES --------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center justify-center min-h-[400px]">
          <RefreshCw className="animate-spin mb-4 h-8 w-8 text-gray-400" />
          <p className="text-gray-400">Loading player data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !player) {
    return (
      <DashboardLayout>
        <div className="p-10">
          <button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-white transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-400 font-medium mb-2">❌ {error || "No player found"}</p>
            <button onClick={fetchPlayer} className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition">
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const games = player.stats?.slice(0, 10) || [];

  return (
    <DashboardLayout>
      <div className="p-4">

        {/* BACK + CACHE STATUS */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft size={16} /> Back
          </button>
          
          {cacheInfo && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
              cacheInfo.cached 
                ? "bg-green-900/30 text-green-400 border-green-800" 
                : "bg-blue-900/30 text-blue-400 border-blue-800"
            }`}>
              <Database size={12} />
              {cacheInfo.cached ? `Cached ${cacheInfo.age?.toFixed(1)}h ago` : "Fresh data"}
            </div>
          )}
        </div>

        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{player.full_name}</h1>
            <p className="text-gray-400">{player.position} • {player.team}</p>
            {player.injury_status && (
              <p className="text-red-400 text-sm mt-1">🚑 {player.injury_status} – {player.injury_description}</p>
            )}
          </div>

          <div className="bg-[#0f172a] p-4 rounded-xl text-sm border border-gray-800">
            <p>Max Points: {maxStat("points")}</p>
            <p>Max Rebounds: {maxStat("rebounds")}</p>
            <p>Max Assists: {maxStat("assists")}</p>
          </div>
        </div>

        {/* LINE CONTROL */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLine(prev => Math.max(0, prev - 1))} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition">-</button>
          <div className="text-lg font-bold min-w-[60px] text-center">{line.toFixed(1)}</div>
          <button onClick={() => setLine(prev => prev + 1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition">+</button>
          <button onClick={() => setLine(calcAvg(player.stats, 10))} className="ml-2 text-xs text-gray-400 hover:text-white underline">Reset to avg</button>
        </div>

        {/* HIT RATES */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[5, 10, 15, 20].map(n => (
            <div key={n} className="bg-[#020617] p-3 rounded text-center border border-gray-800">
              <p className="text-xs text-gray-400">L{n}</p>
              <p className="text-green-400 font-bold">{hitRate(player.stats, n)}%</p>
              <p className="text-xs text-gray-500">Avg {calcAvg(player.stats, n).toFixed(1)}</p>
            </div>
          ))}
        </div>

        {/* BAR GRAPH */}
        <div className="bg-[#020617] p-4 rounded-xl mb-6 border border-gray-800">
          <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2">
            {games.map((g: any, i: number) => {
              const val = calcCombo(g);
              const height = Math.min(val * 3, 160);
              const color = val > line ? "bg-green-500" : "bg-red-500";
              return (
                <div key={i} className="flex flex-col items-center w-8 flex-shrink-0">
                  <div className={`${color} w-full rounded-t transition-all hover:opacity-80`} style={{ height: `${height}px` }} title={`${g.opponent}: ${val}`} />
                  <p className="text-[10px] mt-1 text-gray-400 truncate w-full text-center">{g.opponent}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t-2 border-dashed border-yellow-500/50 mt-2 relative pt-1">
            <div className="absolute -top-5 left-0 text-xs text-yellow-500 font-medium bg-[#020617] px-2 py-0.5 rounded">Line: {line.toFixed(1)}</div>
          </div>
        </div>

        {/* GAME LOGS */}
        <div className="bg-[#020617] rounded-xl overflow-hidden border border-gray-800">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-medium">Recent Games</h3>
            <button onClick={fetchPlayer} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Opp</th>
                  <th className="p-3 text-right">PTS</th>
                  <th className="p-3 text-right">REB</th>
                  <th className="p-3 text-right">AST</th>
                  <th className="p-3 text-right">Combo</th>
                </tr>
              </thead>
              <tbody>
                {(player.stats || []).slice(0, 15).map((g: any, i: number) => {
                  const combo = calcCombo(g);
                  const isOver = combo > line;
                  return (
                    <tr key={i} className={`border-t border-gray-800 hover:bg-[#0f172a] transition ${isOver ? "bg-green-900/10" : ""}`}>
                      <td className="p-3 text-gray-400">{g.game_date}</td>
                      <td className="p-3">{g.opponent}</td>
                      <td className={`p-3 text-right ${isOver ? "text-green-400 font-medium" : ""}`}>{g.points}</td>
                      <td className="p-3 text-right text-gray-400">{g.rebounds}</td>
                      <td className="p-3 text-right text-gray-400">{g.assists}</td>
                      <td className={`p-3 text-right font-bold ${isOver ? "text-green-400" : "text-red-400"}`}>{combo}</td>
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
