import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getTrueLine, getEdge, getHitRate } from "@/utils/edgeEngine";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const PROPS = [
  { label: "Points", value: "points" },
  { label: "Rebounds", value: "rebounds" },
  { label: "Assists", value: "assists" },
  { label: "PR", value: "pr" },
  { label: "RA", value: "ra" },
  { label: "PRA", value: "pra" },
];

export default function Scanner() {
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedProp, setSelectedProp] = useState("points");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);

    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "get_players_with_stats" }),
    });

    const data = await res.json();

    if (data.success) {
      const processed = data.players.map((p: any) => {
        const games = p.stats || [];

        const trueLine = getTrueLine(games, selectedProp);
        const userLine = Math.round(trueLine); // base line

        return {
          ...p,
          trueLine,
          line: userLine,
          edge: getEdge(trueLine, userLine),
          l5: getHitRate(games, selectedProp, userLine, 5),
          l10: getHitRate(games, selectedProp, userLine, 10),
          l15: getHitRate(games, selectedProp, userLine, 15),
        };
      });

      setPlayers(processed);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (players.length) {
      setPlayers(prev =>
        prev.map(p => {
          const games = p.stats || [];
          const trueLine = getTrueLine(games, selectedProp);
          const line = Math.round(trueLine);

          return {
            ...p,
            trueLine,
            line,
            edge: getEdge(trueLine, line),
            l5: getHitRate(games, selectedProp, line, 5),
            l10: getHitRate(games, selectedProp, line, 10),
            l15: getHitRate(games, selectedProp, line, 15),
          };
        })
      );
    }
  }, [selectedProp]);

  const sorted = [...players].sort((a, b) => b.edge - a.edge);

  return (
    <DashboardLayout>
      <div className="p-6">

        {/* PROP SELECTOR */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {PROPS.map(p => (
            <button
              key={p.value}
              onClick={() => setSelectedProp(p.value)}
              className={`px-3 py-1 rounded ${
                selectedProp === p.value ? "bg-purple-600" : "bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="bg-black rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left">
                <th className="p-2">Player</th>
                <th>Line</th>
                <th>True</th>
                <th>Edge</th>
                <th>L5</th>
                <th>L10</th>
                <th>L15</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="p-2">{p.name}</td>
                  <td>{p.line.toFixed(1)}</td>
                  <td className="text-green-400">{p.trueLine.toFixed(1)}</td>
                  <td className={p.edge > 0 ? "text-green-400" : "text-red-400"}>
                    {p.edge.toFixed(1)}
                  </td>
                  <td>{p.l5.toFixed(0)}%</td>
                  <td>{p.l10.toFixed(0)}%</td>
                  <td>{p.l15.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </DashboardLayout>
  );
}
