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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_player_details", player_id: playerId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (data.success) {
          setPlayer(data.player);
        } else {
          setError(data.error || "Failed to load player details");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [playerId]);

  if (loading) return <DashboardLayout><div className="flex justify-center py-16">Loading player details...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="text-center py-16 text-red-400">Error: {error}</div></DashboardLayout>;
  if (!player) return <DashboardLayout><div className="text-center py-16">Player not found</div></DashboardLayout>;

  const props = player.props || [];
  const stakeProps = props.filter((p: any) => p.bookmaker === "Stake");
  const betonlineProps = props.filter((p: any) => p.bookmaker === "BetOnline");
  const uniqueMarkets = Array.from(new Set(props.map((p: any) => p.market_type)));

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Scanner
        </button>

        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-foreground">{player.full_name}</h1>
          <p className="text-muted-foreground">{player.position || "N/A"} • {player.teams?.name || "Unknown Team"}</p>
          {player.injury_description && <p className="text-red-400 text-sm mt-2">Injury: {player.injury_description}</p>}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border">
            <h2 className="font-bold text-foreground">All Available Props</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4">Market</th>
                  <th className="text-left py-3 px-4">Stake Line</th>
                  <th className="text-left py-3 px-4">Stake Odds</th>
                  <th className="text-left py-3 px-4">BetOnline Line</th>
                  <th className="text-left py-3 px-4">BetOnline Odds</th>
                </tr>
              </thead>
              <tbody>
                {uniqueMarkets.map(market => {
                  const stake = stakeProps.find(p => p.market_type === market);
                  const betonline = betonlineProps.find(p => p.market_type === market);
                  const displayName = market.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase();
                  return (
                    <tr key={market} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-3 px-4 font-medium">{displayName}</td>
                      <td className="py-3 px-4">{stake?.line ?? "—"}</td>
                      <td className="py-3 px-4">{stake?.odds ?? "—"}</td>
                      <td className="py-3 px-4">{betonline?.line ?? "—"}</td>
                      <td className="py-3 px-4">{betonline?.odds ?? "—"}</td>
                    </tr>
                  );
                })}
                {uniqueMarkets.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No props available for this player</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
