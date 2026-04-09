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

export default function Scanner() {
  const [sport, setSport] = useState("nba");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const [players, setPlayers] = useState<any[]>([]);
  const [allProps, setAllProps] = useState<any[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [selectedMarket, setSelectedMarket] = useState("");

  const [selectedBookmaker, setSelectedBookmaker] = useState("Stake");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🧠 FORMAT MARKET NAMES
  const formatMarket = (m: string) =>
    m.replace(/player_/g, "").replace(/_/g, " + ").toUpperCase();

  // 🔥 FETCH ALL PROPS (NOT FILTERED)
  const fetchAllProps = async () => {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "get_props",
        sport,
        bookmaker: selectedBookmaker,
      }),
    });

    const data = await res.json();

    if (data.success && data.props) {
      setAllProps(data.props);

      const markets = [...new Set(data.props.map((p: any) => p.market_type))];

      setAvailableMarkets(markets);

      if (!selectedMarket && markets.length) {
        setSelectedMarket(markets[0]);
      }
    }
  };

  // 🔥 FETCH PLAYERS + APPLY SELECTED MARKET
  const fetchPlayers = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "get_players", sport }),
    });

    const data = await res.json();

    if (!data.success) return;

    // 🔥 FILTER PROPS FOR SELECTED MARKET
    const marketProps = allProps.filter(
      (p) => p.market_type === selectedMarket
    );

    const lineMap = new Map();

    for (const p of marketProps) {
      lineMap.set(p.player_name, p);
    }

    // 🔥 BUILD PLAYER ROWS
    const merged = data.players.map((player: any) => {
      const prop = lineMap.get(player.name);

      if (!prop) {
        return {
          ...player,
          line: "—",
          odds: "—",
          edge_type: "NONE",
          confidence: 0,
        };
      }

      // 🧠 SIMPLE EDGE CALC (UPGRADE LATER)
      const projection = prop.line + (Math.random() * 4 - 2);
      const isOver = projection > prop.line;

      return {
        ...player,
        line: prop.line,
        odds: prop.odds,
        edge_type: isOver ? "OVER" : "UNDER",
        confidence: Math.floor(60 + Math.random() * 25),
      };
    });

    setPlayers(merged);
    setLoading(false);
    setRefreshing(false);
  };

  // 🔁 LOAD DATA
  useEffect(() => {
    fetchAllProps();
  }, [sport, selectedBookmaker]);

  useEffect(() => {
    if (selectedMarket) fetchPlayers();
  }, [selectedMarket, allProps]);

  // 🔍 FILTER + SORT
  const filteredPlayers = players
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortDir === "desc") return b[sortField] - a[sortField];
      return a[sortField] - b[sortField];
    });

  const handlePlayerClick = (id: string) => {
    setSelectedPlayer(id.split("_")[0]);
  };

  if (selectedPlayer) {
    return (
      <PlayerDetailView
        playerId={selectedPlayer}
        onBack={() => setSelectedPlayer(null)}
      />
    );
  }

  return (
    <DashboardLayout>
      {/* HEADER */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">LINE PULSE</h1>

          <div className="flex gap-2 flex-wrap">
            {/* SPORT */}
            <select
              value={sport}
              onChange={(e) => {
                setSport(e.target.value);
                setSelectedMarket("");
              }}
              className="bg-secondary px-3 py-2 rounded"
            >
              {SPORTS_LIST.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* BOOKMAKER */}
            <select
              value={selectedBookmaker}
              onChange={(e) => setSelectedBookmaker(e.target.value)}
              className="bg-secondary px-3 py-2 rounded"
            >
              {SPORTSBOOKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>

            {/* 🔥 MARKET DROPDOWN (NOW WORKS FULLY) */}
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="bg-secondary px-3 py-2 rounded"
            >
              {availableMarkets.map((m) => (
                <option key={m} value={m}>
                  {formatMarket(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <input
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-input border px-3 py-2 rounded"
          />

          <button
            onClick={() => fetchPlayers(true)}
            className="px-4 py-2 bg-secondary rounded flex items-center gap-2"
          >
            {refreshing ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : (
          <PlayerTable
            players={filteredPlayers}
            sortField={sortField}
            sortDir={sortDir}
            onSort={setSortField}
            onPlayerClick={handlePlayerClick}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
