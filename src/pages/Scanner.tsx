// src/pages/Scanner.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { SubmitLineModal } from "@/components/SubmitLineModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, PlusCircle } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  
  const playerId = searchParams.get("playerId");

  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_players_with_stats",
          sport,
          search: searchQuery || undefined,
          props: ["points"],
          bookmakers: ["Stake"],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      // ✅ Ensure players is always an array
      setPlayers(Array.isArray(data.players) ? data.players : []);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerClick = (id: string) => {
    navigate(`/scanner?playerId=${id}&sport=${sport}`);
  };

  // ✅ If playerId exists, render PlayerDetailView
  if (playerId) {
    return (
      <PlayerDetailView 
        playerId={playerId} 
        sport={sport} 
        selectedProps={["points"]} 
        onBack={() => navigate("/scanner")} 
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-2xl font-bold text-yellow-400">📊 Line Pulse Scanner</h1>
          <Button onClick={() => setShowModal(true)} className="bg-yellow-500 text-black">
            <PlusCircle className="h-4 w-4 mr-2" /> Report Line
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a]">
              <SelectItem value="nba">🏀 NBA</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="nhl">🏒 NHL</SelectItem>
              <SelectItem value="soccer">⚽ Soccer</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 bg-[#0f172a] border-gray-700" 
            />
          </div>
        </div>

        {error && <div className="bg-red-900/20 text-red-400 p-4 rounded mb-4">❌ {error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr>
                  <th className="p-4 text-left text-yellow-400">Player</th>
                  <th className="p-4 text-left text-yellow-400">BETTING LINE</th>
                  <th className="p-4 text-left text-yellow-400">Avg</th>
                  <th className="p-4 text-left text-yellow-400">Edge</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p: any, i: number) => {
                  // ✅ Safe string handling
                  const name = typeof p.full_name === "string" ? p.full_name : "Unknown";
                  const team = typeof p.team === "string" ? p.team : "";
                  const line = p.line ? String(p.line) : "-";
                  const avg = typeof p.avgL10 === "number" ? p.avgL10.toFixed(1) : "-";
                  const diff = typeof p.diff === "number" 
                    ? (p.diff > 0 ? "+" : "") + p.diff.toFixed(1) 
                    : "-";

                  return (
                    <tr 
                      key={i} 
                      onClick={() => handlePlayerClick(p.player_id)} 
                      className="border-t border-gray-800 hover:bg-[#0f172a] cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-yellow-400">{name}</div>
                        <div className="text-xs text-gray-400">{team}</div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400 font-bold">
                          {line}
                        </Badge>
                      </td>
                      <td className="p-4 text-green-400">{avg}</td>
                      <td className={`p-4 font-bold ${typeof p.diff === "number" && p.diff > 0 ? "text-green-400" : "text-red-400"}`}>
                        {diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <SubmitLineModal open={showModal} onOpenChange={setShowModal} sport={sport} />
      </div>
    </DashboardLayout>
  );
}
