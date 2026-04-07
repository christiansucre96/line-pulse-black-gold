import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Loader2, Trophy } from "lucide-react";

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
        console.error("Error fetching picks:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPicks();
  }, [sport]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Top Picks
          </h1>
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
              <div key={idx} className="bg-card border border-border rounded-xl p-4 hover:shadow-lg transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{pick.player_name}</h3>
                    <p className="text-xs text-muted-foreground">{pick.team} vs {pick.opponent}</p>
                  </div>
                  <div className={`text-xl font-bold ${pick.pick_type === 'OVER' ? 'text-green-400' : 'text-red-400'}`}>
                    {pick.pick_type} {pick.line}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Projection</div>
                    <div className="font-semibold">{pick.projection?.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Edge</div>
                    <div className={`font-semibold ${pick.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pick.edge > 0 ? '+' : ''}{pick.edge}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Confidence</div>
                    <div className="font-semibold">{pick.confidence}%</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {pick.reasoning}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
