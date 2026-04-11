// src/pages/Scanner.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronDown, TrendingUp, Activity } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Prop types for different sports
const PROP_TYPES = {
  nba: [
    { id: "points", label: "Points", combo: false },
    { id: "rebounds", label: "Rebounds", combo: false },
    { id: "assists", label: "Assists", combo: false },
    { id: "steals", label: "Steals", combo: false },
    { id: "blocks", label: "Blocks", combo: false },
    { id: "threes", label: "3-Pointers Made", combo: false },
    { id: "ptra", label: "Points+Rebounds+Assists", combo: true },
    { id: "pr", label: "Points+Rebounds", combo: true },
    { id: "pa", label: "Points+Assists", combo: true },
    { id: "ra", label: "Rebounds+Assists", combo: true },
  ],
  nfl: [
    { id: "passYards", label: "Passing Yards", combo: false },
    { id: "passTD", label: "Passing TDs", combo: false },
    { id: "rushYards", label: "Rushing Yards", combo: false },
    { id: "rushTD", label: "Rushing TDs", combo: false },
    { id: "recYards", label: "Receiving Yards", combo: false },
    { id: "rec", label: "Receptions", combo: false },
    { id: "ptra", label: "Pass+Rush+Rec Yards", combo: true },
  ],
  mlb: [
    { id: "hits", label: "Hits", combo: false },
    { id: "homeRuns", label: "Home Runs", combo: false },
    { id: "rbi", label: "RBI", combo: false },
    { id: "runs", label: "Runs", combo: false },
    { id: "strikeouts", label: "Strikeouts (Pitcher)", combo: false },
  ],
  nhl: [
    { id: "goals", label: "Goals", combo: false },
    { id: "assists", label: "Assists", combo: false },
    { id: "points", label: "Points", combo: false },
    { id: "shots", label: "Shots on Goal", combo: false },
  ],
  soccer: [
    { id: "goals", label: "Goals", combo: false },
    { id: "assists", label: "Assists", combo: false },
    { id: "shots", label: "Shots", combo: false },
    { id: "shotsOnTarget", label: "Shots on Target", combo: false },
  ],
};

const SPORTSBOOKS = ["Stake", "BetOnline", "DraftKings", "FanDuel", "BetMGM"];

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProps, setSelectedProps] = useState<string[]>(["points"]);
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>(["Stake", "BetOnline"]);
  const [selectedGame, setSelectedGame] = useState<string>("");
  
  const playerId = searchParams.get("playerId");

  useEffect(() => {
    if (playerId) return;
    fetchPlayers();
  }, [sport, searchQuery, selectedProps]);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_players_with_stats",
          sport,
          search: searchQuery || undefined,
          props: selectedProps,
          bookmakers: selectedBookmakers,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch players");
      }

      setPlayers(data.players || []);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerClick = (playerId: string) => {
    navigate(`/scanner?playerId=${playerId}&sport=${sport}&props=${selectedProps.join(",")}`);
  };

  const handleBack = () => {
    navigate("/scanner");
  };

  const toggleProp = (propId: string) => {
    setSelectedProps(prev => 
      prev.includes(propId) 
        ? prev.filter(p => p !== propId)
        : [...prev, propId]
    );
  };

  const toggleBookmaker = (bookmaker: string) => {
    setSelectedBookmakers(prev =>
      prev.includes(bookmaker)
        ? prev.filter(b => b !== bookmaker)
        : [...prev, bookmaker]
    );
  };

  if (playerId) {
    return (
      <PlayerDetailView 
        playerId={playerId} 
        sport={sport}
        selectedProps={selectedProps}
        onBack={handleBack} 
      />
    );
  }

  const currentProps = PROP_TYPES[sport as keyof typeof PROP_TYPES] || PROP_TYPES.nba;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">📊 Line Pulse Scanner</h1>
          <p className="text-gray-400 text-sm">
            Find betting edges across all major sportsbooks
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Sport Selector */}
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="bg-[#0f172a] border-gray-700 text-yellow-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem>
              <SelectItem value="nhl">🏒 NHL</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="soccer">⚽ Soccer</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0f172a] border-gray-700 text-yellow-400"
            />
          </div>

          {/* Sportsbooks Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full bg-[#0f172a] border-gray-700 text-yellow-400 justify-between">
                {selectedBookmakers.length} Books
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#0f172a] border-gray-700">
              <DropdownMenuLabel>Sportsbooks</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              {SPORTSBOOKS.map(book => (
                <DropdownMenuCheckboxItem
                  key={book}
                  checked={selectedBookmakers.includes(book)}
                  onCheckedChange={() => toggleBookmaker(book)}
                  className="text-yellow-400 focus:text-yellow-300"
                >
                  {book}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Props Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full bg-[#0f172a] border-gray-700 text-yellow-400 justify-between">
                {selectedProps.length} Props
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#0f172a] border-gray-700 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Player Props</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              {currentProps.map(prop => (
                <DropdownMenuCheckboxItem
                  key={prop.id}
                  checked={selectedProps.includes(prop.id)}
                  onCheckedChange={() => toggleProp(prop.id)}
                  className="text-yellow-400 focus:text-yellow-300"
                >
                  {prop.label} {prop.combo && "(Combo)"}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">❌ {error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchPlayers}>
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading players...</p>
          </div>
        )}

        {/* Players Table */}
        {!loading && !error && players.length > 0 && (
          <div className="bg-[#020617] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a] border-b border-gray-800">
                  <tr>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Player</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Apps</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Line</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Avg L10</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Diff ↓↑</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">L5 ↑↓</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">L10 ↑↓</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">L15 ↑↓</th>
                    <th className="p-4 text-left text-yellow-400 font-semibold">Strk ↑↓</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => (
                    <tr 
                      key={`${player.player_id}-${idx}`}
                      onClick={() => handlePlayerClick(player.player_id)}
                      className="border-b border-gray-800 hover:bg-[#0f172a] cursor-pointer transition"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black font-bold text-sm">
                            {player.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-yellow-400">{player.full_name}</p>
                            <p className="text-xs text-gray-400">{player.team} {player.injury_status && `• ${player.injury_status}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{player.bookmaker}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                          {player.line}
                        </Badge>
                      </td>
                      <td className="p-4 text-green-400 font-semibold">{player.avgL10?.toFixed(1)}</td>
                      <td className="p-4">
                        <span className={player.diff > 0 ? "text-green-400" : "text-red-400"}>
                          {player.diff > 0 ? "+" : ""}{player.diff?.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={player.l5HitRate >= 50 ? "text-green-400" : "text-red-400"}>
                          {player.l5HitRate}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={player.l10HitRate >= 50 ? "text-green-400" : "text-red-400"}>
                          {player.l10HitRate}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={player.l15HitRate >= 50 ? "text-green-400" : "text-red-400"}>
                          {player.l15HitRate}%
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`h-4 w-4 ${player.streak > 0 ? "text-green-400" : "text-red-400"}`} />
                          <span className={player.streak > 0 ? "text-green-400" : "text-red-400"}>
                            {player.streak}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && players.length === 0 && (
          <div className="text-center py-12 bg-[#020617] rounded-xl border border-gray-800">
            <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No players found matching your criteria</p>
            <Button variant="link" onClick={() => { setSearchQuery(""); setSelectedProps(["points"]); }} className="mt-2 text-yellow-400">
              Clear filters
            </Button>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
