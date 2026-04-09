import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        else setError(data.error);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [playerId]);

  if (loading) return <DashboardLayout><div className="flex justify-center py-16">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="text-center py-16 text-red-400">{error}</div></DashboardLayout>;
  if (!player) return <DashboardLayout><div className="text-center py-16">Player not found</div></DashboardLayout>;

  const props = player.props || [];
  const stats = player.stats || [];
  const stakeProps = props.filter(p => p.bookmaker === "Stake");
  const betonlineProps = props.filter(p => p.bookmaker === "BetOnline");
  const uniqueMarkets = [...new Set(props.map(p => p.market_type))];

  // Calculate rolling averages (last 5,10,15,20)
  const pointsArr = stats.map(s => s.points).filter(v => v);
  const avg = (arr: number[], n: number) => {
    const slice = arr.slice(0, n);
    return slice.length ? (slice.reduce((a,b) => a+b,0) / slice.length).toFixed(1) : "N/A";
  };
  const last5 = avg(pointsArr, 5);
  const last10 = avg(pointsArr, 10);
  const last15 = avg(pointsArr, 15);
  const last20 = avg(pointsArr, 20);

  // For bar graph: we'll show bars for last 5,10,15,20 compared to a line (e.g., the current prop line)
  // We'll take the first available prop line from Stake as the reference
  const sampleProp = stakeProps[0] || betonlineProps[0];
  const lineValue = sampleProp?.line || 0;

  const getBarColor = (avgValue: number, line: number) => {
    if (avgValue > line) return "bg-green-500";
    if (avgValue < line) return "bg-red-500";
    return "bg-yellow-500";
  };

  const formatMarket = (m: string) => m.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase();

  // Game logs table
  const recentGames = stats.slice(0, 15);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold">{player.full_name}</h1>
          <p className="text-muted-foreground">{player.position} • {player.teams?.name}</p>
          {player.injury_description && <p className="text-red-400 text-sm mt-2">Injury: {player.injury_description}</p>}
        </div>

        {/* Bar Graph Section */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Rolling Averages (Points) vs Line</h2>
          <div className="space-y-4">
            {[
              { label: "Last 5 Games", value: parseFloat(last5 as string) },
              { label: "Last 10 Games", value: parseFloat(last10 as string) },
              { label: "Last 15 Games", value: parseFloat(last15 as string) },
              { label: "Last 20 Games", value: parseFloat(last20 as string) },
            ].map((item, idx) => {
              const avgVal = item.value;
              if (isNaN(avgVal)) return null;
              const percent = Math.min(100, (avgVal / lineValue) * 100);
              return (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span>{avgVal.toFixed(1)} vs line {lineValue}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-6 relative">
                    <div
                      className={`h-6 rounded-full ${getBarColor(avgVal, lineValue)}`}
                      style={{ width: `${percent}%` }}
                    />
                    <div className="absolute top-0 left-0 h-full w-full flex items-center justify-center text-xs font-bold text-white">
                      {avgVal > lineValue ? "OVER" : avgVal < lineValue ? "UNDER" : "PUSH"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Props Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border">
            <h2 className="font-bold text-foreground">All Available Props (Stake / BetOnline)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4">Market</th><th>Stake Line</th><th>Stake Odds</th><th>BetOnline Line</th><th>BetOnline Odds</th>
              </tr></thead>
              <tbody>
                {uniqueMarkets.map(market => {
                  const stake = stakeProps.find(p => p.market_type === market);
                  const betonline = betonlineProps.find(p => p.market_type === market);
                  return (
                    <tr key={market} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-3 px-4 font-medium">{formatMarket(market)}</td>
                      <td className="py-3 px-4">{stake?.line ?? "—"}</td>
                      <td className="py-3 px-4">{stake?.odds ?? "—"}</td>
                      <td className="py-3 px-4">{betonline?.line ?? "—"}</td>
                      <td className="py-3 px-4">{betonline?.odds ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Game Logs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border">
            <h2 className="font-bold text-foreground">Game Logs (Last 15 Games)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/30">
                <th>Date</th><th>PTS</th><th>REB</th><th>AST</th><th>MIN</th>
              </tr></thead>
              <tbody>
                {recentGames.map((g, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="py-2 px-4">{new Date(g.game_date).toLocaleDateString()}</td>
                    <td className="py-2 px-4">{g.points}</td>
                    <td className="py-2 px-4">{g.rebounds}</td>
                    <td className="py-2 px-4">{g.assists}</td>
                    <td className="py-2 px-4">{g.minutes}</td>
                  </tr>
                ))}
                {recentGames.length === 0 && <tr><td colSpan={5} className="text-center py-4">No game logs available</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
