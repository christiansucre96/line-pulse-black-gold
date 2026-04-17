// src/pages/Scanner.tsx
// Shows players (3-day lookahead by default, but can load all with button)
// All prop types, user-adjustable lines, hit rate boxes

import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Calendar, Users } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Hit rate box (same color logic as detail view)
function HRBox({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <div className="w-9 h-6 rounded bg-gray-800 text-gray-600 text-[10px] font-bold flex items-center justify-center">—</div>;
  const bg = value >= 80 ? "bg-green-500 text-white" : value >= 60 ? "bg-yellow-500 text-black" : "bg-red-500 text-white";
  return <div className={`w-9 h-6 rounded text-[10px] font-bold flex items-center justify-center ${bg}`}>{value}%</div>;
}

const SPORTS = [
  { value: "nba", label: "🏀 NBA" },
  { value: "nfl", label: "🏈 NFL" },
  { value: "mlb", label: "⚾ MLB" },
  { value: "nhl", label: "🏒 NHL" },
  { value: "soccer", label: "⚽ Soccer" },
];

// Sport-specific primary prop types for the scanner filter
const SPORT_PROPS: Record<string, { id: string; label: string }[]> = {
  nba: [
    { id: "points", label: "Points" }, { id: "rebounds", label: "Rebounds" },
    { id: "assists", label: "Assists" }, { id: "three_pointers_made", label: "3PM" },
    { id: "steals", label: "Steals" }, { id: "blocks", label: "Blocks" },
    { id: "combo_pra", label: "PRA" }, { id: "combo_pr", label: "P+R" },
    { id: "combo_pa", label: "P+A" }, { id: "turnovers", label: "TOV" },
  ],
  nfl: [
    { id: "passing_yards", label: "Pass Yds" }, { id: "rushing_yards", label: "Rush Yds" },
    { id: "receiving_yards", label: "Rec Yds" }, { id: "passing_tds", label: "Pass TDs" },
    { id: "receptions", label: "Receptions" },
  ],
  mlb: [
    { id: "hits", label: "Hits" }, { id: "runs", label: "Runs" }, { id: "rbi", label: "RBI" },
    { id: "home_runs", label: "HR" }, { id: "strikeouts_pitching", label: "K (P)" },
  ],
  nhl: [
    { id: "goals", label: "Goals" }, { id: "assists_hockey", label: "Assists" },
    { id: "shots_on_goal", label: "SOG" }, { id: "combo_ga", label: "G+A" },
  ],
  soccer: [
    { id: "goals_soccer", label: "Goals" }, { id: "assists_soccer", label: "Assists" },
    { id: "shots_soccer", label: "Shots" }, { id: "shots_on_target", label: "SOT" },
  ],
};

function getInitials(name: string) {
  return (name || "??").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sport, setSport]           = useState("nba");
  const [filterProp, setFilterProp] = useState("points");
  const [search, setSearch]         = useState("");
  const [players, setPlayers]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [sortKey, setSortKey]       = useState<string>("l10");
  const [sortDir, setSortDir]       = useState<1 | -1>(-1);

  const playerId = searchParams.get("playerId");
  const urlSport = searchParams.get("sport");

  useEffect(() => {
    if (urlSport && urlSport !== sport) setSport(urlSport);
  }, [urlSport]);

  // ✅ Updated: fetchPlayers accepts a forceAll flag
  const fetchPlayers = async (forceAll: boolean = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operation: "get_players", 
          sport,
          forceAll, // ← send forceAll flag to edge function
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setPlayers(data.players || []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load: only upcoming games (forceAll = false)
  useEffect(() => {
    if (!playerId) fetchPlayers(false);
  }, [sport]);

  // Sort
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(-1); }
  };

  // Filter + sort players
  const displayPlayers = useMemo(() => {
    let list = [...players];

    // Filter by prop type
    if (filterProp && filterProp !== "all") {
      list = list.filter(p => p.all_props?.[filterProp]);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.team_abbr || "").toLowerCase().includes(q) ||
        (p.opponent || "").toLowerCase().includes(q)
      );
    }

    // Sort — use the prop data for the selected filter
    list.sort((a, b) => {
      const getVal = (p: any) => {
        const pd = p.all_props?.[filterProp];
        if (!pd) return -Infinity;
        if (sortKey === "line")    return pd.line ?? 0;
        if (sortKey === "avg")     return pd.avg_l10 ?? 0;
        if (sortKey === "l5")      return pd.l5 ?? 0;
        if (sortKey === "l10")     return pd.l10 ?? 0;
        if (sortKey === "l15")     return pd.l15 ?? 0;
        if (sortKey === "l20")     return pd.l20 ?? 0;
        if (sortKey === "name")    return 0; // handled separately
        if (sortKey === "diff") {
          const diff = (pd.avg_l10 ?? 0) - (pd.line ?? 0);
          return diff;
        }
        return 0;
      };
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      return sortDir * (getVal(a) - getVal(b));
    });

    return list;
  }, [players, filterProp, search, sortKey, sortDir]);

  const SortTh = ({ label, sk }: { label: string; sk: string }) => (
    <th
      onClick={() => handleSort(sk)}
      className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider cursor-pointer select-none hover:text-yellow-400 whitespace-nowrap"
    >
      {label} {sortKey === sk ? (sortDir === -1 ? "↓" : "↑") : ""}
    </th>
  );

  // If viewing player detail
  if (playerId) {
    return (
      <PlayerDetailView
        playerId={playerId}
        sport={sport}
        onBack={() => navigate("/scanner")}
      />
    );
  }

  const currentProps = SPORT_PROPS[sport] || SPORT_PROPS.nba;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">⚡ LinePulse Scanner</h1>
            <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Players with games in the next 3 days · Set your own lines
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPlayers(true)}  // ✅ Load All (forceAll = true)
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm text-black font-medium transition disabled:opacity-50"
            >
              <Users className="w-3.5 h-3.5" />
              Load All
            </button>
            <button
              onClick={() => fetchPlayers(false)} // Refresh with current filter (upcoming only)
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {lastRefresh ? `Updated ${lastRefresh}` : "Refresh"}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={sport} onValueChange={(v) => { setSport(v); setFilterProp("points"); }}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-yellow-400 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterProp} onValueChange={setFilterProp}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300 text-sm">
              <SelectValue placeholder="All Props" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All Props</SelectItem>
              {currentProps.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players, teams..."
              className="pl-9 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading players...</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          displayPlayers.length === 0 ? (
            <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
              <p className="text-lg">No players found</p>
              <p className="text-sm mt-1">
                {players.length === 0
                  ? "Run the data pipeline first: Admin → Full Ingest → select sport"
                  : "Try adjusting your filters or use 'Load All' to see all players"}
              </p>
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-600">
                {displayPlayers.length} players · click any row for all prop details
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <SortTh label="Player"  sk="name" />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Game</th>
                      <SortTh label="Line"    sk="line" />
                      <SortTh label="Avg L10" sk="avg"  />
                      <SortTh label="Diff"    sk="diff" />
                      <SortTh label="L5"      sk="l5"   />
                      <SortTh label="L10"     sk="l10"  />
                      <SortTh label="L15"     sk="l15"  />
                      <SortTh label="L20"     sk="l20"  />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPlayers.map((p, i) => {
                      const pd = p.all_props?.[filterProp] || p.all_props?.[Object.keys(p.all_props || {})[0]];
                      if (!pd) return null;
                      const diff = ((pd.avg_l10 ?? 0) - (pd.line ?? 0));
                      return (
                        <tr
                          key={`${p.player_id}-${i}`}
                          onClick={() => navigate(`/scanner?playerId=${p.player_id}&sport=${sport}`)}
                          className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition"
                        >
                          {/* Player */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black text-xs font-bold shrink-0">
                                {getInitials(p.name)}
                              </div>
                              <div>
                                <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                                <p className="text-[10px] text-gray-500">
                                  {p.team_abbr} · {p.position} · {pd.label}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Game */}
                          <td className="p-3">
                            <div>
                              <p className="text-xs text-gray-400">vs {p.opponent}</p>
                              <p className="text-[10px] text-gray-600">{p.game_date}</p>
                            </div>
                          </td>
                          {/* Line */}
                          <td className="p-3">
                            <span className="text-yellow-400 font-bold text-sm">{pd.line?.toFixed(1)}</span>
                          </td>
                          {/* Avg */}
                          <td className="p-3 text-gray-300 text-sm">{pd.avg_l10}</td>
                          {/* Diff */}
                          <td className="p-3">
                            <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          </td>
                          {/* Hit rate boxes */}
                          <td className="p-3"><HRBox value={pd.l5} /></td>
                          <td className="p-3"><HRBox value={pd.l10} /></td>
                          <td className="p-3"><HRBox value={pd.l15} /></td>
                          <td className="p-3"><HRBox value={pd.l20} /></td>
                          {/* Trend */}
                          <td className="p-3">
                            <span className={`text-xs font-bold ${pd.trend === 'up' ? 'text-green-400' : pd.trend === 'down' ? 'text-red-400' : 'text-gray-600'}`}>
                              {pd.trend === 'up' ? '↑ HOT' : pd.trend === 'down' ? '↓ COLD' : '→ FLAT'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
