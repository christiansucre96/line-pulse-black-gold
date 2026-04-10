import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export function PlayerDetailView({ playerId, onBack }: any) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProps, setSelectedProps] = useState<string[]>(["points"]);
  const [line, setLine] = useState(0);

  useEffect(() => {
    fetchPlayer();
  }, [playerId]);

  const fetchPlayer = async () => {
    setLoading(true);
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "get_player_details",
        player_id: playerId,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setPlayer(data.player);
      const avg = calcAvg(data.player.stats, 10);
      setLine(avg);
    }
    setLoading(false);
  };

  // -------- LOGIC --------
  const calcCombo = (g: any) =>
    selectedProps.reduce((sum, stat) => sum + (g[stat] || 0), 0);

  const calcAvg = (games: any[], n: number) => {
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    return slice.reduce((a, g) => a + calcCombo(g), 0) / slice.length;
  };

  const hitRate = (games: any[], n: number) => {
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    const hits = slice.filter(g => calcCombo(g) > line).length;
    return Math.round((hits / slice.length) * 100);
  };

  const maxStat = (key: string) =>
    Math.max(...player.stats.map((g: any) => g[key] || 0));

  if (loading) return <div className="p-10">Loading...</div>;
  if (!player) return <div>No player found</div>;

  const games = player.stats.slice(0, 10);

  return (
    <DashboardLayout>
      <div className="p-4">

        {/* BACK */}
        <button onClick={onBack} className="flex items-center gap-2 mb-4">
          <ArrowLeft /> Back
        </button>

        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{player.full_name}</h1>
            <p className="text-gray-400">
              {player.position} • {player.team}
            </p>

            {player.injury_status && (
              <p className="text-red-400 text-sm mt-1">
                🚑 {player.injury_status} – {player.injury_description}
              </p>
            )}
          </div>

          {/* PLAYER MAX PANEL */}
          <div className="bg-[#0f172a] p-4 rounded-xl text-sm">
            <p>Max Points: {maxStat("points")}</p>
            <p>Max Rebounds: {maxStat("rebounds")}</p>
            <p>Max Assists: {maxStat("assists")}</p>
          </div>
        </div>

        {/* LINE CONTROL */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLine(line - 1)} className="px-3 py-1 bg-gray-700 rounded">-</button>
          <div className="text-lg font-bold">{line.toFixed(1)}</div>
          <button onClick={() => setLine(line + 1)} className="px-3 py-1 bg-gray-700 rounded">+</button>
        </div>

        {/* HIT RATES */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[5, 10, 15, 20].map(n => (
            <div key={n} className="bg-[#020617] p-3 rounded text-center">
              <p className="text-xs text-gray-400">L{n}</p>
              <p className="text-green-400 font-bold">
                {hitRate(player.stats, n)}%
              </p>
              <p className="text-xs text-gray-500">
                Avg {calcAvg(player.stats, n).toFixed(1)}
              </p>
            </div>
          ))}
        </div>

        {/* BAR GRAPH */}
        <div className="bg-[#020617] p-4 rounded-xl mb-6">
          <div className="flex items-end gap-2 h-40">
            {games.map((g: any, i: number) => {
              const val = calcCombo(g);
              const height = val * 3;
              const color = val > line ? "bg-green-500" : "bg-red-500";

              return (
                <div key={i} className="flex flex-col items-center w-6">
                  <div
                    className={`${color} w-full rounded-t`}
                    style={{ height }}
                  />
                  <p className="text-[10px] mt-1">
                    {g.opponent}
                  </p>
                </div>
              );
            })}
          </div>

          {/* LINE */}
          <div className="border-t border-dashed border-gray-500 mt-2 relative">
            <div className="absolute -top-3 text-xs text-gray-400">
              Line {line.toFixed(1)}
            </div>
          </div>
        </div>

        {/* GAME LOGS */}
        <div className="bg-[#020617] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0f172a]">
              <tr>
                <th>Date</th>
                <th>Opp</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
              </tr>
            </thead>

            <tbody>
              {player.stats.slice(0, 15).map((g: any, i: number) => (
                <tr key={i} className="border-t border-gray-800">
                  <td>{g.game_date}</td>
                  <td>{g.opponent}</td>
                  <td>{g.points}</td>
                  <td>{g.rebounds}</td>
                  <td>{g.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </DashboardLayout>
  );
}
