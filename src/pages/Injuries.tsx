import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Sport } from "@/data/mockPlayers";
import { AlertTriangle, Search } from "lucide-react";

interface InjuryEntry {
  id: string;
  name: string;
  team: string;
  position: string;
  initials: string;
  status: "Out" | "Doubtful" | "Questionable" | "Day-to-Day" | "IR";
  injury: string;
  updated: string;
}

// Mock injury data per sport
const injuryData: Record<Sport, InjuryEntry[]> = {
  NBA: [
    { id: "i1", name: "Kawhi Leonard", team: "LAC", position: "F", initials: "KL", status: "Out", injury: "Knee inflammation", updated: "Mar 30" },
    { id: "i2", name: "Zion Williamson", team: "NOP", position: "F", initials: "ZW", status: "Day-to-Day", injury: "Hamstring tightness", updated: "Mar 30" },
    { id: "i3", name: "Damian Lillard", team: "MIL", position: "G", initials: "DL", status: "Questionable", injury: "Calf strain", updated: "Mar 29" },
    { id: "i4", name: "Joel Embiid", team: "PHI", position: "C", initials: "JE", status: "Out", injury: "Knee management", updated: "Mar 29" },
    { id: "i5", name: "Chet Holmgren", team: "OKC", position: "C", initials: "CH", status: "IR", injury: "Hip fracture", updated: "Mar 28" },
    { id: "i6", name: "Tyrese Maxey", team: "PHI", position: "G", initials: "TM", status: "Day-to-Day", injury: "Finger injury", updated: "Mar 30" },
    { id: "i7", name: "Jimmy Butler", team: "MIA", position: "F", initials: "JB", status: "Questionable", injury: "Ankle sprain", updated: "Mar 29" },
    { id: "i8", name: "Paolo Banchero", team: "ORL", position: "F", initials: "PB", status: "Out", injury: "Oblique tear", updated: "Mar 27" },
  ],
  MLB: [
    { id: "mi1", name: "Mike Trout", team: "LAA", position: "CF", initials: "MT", status: "IR", injury: "Knee surgery", updated: "Mar 28" },
    { id: "mi2", name: "Jacob deGrom", team: "TEX", position: "SP", initials: "JD", status: "IR", injury: "Tommy John recovery", updated: "Mar 25" },
    { id: "mi3", name: "Fernando Tatis Jr.", team: "SD", position: "RF", initials: "FT", status: "Day-to-Day", injury: "Quad tightness", updated: "Mar 30" },
    { id: "mi4", name: "Carlos Correa", team: "MIN", position: "SS", initials: "CC", status: "Questionable", injury: "Plantar fasciitis", updated: "Mar 29" },
  ],
  NHL: [
    { id: "hi1", name: "Carey Price", team: "MTL", position: "G", initials: "CP", status: "IR", injury: "Knee recovery", updated: "Mar 25" },
    { id: "hi2", name: "Gabriel Landeskog", team: "COL", position: "LW", initials: "GL", status: "IR", injury: "Knee surgery", updated: "Mar 20" },
    { id: "hi3", name: "Kaapo Kakko", team: "NYR", position: "RW", initials: "KK", status: "Day-to-Day", injury: "Upper body", updated: "Mar 30" },
  ],
  Soccer: [
    { id: "si1", name: "Thibaut Courtois", team: "RMA", position: "GK", initials: "TC", status: "Questionable", injury: "ACL recovery", updated: "Mar 28" },
    { id: "si2", name: "Diogo Jota", team: "LIV", position: "FW", initials: "DJ", status: "Out", injury: "Knee injury", updated: "Mar 27" },
    { id: "si3", name: "Lisandro Martinez", team: "MUN", position: "CB", initials: "LM", status: "Day-to-Day", injury: "Muscular issue", updated: "Mar 30" },
  ],
  NFL: [
    { id: "fi1", name: "Aaron Rodgers", team: "NYJ", position: "QB", initials: "AR", status: "IR", injury: "Achilles", updated: "Mar 15" },
    { id: "fi2", name: "Nick Chubb", team: "CLE", position: "RB", initials: "NC", status: "IR", injury: "Knee reconstruction", updated: "Mar 10" },
    { id: "fi3", name: "Joe Burrow", team: "CIN", position: "QB", initials: "JB", status: "Out", injury: "Wrist surgery", updated: "Mar 20" },
    { id: "fi4", name: "Kirk Cousins", team: "ATL", position: "QB", initials: "KC", status: "Questionable", injury: "Achilles recovery", updated: "Mar 28" },
  ],
};

const statusColors: Record<string, string> = {
  Out: "bg-red-500/20 text-red-400 border-red-500/30",
  Doubtful: "bg-red-500/10 text-red-300 border-red-500/20",
  Questionable: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Day-to-Day": "bg-primary/15 text-primary border-primary/30",
  IR: "bg-red-500/25 text-red-400 border-red-500/40",
};

export default function Injuries() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");

  const injuries = useMemo(() => {
    const data = injuryData[sport] || [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((e) => e.name.toLowerCase().includes(q) || e.team.toLowerCase().includes(q));
  }, [sport, search]);

  const statusGroups = useMemo(() => {
    const groups: Record<string, InjuryEntry[]> = {};
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
            <p className="text-xs text-muted-foreground">Track injuries affecting your bets</p>
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

      {/* Summary cards */}
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[e.status] || ""}`}>
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
      </div>
    </DashboardLayout>
  );
}
