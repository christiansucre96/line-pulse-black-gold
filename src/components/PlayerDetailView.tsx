import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export function PlayerDetailView({ playerId, onBack }) {
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState([]);
  const [line, setLine] = useState(0);
  const [activeStat, setActiveStat] = useState("points");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_player_details", player_id: playerId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayer(data.player);
        setStats(data.player.stats || []);
        setLine(data.player.default_line || 20);
      }
      setLoading(false);
    };
    fetchData();
  }, [playerId]);

  if (loading) return <DashboardLayout><div className="p-10">Loading...</div></DashboardLayout>;
  if (!player) return null;

  // 🔥 STAT SELECTOR LOGIC
  const getStatValue = (g) => {
    if (activeStat === "points") return g.points;
    if (activeStat === "rebounds") return g.rebounds;
    if (activeStat === "assists") return g.assists;
    if (activeStat === "pr") return g.points + g.rebounds;
    if (activeStat === "ra") return g.rebounds + g.assists;
    if (activeStat === "pra") return g.points + g.rebounds + g.assists;
    return 0;
  };

  const games = stats.slice(0, 15).reverse();

  const calcAvg = (n) => {
    const slice = stats.slice(0, n);
    const vals = slice.map(getStatValue);
    return vals.reduce((a, b) => a + b, 0) / vals.length || 0;
  };

  const calcHitRate = (n) => {
    const slice = stats.slice(0, n);
    const hits = slice.filter(g => getStatValue(g) > line).length;
    return ((hits / slice.length) * 100) || 0;
  };

  const maxStats = {
    points: Math.max(...stats.map(s => s.points || 0)),
    rebounds: Math.max(...stats.map(s => s.rebounds || 0)),
    assists: Math.max(...stats.map(s => s.assists || 0)),
  };

  const barColor = (val) => val >= line ? "bg-green-500" : "bg-red-500";

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">

        {/* HEADER */}
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft /> Back
        </button>

        <h1 className="text-2xl font-bold">{player.full_name}</h1>

        {/* STAT TABS */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {["points","rebounds","assists","pr","ra","pra"].map(s => (
            <button
              key={s}
              onClick={() => setActiveStat(s)}
              className={`px-3 py-1 rounded ${activeStat === s ? "bg-primary" : "bg-secondary"}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* LINE CONTROL */}
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setLine(l => l - 1)}>-</button>
          <div className="px-4 py-2 bg-secondary rounded">{line}</div>
          <button onClick={() => setLine(l => l + 1)}>+</button>
        </div>

        {/* L5 L10 L15 L20 */}
        <div className="grid grid-cols-4 gap-3 mt-4 text-center">
          {[5,10,15,20].map(n => (
            <div key={n} className="bg-secondary p-2 rounded">
              <div>L{n}</div>
              <div className="text-green-400">{calcHitRate(n).toFixed(0)}%</div>
              <div className="text-xs">Avg {calcAvg(n).toFixed(1)}</div>
            </div>
          ))}
        </div>

        {/* BAR GRAPH */}
        <div className="mt-6">
          <div className="flex items-end gap-2 h-48">
            {games.map((g, i) => {
              const val = getStatValue(g);
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center">
                  <div
                    className={`${barColor(val)} w-full rounded`}
                    style={{ height: `${val * 3}px` }}
                  />
                  <span className="text-xs mt-1">{val}</span>
                </div>
              );
            })}
          </div>

          {/* LINE */}
          <div className="border-t border-dashed border-white mt-2 text-xs text-center">
            Line: {line}
          </div>
        </div>

        {/* MAX STATS */}
        <div className="mt-6 bg-secondary p-4 rounded">
          <h3 className="font-bold mb-2">Player Max Stats</h3>
          <div>PTS: {maxStats.points}</div>
          <div>REB: {maxStats.rebounds}</div>
          <div>AST: {maxStats.assists}</div>
        </div>

        {/* GAME LOG */}
        <div className="mt-6">
          <h3 className="font-bold mb-2">Last 15 Games</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Date</th><th>PTS</th><th>REB</th><th>AST</th><th>PRA</th>
              </tr>
            </thead>
            <tbody>
              {stats.slice(0,15).map((g,i)=>(
                <tr key={i}>
                  <td>{new Date(g.game_date).toLocaleDateString()}</td>
                  <td>{g.points}</td>
                  <td>{g.rebounds}</td>
                  <td>{g.assists}</td>
                  <td>{g.points + g.rebounds + g.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </DashboardLayout>
  );
}
