import { useEffect, useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  playerId: string;
  sport: string;
  onBack: () => void;
}

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// 🔥 STACKED BAR (LIKE SCREENSHOT)
function StackedBar({
  data,
  line,
}: {
  data: any[];
  line: number;
}) {
  const max = Math.max(...data.map((d) => d.total), line) * 1.2;

  return (
    <div className="w-full h-64 flex items-end gap-2">
      {data.map((d, i) => {
        const pct = (d.total / max) * 100;
        const isOver = d.total >= line;

        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col justify-end h-full relative">
              {/* line */}
              <div
                className="absolute w-full border-t border-dashed border-pink-400"
                style={{ bottom: `${(line / max) * 100}%` }}
              />

              {/* rebounds */}
              <div
                className="bg-green-400 w-full"
                style={{ height: `${(d.reb / max) * 100}%` }}
              />

              {/* points */}
              <div
                className={`w-full ${
                  isOver ? "bg-green-600" : "bg-red-500"
                }`}
                style={{ height: `${(d.pts / max) * 100}%` }}
              />
            </div>

            <span className="text-[10px] text-gray-400 mt-1">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 🔥 STAT BADGE (L5 / L10 / etc)
function StatBox({ label, hr, avg }: any) {
  return (
    <div className="bg-[#0f172a] px-3 py-2 rounded-lg text-xs text-center">
      <p className="text-gray-400">{label}</p>
      <p className="text-green-400 font-bold">HR {hr}%</p>
      <p className="text-gray-300">Avg {avg}</p>
    </div>
  );
}

export default function PlayerDetailView({ playerId, sport, onBack }: Props) {
  const [player, setPlayer] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [props, setProps] = useState<any>({});
  const [selectedProp, setSelectedProp] = useState("PR");
  const [line, setLine] = useState(16.5);

  useEffect(() => {
    (async () => {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_player_details",
          sport,
          player_id: playerId,
        }),
      });

      const data = await res.json();

      setPlayer(data.player);
      setLogs(data.player.game_logs || []);
      setProps(data.player.all_props || {});
    })();
  }, [playerId]);

  // 🔥 FORMAT DATA FOR STACKED BAR
  const chartData = useMemo(() => {
    return logs.slice(0, 10).map((g: any, i) => ({
      label: `G${10 - i}`,
      pts: g.points || 0,
      reb: g.rebounds || 0,
      total: (g.points || 0) + (g.rebounds || 0),
    }));
  }, [logs]);

  if (!player) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#020617] text-white">
      
      {/* HEADER */}
      <div className="p-4 flex items-center gap-3">
        <button onClick={onBack}>
          <ArrowLeft />
        </button>
        <h1 className="text-lg font-bold">Player Detail</h1>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-4 p-4">

        {/* LEFT SIDE */}
        <div className="bg-[#020617] rounded-xl p-4 border border-gray-800">

          {/* TABS */}
          <div className="flex gap-3 mb-4 text-sm">
            {["PTS", "REBS", "ASTS", "PR", "PRA"].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedProp(t)}
                className={`px-3 py-1 rounded ${
                  selectedProp === t
                    ? "bg-purple-600"
                    : "bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* LINE */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-1">
              Points & Rebounds
            </p>
            <div className="flex items-center gap-2">
              <button className="bg-gray-800 px-2">-</button>
              <span className="text-yellow-400 font-bold">{line}</span>
              <button className="bg-gray-800 px-2">+</button>
            </div>
          </div>

          {/* STATS BOXES */}
          <div className="flex gap-2 mb-4">
            <StatBox label="L5" hr={60} avg={25.4} />
            <StatBox label="L10" hr={80} avg={31.3} />
            <StatBox label="L15" hr={73} avg={27.5} />
            <StatBox label="L20" hr={80} avg={26.8} />
          </div>

          {/* CHART */}
          <StackedBar data={chartData} line={line} />
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-[#020617] rounded-xl p-4 border border-gray-800">
          <h2 className="text-purple-400 font-bold mb-3">
            Player Max Stats
          </h2>

          {[
            ["Points", 35],
            ["Turnovers", 4],
            ["Steals", 5],
            ["Assists", 7],
            ["Blocks", 6],
            ["Rebounds", 25],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-sm py-1">
              <span className="text-gray-400">{label}</span>
              <span className="text-white font-bold">{val}</span>
            </div>
          ))}

          <div className="mt-4 bg-purple-600/20 p-3 rounded-lg text-center">
            <p className="text-sm text-gray-300">Matches Played</p>
            <p className="text-xl font-bold text-purple-400">73</p>
          </div>
        </div>
      </div>
    </div>
  );
}
