// src/pages/Scanner.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { SubmitLineModal } from "@/components/SubmitLineModal";
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
import { Search, ChevronDown, ArrowUpDown, TrendingUp, PlusCircle } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const PROP_GROUPS: Record<string, { id: string; label: string; stackKeys?: string[]; isBoolean?: boolean }[]> = {
  nba: [
    { id: "points", label: "PTS" }, { id: "rebounds", label: "REB" }, { id: "assists", label: "AST" },
    { id: "threes", label: "3PM" },
    { id: "PR", label: "PR", stackKeys: ["points", "rebounds"] },
    { id: "PA", label: "PA", stackKeys: ["points", "assists"] },
    { id: "RA", label: "RA", stackKeys: ["rebounds", "assists"] },
    { id: "PRA", label: "PRA", stackKeys: ["points", "rebounds", "assists"] },
    { id: "steals", label: "STL" }, { id: "blocks", label: "BLK" },
    { id: "SB", label: "STL+BLK", stackKeys: ["steals", "blocks"] },
    { id: "doubleDouble", label: "DD", isBoolean: true },
    { id: "tripleDouble", label: "TD", isBoolean: true },
    { id: "turnovers", label: "TO" }, { id: "minutes", label: "MIN" }
  ],
  nfl: [
    { id: "passYards", label: "Pass Yds" }, { id: "passTD", label: "Pass TD" },
    { id: "completions", label: "Comp" }, { id: "attempts", label: "Att" }, { id: "interceptions", label: "INT" },
    { id: "rushYards", label: "Rush Yds" }, { id: "rushAtt", label: "Rush Att" }, { id: "rushTD", label: "Rush TD" },
    { id: "receptions", label: "Rec" }, { id: "recYards", label: "Rec Yds" }, { id: "recTD", label: "Rec TD" },
    { id: "passRushYds", label: "Pass+Rush", stackKeys: ["passYards", "rushYards"] },
    { id: "rushRecYds", label: "Rush+Rec", stackKeys: ["rushYards", "recYards"] },
    { id: "anytimeTD", label: "Anytime TD", isBoolean: true },
    { id: "firstTD", label: "First TD", isBoolean: true },
    { id: "sacks", label: "Sacks" }, { id: "tackles", label: "Tackles" }
  ],
  mlb: [
    { id: "hits", label: "H" }, { id: "runs", label: "R" }, { id: "rbi", label: "RBI" },
    { id: "homeRuns", label: "HR" }, { id: "totalBases", label: "TB" },
    { id: "strikeouts", label: "Ks" }, { id: "earnedRuns", label: "ER" },
    { id: "hitsAllowed", label: "H All" }, { id: "walksAllowed", label: "BB All" },
    { id: "HRR", label: "H+R+RBI", stackKeys: ["hits", "runs", "rbi"] },
    { id: "TBLadder", label: "TB Ladder" }
  ],
  nhl: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" },
    { id: "points", label: "Pts", stackKeys: ["goals", "assists"] },
    { id: "shots", label: "SOG" }, { id: "saves", label: "Saves" },
    { id: "goalsAllowed", label: "GA" },
    { id: "ptsShots", label: "Pts+SOG", stackKeys: ["goals", "assists", "shots"] },
    { id: "anytimeGoal", label: "Anytime G", isBoolean: true }
  ],
  soccer: [
    { id: "goals", label: "G" }, { id: "assists", label: "A" },
    { id: "shots", label: "Shots" }, { id: "shotsOnTarget", label: "SOT" }
  ]
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
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  const playerId = searchParams.get("playerId");

  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport, searchQuery, selectedProps, selectedBookmaker]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [edgeRes, linesRes] = await Promise.all([
        fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "get_players_with_stats",
            sport,
            search: searchQuery || undefined,
            props: selectedProps,
            bookmakers: [selectedBookmaker],
          }),
        }),
        supabase
          .from("user_submitted_lines")
          .select("*")
          .eq("sport", sport)
          .eq("status", "verified")
          .eq("bookmaker", selectedBookmaker)
          .gte("submitted_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .order("submitted_at", { ascending: false })
      ]);

      const edgeData = await edgeRes.json();
      const {  communityLines } = linesRes;

      if (!edgeData.success) throw new Error(edgeData.error || "Failed to fetch stats");

      const merged = (edgeData.players || []).map((p: any) => {
        const matchingLine = (communityLines || []).find(
          (l: any) => l.player_name?.toLowerCase() === p.full_name?.toLowerCase() && l.prop_type === selectedProps[0]
        );
        return {
          ...p,
          line: matchingLine ? matchingLine.line_value.toFixed(1) : p.line,
          bookmaker: matchingLine ? matchingLine.bookmaker : p.bookmaker,
          isCommunity: !!matchingLine,
        };
      });

      setPlayers(merged);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
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
        return sortConfig.direction === "asc" ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
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

  const currentProps = PROP_GROUPS[sport as keyof typeof PROP_GROUPS] || PROP_GROUPS.nba;

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
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400 mb-2">📊 Line Pulse Scanner</h1>
            <p className="text-gray-400 text-sm">Find betting edges across all major sportsbooks</p>
          </div>
          <Button 
            onClick={() => setShowSubmitModal(true)} 
            className="bg-yellow-500 text-black hover:bg-yellow-600 gap-2"
          >
            <PlusCircle className="h-4 w-4" /> Report Line
          </Button>
        </div>

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
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm">{p.full_name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2) || "?"}</div>
                          <div>
                            <p className="font-semibold text-yellow-400">{p.full_name || "Unknown"}</p>
                            <p className="text-xs text-gray-400">{p.team || "-"} • {selectedProps.map(id => PROP_GROUPS[sport]?.find(x=>x.id===id)?.label).join("+")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-gray-600 text-gray-300">
                            {p.bookmaker || selectedBookmaker}
                          </Badge>
                          {p.isCommunity && (
                            <Badge variant="secondary" className="bg-green-900/30 text-green-400 border-green-800 text-[10px]">
                              Community
                            </Badge>
                          )}
                        </div>
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

        <SubmitLineModal 
          open={showSubmitModal} 
          onOpenChange={setShowSubmitModal}
          sport={sport}
        />
      </div>
    </DashboardLayout>
  );
}
