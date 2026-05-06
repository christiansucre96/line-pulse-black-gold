// src/pages/Leaderboard.tsx
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  TrendingUp,
  Target,
  Activity,
  Award,
  RefreshCw,
  Star,
  Zap,
  Calendar,
} from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Leader {
  player_id: string;
  name: string;
  team: string;
  position: string;
  games: number;
  hits: number;
  runs: number;
  rbi: number;
  home_runs: number;
  strikeouts: number;
}

export default function Leaderboard() {
  const [sport, setSport] = useState<"mlb" | "nba" | "nfl" | "nhl" | "soccer">("mlb");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    fetchLeaderboardData();
  }, [sport]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ operation: "get_leaders", sport }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load leaderboard");
      setLeaders(data.leaders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const topThree = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  const sportDisplay = sport.toUpperCase();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8" />
            🏆 Leaderboard
          </h1>
          <p className="text-gray-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Season totals – updated daily
          </p>
        </div>

        {/* Sport Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Sport</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as any)}
            className="w-full max-w-xs px-4 py-2 bg-[#1e293b] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-yellow-500"
          >
            <option value="mlb">⚾ MLB</option>
            <option value="nba">🏀 NBA</option>
            <option value="nfl">🏈 NFL</option>
            <option value="nhl">🏒 NHL</option>
            <option value="soccer">⚽ Soccer</option>
          </select>
        </div>

        <div className="mb-6 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLeaderboardData}
            disabled={loading}
            className="border-gray-700 text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            <p>❌ {error}</p>
            <Button
              variant="outline"
              onClick={fetchLeaderboardData}
              className="mt-4 border-gray-700 text-gray-300"
            >
              Retry
            </Button>
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3" />
            <p>No data available for {sportDisplay}</p>
            <p className="text-sm mt-2">Run sync or check back later</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {topThree.length > 0 && (
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {topThree.map((leader, index) => {
                  const medalColors = [
                    "from-yellow-400 to-yellow-600",
                    "from-gray-300 to-gray-500",
                    "from-orange-400 to-orange-600",
                  ];
                  const medalIcons = ["🥇", "🥈", "🥉"];

                  return (
                    <Card
                      key={leader.player_id}
                      className={`bg-gradient-to-b ${medalColors[index]} bg-opacity-10 border-2 ${
                        index === 0 ? "border-yellow-500/50" : "border-gray-600/50"
                      }`}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="text-4xl mb-3">{medalIcons[index]}</div>
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-xl">
                          {leader.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <h3 className="font-bold text-white text-lg mb-1">
                          {leader.name}
                        </h3>
                        <p className="text-sm text-gray-400 mb-3">
                          {leader.team} • {leader.position}
                        </p>
                        <div className="inline-block px-4 py-2 rounded-lg font-bold text-xl text-yellow-400 bg-yellow-500/20 border border-yellow-500/50">
                          {leader.home_runs} HR
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Home Runs</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Main Leaderboard Table */}
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-800 bg-gray-900/80">
                      <tr>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">Player</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">Team</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">G</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">Hits</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">Runs</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">RBI</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">HR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {rest.map((leader, idx) => (
                        <tr
                          key={leader.player_id}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="p-4 text-gray-400 font-mono">{idx + 4}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-xs">
                                {leader.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{leader.name}</p>
                                <p className="text-xs text-gray-500">{leader.position}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-gray-300">{leader.team}</td>
                          <td className="p-4 text-center text-gray-300">{leader.games}</td>
                          <td className="p-4 text-center text-gray-300">{leader.hits}</td>
                          <td className="p-4 text-center text-gray-300">{leader.runs}</td>
                          <td className="p-4 text-center text-gray-300">{leader.rbi}</td>
                          <td className="p-4 text-center">
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                              {leader.home_runs}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Star className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                  <p className="text-2xl font-bold text-white">{leaders.length}</p>
                  <p className="text-xs text-gray-500">Players Tracked</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Target className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaders.reduce((sum, l) => sum + l.home_runs, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Total Home Runs</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Activity className="w-6 h-6 mx-auto mb-2 text-green-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaders.filter(l => l.home_runs >= 20).length}
                  </p>
                  <p className="text-xs text-gray-500">20+ HR Club</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Zap className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaders.length > 0 ? (leaders[0]?.home_runs || 0) : 0}
                  </p>
                  <p className="text-xs text-gray-500">Leader HRs</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
