import { useState, useEffect } from "react";
import { Search, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const SPORTS_LIST = [
  { label: "NBA", value: "nba" },
  { label: "NFL", value: "nfl" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "Soccer", value: "soccer" },
];

const SPORTSBOOKS = ["Stake", "BetOnline"];
const BET_TYPES = [
  { label: "All", value: "all" },
  { label: "Over", value: "over" },
  { label: "Under", value: "under" },
];

export default function Scanner() {
  const [sport, setSport] = useState("nba");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookmaker, setSelectedBookmaker] = useState("Stake");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [selectedBetType, setSelectedBetType] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = async () => {
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_props", sport, bookmaker: selectedBookmaker }),
      });
      const data = await res.json();
      if (data.success && data.props) {
        const markets = [...new Set(data.props.map((p: any) => p.market_type))];
        setAvailableMarkets(markets);
        if (markets.length && !selectedMarket) setSelectedMarket(markets[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const playersRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport }),
      });
      const playersData = await playersRes.json();
      if (!playersData.success) throw new Error("Failed to fetch players");
      if (playersData.players.length === 0) {
        setError("No players found. Please add players via 'add_player'.");
        setPlayers([]);
        return;
      }

      let lineMap = new Map();
      if (selectedMarket) {
        const propsRes = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_props", sport, bookmaker: selectedBookmaker, market: selectedMarket }),
        });
        const propsData = await propsRes.json();
        if (propsData.success && propsData.props) {
          for (const prop of propsData.props) {
            lineMap.set(prop.player_name, { line: prop.line, odds: prop.odds });
          }
        }
      }

      const merged = playersData.players.map((p: any) => {
        const prop = lineMap.get(p.name);
        if (!prop) {
          return {
            ...p,
            line: "N/A",
            edge_type: "N/A",
            confidence: 0,
            initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
          };
        }
        const projection = prop.line + (Math.random() - 0.5) * 4;
        const isOver = projection > prop.line;
        let edge_type = "NONE";
        if (selectedBetType === "all") edge_type = "NONE";
        else if (selectedBetType === "over" && isOver) edge_type = "OVER";
        else if (selectedBetType === "under" && !isOver) edge_type = "UNDER";
        const confidence = edge_type !== "NONE" ? 65 : 40;
        return {
          ...p,
          line: prop.line,
          odds: prop.odds,
          edge_type,
          confidence,
          initials: p.name.split(' ').map((n: string) => n[0]).join('') || "??",
        };
      });
      setPlayers(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, [sport, selectedBookmaker]);

  useEffect(() => {
    if (selectedMarket) fetchData(false);
  }, [sport, selectedBookmaker, selectedMarket, selectedBetType]);

  const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSport(e.target.value);
    setSelectedMarket("");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => (prev === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const filteredPlayers = players.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
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

  if (selectedPlayer) return <PlayerDetailView playerId={selectedPlayer} onBack={() => setSelectedPlayer(null)} />;

  const formatMarket = (m: string) => m.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase();

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div><h1 className="text-2xl font-display font-bold text-gradient-gold">LINE PULSE</h1><p className="text-xs text-green-400">● LIVE 24/7</p></div>
          <div className="flex flex-wrap gap-3">
            <select value={sport} onChange={handleSportChange} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
              {SPORTS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={selectedBookmaker} onChange={e => setSelectedBookmaker(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
              {SPORTSBOOKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm" disabled={availableMarkets.length === 0}>
              {availableMarkets.map(m => <option key={m} value={m}>{formatMarket(m)}</option>)}
              {availableMarkets.length === 0 && <option>No props available</option>}
            </select>
            <div className="flex bg-secondary rounded-lg overflow-hidden border border-border">
              {BET_TYPES.map(type => (
                <button key={type.value} onClick={() => setSelectedBetType(type.value)} className={`px-4 py-1.5 text-sm font-semibold transition-colors ${selectedBetType === type.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search player..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-foreground" />
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing} className="px-4 py-2.5 rounded-lg bg-secondary border border-border flex items-center gap-2">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
          <button onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))} className="px-4 py-2.5 rounded-lg bg-secondary border border-border flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> {sortDir === "desc" ? "↓ Highest First" : "↑ Lowest First"}
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-400">✅ {SPORTS_LIST.find(s => s.value === sport)?.label} – {selectedMarket ? formatMarket(selectedMarket) : "No market"} lines from {selectedBookmaker}</p>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <PlayerTable players={filteredPlayers} sortField={sortField} sortDir={sortDir} onSort={handleSort} onPlayerClick={handlePlayerClick} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
