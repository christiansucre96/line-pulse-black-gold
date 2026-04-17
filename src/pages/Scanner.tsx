// src/pages/Scanner.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { SubmitLineModal } from "@/components/SubmitLineModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ✅ Prop type groups by sport
const PROP_GROUPS: Record<string, { id: string; label: string }[]> = {
  nba: [
    { id: "points", label: "PTS" },
    { id: "rebounds", label: "REB" },
    { id: "assists", label: "AST" },
    { id: "threes", label: "3PM" },
    { id: "steals", label: "STL" },
    { id: "blocks", label: "BLK" },
    { id: "Pts+Reb", label: "P+R" },
    { id: "Pts+Ast", label: "P+A" },
    { id: "Reb+Ast", label: "R+A" },
    { id: "Pts+Reb+Ast", label: "PRA" }
  ],
  nfl: [
    { id: "passing_yards", label: "Pass Yds" },
    { id: "rushing_yards", label: "Rush Yds" },
    { id: "receiving_yards", label: "Rec Yds" },
    { id: "passing_tds", label: "Pass TD" },
    { id: "receptions", label: "Rec" }
  ],
  mlb: [
    { id: "hits", label: "H" },
    { id: "runs", label: "R" },
    { id: "rbi", label: "RBI" },
    { id: "home_runs", label: "HR" }
  ],
  nhl: [
    { id: "goals", label: "G" },
    { id: "assists_hockey", label: "A" },
    { id: "shots_on_goal", label: "SOG" }
  ],
  soccer: [
    { id: "goals_soccer", label: "G" },
    { id: "assists_soccer", label: "A" },
    { id: "shots_soccer", label: "Shots" }
  ]
};

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [selectedProp, setSelectedProp] = useState("points");
  const [viewMode, setViewMode] = useState<"all" | "over" | "under">("all");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  
  const playerId = searchParams.get("playerId");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          operation: "get_players",
          sport: sport,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch players");
      }

      let filteredPlayers = data.players || [];
      if (selectedProp && selectedProp !== "all") {
        filteredPlayers = filteredPlayers.filter((p: any) => 
          p.prop_type?.toLowerCase() === selectedProp.toLowerCase() ||
          p.stat_type?.toLowerCase() === selectedProp.toLowerCase()
        );
      }

      const mapped = filteredPlayers.map((p: any) => {
        const lineVal = p.line ?? p.baseline_line ?? p.projected_value ?? 0;
        const avgVal = p.avg_last10 ?? p.avgL10 ?? p.avg_last5 ?? 0;
        const conf = p.confidence_score ?? p.confidence ?? 50;
        const edgeType = p.edge_type ?? (conf > 55 ? "OVER" : conf < 45 ? "UNDER" : "NONE");
        
        return {
          player_id: p.player_id,
          full_name: p.name || p.full_name || "Unknown",
          team: p.team_abbr || p.team || "N/A",
          position: p.position || "N/A",
          line: parseFloat(lineVal).toFixed(1),
          avgL10: parseFloat(avgVal).toFixed(1),
          diff: (parseFloat(avgVal) - parseFloat(lineVal)).toFixed(1),
          edgePct: `${(conf - 50).toFixed(1)}%`,
          ev: edgeType === "OVER" ? "0.050" : edgeType === "UNDER" ? "-0.050" : "0.000",
          recommendation: edgeType === "OVER" ? "OVER" : edgeType === "UNDER" ? "UNDER" : "NO BET",
          prop_type: p.prop_type || p.stat_type || selectedProp,
          opponent: p.opponent || "TBD",
          _confidence: conf,
          _ev: edgeType === "OVER" ? 0.05 : edgeType === "UNDER" ? -0.05 : 0,
        };
      });

      console.log(`✅ Mapped ${mapped.length} players (filtered by ${selectedProp})`);
      setPlayers(mapped);
      
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport, selectedProp]);

  const sortedPlayers = useMemo(() => {
    let sorted = [...players];
    
    if (viewMode === "over") {
      sorted = sorted.filter(p => parseFloat(p.avgL10) > parseFloat(p.line));
    } else if (viewMode === "under") {
      sorted = sorted.filter(p => parseFloat(p.avgL10) <= parseFloat(p.line));
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(p => 
        p.full_name?.toLowerCase().includes(q) || 
        p.team?.toLowerCase().includes(q)
      );
    }
    
    if (sortConfig?.key) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortConfig.direction === "asc" 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        const aNum = parseFloat(aVal) || 0;
        const bNum = parseFloat(bVal) || 0;
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      });
    }
    
    return sorted;
  }, [players, viewMode, searchQuery, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  // ✅ UPDATED: Navigate to player detail with sport parameter
  const handlePlayerClick = (id: string) => {
    navigate(`/scanner?playerId=${id}&sport=${sport}`);
  };
  
  const handleBack = () => {
    navigate("/scanner");
  };

  if (playerId) {
    return (
      <PlayerDetailView 
        playerId={playerId} 
        sport={sport} 
        selectedProps={[selectedProp]} 
        onBack={handleBack} 
      />
    );
  }

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
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

  const currentProps = PROP_GROUPS[sport as keyof typeof PROP_GROUPS] || PROP_GROUPS.nba;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">📊 Line Pulse Scanner</h1>
          <p className="text-gray-400 text-sm">Find betting edges across all major sportsbooks</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-full md:w-[180px] bg-[#0f172a] border-gray-700 text-yellow-400">
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="nhl">🏒 NHL</SelectItem>
              <SelectItem value="soccer">⚽ Soccer</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search players..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 bg-[#0f172a] border-gray-700 text-yellow-400" 
            />
          </div>

          <Select value={selectedProp} onValueChange={setSelectedProp}>
            <SelectTrigger className="w-full md:w-[180px] bg-[#0f172a] border-gray-700 text-yellow-400">
              <SelectValue placeholder="Select prop" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              <SelectItem value="all">All Props</SelectItem>
              {currentProps.map(prop => (
                <SelectItem key={prop.id} value={prop.id}>{prop.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 mb-6">
          {(["all", "over", "under"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === mode
                  ? "bg-yellow-500 text-black"
                  : "bg-[#0f172a] text-gray-400 border border-gray-700 hover:border-yellow-600"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-400">
            ❌ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading players...</p>
          </div>
        ) : sortedPlayers.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-[#020617] rounded-xl border border-gray-800">
            <p className="text-xl font-medium">No players found.</p>
            <p className="text-sm mt-2">Try selecting a different sport, prop, or clearing filters.</p>
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
                    <SortHeader label="Rec" sortKey="recommendation" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, i) => (
                    <tr 
                      key={`${p.player_id}-${i}`} 
                      onClick={() => handlePlayerClick(p.player_id)} 
                      className="border-b border-gray-800 hover:bg-[#0f172a] cursor-pointer transition"
                    >
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
                      <td className="p-4">
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400 font-bold">
                          {p.line}
                        </Badge>
                      </td>
                      <td className="p-4 text-green-400 font-semibold">{p.avgL10}</td>
                      <td className="p-4">
                        <span className={p.edgePct?.includes('-') ? "text-red-400" : "text-green-400"}>
                          {p.edgePct}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={parseFloat(p.ev) > 0 ? "text-green-400" : "text-red-400"}>
                          {p.ev}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold ${
                          p.recommendation?.includes('OVER') ? 'text-green-400' : 
                          p.recommendation?.includes('UNDER') ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          {p.recommendation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SubmitLineModal 
          open={false} 
          onOpenChange={() => {}}
          sport={sport}
        />
      </div>
    </DashboardLayout>
  );
}
