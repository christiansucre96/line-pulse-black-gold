// src/pages/Scanner.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronDown, ArrowUpDown, TrendingUp } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const PROP_TYPES = {
  nba: [
    { id: "points", label: "Points" }, { id: "rebounds", label: "Rebounds" },
    { id: "assists", label: "Assists" }, { id: "steals", label: "Steals" },
    { id: "blocks", label: "Blocks" }, { id: "threes", label: "3PM" },
    { id: "ptra", label: "PTS+REB+AST" }, { id: "pr", label: "PTS+REB" },
    { id: "pa", label: "PTS+AST" }, { id: "ra", label: "REB+AST" },
  ],
  nfl: [
    { id: "passYards", label: "Pass Yds" }, { id: "passTD", label: "Pass TD" },
    { id: "rushYards", label: "Rush Yds" }, { id: "recYards", label: "Rec Yds" },
    { id: "ptra", label: "Total Yards" },
  ],
  mlb: [{ id: "hits", label: "Hits" }, { id: "homeRuns", label: "HR" }, { id: "rbi", label: "RBI" }],
  nhl: [{ id: "goals", label: "Goals" }, { id: "assists", label: "Assists" }, { id: "shots", label: "SOG" }],
  soccer: [{ id: "goals", label: "Goals" }, { id: "assists", label: "Assists" }, { id: "shots", label: "Shots" }],
};

const SPORTSBOOKS = ["Stake", "BetOnline", "DraftKings", "FanDuel"];

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProps, setSelectedProps] = useState<string[]>(["points"]);
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>("Stake");
  const [viewMode, setViewMode] = useState<"all" | "over" | "under">("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  
  const playerId = searchParams.get("playerId");

  useEffect(() => {
    if (playerId) return;
    fetchPlayers();
  }, [sport, searchQuery, selectedProps, selectedBookmaker]);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ FIX: Send as array 'bookmakers' to match Edge Function expectation
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_players_with_stats",
          sport,
          search: searchQuery || undefined,
          props: selectedProps,
          bookmakers: [selectedBookmaker], 
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch");
      setPlayers(data.players || []);
    } catch (err: any) {
      setError(err.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  const sortedPlayers = useMemo(() => {
    let sorted = [...players];
    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (typeof aVal === "string") return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    if (viewMode === "over") sorted = sorted.filter(p => (p.avgL10 || 0) > parseFloat(p.line || "0"));
    if (viewMode === "under") sorted = sorted.filter(p => (p.avgL10 || 0) <= parseFloat(p.line || "0"));
    return sorted;
  }, [players, sortConfig, viewMode]);

  const requestSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "desc" };
    });
  };

  const handlePlayerClick = (id: string) => navigate(`/scanner?playerId=${id}&sport=${sport}&props=${selectedProps.join(",")}`);
  const handleBack = () => navigate("/scanner");

  if (playerId) return <PlayerDetailView playerId={playerId} sport={sport} selectedProps={selectedProps} onBack={handleBack} />;

  const currentProps = PROP_TYPES[sport as keyof typeof PROP_TYPES] || PROP_TYPES.nba;

  const getPropDisplayName = () => {
    if (selectedProps.length === 1) {
      const prop = currentProps.find(p => p.id === selectedProps[0]);
      return prop ? prop.label.toUpperCase() : selectedProps[0].toUpperCase();
    }
    return selectedProps.join("+").toUpperCase();
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th 
      className="p-4 text-left text-yellow-400 font-semibold cursor-pointer hover:text-yellow-300 select-none"
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === sortKey ? "text-yellow-400" : "text-gray-600"}`} />
      </div>
    </th>
  );

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">📊 Line Pulse Scanner</h1>
        <p className="text-gray-400 text-sm mb-6">Find betting edges across all major sportsbooks</p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700 text-yellow-400"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem><SelectItem value="nhl">🏒 NHL</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem><SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="soccer">⚽ Soccer</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search players..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-[#0f172a] border-gray-700 text-yellow-400" />
          </div>

          {/* ✅ Sportsbook Selector */}
          <Select value={selectedBookmaker} onValueChange={setSelectedBookmaker}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700 text-yellow-400 justify-between">
              <SelectValue placeholder="Select Book" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              {SPORTSBOOKS.map(b => (
                <SelectItem key={b} value={b} className="text-yellow-400 focus:bg-[#1e293b] focus:text-yellow-300">
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full bg-[#0f172a] border-gray-700 text-yellow-400 justify-between">
                {selectedProps.length} Props <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#0f172a] border-gray-700 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Player Props</DropdownMenuLabel><DropdownMenuSeparator className="bg-gray-700" />
              {currentProps.map(p => (
                <DropdownMenuCheckboxItem 
                  key={p.id} 
                  checked={selectedProps.includes(p.id)} 
                  onCheckedChange={() => setSelectedProps(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} 
                  className="text-yellow-400"
                >
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-4">
          {(["all", "over", "under"] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === mode ? "bg-yellow-500 text-black" : "bg-[#0f172a] text-gray-400 border border-gray-700 hover:border-yellow-600"}`}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-400">❌ {error}</div>}

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" /><p className="text-gray-400">Loading...</p></div>
        ) : (
          <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a] border-b border-gray-800">
                  <tr>
                    <SortHeader label="Player" sortKey="full_name" />
                    <SortHeader label="Apps" sortKey="bookmaker" />
                    <SortHeader label="Line" sortKey="line" />
                    <SortHeader label="Avg L10" sortKey="avgL10" />
                    <SortHeader label="Diff" sortKey="diff" />
                    <SortHeader label="L5 %" sortKey="l5HitRate" />
                    <SortHeader label="L10 %" sortKey="l10HitRate" />
                    <SortHeader label="Streak" sortKey="streak" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, i) => (
                    <tr key={i} onClick={() => handlePlayerClick(p.player_id)} className="border-b border-gray-800 hover:bg-[#0f172a] cursor-pointer transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm">{p.full_name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                          <div>
                            <p className="font-semibold text-yellow-400">{p.full_name}</p>
                            <p className="text-xs text-gray-400">{p.team} • {getPropDisplayName()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {/* ✅ FIX: Show API data, fallback to selected book if API is slow */}
                        <Badge variant="outline" className="border-gray-600 text-gray-300">
                          {p.bookmaker || selectedBookmaker}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                          {p.line || "-"}
                        </Badge>
                      </td>
                      <td className="p-4 text-green-400 font-semibold">
                        {p.avgL10 ? p.avgL10.toFixed(1) : "-"}
                      </td>
                      <td className="p-4">
                        <span className={p.diff > 0 ? "text-green-400" : "text-red-400"}>
                          {p.diff > 0 ? "+" : ""}{p.diff ? p.diff.toFixed(1) : "-"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={p.l5HitRate >= 50 ? "text-green-400" : "text-red-400"}>{p.l5HitRate || 0}%</span>
                      </td>
                      <td className="p-4">
                        <span className={p.l10HitRate >= 50 ? "text-green-400" : "text-red-400"}>{p.l10HitRate || 0}%</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`h-4 w-4 ${p.streak > 0 ? "text-green-400" : "text-red-400"}`} />
                          <span className={p.streak > 0 ? "text-green-400" : "text-red-400"}>{p.streak || 0}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
