import { useState, useEffect } from "react";
import { Search, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Sport, sportCategories } from "@/data/mockPlayers";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Available sports
const SPORTS_LIST = [
  { label: "NBA", value: "nba" },
  { label: "NFL", value: "nfl" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "Soccer", value: "soccer" },
];

// Sportsbooks
const SPORTSBOOKS = ["Stake", "BetOnline"];

// Combo props for each sport (will be populated from API)
const DEFAULT_PROP_TYPES = [
  { label: "Points + Rebounds + Assists", value: "player_points_rebounds_assists" },
  { label: "Points + Rebounds", value: "player_points_rebounds" },
  { label: "Points + Assists", value: "player_points_assists" },
  { label: "Rebounds + Assists", value: "player_rebounds_assists" },
];

const playerCache = new Map<string, any[]>();

export default function Scanner() {
  const [sport, setSport] = useState("nba");
  const [search, setSearch] = useState("");
  const [activeStats, setActiveStats] = useState(["points"]);
  const [sortField, setSortField] = useState("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState({ players: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookmaker, setSelectedBookmaker] = useState("Stake");
  const [selectedPropType, setSelectedPropType] = useState("player_points_rebounds_assists");
  const [propTypes, setPropTypes] = useState(DEFAULT_PROP_TYPES);

  // Fetch available prop types from edge function
  const fetchPropTypes = async (sportVal: string, bookmakerVal: string) => {
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_combo_props", sport: sportVal, bookmaker: bookmakerVal }),
      });
      const data = await res.json();
      if (data.success && data.props) {
        const uniqueMarkets = [...new Set(data.props.map(p => p.market_type))];
        const types = uniqueMarkets.map(m => ({
          label: m.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase(),
          value: m,
        }));
        if (types.length) setPropTypes(types);
      }
    } catch (err) {
      console.error("Error fetching prop types:", err);
    }
  };

  const fetchData = async (force = false) => {
    const cacheKey = `${sport}-${selectedBookmaker}-${selectedPropType}`;
    if (!force && playerCache.has(cacheKey)) {
      setPlayers(playerCache.get(cacheKey)!);
      setDbStats({ players: playerCache.get(cacheKey)!.length });
      setLoading(false);
      return;
    }

    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      // Get players
      const playersRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport }),
      });
      const playersData = await playersRes.json();
      if (!playersData.success) throw new Error("Failed to fetch players");

      // Get combo props for selected sport, bookmaker, and prop type
      const propsRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operation: "get_combo_props", 
          sport, 
          bookmaker: selectedBookmaker,
          market: selectedPropType,
        }),
      });
      const propsData = await propsRes.json();
      const props = propsData.props || [];

      // Build line map
      const lineMap = new Map();
      for (const prop of props) {
        if (prop.player_name && prop.line) {
          lineMap.set(prop.player_name, prop.line);
        }
      }

      // Merge players with lines
      const merged = playersData.players.map((p: any) => {
        const line = lineMap.get(p.name);
        if (!line) {
          return {
            ...p,
            line: "N/A",
            edge_type: "N/A",
            confidence: 0,
            hit_rate: 0,
            trend: "no line",
            initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
          };
        }
        return {
          ...p,
          line,
          edge_type: "NONE",
          confidence: 50,
          hit_rate: 0,
          trend: "stable",
          initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
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
    fetchPropTypes(sport, selectedBookmaker);
  }, [sport, selectedBookmaker, selectedPropType]);

  const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSport(e.target.value);
    setSearch("");
    setSelectedPropType(propTypes[0]?.value || DEFAULT_PROP_TYPES[0].value);
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

  const getSportDisplay = () => SPORTS_LIST.find(s => s.value === sport)?.label || sport.toUpperCase();

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Welcome to</p>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">LINE PULSE</h1>
            <p className="text-xs text-green-400">● LIVE 24/7</p>
          </div>
          <div className="flex flex-wrap gap-3">
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

            {/* Prop Type Dropdown (Combo Props Only) */}
            <select
              value={selectedPropType}
              onChange={(e) => setSelectedPropType(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {propTypes.map(prop => (
                <option key={prop.value} value={prop.value}>{prop.label}</option>
              ))}
            </select>
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
                ✅ {getSportDisplay()} – {propTypes.find(p => p.value === selectedPropType)?.label || selectedPropType} lines from {selectedBookmaker}
                <br />
                <span className="text-muted-foreground">
                  {players.filter(p => p.line !== "N/A").length} of {players.length} players have lines available
                </span>
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
