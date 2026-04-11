// src/pages/Scanner.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { SubmitLineModal } from "@/components/SubmitLineModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, PlusCircle } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"];
const BOOKS = ["Stake", "BetOnline", "DraftKings", "FanDuel"];
const PROPS = ["points", "rebounds", "assists", "PRA"];

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProp, setSelectedProp] = useState("points");
  const [selectedBook, setSelectedBook] = useState("Stake");
  const [showModal, setShowModal] = useState(false);
  
  const playerId = searchParams.get("playerId");

  useEffect(() => {
    if (playerId) return;
    fetchData();
  }, [sport, searchQuery, selectedProp, selectedBook]);

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
          props: [selectedProp],
          bookmakers: [selectedBook],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setPlayers(data.players || []);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (playerId) return <PlayerDetailView playerId={playerId} sport={sport} selectedProps={[selectedProp]} onBack={() => navigate("/scanner")} />;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a]">
              {SPORTS.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-[#0f172a] border-gray-700" />
          </div>

          <Select value={selectedBook} onValueChange={setSelectedBook}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700"><SelectValue placeholder="Book" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a]">
              {BOOKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedProp} onValueChange={setSelectedProp}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700"><SelectValue placeholder="Prop" /></SelectTrigger>
            <SelectContent className="bg-[#0f172a]">
              {PROPS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {error && <div className="bg-red-900/20 text-red-400 p-4 rounded mb-4">❌ {error}</div>}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f172a]">
                <tr>
                  <th className="p-4 text-left">Player</th>
                  <th className="p-4 text-left">Book</th>
                  <th className="p-4 text-left">Line</th>
                  <th className="p-4 text-left">Avg</th>
                  <th className="p-4 text-left">Edge</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i} onClick={() => navigate(`/scanner?playerId=${p.player_id}`)} className="border-t border-gray-800 hover:bg-[#0f172a] cursor-pointer">
                    <td className="p-4">
                      <div className="font-semibold text-yellow-400">{p.full_name}</div>
                      <div className="text-xs text-gray-400">{p.team}</div>
                    </td>
                    <td className="p-4"><Badge variant="outline">{p.bookmaker}</Badge></td>
                    <td className="p-4 font-bold text-yellow-400">{p.line}</td>
                    <td className="p-4 text-green-400">{p.avgL10?.toFixed(1)}</td>
                    <td className={`p-4 font-bold ${p.diff > 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.diff > 0 ? "+" : ""}{p.diff?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <SubmitLineModal open={showModal} onOpenChange={setShowModal} sport={sport} />
      </div>
    </DashboardLayout>
  );
}
