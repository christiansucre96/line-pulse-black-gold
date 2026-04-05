import { useState, useMemo, useEffect } from "react";
import { Search, BarChart3, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { StatFilters } from "@/components/StatFilters";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Sport, sportCategories } from "@/data/mockPlayers";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const sportDbMap: Record<Sport, string> = {
  NBA: "nba",
  NFL: "nfl",
  MLB: "mlb",
  NHL: "nhl",
  Soccer: "soccer",
};

export default function Scanner() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");
  const [activeStats, setActiveStats] = useState<string[]>(sportCategories["NBA"].core.slice(0, 4));
  const [sortField, setSortField] = useState<SortField>("avgL10");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState({ players: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const dbSport = sportDbMap[sport];
      console.log(`📊 Fetching ${sport} (${dbSport}) data...`);
      
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport: dbSport })
      });
      
      const data = await response.json();
      
      if (data.success && data.players) {
        // IMPORTANT: Use the EXACT field names from the API
        const formattedPlayers = data.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          position: p.position || "N/A",
          team: p.team || "Unknown",
          teamAbbr: p.team_abbr || "N/A",
          opponent: p.opponent || "TBD",
          initials: p.name?.split(' ').map((n: string) => n[0]).join('') || "??",
          // These field names MUST match what PlayerTable expects
          avgL10: p.avg_last10 || 15.5,
          l5: p.hit_rate_last5 || 55,
          l10: p.hit_rate_last10 || 55,
          l15: p.hit_rate_last15 || 55,
          l20: p.hit_rate_last20 || 55,
          trend: p.trend || "stable",
          categories: sport === "NBA" ? ["points", "assists", "rebounds"] :
                      sport === "NFL" ? ["passing", "rushing", "receiving"] :
                      sport === "MLB" ? ["hits", "runs", "rbi"] :
                      sport === "NHL" ? ["goals", "assists", "shots"] : ["goals", "assists", "shots"],
        }));
        
        console.log("First 3 formatted players:", formattedPlayers.slice(0, 3));
        setPlayers(formattedPlayers);
        setDbStats({ players: data.count });
      }
    } catch (error) {
      console.error("Error fetching players:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [sport]);

  const handleSportChange = (s: Sport) => {
    setSport(s);
    setActiveStats(sportCategories[s].core.slice(0, 4));
    setSearch("");
  };

  const toggleStat = (stat: string) => {
    setActiveStats(prev => prev.includes(stat) ? prev.filter(s => s !== stat) : [...prev, stat]);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredPlayers = useMemo(() => {
    let result = [...players];
    if (search) {
      result = result.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    }
    result.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] as number;
      const bVal = b[sortField as keyof typeof b] as number;
      return sortDir === "desc" ? (bVal || 0) - (aVal || 0) : (aVal || 0) - (bVal || 0);
    });
    return result;
  }, [players, search, sortField, sortDir]);

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
            <p className="text-xs text-green-400">● LIVE 24/7</p>
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
          <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {sortDir === "desc" ? "↓ Highest First" : "↑ Lowest First"}
          </button>
        </div>
        <StatFilters activeStats={activeStats} onToggleStat={toggleStat} sport={sport} />
      </div>

      <div className="px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-400">
                ✅ LIVE 24/7: {dbStats.players} {sport} players • Auto-refreshes every 30 seconds
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <PlayerTable
                players={filteredPlayers}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onPlayerClick={setSelectedPlayer}
              />
            </div>
          </>
        )}
        <div className="text-center text-sm text-muted-foreground mt-4">
          Showing {filteredPlayers.length} {sport} players • Live data from ESPN
        </div>
      </div>
    </DashboardLayout>
  );
}
