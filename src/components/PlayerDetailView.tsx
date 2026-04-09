import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBookmaker, setSelectedBookmaker] = useState("Stake");

  useEffect(() => {
    const fetchPlayerDetails = async () => {
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
    fetchPlayerDetails();
  }, [playerId]);

  if (loading) return <div className="flex justify-center py-16">Loading player details...</div>;
  if (!player) return <div className="text-center py-16">Player not found</div>;

  const averages = player.player_averages || {};
  const props = player.props || [];

  // Group props by market type
  const propsByMarket = props.reduce((acc: any, prop: any) => {
    if (!acc[prop.market_type]) acc[prop.market_type] = [];
    acc[prop.market_type].push(prop);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Scanner
      </button>

      {/* Player Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{player.full_name}</h1>
            <p className="text-muted-foreground">{player.position} • {player.teams?.name}</p>
          </div>
          <div className="flex gap-2">
            {["Stake", "BetOnline"].map(book => (
              <button
                key={book}
                onClick={() => setSelectedBookmaker(book)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  selectedBookmaker === book
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {book}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Points</div>
          <div className="text-2xl font-bold">{averages.last10_avg_points?.toFixed(1) || "N/A"}</div>
          <div className="text-xs text-muted-foreground">Last 10 games</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Rebounds</div>
          <div className="text-2xl font-bold">{averages.last10_avg_rebounds?.toFixed(1) || "N/A"}</div>
          <div className="text-xs text-muted-foreground">Last 10 games</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Assists</div>
          <div className="text-2xl font-bold">{averages.last10_avg_assists?.toFixed(1) || "N/A"}</div>
          <div className="text-xs text-muted-foreground">Last 10 games</div>
        </div>
      </div>

      {/* Player Props Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-secondary/30 border-b border-border">
          <h2 className="font-bold text-foreground">Available Props – {selectedBookmaker}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Prop Type</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Line</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Odds</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {props.filter(p => p.bookmaker === selectedBookmaker).map((prop: any, idx: number) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="py-3 px-4 font-medium">{prop.market_type.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase()}</td>
                  <td className="py-3 px-4">{prop.line}</td>
                  <td className="py-3 px-4">{prop.odds || "N/A"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{new Date(prop.last_updated).toLocaleString()}</td>
                </tr>
              ))}
              {props.filter(p => p.bookmaker === selectedBookmaker).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No props available for this player at {selectedBookmaker}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
