import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Sport, mockPlayers } from "@/data/mockPlayers";
import { Search, Loader2 } from "lucide-react";
import { useRosterData } from "@/hooks/useLiveData";

export default function Roster() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");

  const { data: liveRoster, isLoading } = useRosterData(sport);

  // Fallback to mock data
  const teams = useMemo(() => {
    if (liveRoster && Object.keys(liveRoster).length > 0) return liveRoster;
    const players = mockPlayers.filter((p) => p.sport === sport);
    const grouped: Record<string, any[]> = {};
    players.forEach((p) => {
      if (!grouped[p.team]) grouped[p.team] = [];
      grouped[p.team].push({ id: p.id, name: p.name, position: p.position, team: p.team, initials: p.initials, sport: p.sport });
    });
    return grouped;
  }, [liveRoster, sport]);

  const isLive = liveRoster && Object.keys(liveRoster).length > 0;

  const filteredTeams = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    const result: Record<string, any[]> = {};
    Object.entries(teams).forEach(([team, players]) => {
      const filtered = players.filter(
        (p: any) => p.name.toLowerCase().includes(q) || team.toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[team] = filtered;
    });
    return result;
  }, [teams, search]);

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">ROSTERS</h1>
            <p className="text-xs text-muted-foreground">
              Players grouped by team
              {isLive && <span className="ml-2 text-green-400">● Live Data</span>}
            </p>
          </div>
          <SportTabs activeSport={sport} onSportChange={(s) => { setSport(s); setSearch(""); }} />
        </div>
      </header>

      <div className="px-6 pt-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {Object.entries(filteredTeams).map(([team, players]) => (
              <div key={team} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-gold flex items-center justify-center font-display font-bold text-sm text-primary-foreground">
                    {team.slice(0, 3)}
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-foreground tracking-wider">{team}</h2>
                    <p className="text-xs text-muted-foreground">{players.length} player{players.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {players.map((p: any) => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                          {p.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.position}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(filteredTeams).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No teams or players match your search.</div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
