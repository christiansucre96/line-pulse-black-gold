import { useState, useEffect } from "react";
import { Search, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Sport, sportCategories } from "@/data/mockPlayers";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Available sports (add more as needed)
const SPORTS_LIST: { label: Sport; value: string }[] = [
  { label: "NBA", value: "nba" },
  { label: "NFL", value: "nfl" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "Soccer", value: "soccer" },
];

// Available sportsbooks (add more here – the UI will auto‑update)
const SPORTSBOOKS = ["Stake", "BetOnline", "DraftKings", "FanDuel"];

// Over/Under options
const BET_TYPES = [
  { label: "Over", value: "over" },
  { label: "Under", value: "under" },
];

// Cache per sport + bookmaker + bet type
const playerCache = new Map<string, any[]>();

export default function Scanner() {
  const [sport, setSport] = useState<string>("nba");
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
  const [selectedBetType, setSelectedBetType] = useState<string>("over");

  const fetchData = async (force = false) => {
    const cacheKey = `${sport}-${selectedBookmaker}-${selectedBetType}`;
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
      console.log(`📊 Fetching ${sport} data for ${selectedBookmaker} (${selectedBetType})...`);

      // 1. Get players from edge function
      const playersRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport }),
      });
      const playersData = await playersRes.json();
      if (!playersData.success) throw new Error("Failed to fetch players");

      // 2. Get odds for selected bookmaker (player props)
      const oddsRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_odds", sport, bookmaker: selectedBookmaker }),
      });
      const oddsData = await oddsRes.json();
      const odds = oddsData.odds || [];

      // Build a map: player name -> line
      const lineMap = new Map<string, number>();
      for (const odd of odds) {
        const eventName = odd.event_name || "";
        const playerName = eventName.replace(" Points", "").trim();
        if (playerName && odd.line) {
          lineMap.set(playerName, odd.line);
        }
      }

      // Merge players with lines and apply over/under selection
      const merged = playersData.players.map((p: any) => {
        const rawLine = lineMap.get(p.name) || 22.5;
        // For "under", we show the same line but the bet type will be indicated separately
        const line = rawLine;
        let edge_type = "NONE";
        let confidence = 50;
        // Simple logic: if projection > line => Over, else Under.
        // For demo, we use a random projection (replace with real projection later)
        const projection = rawLine + (Math.random() * 2 - 1); // placeholder
        const isOver = projection > rawLine;
        if (selectedBetType === "over" && isOver) edge_type = "OVER";
        else if (selectedBetType === "under" && !isOver) edge_type = "UNDER";
        else edge_type = "NONE";

        confidence = edge_type !== "NONE" ? 65 : 40;

        return {
          ...p,
          line,
          edge_type,
          confidence,
          hit_rate: 0,
          trend: "stable",
          initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
          projection: projection.toFixed(1),
        };
      });

      playerCache.set(cacheKey, merged);
      setPlayers(merged);
      setDbStats({ players: merged.length });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [sport, selectedBookmaker, selectedBetType]);

  const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSport(e.target.value);
    setActiveStats(sportCategories[e.target.value.toUpperCase() as Sport]?.core.slice(0, 4) || ["points"]);
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
          <div className="flex gap-3">
            {/* Sport Dropdown */}
            <select
              value={sport}
              onChange={handleSportChange}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {SPORTS_LIST.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Sportsbook Dropdown */}
            <select
              value={selectedBookmaker}
              onChange={(e) => setSelectedBookmaker(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {SPORTSBOOKS.map(book => (
                <option key={book} value={book}>{book}</option>
              ))}
            </select>

            {/* Over/Under Toggle */}
            <div className="flex bg-secondary rounded-lg overflow-hidden border border-border">
              {BET_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setSelectedBetType(type.value)}
                  className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                    selectedBetType === type.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
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
                ✅ LIVE: {dbStats.players} players – {selectedBetType.toUpperCase()} from {selectedBookmaker}
                <br />
                <span className="text-muted-foreground">Data refreshed every 30 minutes (backend sync)</span>
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
          Showing {filteredPlayers.length} players • Powered by Odds‑API.io
        </div>
      </div>
    </DashboardLayout>
  );
}
