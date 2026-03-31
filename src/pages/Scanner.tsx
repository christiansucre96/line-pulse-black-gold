import { useState, useMemo } from "react";
import { Search, BarChart3 } from "lucide-react";
import { SportTabs } from "@/components/SportTabs";
import { StatFilters } from "@/components/StatFilters";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { DashboardLayout } from "@/components/DashboardLayout";
import { mockPlayers, Sport, sportCategories } from "@/data/mockPlayers";

export default function Scanner() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");
  const [activeStats, setActiveStats] = useState<string[]>(sportCategories["NBA"].core.slice(0, 4));
  const [sortField, setSortField] = useState<SortField>("diff");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const handleSportChange = (s: Sport) => {
    setSport(s);
    setActiveStats(sportCategories[s].core.slice(0, 4));
    setSearch("");
  };

  const toggleStat = (stat: string) => {
    setActiveStats((prev) => prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const filteredPlayers = useMemo(() => {
    let players = mockPlayers.filter((p) => p.sport === sport);
    if (search) players = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (activeStats.length > 0) {
      players = players.filter((p) => p.categories.some((c) => activeStats.includes(c)));
    }
    players.sort((a, b) => {
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return players;
  }, [sport, search, activeStats, sortField, sortDir]);

  if (selectedPlayer) {
    return (
      <DashboardLayout>
        <PlayerDetailView playerId={selectedPlayer} onBack={() => setSelectedPlayer(null)} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Welcome to</p>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">LINE PULSE</h1>
            <p className="text-xs text-green-400">● LIVE</p>
          </div>
          <SportTabs activeSport={sport} onSportChange={handleSportChange} />
        </div>
      </header>

      <div className="px-6 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search player by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {sortDir === "desc" ? "↓ Highest First" : "↑ Lowest First"}
          </button>
        </div>
        <StatFilters activeStats={activeStats} onToggleStat={toggleStat} sport={sport} />
      </div>

      <div className="px-6 pb-8">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <PlayerTable
            players={filteredPlayers}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onPlayerClick={setSelectedPlayer}
          />
        </div>
        <div className="text-center text-sm text-muted-foreground mt-4">
          Showing {filteredPlayers.length} results
        </div>
      </div>
    </DashboardLayout>
  );
}
