import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const SPORTS = ["nba", "nfl", "mlb", "nhl"];

const PROP_OPTIONS = [
  { label: "Points", value: ["points"] },
  { label: "Rebounds", value: ["rebounds"] },
  { label: "Assists", value: ["assists"] },
  { label: "Pts+Reb", value: ["points", "rebounds"] },
  { label: "Pts+Ast", value: ["points", "assists"] },
  { label: "Reb+Ast", value: ["rebounds", "assists"] },
  { label: "PRA", value: ["points", "rebounds", "assists"] },
];

export default function Scanner() {
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedProps, setSelectedProps] = useState<string[]>(["points"]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, [sport]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players_with_stats", sport }),
      });

      const data = await res.json();
      if (data.success) setPlayers(data.players);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // -------- LOGIC --------
  const calcCombo = (g: any) =>
    selectedProps.reduce((sum, stat) => sum + (g[stat] || 0), 0);

  const avg = (games: any[], n: number) => {
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    return slice.reduce((a, g) => a + calcCombo(g), 0) / slice.length;
  };

  const hitRate = (games: any[], line: number, n: number) => {
    const slice = games.slice(0, n);
    if (!slice.length) return 0;
    const hits = slice.filter(g => calcCombo(g) > line).length;
    return Math.round((hits / slice.length) * 100);
  };

  const getStreak = (games: any[], line: number) => {
    let streak = 0;
    for (let g of games) {
      if (calcCombo(g) > line) streak++;
      else break;
    }
    return streak;
  };

  const getColor = (val: number) => {
    if (val >= 80) return "bg-green-600/80";
    if (val >= 60) return "bg-green-500/50";
    if (val >= 40) return "bg-yellow-500/40";
    return "bg-red-600/70";
  };

  const getDiffColor = (val: number) =>
    val > 0 ? "text-green-400" : "text-red-400";

  // -------- PROCESS --------
  const processed = players.map(p => {
    const games = p.stats || [];

    const line = avg(games, 10);

    return {
      ...p,
      line,
      avg10: line,
      diff: avg(games, 5) - line,
      l5: hitRate(games, line, 5),
      l10: hitRate(games, line, 10),
      l15: hitRate(games, line, 15),
      l20: hitRate(games, line, 20),
      streak: getStreak(games, line),
    };
  });

  const filtered = processed.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-4">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">

          <input
            placeholder="Search player..."
            className="bg-[#0f172a] border border-gray-700 px-4 py-2 rounded-lg w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="bg-[#0f172a] border border-gray-700 px-4 py-2 rounded-lg"
          >
            {SPORTS.map(s => (
              <option key={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* PROP CHIPS */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PROP_OPTIONS.map(opt => {
            const active =
              JSON.stringify(opt.value) === JSON.stringify(selectedProps);

            return (
              <button
                key={opt.label}
                onClick={() => setSelectedProps(opt.value)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  active
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <div className="rounded-xl overflow-hidden border border-gray-800">

          <table className="w-full text-sm">

            <thead className="bg-[#020617] text-gray-400">
              <tr>
                <th className="p-3 text-left">Player</th>
                <th>Line</th>
                <th>Avg</th>
                <th>Diff</th>
                <th>L5</th>
                <th>L10</th>
                <th>L15</th>
                <th>L20</th>
                <th>Strk</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center p-6">
                    Loading...
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={i} className="border-t border-gray-800 hover:bg-gray-900/40">

                    <td className="p-3 font-semibold">
                      {p.name}
                    </td>

                    <td>{p.line.toFixed(1)}</td>
                    <td>{p.avg10.toFixed(1)}</td>

                    <td className={getDiffColor(p.diff)}>
                      {p.diff.toFixed(1)}
                    </td>

                    <td className={`${getColor(p.l5)} text-center`}>{p.l5}%</td>
                    <td className={`${getColor(p.l10)} text-center`}>{p.l10}%</td>
                    <td className={`${getColor(p.l15)} text-center`}>{p.l15}%</td>
                    <td className={`${getColor(p.l20)} text-center`}>{p.l20}%</td>

                    <td className="text-center font-bold">
                      {p.streak}
                    </td>

                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
