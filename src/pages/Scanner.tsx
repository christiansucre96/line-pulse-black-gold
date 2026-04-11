// src/pages/Scanner.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, ArrowLeft } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // 👇 If playerId is in URL, show PlayerDetailView instead of list
  const playerId = searchParams.get("playerId") || searchParams.get("player");

  useEffect(() => {
    if (playerId) return; // Don't fetch list if viewing single player
    fetchPlayers();
  }, [playerId]);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_players_with_stats",
          sport: "nba",
          search: searchQuery || undefined,
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
    // Navigate to same page but with playerId param
    navigate(`/scanner?playerId=${playerId}`);
  };

  const handleBack = () => {
    // Remove playerId param to go back to list
    navigate("/scanner");
  };

  // 👇 If viewing single player, show PlayerDetailView
  if (playerId) {
    return <PlayerDetailView playerId={playerId} onBack={handleBack} />;
  }

  // 👇 Otherwise show player list
  return (
    <DashboardLayout>
      <div className="p-4 max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">🏀 NBA Player Scanner</h1>
          <p className="text-gray-400 text-sm">
            Find players with betting edges. Click a player to see detailed stats.
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              onKeyDown={(e) => e.key === "Enter" && fetchPlayers()}
            />
          </div>
          <Button onClick={fetchPlayers} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </Button>
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
            <div className="animate-spin h-8 w-8 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading players...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && players.length === 0 && (
          <div className="text-center py-12 bg-[#020617] rounded-xl border border-gray-800">
            <User className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery ? `No players found for "${searchQuery}"` : "No players available"}
            </p>
            {searchQuery && (
              <Button variant="link" onClick={() => { setSearchQuery(""); fetchPlayers(); }} className="mt-2">
                Clear search
              </Button>
            )}
          </div>
        )}

        {/* Players List */}
        {!loading && !error && players.length > 0 && (
          <div className="grid gap-3">
            {players.map((player) => (
              <button
                key={player.player_id}
                onClick={() => handlePlayerClick(player.player_id)}
                className="flex items-center justify-between p-4 bg-[#020617] hover:bg-[#0f172a] border border-gray-800 rounded-xl text-left transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {player.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-blue-400 transition">
                      {player.full_name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {player.team} • {player.position}
                    </p>
                  </div>
                </div>
                
                <div className="text-right text-sm">
                  <p className="text-green-400 font-medium">{player.avg_points?.toFixed(1)} PPG</p>
                  <p className="text-gray-500">{player.avg_rebounds?.toFixed(1)} REB • {player.avg_assists?.toFixed(1)} AST</p>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
