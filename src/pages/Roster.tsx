// src/pages/Roster.tsx
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Loader2 } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const sportDisplayMap = {
  nba: "NBA",
  nfl: "NFL",
  mlb: "MLB",
  nhl: "NHL",
  soccer: "Soccer",
};

export default function Roster() {
  const [sport, setSport] = useState<"nba" | "nfl" | "mlb" | "nhl" | "soccer">("nba");
  const [teams, setTeams] = useState<{ team: string; players: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoster = async () => {
      setLoading(true);
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_players", sport }),
        });
        const data = await res.json();
        if (data.success && data.players) {
          // Group by team name
          const grouped = new Map<string, any[]>();
          data.players.forEach((p: any) => {
            const teamKey = p.team || "Unknown";
            if (!grouped.has(teamKey)) grouped.set(teamKey, []);
            grouped.get(teamKey)!.push(p);
          });
          const sortedTeams = Array.from(grouped.entries())
            .map(([team, players]) => ({ team, players }))
            .sort((a, b) => a.team.localeCompare(b.team));
          setTeams(sortedTeams);
        } else {
          setTeams([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoster();
  }, [sport]);

  const getPlayerClass = (player: any) => {
    const status = player.status?.toLowerCase();
    if (status === "out" || status === "injured") {
      return "bg-red-500/10 border-red-500/30 text-red-400";
    }
    if (player.is_starter) {
      return "bg-green-500/10 border-green-500/30 text-green-400";
    }
    return "bg-gray-800/50 border-gray-700 text-gray-400";
  };

  const getStatusBadge = (player: any) => {
    if (player.status === "out" || player.status === "injured") {
      return <span className="text-xs bg-red-500/20 px-1.5 py-0.5 rounded">OUT</span>;
    }
    if (player.is_starter) {
      return <span className="text-xs bg-green-500/20 px-1.5 py-0.5 rounded">STARTER</span>;
    }
    return <span className="text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">BENCH</span>;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <SportTabs
            activeSport={sportDisplayMap[sport] as any}
            onSportChange={(s) => setSport(sportDbMap[s] as any)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map(({ team, players }) => (
              <div key={team} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                  <h2 className="text-lg font-bold text-foreground">{team}</h2>
                  <p className="text-xs text-muted-foreground">{players.length} players</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={`p-3 rounded-lg border ${getPlayerClass(player)} transition-all hover:scale-[1.02]`}
                    >
                      <div className="font-medium text-sm">{player.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs opacity-75">{player.position || "N/A"}</span>
                        {getStatusBadge(player)}
                      </div>
                      {player.injury_description && (
                        <div className="text-xs text-red-300 mt-2 truncate">
                          🏥 {player.injury_description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="text-center text-muted-foreground py-16">No players found for this sport.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Helper to map display sport to DB sport
const sportDbMap: Record<string, string> = {
  NBA: "nba",
  NFL: "nfl",
  MLB: "mlb",
  NHL: "nhl",
  Soccer: "soccer",
};
