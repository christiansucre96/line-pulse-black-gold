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

  // -------- FETCH DATA --------
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
      if (data.success) {
        setPlayers(data.players);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // -------- CALCULATIONS --------
  const calcCombo = (game: any) => {
    return selectedProps.reduce((sum, stat) => sum + (game[stat] || 0), 0);
  };

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

  // -------- BUILD TABLE DATA --------
  const processed = players.map(p => {
    const games = p.stats || [];

    const line = avg(games, 10); // YOUR "SMART LINE"

    return {
      ...p,
      line: line.toFixed(1),
      avg10: line.toFixed(1),
      diff: (avg(games, 5) - line).toFixed(1),
      l5: hitRate(games, line, 5),
      l10: hitRate(games, line, 10),
      l15: hitRate(games, line, 15),
      l20: hitRate(games, line, 20),
    };
  });

  const filtered = processed.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // -------- UI --------
  return (
    <DashboardLayout>
      <div className="p-4">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">

          <input
            placeholder="Search player..."
            className="bg-secondary px-4 py-2 rounded-lg w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="bg-secondary px-4 py-2 rounded-lg"
          >
            {SPORTS.map(s => (
              <option key={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* PROP SELECTOR (LIKE SCREENSHOT) */}
        <div className="flex gap-2 flex-wrap mb-4">
          {PROP_OPTIONS.map(opt => {
            const active =
              JSON.stringify(opt.value) === JSON.stringify(selectedProps);

            return (
              <button
                key={opt.label}
                onClick={() => setSelectedProps(opt.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  active
                    ? "bg-purple-600 text-white"
                    : "bg-secondary text-gray-400"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left p-3">Player</th>
                <th>Line</th>
                <th>Avg L10</th>
                <th>Diff</th>
                <th>L5</th>
                <th>L10</th>
                <th>L15</th>
                <th>L20</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center p-6">
                    Loading...
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={i} className="border-t border-border">

                    <td className="p-3 font-semibold">
                      {p.name}
                    </td>

                    <td>{p.line}</td>
                    <td>{p.avg10}</td>

                    <td className={Number(p.diff) > 0 ? "text-green-400" : "text-red-400"}>
                      {p.diff}
                    </td>

                    <td>{p.l5}%</td>
                    <td>{p.l10}%</td>
                    <td>{p.l15}%</td>
                    <td>{p.l20}%</td>

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
