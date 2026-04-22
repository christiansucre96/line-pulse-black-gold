// src/pages/Scanner.tsx
// Shows only players with games in next 3 days (with force fallback)
// All prop types, user-adjustable lines, hit rate boxes
// ✅ ADDITIONS: Pagination support for Supabase free tier
// ✅ ADDITION: Game filter dropdown (next 24h games)
// ✅ FIXED: Game time formatted nicely (e.g., "7:00 PM")
// ✅ ADDED: Rolling stats integration via playerService + L20 badges
// ✅ FIXED: fetchPlayers correctly uses array return from fetchPlayersWithRollingStats
// ✅ FIXED: Safe optional chaining in game dropdown
// ✅ UPDATED: Table now shows streak and enhanced trend (Strong Over/Over/Under/Strong Under)
// ✅ NEW: Market line input for betting signals (100% free, no APIs)

import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
// ✅ NEW: Import rolling stats service
import { fetchPlayersWithRollingStats, type PlayerWithRollingStats } from '@/services/playerService';

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Hit rate box (same color logic as detail view)
function HRBox({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <div className="w-9 h-6 rounded bg-gray-800 text-gray-600 text-[10px] font-bold flex items-center justify-center">—</div>;
  const bg = value >= 80 ? "bg-green-500 text-white" : value >= 60 ? "bg-yellow-500 text-black" : "bg-red-500 text-white";
  return <div className={`w-9 h-6 rounded text-[10px] font-bold flex items-center justify-center ${bg}`}>{value}%</div>;
}

// ✅ NEW: L20 Completion Badge Component (kept for reference)
function L20Badge({ gamesAnalyzed, targetGames = 20, isComplete }: { gamesAnalyzed: number | null; targetGames?: number; isComplete: boolean | null }) {
  if (gamesAnalyzed === null || gamesAnalyzed === undefined) {
    return <span className="text-[10px] text-gray-600">—</span>;
  }
  if (isComplete) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        ✅ L{targetGames}
      </span>
    );
  }
  return (
    <span 
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
      title={`Only ${gamesAnalyzed} games so far — updating as new games finish`}
    >
      ⏳ L{gamesAnalyzed}/{targetGames}
    </span>
  );
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

// ✅ Extend player type to include rolling stats + streak/trend
interface ScannerPlayer extends PlayerWithRollingStats {
  all_props?: Record<string, any>;
  name?: string;
  team_abbr?: string;
  position?: string;
  opponent?: string;
  game_date?: string;
  player_id?: string;
}

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sport, setSport]           = useState("nba");
  const [filterProp, setFilterProp] = useState("points");
  const [search, setSearch]         = useState("");
  const [players, setPlayers]       = useState<ScannerPlayer[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [sortKey, setSortKey]       = useState<string>("l10");
  const [sortDir, setSortDir]       = useState<1 | -1>(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const PLAYERS_PER_PAGE = 100;

  // Game filter state
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [availableGames, setAvailableGames] = useState<any[]>([]);

  // ✅ NEW: Market line input for betting signals
  const [marketLine, setMarketLine] = useState<number | null>(null);

  const playerId = searchParams.get("playerId");
  const urlSport = searchParams.get("sport");

  useEffect(() => {
    if (urlSport && urlSport !== sport) setSport(urlSport);
  }, [urlSport]);

  // Fetch available games for the selected sport
  const fetchGames = async () => {
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_games", sport }),
      });
      const data = await res.json();
      if (data.success) {
        setAvailableGames(data.games || []);
      } else {
        console.error("Failed to fetch games:", data.error);
      }
    } catch (err) {
      console.error("❌ Error fetching games:", err);
    }
  };

  // ✅ UPDATED & FIXED: Fetch players with rolling stats via playerService
  const fetchPlayers = async (page: number = 1, gameId?: string) => {
    setLoading(true); setError(null);
    try {
      // First fetch basic player list from edge function (for game filtering)
      const body: any = { 
        operation: "get_players", 
        sport,
        page,
        limit: PLAYERS_PER_PAGE,
      };
      if (gameId && gameId !== "all") {
        body.game_id = gameId;
      }
      
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const edgeData = await res.json();
      if (!edgeData.success) throw new Error(edgeData.error || "Failed");
      
      // ✅ Then enrich with rolling stats from Supabase
      const playerIds = (edgeData.players || [])
        .map((p: any) => p.player_id)
        .filter(Boolean);
      
      let enrichedPlayers: ScannerPlayer[] = edgeData.players || [];
      
      if (playerIds.length > 0) {
        // ✅ fetchPlayersWithRollingStats returns an array directly (not an object)
        const playersWithStats = await fetchPlayersWithRollingStats(sport, 500);
        const statsMap = new Map(
          playersWithStats.map((p: any) => [p.id, p.rolling_stats])
        );
        
        // Merge rolling stats into edge data
        enrichedPlayers = enrichedPlayers.map((p: any) => ({
          ...p,
          rolling_stats: p.player_id ? statsMap.get(p.player_id) : null
        }));
      }
      
      console.log(`✅ Loaded ${enrichedPlayers.length}/${edgeData.total || 0} players for ${sport} (page ${page})${gameId ? `, game: ${gameId}` : ''}`);
      setPlayers(enrichedPlayers);
      setTotalPlayers(edgeData.total || 0);
      setCurrentPage(page);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      console.error("❌ Fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and sport / game changes
  useEffect(() => {
    if (!playerId) {
      fetchGames();
      fetchPlayers(1, selectedGame === "all" ? undefined : selectedGame);
    }
  }, [sport]);

  const handleSportChange = (newSport: string) => {
    setSport(newSport);
    setFilterProp("points");
    setSelectedGame("");  // reset game filter
  };

  const handleGameChange = (gameId: string) => {
    setSelectedGame(gameId);
    fetchPlayers(1, gameId === "all" ? undefined : gameId);
  };

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
      const getVal = (p: ScannerPlayer) => {
        const pd = p.all_props?.[filterProp];
        if (!pd) return -Infinity;
        if (sortKey === "line")    return pd.line ?? 0;
        if (sortKey === "avg")     return pd.avg_l10 ?? 0;
        if (sortKey === "l5")      return pd.l5 ?? 0;
        if (sortKey === "l10")     return pd.l10 ?? 0;
        if (sortKey === "l15")     return pd.l15 ?? 0;
        if (sortKey === "l20")     return pd.l20 ?? 0;
        if (sortKey === "name")    return 0;
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
  const totalPages = Math.ceil(totalPlayers / PLAYERS_PER_PAGE);

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
              onClick={() => fetchPlayers(currentPage, selectedGame === "all" ? undefined : selectedGame)}
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
          <Select value={sport} onValueChange={handleSportChange}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-yellow-400 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* ✅ Game Filter Dropdown with formatted time and safe mapping */}
          <Select value={selectedGame} onValueChange={handleGameChange}>
            <SelectTrigger className="w-72 bg-gray-900 border-gray-700 text-gray-300 text-sm">
              <SelectValue placeholder="All Games (Next 24h)" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 max-h-64 overflow-y-auto">
              <SelectItem value="all">All Games (Next 24h)</SelectItem>
              {/* ✅ Safe map with optional chaining */}
              {(availableGames || []).map((game: any) => (
                <SelectItem key={game.external_id} value={game.external_id}>
                  {game.home_team?.abbreviation} vs {game.away_team?.abbreviation} -{" "}
                  {game.game_date 
                    ? `${new Date(game.game_date).toLocaleDateString()} ${
                        game.start_time 
                          ? new Date(game.start_time).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit'
                            })
                          : ''
                      }`
                    : 'TBD'
                  }
                </SelectItem>
              ))}
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
              onKeyDown={(e) => e.key === 'Enter' && fetchPlayers(currentPage, selectedGame === "all" ? undefined : selectedGame)}
            />
          </div>
        </div>

        {/* ✅ NEW: Market Line Input for Betting Signals */}
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400 font-medium">📊 Market Line (from sportsbook):</span>
          <input
            type="number"
            step="0.5"
            placeholder="e.g. 26.5"
            value={marketLine ?? ""}
            onChange={(e) => setMarketLine(e.target.value ? parseFloat(e.target.value) : null)}
            className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
          />
          {marketLine && (
            <span className="text-xs text-blue-400">
              Enter the line you see on Stake/DraftKings/etc. → app calculates your edge instantly
            </span>
          )}
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
            <p className="text-gray-500 text-sm">Loading upcoming players...</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          displayPlayers.length === 0 ? (
            <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
              <p className="text-lg">No players found</p>
              <p className="text-sm mt-1">
                {totalPlayers === 0
                  ? "Run the data pipeline first: Admin → Full Ingest → select sport"
                  : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-600 flex justify-between">
                <span>{displayPlayers.length} players shown · click any row for all prop details</span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Table Headers */}
                  <thead className="border-b border-gray-800">
                    <tr>
                      <SortTh label="Player" sk="name" />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Game</th>
                      <SortTh label="Line" sk="line" />
                      <SortTh label="Avg L10" sk="avg" />
                      <SortTh label="Diff" sk="diff" />
                      <SortTh label="L5" sk="l5" />
                      <SortTh label="L10" sk="l10" />
                      <SortTh label="L15" sk="l15" />
                      <SortTh label="L20" sk="l20" />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Rolling</th>
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Trend</th>
                    </tr>
                  </thead>

                  {/* Table Rows */}
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
                                <p className="text-[10px] text-gray-500">{p.team_abbr} · {p.position} · {pd.label}</p>
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
                          {/* App-Calculated Line */}
                          <td className="p-3">
                            <span className="text-yellow-400 font-bold text-sm">{pd.line?.toFixed(1)}</span>
                          </td>
                          {/* Avg L10 */}
                          <td className="p-3 text-gray-300 text-sm">{pd.avg_l10}</td>
                          {/* Diff */}
                          <td className="p-3">
                            <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                          </td>
                          {/* Hit Rate Boxes */}
                          <td className="p-3"><HRBox value={pd.l5} /></td>
                          <td className="p-3"><HRBox value={pd.l10} /></td>
                          <td className="p-3"><HRBox value={pd.l15} /></td>
                          <td className="p-3"><HRBox value={pd.l20} /></td>
                          
                          {/* ✅ ROLLING: Streak Display */}
                          <td className="p-3">
                            {pd.streak ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                pd.streak.type === 'Over' 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {pd.streak.type === 'Over' ? '🔺' : '🔻'} {pd.streak.count}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          
                          {/* ✅ TREND: Betting Signal (Strong Over/Over/Under/Strong Under) */}
                          <td className="p-3">
                            {(() => {
                              // If user entered a market line, calculate betting signal vs that line
                              if (marketLine && pd.avg_l10) {
                                const edge = pd.avg_l10 - marketLine;
                                const pctEdge = marketLine > 0 ? (edge / marketLine) * 100 : 0;
                                
                                let signal = "Neutral";
                                let colorClass = "bg-gray-500/10 text-gray-400 border border-gray-500/30";
                                
                                if (pctEdge >= 10) {
                                  signal = "🟢 STRONG OVER";
                                  colorClass = "bg-green-500/30 text-green-300 border border-green-500/50";
                                } else if (pctEdge >= 3) {
                                  signal = "🟡 Over";
                                  colorClass = "bg-green-500/15 text-green-400 border border-green-500/30";
                                } else if (pctEdge <= -10) {
                                  signal = "🔴 STRONG UNDER";
                                  colorClass = "bg-red-500/30 text-red-300 border border-red-500/50";
                                } else if (pctEdge <= -3) {
                                  signal = "🟠 Under";
                                  colorClass = "bg-red-500/15 text-red-400 border border-red-500/30";
                                }
                                
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${colorClass}`}>
                                      {signal}
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                      Edge: {edge > 0 ? "+" : ""}{edge.toFixed(1)} ({pctEdge > 0 ? "+" : ""}{pctEdge.toFixed(1)}%)
                                    </span>
                                  </div>
                                );
                              }
                              
                              // Fallback: show app-calculated trend if no market line entered
                              const trend = pd.trend || 'Neutral';
                              const styles: Record<string, string> = {
                                'Strong Over': 'bg-green-500/30 text-green-300 border border-green-500/50',
                                'Over': 'bg-green-500/10 text-green-400 border border-green-500/30',
                                'Strong Under': 'bg-red-500/30 text-red-300 border border-red-500/50',
                                'Under': 'bg-red-500/10 text-red-400 border border-red-500/30',
                                'Neutral': 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                              };
                              return (
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${styles[trend] || styles['Neutral']}`}>
                                  {trend}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-4 py-3 border-t border-gray-800 bg-gray-900/30">
                  <button
                    onClick={() => fetchPlayers(Math.max(1, currentPage - 1), selectedGame === "all" ? undefined : selectedGame)}
                    disabled={currentPage === 1 || loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages} ({totalPlayers} total)
                  </span>
                  <button
                    onClick={() => fetchPlayers(Math.min(totalPages, currentPage + 1), selectedGame === "all" ? undefined : selectedGame)}
                    disabled={currentPage >= totalPages || loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
