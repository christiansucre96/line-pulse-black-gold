import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState("points");
  const [lineValue, setLineValue] = useState(0);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_player_details", player_id: playerId }),
        });
        const data = await res.json();
        if (data.success) setPlayer(data.player);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [playerId]);

  if (loading) return <DashboardLayout><div className="py-20 text-center">Loading...</div></DashboardLayout>;
  if (!player) return <DashboardLayout><div className="py-20 text-center">No player found</div></DashboardLayout>;

  const stats = player.stats || [];
  const props = player.props || [];

  // 🔥 GET STAT ARRAY
  const getStatArray = () => {
    switch (selectedStat) {
      case "points":
        return stats.map(s => s.points || 0);
      case "rebounds":
        return stats.map(s => s.rebounds || 0);
      case "assists":
        return stats.map(s => s.assists || 0);
      case "pra":
        return stats.map(s => (s.points || 0) + (s.rebounds || 0) + (s.assists || 0));
      default:
        return [];
    }
  };

  const statArr = getStatArray();

  // 🔥 AUTO SET LINE FROM PROPS
  useEffect(() => {
    const prop = props.find(p => p.market_key?.includes(selectedStat));
    if (prop) setLineValue(prop.line);
  }, [selectedStat, props]);

  // 🔥 AVERAGES
  const avg = (arr: number[], n: number) => {
    const slice = arr.slice(0, n);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  };

  const rolling = [
    { label: "L5", value: avg(statArr, 5) },
    { label: "L10", value: avg(statArr, 10) },
    { label: "L15", value: avg(statArr, 15) },
    { label: "L20", value: avg(statArr, 20) },
  ];

  const maxStat = Math.max(...statArr, 1);
  const minStat = Math.min(...statArr, 0);

  const recentGames = stats.slice(0, 15);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {/* BACK */}
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* PLAYER HEADER */}
        <div className="bg-card p-6 rounded-xl mb-6">
          <h1 className="text-2xl font-bold">{player.full_name}</h1>
          <p className="text-muted-foreground">{player.position}</p>
        </div>

        {/* STAT SELECTOR */}
        <div className="flex gap-2 mb-4">
          {["points", "rebounds", "assists", "pra"].map(stat => (
            <button
              key={stat}
              onClick={() => setSelectedStat(stat)}
              className={`px-3 py-1 rounded ${
                selectedStat === stat ? "bg-primary text-white" : "bg-secondary"
              }`}
            >
              {stat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* LINE SLIDER */}
        <div className="mb-6">
          <label className="text-sm">Adjust Line: {lineValue.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max={maxStat + 10}
            value={lineValue}
            onChange={(e) => setLineValue(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* BAR GRAPH */}
        <div className="bg-card p-6 rounded-xl mb-6">
          <h2 className="font-bold mb-4">Performance vs Line</h2>

          {rolling.map((item, i) => {
            const percent = (item.value / maxStat) * 100;

            return (
              <div key={i} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span>{item.value.toFixed(1)}</span>
                </div>

                <div className="w-full bg-muted h-6 rounded relative">
                  <div
                    className={`h-6 rounded ${
                      item.value > lineValue ? "bg-green-500" : "bg-red-500"
                    }`}
                    style={{ width: `${percent}%` }}
                  />

                  {/* LINE MARKER */}
                  <div
                    className="absolute top-0 h-6 w-[2px] bg-yellow-400"
                    style={{ left: `${(lineValue / maxStat) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* MAX / MIN */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground">Max</div>
            <div className="text-xl font-bold">{maxStat}</div>
          </div>
          <div className="bg-secondary p-4 rounded">
            <div className="text-xs text-muted-foreground">Min</div>
            <div className="text-xl font-bold">{minStat}</div>
          </div>
        </div>

        {/* PROPS TABLE */}
        <div className="bg-card rounded-xl overflow-hidden mb-6">
          <div className="p-4 border-b">Props</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="p-2 text-left">Market</th>
                <th>Line</th>
                <th>Over</th>
                <th>Under</th>
              </tr>
            </thead>
            <tbody>
              {props.map((p: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{p.market_label}</td>
                  <td>{p.line}</td>
                  <td>{p.over_odds}</td>
                  <td>{p.under_odds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GAME LOGS */}
        <div className="bg-card rounded-xl overflow-hidden">
          <div className="p-4 border-b">Last 15 Games</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th>Date</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((g: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{new Date(g.game_date).toLocaleDateString()}</td>
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
