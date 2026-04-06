import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Loader2, AlertTriangle } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const sportDisplayMap: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  mlb: "MLB",
  nhl: "NHL",
  soccer: "Soccer",
};

const sportDbMap: Record<string, string> = {
  NBA: "nba",
  NFL: "nfl",
  MLB: "mlb",
  NHL: "nhl",
  Soccer: "soccer",
};

export default function Injuries() {
  const [sport, setSport] = useState<"nba" | "nfl" | "mlb" | "nhl" | "soccer">("nba");
  const [injuredPlayers, setInjuredPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInjuries = async () => {
      setLoading(true);
      try {
        // ✅ ADD mode: "all" to get all players (including those without upcoming games)
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_players", sport, mode: "all" }),
        });
        const data = await res.json();
        if (data.success && data.players) {
          const injured = data.players.filter(
            (p: any) => p.status === "out" || p.status === "injured" || p.status === "questionable"
          );
          setInjuredPlayers(injured);
        } else {
          setInjuredPlayers([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInjuries();
  }, [sport]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <SportTabs
            activeSport={sportDisplayMap[sport] as any}
            onSportChange={(s) => setSport(sportDbMap[s] as any)}
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-foreground">Injury Report – {sport.toUpperCase()}</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : injuredPlayers.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">No injured players reported for this sport.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Player</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Team</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Position</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Injury Details</th>
                  </tr>
                </thead>
                <tbody>
                  {injuredPlayers.map((player) => (
                    <tr key={player.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-3 px-4 font-medium text-foreground">{player.name}</td>
                      <td className="py-3 px-4">{player.team || "N/A"}</td>
                      <td className="py-3 px-4">{player.position || "N/A"}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                          {player.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{player.injury_description || "Unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
