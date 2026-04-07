import { useState, useEffect } from "react";
import { Search, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Sport, sportCategories } from "@/data/mockPlayers";

// Your Vercel proxy endpoint
const PROXY_URL = "/api/odds-proxy?path=";

// Map your frontend sports to odds-api.io sport names
const sportApiName: Record<Sport, string> = {
  NBA: "basketball",
  NFL: "americanfootball",
  MLB: "baseball",
  NHL: "icehockey",
  Soccer: "soccer",
};

async function fetchPlayerProps(sport: Sport) {
  const sportName = sportApiName[sport];
  if (!sportName) return [];

  try {
    // Step 1: Get active leagues for this sport
    const leaguesRes = await fetch(`${PROXY_URL}leagues&sport=${sportName}&all=false`);
    const leagues = await leaguesRes.json();
    if (!leagues.length) return [];

    // For simplicity, take the first league (e.g., "nba")
    const leagueSlug = leagues[0].slug;
    
    // Step 2: Get upcoming events for that league
    const eventsRes = await fetch(`${PROXY_URL}events&sport=${sportName}&league=${leagueSlug}&status=pending`);
    const events = await eventsRes.json();
    if (!events.length) return [];

    // Step 3: For each event, fetch odds (player props)
    const allPlayers = new Map();
    for (const event of events.slice(0, 5)) { // limit to 5 events to avoid rate limits
      const oddsRes = await fetch(`${PROXY_URL}odds&eventId=${event.id}&bookmakers=DraftKings,FanDuel`);
      const oddsData = await oddsRes.json();
      
      // Parse player props from the response
      for (const bookmaker of oddsData.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (market.name === "Player Props" || market.key === "player_points") {
            for (const outcome of market.outcomes || []) {
              const playerName = outcome.description;
              if (playerName && !allPlayers.has(playerName)) {
                allPlayers.set(playerName, {
                  id: playerName.replace(/\s/g, '_').toLowerCase(),
                  name: playerName,
                  position: "N/A",
                  team: event.home_team,
                  teamAbbr: (event.home_team || "").slice(0,3).toUpperCase(),
                  opponent: event.away_team,
                  line: outcome.point,
                  confidence: 65, // placeholder, can calculate later
                });
              }
            }
          }
        }
      }
    }

    return Array.from(allPlayers.values()).map(p => ({
      ...p,
      initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
      edge_type: "NONE",
      hit_rate: 0,
      trend: "stable",
      status: "active",
      is_starter: false,
      injury_description: null,
    }));
  } catch (error) {
    console.error("Odds API error:", error);
    return [];
  }
}

const playerCache = new Map<string, any[]>();

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

  const fetchData = async (force = false) => {
    const cacheKey = sport;
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
      console.log(`📊 Fetching ${sport} players from odds-api.io...`);
      const playersData = await fetchPlayerProps(sport);
      playerCache.set(cacheKey, playersData);
      setPlayers(playersData);
      setDbStats({ players: playersData.length });
    } catch (error) {
      console.error("Error fetching players:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
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
                ✅ LIVE: {dbStats.players} {sport} players from odds-api.io
                <br />
                <span className="text-muted-foreground">Real player props & lines – powered by your API key</span>
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
          Showing {filteredPlayers.length} {sport} players • Data from odds-api.io
        </div>
      </div>
    </DashboardLayout>
  );
}
