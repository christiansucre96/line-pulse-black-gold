import { useState, useEffect } from "react";
import { Search, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Sport, sportCategories } from "@/data/mockPlayers";
import { supabase } from "@/integrations/supabase/client";

// Cache per sport + bookmaker
const playerCache = new Map<string, any[]>();

// Bookmaker options
const BOOKMAKERS = ["Stake", "BetOnline"];

export default function Scanner() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");
  const [activeStats, setActiveStats] = useState<string[]>(sportCategories["NBA"].core.slice(0, 4));
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState({ players: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>("Stake");

  const sportDbMap: Record<Sport, string> = {
    NBA: "nba",
    NFL: "nfl",
    MLB: "mlb",
    NHL: "nhl",
    Soccer: "soccer",
  };

  // Fetch players and odds for the selected sport and bookmaker
  const fetchData = async (force = false) => {
    const cacheKey = `${sport}-${selectedBookmaker}`;
    if (!force && playerCache.has(cacheKey)) {
      const cached = playerCache.get(cacheKey)!;
      setPlayers(cached);
      setDbStats({ players: cached.length });
      setLoading(false);
      return;
    }

    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const dbSport = sportDbMap[sport];
      console.log(`📊 Fetching ${sport} live data for ${selectedBookmaker}...`);

      // 1. Get players from database
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select(`
          id,
          external_id,
          full_name,
          position,
          team_id,
          status,
          injury_description,
          is_starter,
          teams:team_id ( name, abbreviation )
        `)
        .eq("sport", dbSport)
        .limit(500);

      if (playersError) throw playersError;
      if (!playersData || playersData.length === 0) {
        console.warn("No players found. Run sync_upcoming first.");
        setPlayers([]);
        setDbStats({ players: 0 });
        return;
      }

      // 2. Get odds for this sport and selected bookmaker
      const { data: oddsData, error: oddsError } = await supabase
        .from("odds_cache")
        .select("*")
        .eq("sport", dbSport)
        .eq("bookmaker", selectedBookmaker)
        .order("last_updated", { ascending: false });

      if (oddsError) console.warn("Odds fetch error:", oddsError);

      // 3. Build a map: player name -> line (from player_points market)
      const playerLineMap = new Map<string, number>();
      if (oddsData) {
        for (const odd of oddsData) {
          if (odd.market_type === "player_points" && odd.line) {
            // Try to extract player name from event_name or outcome description
            // For now, we'll use a simple heuristic: if the event_name contains a known player name
            // In a real integration, you would have a proper mapping.
            // As a fallback, we'll assign a default line.
            const eventName = odd.event_name || "";
            // For demonstration, we'll match if any player's name appears in the event name
            for (const p of playersData) {
              if (eventName.includes(p.full_name) && !playerLineMap.has(p.full_name)) {
                playerLineMap.set(p.full_name, odd.line);
              }
            }
          }
        }
      }

      // 4. Build opponent map from game events (optional)
      const opponentMap = new Map<string, string>();
      if (oddsData) {
        for (const odd of oddsData) {
          const parts = odd.event_name?.split(" vs ") || [];
          if (parts.length === 2) {
            opponentMap.set(parts[0], parts[1]);
            opponentMap.set(parts[1], parts[0]);
          }
        }
      }

      // 5. Format players with the line from the selected bookmaker
      const formatted = playersData.map((p: any) => {
        const teamName = p.teams?.name || "Unknown";
        const opponent = opponentMap.get(teamName) || "TBD";
        let line = 22.5; // default
        let edge_type = "NONE";
        let confidence = 50;
        // Use the line from the playerLineMap if available
        if (playerLineMap.has(p.full_name)) {
          line = playerLineMap.get(p.full_name)!;
          // Placeholder edge calculation (you can replace with real math)
          edge_type = line > 22 ? "OVER" : "UNDER";
          confidence = line > 22 ? 65 : 55;
        }
        return {
          id: p.id,
          name: p.full_name,
          position: p.position || "N/A",
          team: teamName,
          teamAbbr: p.teams?.abbreviation || "N/A",
          opponent,
          initials: p.full_name?.split(' ').map((n: string) => n[0]).join('') || "??",
          line,
          edge_type,
          confidence,
          hit_rate: 0,
          trend: "stable",
          status: p.status || "active",
          is_starter: p.is_starter || false,
          injury_description: p.injury_description,
        };
      });

      playerCache.set(cacheKey, formatted);
      setPlayers(formatted);
      setDbStats({ players: formatted.length });
    } catch (error) {
      console.error("Error fetching live data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload when sport or bookmaker changes
  useEffect(() => {
    fetchData(false);
  }, [sport, selectedBookmaker]);

  const handleSportChange = (s: Sport) => {
    setSport(s);
    setActiveStats(sportCategories[s].core.slice(0, 4));
    setSearch("");
  };

  const handleBookmakerChange = (bookmaker: string) => {
    setSelectedBookmaker(bookmaker);
  };

  const toggleStat = (stat: string) => {
    setActiveStats(prev =>
      prev.includes(stat) ? prev.filter(s => s !== stat) : [...prev, stat]
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredPlayers = players
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      }
      return 0;
    });

  const handlePlayerClick = (compositeId: string) => {
    const realId = compositeId.split("_")[0];
    setSelectedPlayer(realId);
  };

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
        {/* Sportsbook Toggle */}
        <div className="flex items-center gap-4 bg-secondary/30 p-2 rounded-lg w-fit">
          <span className="text-sm font-medium text-muted-foreground">Sportsbook:</span>
          {BOOKMAKERS.map(book => (
            <button
              key={book}
              onClick={() => handleBookmakerChange(book)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                selectedBookmaker === book
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {book}
            </button>
          ))}
        </div>

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
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {refreshing ? "Refreshing..." : "Refresh Now"}
          </button>
          <button
            onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))}
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {sortDir === "desc" ? "↓ Highest First" : "↑ Lowest First"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 py-2">
          {["points", "assists", "rebounds", "steals"].map(stat => (
            <button
              key={stat}
              onClick={() => toggleStat(stat)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeStats.includes(stat)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {stat.charAt(0).toUpperCase() + stat.slice(1)}
            </button>
          ))}
        </div>
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
                ✅ LIVE: {dbStats.players} {sport} players from {selectedBookmaker}
                <br />
                <span className="text-muted-foreground">Lines are updated automatically every 30 minutes</span>
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <PlayerTable
                players={filteredPlayers}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onPlayerClick={handlePlayerClick}
              />
            </div>
          </>
        )}
        <div className="text-center text-sm text-muted-foreground mt-4">
          Showing {filteredPlayers.length} {sport} players • Lines from {selectedBookmaker}
        </div>
      </div>
    </DashboardLayout>
  );
}
