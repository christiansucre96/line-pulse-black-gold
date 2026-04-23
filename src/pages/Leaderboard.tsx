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
  TrendingDown,
  Target,
  Activity,
  Award,
  RefreshCw,
  Star,
  Zap,
} from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  position: string;
}

interface LeaderboardEntry {
  rank: number;
  player: Player;
  propType: string;
  propLabel: string;
  hitRateL5: number;
  hitRateL10: number;
  hitRateL15: number;
  hitRateL20: number;
  currentStreak: { type: string; count: number };
  avgVsLine: number;
  consistency: number;
  gamesPlayed: number;
  confidence: number;
}

const PROP_LABELS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  three_pointers_made: "3PM",
  steals: "Steals",
  blocks: "Blocks",
  combo_pra: "PRA",
  combo_pr: "P+R",
  combo_pa: "P+A",
};

export default function Leaderboard() {
  const [sport, setSport] = useState("nba");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"hitRate" | "streak" | "edge">("hitRate");
  const [propFilter, setPropFilter] = useState("all");
  const [timeWindow, setTimeWindow] = useState("L10");

  useEffect(() => {
    fetchLeaderboardData();
  }, [sport, propFilter]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "get_players",
          sport,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // 📊 Calculate leaderboard entries from player data
  const leaderboardData: LeaderboardEntry[] = useMemo(() => {
    const entries: LeaderboardEntry[] = [];

    for (const player of players) {
      if (!player.all_props) continue;

      for (const [propType, propData] of Object.entries(player.all_props)) {
        const data = propData as any;
        if (!data?.l10 || data.games_n < 5) continue;

        // Filter by prop type if selected
        if (propFilter !== "all" && propType !== propFilter) continue;

        // Calculate consistency (standard deviation inverse)
        const values = data.values || [];
        const avg = data.avg_l10 || 0;
        const variance = values.length > 0
          ? values.reduce((sum: number, v: number) => sum + Math.pow(v - avg, 2), 0) / values.length
          : 0;
        const consistency = Math.max(0, 100 - Math.sqrt(variance) / avg * 100);

        entries.push({
          rank: 0, // Will be set after sorting
          player: {
            player_id: player.player_id,
            name: player.name,
            team_abbr: player.team_abbr,
            position: player.position,
          },
          propType,
          propLabel: PROP_LABELS[propType] || propType,
          hitRateL5: data.l5 || 0,
          hitRateL10: data.l10 || 0,
          hitRateL15: data.l15 || 0,
          hitRateL20: data.l20 || 0,
          currentStreak: data.streak || { type: "Under", count: 0 },
          avgVsLine: data.avg_l10 - data.line || 0,
          consistency: Math.round(consistency),
          gamesPlayed: data.games_n || 0,
          confidence: data.confidence || 0,
        });
      }
    }

    // Sort based on selected criteria
    entries.sort((a, b) => {
      if (sortBy === "hitRate") {
        return (b.hitRateL10 || 0) - (a.hitRateL10 || 0);
      } else if (sortBy === "streak") {
        const aStreak = a.currentStreak.type === "Over" ? a.currentStreak.count : -a.currentStreak.count;
        const bStreak = b.currentStreak.type === "Over" ? b.currentStreak.count : -b.currentStreak.count;
        return bStreak - aStreak;
      } else if (sortBy === "edge") {
        return b.avgVsLine - a.avgVsLine;
      }
      return 0;
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }, [players, sortBy, propFilter]);

  // Get top 3 for podium
  const topThree = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);

  // Available prop types for filter
  const availablePropTypes = useMemo(() => {
    const types = new Set<string>();
    for (const player of players) {
      if (player.all_props) {
        Object.keys(player.all_props).forEach(prop => types.add(prop));
      }
    }
    return Array.from(types).sort();
  }, [players]);

  const getHitRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-400 bg-green-500/20 border-green-500/50";
    if (rate >= 60) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/50";
    return "text-red-400 bg-red-500/20 border-red-500/50";
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8" />
            🏆 Leaderboard
          </h1>
          <p className="text-gray-400">
            Top performers across all props • Live data updated hourly
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="hitRate">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Hit Rate
                </div>
              </SelectItem>
              <SelectItem value="streak">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Hot Streak
                </div>
              </SelectItem>
              <SelectItem value="edge">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Edge (Diff)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={propFilter} onValueChange={setPropFilter}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue placeholder="All Props" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 max-h-64">
              <SelectItem value="all">All Props</SelectItem>
              {availablePropTypes.map(prop => (
                <SelectItem key={prop} value={prop}>
                  {PROP_LABELS[prop] || prop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="L5">Last 5</SelectItem>
              <SelectItem value="L10">Last 10</SelectItem>
              <SelectItem value="L15">Last 15</SelectItem>
              <SelectItem value="L20">Last 20</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLeaderboardData}
            disabled={loading}
            className="border-gray-700 text-gray-300 ml-auto"
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
        ) : leaderboardData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3" />
            <p>No data available</p>
            <p className="text-sm mt-2">Run Full Ingest to populate leaderboard</p>
          </div>
        ) : (
          <>
            {/*  Podium - Top 3 */}
            {topThree.length > 0 && (
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {topThree.map((entry, index) => {
                  const medalColors = [
                    "from-yellow-400 to-yellow-600", // Gold
                    "from-gray-300 to-gray-500",     // Silver
                    "from-orange-400 to-orange-600", // Bronze
                  ];
                  const medalIcons = ["🥇", "🥈", "🥉"];

                  return (
                    <Card
                      key={entry.player.player_id + entry.propType}
                      className={`bg-gradient-to-b ${medalColors[index]} bg-opacity-10 border-2 ${
                        index === 0 ? "border-yellow-500/50" : "border-gray-600/50"
                      }`}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="text-4xl mb-3">{medalIcons[index]}</div>
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-xl">
                          {entry.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <h3 className="font-bold text-white text-lg mb-1">
                          {entry.player.name}
                        </h3>
                        <p className="text-sm text-gray-400 mb-3">
                          {entry.player.team_abbr} • {entry.propLabel}
                        </p>
                        <div className={`inline-block px-4 py-2 rounded-lg font-bold text-xl ${getHitRateColor(entry.hitRateL10)}`}>
                          {entry.hitRateL10}%
                        </div>
                        <p className="text-xs text-gray-500 mt-2">L10 Hit Rate</p>
                        {entry.currentStreak.type === "Over" && entry.currentStreak.count >= 3 && (
                          <div className="mt-3 flex items-center justify-center gap-1 text-green-400 text-sm">
                            <TrendingUp className="w-4 h-4" />
                            Over {entry.currentStreak.count}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 📊 Full Leaderboard Table */}
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-800 bg-gray-900/80">
                      <tr>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">Player</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase">Prop</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">L5</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">L10</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">L15</th>
                        <th className="p-4 text-center text-xs font-semibold text-gray-400 uppercase">Streak</th>
                        <th className="p-4 text-right text-xs font-semibold text-gray-400 uppercase">Edge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {rest.map((entry) => (
                        <tr
                          key={entry.player.player_id + entry.propType}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="p-4 text-gray-400 font-mono">{entry.rank}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-xs">
                                {entry.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{entry.player.name}</p>
                                <p className="text-xs text-gray-500">
                                  {entry.player.team_abbr} • {entry.player.position}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="border-blue-500 text-blue-400">
                              {entry.propLabel}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={getHitRateColor(entry.hitRateL5)}>
                              {entry.hitRateL5}%
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={getHitRateColor(entry.hitRateL10)}>
                              {entry.hitRateL10}%
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={getHitRateColor(entry.hitRateL15)}>
                              {entry.hitRateL15}%
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            {entry.currentStreak.type === "Over" ? (
                              <span className="text-green-400 text-sm flex items-center justify-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {entry.currentStreak.count}
                              </span>
                            ) : (
                              <span className="text-red-400 text-sm flex items-center justify-center gap-1">
                                <TrendingDown className="w-3 h-3" />
                                {entry.currentStreak.count}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-mono font-bold ${
                              entry.avgVsLine > 0 ? "text-green-400" : "text-red-400"
                            }`}>
                              {entry.avgVsLine > 0 ? "+" : ""}{entry.avgVsLine.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Star className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                  <p className="text-2xl font-bold text-white">{leaderboardData.length}</p>
                  <p className="text-xs text-gray-500">Total Props Tracked</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaderboardData.filter(e => e.currentStreak.type === "Over" && e.currentStreak.count >= 3).length}
                  </p>
                  <p className="text-xs text-gray-500">Hot Streaks (3+)</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Target className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaderboardData.filter(e => e.hitRateL10 >= 80).length}
                  </p>
                  <p className="text-xs text-gray-500">80%+ Hit Rate</p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-4 text-center">
                  <Zap className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                  <p className="text-2xl font-bold text-white">
                    {leaderboardData.filter(e => e.avgVsLine >= 10).length}
                  </p>
                  <p className="text-xs text-gray-500">Strong Edge (10%+)</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
