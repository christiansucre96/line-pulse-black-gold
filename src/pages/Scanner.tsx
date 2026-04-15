// src/pages/Scanner.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, ChevronDown, ArrowUpDown, PlusCircle } from "lucide-react";
import { toast } from "sonner";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const PROP_GROUPS: Record<string, { id: string; label: string }[]> = {
  nba: [
    { id: "points", label: "PTS" }, { id: "rebounds", label: "REB" }, { id: "assists", label: "AST" },
    { id: "threes", label: "3PM" }, { id: "steals", label: "STL" }, { id: "blocks", label: "BLK" },
    { id: "Pts+Reb", label: "P+R" }, { id: "Pts+Ast", label: "P+A" }, { id: "Reb+Ast", label: "R+A" },
    { id: "Pts+Reb+Ast", label: "PRA" }
  ],
  nfl: [
    { id: "passing_yards", label: "Pass Yds" }, { id: "rushing_yards", label: "Rush Yds" },
    { id: "receiving_yards", label: "Rec Yds" }, { id: "passing_tds", label: "Pass TD" },
    { id: "receptions", label: "Rec" }, { id: "Pass+Rush Yds", label: "Pass+Rush" }
  ],
  mlb: [
    { id: "hits", label: "H" }, { id: "runs", label: "R" }, { id: "rbi", label: "RBI" },
    { id: "home_runs", label: "HR" }, { id: "H+R+RBI", label: "H+R+RBI" }
  ],
  nhl: [
    { id: "goals", label: "G" }, { id: "assists_hockey", label: "A" },
    { id: "shots_on_goal", label: "SOG" }, { id: "G+A", label: "G+A" }
  ],
  soccer: [
    { id: "goals_soccer", label: "G" }, { id: "assists_soccer", label: "A" },
    { id: "shots_soccer", label: "Shots" }, { id: "G+A", label: "G+A" }
  ]
};

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProp, setSelectedProp] = useState("points");
  const [viewMode, setViewMode] = useState<"all" | "over" | "under">("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  const playerId = searchParams.get("playerId");

  // ✅ Fetch +EV Opportunities
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "ev_scan",
          sport,
          bankroll: 1000,
          min_edge: 0.03,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch opportunities");

      const mapped = (data.opportunities || []).map((opp: any) => ({
        player_id: opp.player_id || opp.id,
        full_name: opp.full_name || opp.player_name || "Unknown",
        team: opp.team || opp.team_abbr || "N/A",
        line: opp.line,
        avgL10: opp.avg_last10 || (parseFloat(opp.line) * (1 + parseFloat(opp.edge_pct)/100)).toFixed(1),
        diff: opp.diff || ((parseFloat(opp.edge_pct) / 100 * parseFloat(opp.line)).toFixed(1)),
        edgePct: opp.edge_pct,
        ev: opp.ev,
        recommendation: parseFloat(opp.ev) > 0.03 ? "STRONG OVER" : parseFloat(opp.ev) > 0.01 ? "OVER" : parseFloat(opp.ev) < -0.03 ? "STRONG UNDER" : parseFloat(opp.ev) < -0.01 ? "UNDER" : "NO BET",
        kellyStake: opp.kelly_stake || "0.00",
        confidence: opp.confidence || "50",
        prop_type: opp.prop_type || selectedProp,
      }));

      setPlayers(mapped);
    } catch (err: any) {
      setError(err.message || "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport]);

  // ✅ Sorting & Filtering
  const sortedPlayers = useMemo(() => {
    let sorted = [...players];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(p => p.full_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;
        return sortConfig.direction === "asc" 
          ? (typeof aVal === "string" ? aVal.localeCompare(bVal) : aVal - bVal)
          : (typeof aVal === "string" ? bVal.localeCompare(aVal) : bVal - aVal);
      });
    }
    if (viewMode === "over") sorted = sorted.filter(p => parseFloat(p.avgL10) > parseFloat(p.line));
    if (viewMode === "under") sorted = sorted.filter(p => parseFloat(p.avgL10) <= parseFloat(p.line));
    return sorted;
  }, [players, searchQuery, sortConfig, viewMode]);

  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  // ✅ Place Bet Tracking
  const handlePlaceBet = async (opp: any) => {
    const stake = parseFloat(opp.kellyStake) || 10;
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "place_bet",
          player_name: opp.full_name,
          sport,
          prop_type: opp.prop_type,
          side: opp.recommendation.includes("OVER") ? "over" : "under",
          line: parseFloat(opp.line),
          odds: -110,
          stake,
          bankroll_before: 1000,
          edge_pct: opp.edge_pct,
          ev: opp.ev,
          kelly_stake_pct: stake / 1000,
          bookmaker: "Consensus"
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Bet tracked: $${stake} on ${opp.full_name} ${opp.prop_type}`);
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handlePlayerClick = (id: string) => navigate(`/scanner?playerId=${id}&sport=${sport}`);
  const handleBack = () => navigate("/scanner");
  if (playerId) return <PlayerDetailView playerId={playerId} sport={sport} selectedProps={[selectedProp]} onBack={handleBack} />;

  const currentProps = PROP_GROUPS[sport as keyof typeof PROP_GROUPS] || PROP_GROUPS.nba;
  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "??";

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700 text-yellow-400"><SelectValue placeholder="Select sport" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="nhl">🏒 NHL</SelectItem>
              <SelectItem value="soccer">⚽ Soccer</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search players..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-[#0f172a] border-gray-700 text-yellow-400" />
          </div>

          <Select value={selectedProp} onValueChange={setSelectedProp}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700 text-yellow-400"><SelectValue placeholder="Select prop" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              {currentProps.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" /><p className="text-gray-400">Scanning for +EV edges...</p></div>
        ) : sortedPlayers.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-[#020617] rounded-xl border border-gray-800">
            <p className="text-xl font-medium">No +EV opportunities found.</p>
            <p className="text-sm mt-2">Try lowering the edge threshold or changing sports.</p>
          </div>
        ) : (
          <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a] border-b border-gray-800">
                  <tr>
                    <SortHeader label="Player" sortKey="full_name" />
                    <SortHeader label="BETTING LINE" sortKey="line" />
                    <SortHeader label="Avg L10" sortKey="avgL10" />
                    <SortHeader label="Edge %" sortKey="edgePct" />
                    <SortHeader label="EV" sortKey="ev" />
                    <SortHeader label="Kelly $" sortKey="kellyStake" />
                    <SortHeader label="Rec" sortKey="recommendation" />
                    <th className="p-4 text-left text-yellow-400 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, i) => (
                    <tr key={`${p.player_id}-${i}`} onClick={() => handlePlayerClick(p.player_id)} className="border-b border-gray-800 hover:bg-[#0f172a] cursor-pointer transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm">
                            {getInitials(p.full_name)}
                          </div>
                          <div>
                            <p className="font-semibold text-yellow-400">{p.full_name}</p>
                            <p className="text-xs text-gray-400">{p.team} • {p.prop_type?.toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4"><Badge variant="outline" className="border-yellow-600 text-yellow-400 font-bold">{p.line}</Badge></td>
                      <td className="p-4 text-green-400 font-semibold">{p.avgL10}</td>
                      <td className="p-4"><span className={p.edgePct.includes('-') ? "text-red-400" : "text-green-400"}>{p.edgePct}%</span></td>
                      <td className="p-4"><span className={parseFloat(p.ev) > 0 ? "text-green-400" : "text-red-400"}>{p.ev}</span></td>
                      <td className="p-4 text-yellow-400 font-semibold">${p.kellyStake}</td>
                      <td className="p-4"><span className={`text-xs font-bold ${p.recommendation.includes('OVER') ? 'text-green-400' : p.recommendation.includes('UNDER') ? 'text-red-400' : 'text-gray-500'}`}>{p.recommendation}</span></td>
                      <td className="p-4">
                        <Button 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handlePlaceBet(p); }}
                          className="bg-green-600 hover:bg-green-700 text-xs h-7"
                        >
                          Place Bet
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SubmitLineModal open={showSubmitModal} onOpenChange={setShowSubmitModal} sport={sport} />
      </div>
    </DashboardLayout>
  );
}
