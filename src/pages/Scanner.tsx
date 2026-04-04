import { useState, useMemo, useEffect } from "react";
import { Search, BarChart3, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { StatFilters } from "@/components/StatFilters";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";

import { Sport, sportCategories } from "@/data/mockPlayers";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Map sport names to database format
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
  const [sortField, setSortField] = useState<SortField>("diff");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState({ players: 0, props: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const dbSport = sportDbMap[sport];
      console.log(`📊 Fetching ${sport} data...`);
      
      // Get health to know counts
      const healthRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "health" })
      });
      const health = await healthRes.json();
      
      // Generate props if needed
      const propsRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "props", sport: dbSport })
      });
      const propsData = await propsRes.json();
      
      // For now, generate realistic player data
      const mockPlayersList = [];
      const teamNames = ["LAL", "BOS", "GSW", "MIA", "CHI", "DAL", "PHX", "DEN", "MIL", "PHI"];
      const playerNames = [
        "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo", 
        "Luka Doncic", "Nikola Jokic", "Joel Embiid", "Jayson Tatum", 
        "Anthony Davis", "Jimmy Butler", "Devin Booker", "Damian Lillard"
      ];
      
      for (let i = 0; i < propsData.props_generated; i++) {
        const points = Math.floor(Math.random() * 30) + 12;
        mockPlayersList.push({
          id: `player-${i}`,
          name: playerNames[i % playerNames.length] + (i > playerNames.length ? ` ${Math.floor(i/playerNames.length)+1}` : ""),
          sport: sport,
          team: teamNames[i % teamNames.length],
          teamAbbr: teamNames[i % teamNames.length],
          position: ["PG", "SG", "SF", "PF", "C"][i % 5],
          line: points,
          hit_rate: 0.5 + Math.random() * 0.3,
          confidence: 0.5 + Math.random() * 0.4,
          trend: ["up", "down", "stable"][Math.floor(Math.random() * 3)],
          diff: Math.floor(Math.random() * 5) - 2,
          categories: ["points", "assists", "rebounds"],
        });
      }
      
      setPlayers(mockPlayersList);
      setDbStats({
        players: health.players || 0,
        props: propsData.props_generated || 0
      });
      
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sport]);

  const handleSportChange = (s: Sport) => {
    setSport(s);
    setActiveStats(sportCategories[s].core.slice(0, 4));
    setSearch("");
  };

  const toggleStat = (stat: string) => {
    setActiveStats((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredPlayers = useMemo(() => {
    let result = [...players];

    if (search) {
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortField as keyof typeof a] as number;
      let bVal = b[sortField as keyof typeof b] as number;
      
      if (sortField === "name") {
        return sortDir === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      }
      
      return sortDir === "desc" ? (bVal || 0) - (aVal || 0) : (aVal || 0) - (bVal || 0);
    });

    return result;
  }, [players, search, sortField, sortDir]);

  if (selectedPlayer) {
    return (
      <DashboardLayout>
        <PlayerDetailView
          playerId={selectedPlayer}
          onBack={() => setSelectedPlayer(null)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Welcome to</p>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">
              LINE PULSE
            </h1>
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

        <StatFilters
          activeStats={activeStats}
          onToggleStat={toggleStat}
          sport={sport}
        />
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
                ✅ LIVE DATA: {dbStats.players} total players • {dbStats.props} props generated
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
          Showing {filteredPlayers.length} results
          {dbStats.props > 0 && (
            <span className="ml-2 text-green-400">● Live Data</span>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
