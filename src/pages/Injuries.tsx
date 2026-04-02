import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Sport } from "@/data/mockPlayers";
import { AlertTriangle, Search, Loader2 } from "lucide-react";
import { useInjuryData, LiveInjury } from "@/hooks/useLiveData";

// Hardcoded fallback for when DB is empty
const fallbackInjuries: Record<Sport, LiveInjury[]> = {
  NBA: [
    { id: "i1", name: "Kawhi Leonard", team: "LAC", position: "F", initials: "KL", status: "Out", injury: "Knee inflammation", updated: "Mar 30", sport: "NBA" },
    { id: "i2", name: "Zion Williamson", team: "NOP", position: "F", initials: "ZW", status: "Day-to-Day", injury: "Hamstring tightness", updated: "Mar 30", sport: "NBA" },
    { id: "i3", name: "Joel Embiid", team: "PHI", position: "C", initials: "JE", status: "Out", injury: "Knee management", updated: "Mar 29", sport: "NBA" },
  ],
  MLB: [], NHL: [], Soccer: [], NFL: [],
};

const statusColors: Record<string, string> = {
  Out: "bg-red-500/20 text-red-400 border-red-500/30",
  Doubtful: "bg-red-500/10 text-red-300 border-red-500/20",
  Questionable: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Day-to-Day": "bg-primary/15 text-primary border-primary/30",
  IR: "bg-red-500/25 text-red-400 border-red-500/40",
  active: "bg-green-500/15 text-green-400 border-green-500/30",
};

export default function Injuries() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");

  const { data: liveInjuries, isLoading } = useInjuryData(sport);

  const injuries = useMemo(() => {
    const data = (liveInjuries && liveInjuries.length > 0) ? liveInjuries : (fallbackInjuries[sport] || []);
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((e) => e.name.toLowerCase().includes(q) || e.team.toLowerCase().includes(q));
  }, [liveInjuries, sport, search]);

  const isLive = liveInjuries && liveInjuries.length > 0;

  const statusGroups = useMemo(() => {
    const groups: Record<string, LiveInjury[]> = {};
    injuries.forEach((e) => {
      if (!groups[e.status]) groups[e.status] = [];
      groups[e.status].push(e);
    });
    return groups;
  }, [injuries]);

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">INJURY REPORT</h1>
            <p className="text-xs text-muted-foreground">
              Track injuries affecting your bets
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

      <div className="px-6 pt-4 flex gap-3 flex-wrap">
        {Object.entries(statusGroups).map(([status, entries]) => (
          <div key={status} className={`px-4 py-2 rounded-lg border ${statusColors[status] || "bg-secondary text-muted-foreground border-border"}`}>
            <div className="font-display font-bold text-lg">{entries.length}</div>
            <div className="text-xs">{status}</div>
          </div>
        ))}
        <div className="px-4 py-2 rounded-lg border border-border bg-secondary text-muted-foreground">
          <div className="font-display font-bold text-lg">{injuries.length}</div>
          <div className="text-xs">Total</div>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4 font-semibold">Player</th>
                  <th className="text-left py-3 px-4 font-semibold">Team</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Injury</th>
                  <th className="text-right py-3 px-4 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {injuries.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400">
                          {e.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{e.name}</div>
                          <div className="text-xs text-muted-foreground">{e.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-secondary text-secondary-foreground">{e.team}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[e.status] || "bg-secondary text-muted-foreground border-border"}`}>
                        <AlertTriangle size={12} className="inline mr-1" />
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{e.injury}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground text-xs">{e.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {injuries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No injuries reported for {sport}.</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
