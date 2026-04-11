// src/components/PlayerDetailView.tsx
import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Minus, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const PROP_GROUPS: Record<string, { id: string; label: string }[]> = {
  nba: [
    { id: "points", label: "PTS" }, { id: "rebounds", label: "REB" }, { id: "assists", label: "AST" },
    { id: "threes", label: "3PM" }, { id: "PRA", label: "PRA" },
  ],
  nfl: [
    { id: "passYards", label: "Pass Yds" }, { id: "rushYards", label: "Rush Yds" }, { id: "recYards", label: "Rec Yds" },
  ],
  mlb: [
    { id: "hits", label: "H" }, { id: "homeRuns", label: "HR" }, { id: "rbi", label: "RBI" },
  ],
  nhl: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" }, { id: "shots", label: "SOG" },
  ],
  soccer: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" }, { id: "shots", label: "Shots" },
  ]
};

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
  const [generatedLines, setGeneratedLines] = useState<any[]>([]);
  const [playerLine, setPlayerLine] = useState(1);

  useEffect(() => { fetchPlayer(); }, [playerId]);

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
      setGeneratedLines(data.generated_lines || []);
      
      const gen = (data.generated_lines || []).find((l: any) => l.prop === selectedProps[0]?.toUpperCase());
      setPlayerLine(gen?.line || 1);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally { setLoading(false); }
  };

  const getVal = (game: any, prop: string) => game[prop] || 0;

  if (loading) return <DashboardLayout><div className="p-20 text-center text-yellow-400">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="p-20 text-center text-red-400">{error}</div></DashboardLayout>;
  if (!player) return <DashboardLayout><div className="p-20 text-center">No data</div></DashboardLayout>;

  const games = player.stats || [];
  const chartGames = games.slice(0, 10);
  const maxVal = Math.max(1, ...chartGames.map((g: any) => getVal(g, selectedProps[0] || "points")), playerLine * 1.2);

  // ✅ Simple chart renderer - NO complex nested functions
  const renderChart = () => (
    <div className="h-64 w-full flex items-end justify-between gap-1 pb-8 relative border-b border-gray-800">
      {chartGames.map((g: any, i: number) => {
        const val = getVal(g, selectedProps[0] || "points");
        const isOver = val > playerLine;
        const height = Math.max(4, (val / maxVal) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className={`w-full rounded-t-sm ${isOver ? "bg-green-500" : "bg-red-500"}`} style={{ height: `${height}%` }} />
            <p className="text-[10px] text-gray-500 mt-1">{g.opponent}</p>
          </div>
        );
      })}
      {/* Line marker */}
      <div className="absolute left-0 right-0 border-t-2 border-dashed border-yellow-500" style={{ bottom: `${(playerLine / maxVal) * 100}%` }}>
        <span className="absolute -top-5 left-0 text-[10px] bg-yellow-500 text-black px-1 rounded">Line: {playerLine}</span>
      </div>
    </div>
  );

  const currentLine = generatedLines?.find((l: any) => l.prop === selectedProps[0]?.toUpperCase());

  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400"><ArrowLeft size={20} /> Back</button>
        
        <div className="flex justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">{player.full_name}</h1>
            <p className="text-gray-400">{player.team} • {player.position}</p>
          </div>
          {currentLine && (
            <div className="text-right text-sm">
              <div className="text-gray-400">Our Line</div>
              <div className="text-yellow-400 font-bold">{currentLine.line.toFixed(1)}</div>
            </div>
          )}
        </div>

        {/* Line controls */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400">Line:</span>
          <button onClick={() => setPlayerLine(v => Math.max(0.5, v - 0.5))} className="px-3 py-1 bg-gray-700 rounded">-</button>
          <span className="font-bold text-yellow-400 w-12 text-center">{playerLine.toFixed(1)}</span>
          <button onClick={() => setPlayerLine(v => v + 0.5)} className="px-3 py-1 bg-gray-700 rounded">+</button>
        </div>

        {/* Chart */}
        <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
          {renderChart()}
        </div>

        {/* Game Log Table - Simplified */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0f172a]">
              <tr>
                <th className="p-3 text-left">Opp</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {games.slice(0, 10).map((g: any, i: number) => {
                const val = getVal(g, selectedProps[0] || "points");
                const isOver = val > playerLine;
                return (
                  <tr key={i} className="border-t border-gray-800">
                    <td className="p-3">{g.opponent}</td>
                    <td className="p-3 text-gray-400">{g.game_date}</td>
                    <td className={`p-3 text-right font-bold ${isOver ? "text-green-400" : "text-red-400"}`}>{val}</td>
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
