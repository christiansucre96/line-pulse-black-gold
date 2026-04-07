import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Loader2, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export default function TopPicks() {
  const [sport, setSport] = useState("NBA");
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPicks = async () => {
      setLoading(true);
      try {
        const response = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            operation: "get_top_picks", 
            sport: sport.toLowerCase() 
          })
        });
        const data = await response.json();
        setPicks(data.picks || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPicks();
  }, [sport]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (confidence >= 70) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (confidence >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Top Picks
          </h1>
          <p className="text-muted-foreground">AI-generated betting recommendations based on real-time data</p>
        </div>

        <div className="mb-6">
          <SportTabs activeSport={sport} onSportChange={setSport} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : picks.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            No picks available for this sport. Check back when games are scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {picks.map((pick, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-4 transition-all hover:scale-[1.02] ${getConfidenceColor(pick.confidence)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{pick.player_name}</h3>
                    <p className="text-xs opacity-75">{pick.team} vs {pick.opponent}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${pick.pick_type === 'OVER' ? 'text-green-400' : 'text-red-400'}`}>
                      {pick.pick_type} {pick.line}
                    </div>
                    <div className="text-xs opacity-75">{pick.bookmaker}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-current/20">
                  <div>
                    <div className="text-xs opacity-75">Projection</div>
                    <div className="font-semibold">{pick.projection.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Edge</div>
                    <div className={`font-semibold ${pick.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pick.edge > 0 ? '+' : ''}{pick.edge}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75">Confidence</div>
                    <div className="font-semibold">{pick.confidence}%</div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-xs border-t border-current/20">
                  <span className="opacity-75">📊 {pick.reasoning}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
