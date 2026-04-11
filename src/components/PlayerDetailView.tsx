// src/components/PlayerDetailView.tsx
import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Minus, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ─────────────────────────────────────────────────────────────
// 🌍 FULL PROP CONFIGURATION
// ─────────────────────────────────────────────────────────────

const PROP_GROUPS: Record<string, { id: string; label: string; stackKeys?: string[]; isBoolean?: boolean }[]> = {
  nba: [
    { id: "points", label: "PTS" }, { id: "rebounds", label: "REB" }, { id: "assists", label: "AST" },
    { id: "threes", label: "3PM" },
    { id: "PR", label: "PR", stackKeys: ["points", "rebounds"] },
    { id: "PA", label: "PA", stackKeys: ["points", "assists"] },
    { id: "RA", label: "RA", stackKeys: ["rebounds", "assists"] },
    { id: "PRA", label: "PRA", stackKeys: ["points", "rebounds", "assists"] },
    { id: "steals", label: "STL" }, { id: "blocks", label: "BLK" },
    { id: "SB", label: "STL+BLK", stackKeys: ["steals", "blocks"] },
    { id: "doubleDouble", label: "DD", isBoolean: true },
    { id: "tripleDouble", label: "TD", isBoolean: true },
    { id: "turnovers", label: "TO" }, { id: "minutes", label: "MIN" }
  ],
  nfl: [
    { id: "passYards", label: "Pass Yds" }, { id: "passTD", label: "Pass TD" },
    { id: "completions", label: "Comp" }, { id: "attempts", label: "Att" }, { id: "interceptions", label: "INT" },
    { id: "rushYards", label: "Rush Yds" }, { id: "rushAtt", label: "Rush Att" }, { id: "rushTD", label: "Rush TD" },
    { id: "receptions", label: "Rec" }, { id: "recYards", label: "Rec Yds" }, { id: "recTD", label: "Rec TD" },
    { id: "passRushYds", label: "Pass+Rush", stackKeys: ["passYards", "rushYards"] },
    { id: "rushRecYds", label: "Rush+Rec", stackKeys: ["rushYards", "recYards"] },
    { id: "anytimeTD", label: "Anytime TD", isBoolean: true },
    { id: "firstTD", label: "First TD", isBoolean: true },
    { id: "sacks", label: "Sacks" }, { id: "tackles", label: "Tackles" }
  ],
  mlb: [
    { id: "hits", label: "H" }, { id: "runs", label: "R" }, { id: "rbi", label: "RBI" },
    { id: "homeRuns", label: "HR" }, { id: "totalBases", label: "TB" },
    { id: "strikeouts", label: "Ks" }, { id: "earnedRuns", label: "ER" },
    { id: "hitsAllowed", label: "H All" }, { id: "walksAllowed", label: "BB All" },
    { id: "HRR", label: "H+R+RBI", stackKeys: ["hits", "runs", "rbi"] },
    { id: "TBLadder", label: "TB Ladder" }
  ],
  nhl: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" },
    { id: "points", label: "Pts", stackKeys: ["goals", "assists"] },
    { id: "shots", label: "SOG" }, { id: "saves", label: "Saves" },
    { id: "goalsAllowed", label: "GA" },
    { id: "ptsShots", label: "Pts+SOG", stackKeys: ["goals", "assists", "shots"] },
    { id: "anytimeGoal", label: "Anytime G", isBoolean: true }
  ],
  soccer: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" },
    { id: "shots", label: "Shots" }, { id: "shotsOnTarget", label: "SOT" }
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

  const [chartView, setChartView] = useState<5 | 10 | 15 | 20>(10);
  const [selectedPlayerProp, setSelectedPlayerProp] = useState<string>(sport === "nba" ? "PRA" : "points"); 
  const [playerLine, setPlayerLine] = useState(1);

  const [selectedTeamProp, setSelectedTeamProp] = useState<string>("points");
  const [teamLine, setTeamLine] = useState(1);

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
      const pAvg = calcAvgForProp(data.player.stats, 10, selectedPlayerProp);
      setPlayerLine(Math.max(1, pAvg));
      const tAvg = calcAvgForProp(data.player.stats, 10, selectedTeamProp);
      setTeamLine(Math.max(1, tAvg));
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally { setLoading(false); }
  };

  const getPropValue = (game: any, propId: string) => {
    const group = PROP_GROUPS[sport]?.find(g => g.id === propId);
    if (!group) return 0;
    if (group.stackKeys) {
      return group.stackKeys.reduce((sum, key) => sum + (game[key] || 0), 0);
    }
    if (group.isBoolean) {
      if (propId === "doubleDouble") return ((game.points||0) >= 10 && (game.rebounds||0) >= 10) ? 1 : 0;
      if (propId === "tripleDouble") return ((game.points||0) >= 10 && (game.rebounds||0) >= 10 && (game.assists||0) >= 10) ? 1 : 0;
      if (propId.includes("TD") || propId.includes("Goal") || propId.includes("HR")) return (game.goals || game.rushTD || game.passTD || game.homeRuns || 0) > 0 ? 1 : 0;
      return 0;
    }
    return game[propId] || 0;
  };

  const calcAvgForProp = (games: any[], n: number, propId: string) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    return slice.reduce((sum, g) => sum + getPropValue(g, propId), 0) / slice.length;
  };

  const calcHitRate = (games: any[], n: number, propId: string, line: number) => {
    if (!games?.length) return 0;
    const slice = games.slice(0, n);
    const hits = slice.filter(g => getPropValue(g, propId) > line).length;
    return Math.round((hits / slice.length) * 100);
  };

  if (loading) return <DashboardLayout><div className="p-20 text-center text-yellow-400">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="p-20 text-center text-red-400">{error}</div></DashboardLayout>;
  if (!player) return <DashboardLayout><div className="p-20 text-center">No data</div></DashboardLayout>;

  const games = player.stats || [];
  const chartGames = games.slice(0, chartView);
  
  const playerValues = chartGames.map(g => getPropValue(g, selectedPlayerProp));
  const maxVal = Math.max(1, ...playerValues, playerLine * 1.2);
  const playerLineTop = ((maxVal - playerLine) / maxVal) * 100;

  const teamValues = games.slice(0, 10).map(g => getPropValue(g, selectedTeamProp));
  const maxTeamVal = Math.max(1, ...teamValues, teamLine * 1.2);
  const teamLineTop = ((maxTeamVal - teamLine) / maxTeamVal) * 100;

  // ✅ FIXED: Corrected function signature (added 'data:' parameter name)
  const renderChart = (
    data: any[],
    line: number,
    lineTopPercent: number,
    max: number,
    propId: string,
    heightClass: string = "h-64"
  ) => (
    <div className={`${heightClass} w-full flex items-end justify-between gap-1 pb-8 relative border-b border-gray-800`}>
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-[10px] text-gray-500 pr-2 text-right pointer-events-none">
        <span>{Math.round(max)}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>

      <div 
        className="absolute left-12 right-0 border-t-2 border-dashed border-yellow-500/80 pointer-events-none z-20"
        style={{ top: `${lineTopPercent}%` }}
      >
        <div className="absolute -left-16 -top-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
          Line: {line.toFixed(1)}
        </div>
      </div>

      <div className="absolute left-12 right-0 top-0 bottom-8 pointer-events-none">
        <div className="absolute w-full border-t border-gray-800/50" style={{ top: "25%" }} />
        <div className="absolute w-full border-t border-gray-800/50" style={{ top: "50%" }} />
        <div className="absolute w-full border-t border-gray-800/50" style={{ top: "75%" }} />
      </div>

      <div className="ml-14 flex items-end justify-between gap-1 w-full h-full">
        {data.map((g: any, i: number) => {
          const val = getPropValue(g, propId);
          const isOver = val > line;
          const barHeight = Math.max(4, (val / max) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-[#0f172a] border border-gray-700 text-xs p-2 rounded z-30 pointer-events-none whitespace-nowrap transition-opacity">
                <p className="text-yellow-400 font-bold">{g.opponent} ({g.game_date})</p>
                <p className={isOver ? "text-green-400" : "text-red-400"}>Val: {val} {isOver ? "✓" : "✗"}</p>
              </div>
              <div className="w-full flex flex-col justify-end h-full relative">
                <div 
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isOver ? "bg-gradient-to-t from-green-800 to-green-500" : "bg-gradient-to-t from-red-800 to-red-500"
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
              </div>
              <div className="absolute -bottom-6 w-full text-center">
                <p className="text-[10px] text-gray-500 font-bold truncate">{g.opponent}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto space-y-6">
        
        {/* ── HEADER ─ */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition">
            <ArrowLeft size={20} /> Back
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-yellow-400">{player.full_name}</h1>
            <p className="text-sm text-gray-400">{player.team} • {player.position}</p>
          </div>
        </div>

        {/* ── BLOCK 1: PLAYER PERFORMANCE ── */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 p-5 shadow-lg relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">
                {PROP_GROUPS[sport]?.find(p => p.id === selectedPlayerProp)?.label || selectedPlayerProp}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Line:</span>
                <button onClick={() => setPlayerLine(v => Math.max(0.5, v - 0.5))} className="p-1 hover:bg-gray-700 rounded"><Minus size={14} className="text-yellow-400" /></button>
                <span className="text-xl font-bold text-yellow-400 w-12 text-center">{playerLine.toFixed(1)}</span>
                <button onClick={() => setPlayerLine(v => v + 0.5)} className="p-1 hover:bg-gray-700 rounded"><Plus size={14} className="text-yellow-400" /></button>
              </div>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => {
                const rate = calcHitRate(games, n, selectedPlayerProp, playerLine);
                return (
                  <button key={n} onClick={() => setChartView(n as any)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartView === n ? "bg-yellow-500 text-black" : "bg-[#1e293b] text-gray-400 hover:text-white"}`}>
                    L{n}<div className={`text-[10px] ${rate >= 50 ? "text-green-400" : "text-red-400"}`}>{rate}%</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative inline-block mb-4 w-full sm:w-48">
             <select value={selectedPlayerProp} onChange={e => setSelectedPlayerProp(e.target.value)} className="w-full bg-[#1e293b] text-yellow-400 text-sm rounded border border-gray-700 py-2 px-3 appearance-none focus:outline-none focus:border-yellow-500">
               {PROP_GROUPS[sport]?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
             </select>
          </div>

          {renderChart(chartGames, playerLine, playerLineTop, maxVal, selectedPlayerProp, "h-64")}
        </div>

        {/* ── BLOCK 2: TEAM STATS ── */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-gray-300">Team Stats (Last 10 Opponents)</h3>
            <select value={selectedTeamProp} onChange={e => setSelectedTeamProp(e.target.value)} className="bg-[#1e293b] text-yellow-400 text-xs rounded border border-gray-700 py-1 px-2">
              {PROP_GROUPS[sport]?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {renderChart(games.slice(0, 10).reverse(), teamLine, teamLineTop, maxTeamVal, selectedTeamProp, "h-48")}

          <div className="flex justify-center mt-6">
             <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Line:</span>
                <button onClick={() => setTeamLine(v => v - 1)} className="px-2 bg-gray-800 rounded text-yellow-400 hover:bg-gray-700">-</button>
                <span className="text-sm font-bold text-yellow-400 w-8 text-center">{teamLine.toFixed(0)}</span>
                <button onClick={() => setTeamLine(v => v + 1)} className="px-2 bg-gray-800 rounded text-yellow-400 hover:bg-gray-700">+</button>
             </div>
          </div>
        </div>

        {/* ── BLOCK 3: GAME LOG TABLE ── */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-[#111827] flex justify-between items-center">
            <h3 className="text-yellow-400 font-bold">Game Log - Last 15 Games</h3>
            <Button variant="ghost" size="sm" onClick={fetchPlayer} className="text-gray-400 hover:text-white">
              <Activity size={14} className="mr-2" /> Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-[#0f172a] text-gray-400 uppercase text-xs">
                <tr>
                  <th className="p-3 text-left">Opponent</th>
                  <th className="p-3 text-left">Date</th>
                  {PROP_GROUPS[sport]?.map(p => (
                    <th 
                      key={p.id} 
                      className={`p-3 text-right ${p.id === selectedPlayerProp ? "text-yellow-400 font-bold" : ""}`}
                    >
                      {p.label}
                    </th>
                  ))}
                  <th className="p-3 text-right text-yellow-400">Line</th>
                  <th className="p-3 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {games.slice(0, 15).map((g: any, i: number) => {
                  const activeVal = getPropValue(g, selectedPlayerProp);
                  const isOver = activeVal > playerLine;
                  
                  return (
                    <tr key={i} className={`hover:bg-[#1e293b] transition ${isOver ? "bg-green-900/10" : "bg-red-900/10"}`}>
                      <td className="p-3 font-medium text-gray-200 whitespace-nowrap">{g.opponent}</td>
                      <td className="p-3 text-gray-400 whitespace-nowrap">{g.game_date}</td>
                      
                      {PROP_GROUPS[sport]?.map(p => {
                        const val = getPropValue(g, p.id);
                        return (
                          <td 
                            key={p.id} 
                            className={`p-3 text-right font-medium whitespace-nowrap ${
                              p.id === selectedPlayerProp 
                                ? (val > playerLine ? "text-green-400" : "text-red-400") 
                                : "text-gray-300"
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}
                      
                      <td className="p-3 text-right text-gray-400 font-mono">{playerLine.toFixed(1)}</td>
                      
                      <td className="p-3 text-center">
                        <Badge variant={isOver ? "default" : "secondary"} className={isOver ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700 text-white"}>
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
      </div>
    </DashboardLayout>
  );
}
