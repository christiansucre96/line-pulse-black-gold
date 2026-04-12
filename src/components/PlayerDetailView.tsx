// src/components/PlayerDetailView.tsx
import { useEffect, useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
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
  const [playerLine, setPlayerLine] = useState(1);

  useEffect(() => { 
    if (playerId) fetchPlayer(); 
  }, [playerId]);

  const fetchPlayer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operation: "get_player_details", 
          player_id: playerId, 
          sport, 
          props: selectedProps 
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      
      setPlayer(data.player);
      // ✅ Safe line initialization
      const line = data.generated_lines?.[0]?.line;
      setPlayerLine(typeof line === "number" ? line : 1);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load");
    } finally { 
      setLoading(false); 
    }
  };

  // ✅ Safe value getter
  const getVal = (game: any, prop: string) => {
    if (!game || typeof game !== "object") return 0;
    const val = game[prop];
    return typeof val === "number" ? val : 0;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-20 flex flex-col items-center justify-center min-h-[400px]">
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
          <button onClick={onBack} className="flex items-center gap-2 mb-6 text-gray-400 hover:text-yellow-400">
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

  // ✅ Safe data access
  const games = Array.isArray(player.stats) ? player.stats : [];
  const chartGames = games.slice(0, 10);
  const playerName = typeof player.full_name === "string" ? player.full_name : "Unknown";
  const playerTeam = typeof player.team === "string" ? player.team : "";
  
  // Calculate chart values safely
  const values = chartGames.map((g: any) => getVal(g, selectedProps[0] || "points"));
  const maxVal = Math.max(1, ...values, playerLine * 1.2);

  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition">
            <ArrowLeft size={20} /> Back
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-yellow-400">{playerName}</h1>
            <p className="text-sm text-gray-400">{playerTeam}</p>
          </div>
        </div>

        {/* Line Controls */}
        <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Line:</span>
            <button 
              onClick={() => setPlayerLine(v => Math.max(0.5, v - 0.5))} 
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400"
            >
              -
            </button>
            <span className="text-xl font-bold text-yellow-400 w-16 text-center">
              {playerLine.toFixed(1)}
            </span>
            <button 
              onClick={() => setPlayerLine(v => v + 0.5)} 
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400"
            >
              +
            </button>
          </div>
        </div>

        {/* Simple Chart */}
        <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
          <div className="h-48 flex items-end justify-between gap-1 pb-6 relative">
            {chartGames.map((g: any, i: number) => {
              const val = getVal(g, selectedProps[0] || "points");
              const isOver = val > playerLine;
              const height = Math.max(4, (val / maxVal) * 100);
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t ${isOver ? "bg-green-500" : "bg-red-500"}`} 
                    style={{ height: `${height}%` }} 
                  />
                  <p className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
                    {typeof g.opponent === "string" ? g.opponent : "??"}
                  </p>
                </div>
              );
            })}
            {/* Line marker */}
            <div 
              className="absolute left-0 right-0 border-t-2 border-dashed border-yellow-500"
              style={{ bottom: `${(playerLine / maxVal) * 100}%` }}
            >
              <span className="absolute -top-5 left-0 text-[10px] bg-yellow-500 text-black px-1 rounded">
                {playerLine.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Game Log Table */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0f172a]">
              <tr>
                <th className="p-3 text-left text-yellow-400">Opp</th>
                <th className="p-3 text-left text-yellow-400">Date</th>
                <th className="p-3 text-right text-yellow-400">Value</th>
                <th className="p-3 text-center text-yellow-400">Result</th>
              </tr>
            </thead>
            <tbody>
              {games.slice(0, 10).map((g: any, i: number) => {
                const val = getVal(g, selectedProps[0] || "points");
                const isOver = val > playerLine;
                const opponent = typeof g.opponent === "string" ? g.opponent : "??";
                const date = typeof g.game_date === "string" ? g.game_date : "";
                
                return (
                  <tr key={i} className="border-t border-gray-800 hover:bg-[#0f172a]">
                    <td className="p-3">{opponent}</td>
                    <td className="p-3 text-gray-400">{date}</td>
                    <td className={`p-3 text-right font-bold ${isOver ? "text-green-400" : "text-red-400"}`}>
                      {val}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={isOver ? "default" : "secondary"} className={isOver ? "bg-green-600" : "bg-red-600"}>
                        {isOver ? "OVER" : "UNDER"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
