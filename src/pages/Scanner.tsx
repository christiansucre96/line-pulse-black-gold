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

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  
  const playerId = searchParams.get("playerId");

  // ✅ Fetch players — PROPER POST REQUEST for your original Edge Function
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ CRITICAL: Must be POST with JSON body for Edge Functions
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          operation: "get_players",  // ✅ Your original operation name
          sport: sport,
        }),
      });

      // ✅ Check response status
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch players");
      }

      // ✅ Map your Edge Function response to UI format
      const mapped = (data.players || []).map((p: any) => ({
        player_id: p.player_id,
        full_name: p.name || p.full_name || "Unknown",
        team: p.team_abbr || p.team || "N/A",
        line: p.line?.toFixed(1) || "0.0",
        avgL10: p.avg_last10?.toFixed(1) || "0.0",
        diff: p.diff?.toFixed(1) || "0.0",
        edgePct: `${((p.confidence || 50) - 50).toFixed(1)}%`,
        ev: (p.edge_type === "OVER" ? 0.05 : p.edge_type === "UNDER" ? -0.05 : 0).toFixed(3),
        recommendation: p.edge_type === "OVER" ? "OVER" : p.edge_type === "UNDER" ? "UNDER" : "NO BET",
        prop_type: p.prop_type || "points",
        opponent: p.opponent || "TBD",
      }));

      setPlayers(mapped);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch when sport changes (not if viewing player detail)
  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport]);

  // ✅ Sorting & Filtering Logic
  const sortedPlayers = useMemo(() => {
    let sorted = [...players];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(p => 
        p.full_name?.toLowerCase().includes(q) || 
        p.team?.toLowerCase().includes(q)
      );
    }
    
    // Sort
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
  }, [players, searchQuery, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  // ✅ Navigation handlers
  const handlePlayerClick = (id: string) => {
    navigate(`/scanner?playerId=${id}&sport=${sport}`);
  };
  
  const handleBack = () => {
    navigate("/scanner");
  };

  // ✅ Show Player Detail View if playerId in URL
  if (playerId) {
    return (
      <PlayerDetailView 
        playerId={playerId} 
        sport={sport} 
        selectedProps={["points"]} 
        onBack={handleBack} 
      />
    );
  }

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  // ✅ Sortable Header Component
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">📊 Line Pulse Scanner</h1>
          <p className="text-gray-400 text-sm">Find betting edges across all major sportsbooks</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* Sport Selector */}
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
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search players..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 bg-[#0f172a] border-gray-700 text-yellow-400" 
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-400">
            ❌ {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading players...</p>
          </div>
        ) : sortedPlayers.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 text-gray-500 bg-[#020617] rounded-xl border border-gray-800">
            <p className="text-xl font-medium">No players found.</p>
            <p className="text-sm mt-2">Try selecting a different sport or clearing your search.</p>
          </div>
        ) : (
          /* Results Table */
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
                      {/* Player */}
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
                      
                      {/* Line */}
                      <td className="p-4">
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400 font-bold">
                          {p.line}
                        </Badge>
                      </td>
                      
                      {/* Avg L10 */}
                      <td className="p-4 text-green-400 font-semibold">{p.avgL10}</td>
                      
                      {/* Edge % */}
                      <td className="p-4">
                        <span className={p.edgePct?.includes('-') ? "text-red-400" : "text-green-400"}>
                          {p.edgePct}
                        </span>
                      </td>
                      
                      {/* EV */}
                      <td className="p-4">
                        <span className={parseFloat(p.ev) > 0 ? "text-green-400" : "text-red-400"}>
                          {p.ev}
                        </span>
                      </td>
                      
                      {/* Recommendation */}
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

        {/* Submit Line Modal */}
        <SubmitLineModal 
          open={false} 
          onOpenChange={() => {}}
          sport={sport}
        />
      </div>
    </DashboardLayout>
  );
}
