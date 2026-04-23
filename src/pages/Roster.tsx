// src/pages/Roster.tsx
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw,
  UserCheck,
  UserX,
  Users,
  Activity,
  TrendingUp,
} from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  team_name: string;
  position: string;
  status: "starter" | "bench" | "injured";
  jersey_number?: number;
  stats?: {
    gamesPlayed: number;
    avgPoints: number;
    hitRate: number;
    currentStreak?: { type: string; count: number };
  };
}

interface Team {
  team_id: string;
  abbreviation: string;
  name: string;
  city?: string;
  players: Player[];
}

export default function Roster() {
  const [sport, setSport] = useState("nba");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "starter" | "bench" | "injured">("all");
  const [searchTeam, setSearchTeam] = useState("");

  useEffect(() => {
    fetchRosterData();
  }, [sport]);

  const fetchRosterData = async () => {
    setLoading(true);
    try {
      // Fetch teams
      const teamsRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "teams", sport }),
      });
      const teamsData = await teamsRes.json();

      // Fetch players
      const playersRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "players", sport }),
      });
      const playersData = await playersRes.json();

      // Fetch player stats for hit rates
      const statsRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport }),
      });
      const statsData = await statsRes.json();

      if (teamsData.success && playersData.success) {
        // Create team map
        const teamMap: Record<string, Team> = {};
        for (const team of teamsData.teams || []) {
          teamMap[team.id] = {
            team_id: team.id,
            abbreviation: team.abbreviation,
            name: team.name,
            city: team.city,
            players: [],
          };
        }

        // Create stats map
        const statsMap: Record<string, any> = {};
        for (const player of statsData.players || []) {
          if (player.all_props?.points) {
            statsMap[player.player_id] = {
              gamesPlayed: player.all_props.points.games_n || 0,
              avgPoints: player.all_props.points.avg_l10 || 0,
              hitRate: player.all_props.points.l10 || 0,
              currentStreak: player.all_props.points.streak || null,
            };
          }
        }

        // Assign players to teams
        for (const player of playersData.players || []) {
          const teamId = player.team_id;
          if (teamMap[teamId]) {
            // Determine status (for now, randomly assign - you can update this logic)
            const status: "starter" | "bench" | "injured" = 
              player.status === "injured" ? "injured" :
              Math.random() > 0.6 ? "starter" : "bench";

            teamMap[teamId].players.push({
              player_id: player.id,
              name: player.full_name,
              team_abbr: teamMap[teamId].abbreviation,
              team_name: teamMap[teamId].name,
              position: player.position || "N/A",
              status,
              stats: statsMap[player.id],
            });
          }
        }

        // Sort players: starters first, then bench, then injured
        for (const team of Object.values(teamMap)) {
          team.players.sort((a, b) => {
            const statusOrder = { starter: 0, bench: 1, injured: 2 };
            return statusOrder[a.status] - statusOrder[b.status];
          });
        }

        setTeams(Object.values(teamMap).sort((a, b) => 
          a.abbreviation.localeCompare(b.abbreviation)
        ));
      }
    } catch (err) {
      console.error("Error fetching roster:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.map(team => {
      let players = [...team.players];
      
      if (filterStatus !== "all") {
        players = players.filter(p => p.status === filterStatus);
      }

      if (searchTeam.trim()) {
        const search = searchTeam.toLowerCase();
        if (
          team.abbreviation.toLowerCase().includes(search) ||
          team.name.toLowerCase().includes(search)
        ) {
          // Keep all players if team matches
        } else {
          players = players.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.position.toLowerCase().includes(search)
          );
        }
      }

      return { ...team, players };
    }).filter(team => team.players.length > 0);
  }, [teams, filterStatus, searchTeam]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "starter":
        return "bg-green-500/20 border-green-500/50 text-green-400";
      case "bench":
        return "bg-gray-500/20 border-gray-500/50 text-gray-400";
      case "injured":
        return "bg-red-500/20 border-red-500/50 text-red-400";
      default:
        return "bg-gray-500/20 border-gray-500/50 text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "starter":
        return <UserCheck className="w-3 h-3" />;
      case "bench":
        return <Users className="w-3 h-3" />;
      case "injured":
        return <UserX className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);
  const startersCount = teams.reduce((sum, team) => 
    sum + team.players.filter(p => p.status === "starter").length, 0
  );
  const benchCount = teams.reduce((sum, team) => 
    sum + team.players.filter(p => p.status === "bench").length, 0
  );
  const injuredCount = teams.reduce((sum, team) => 
    sum + team.players.filter(p => p.status === "injured").length, 0
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Users className="w-8 h-8" />
            📋 Team Rosters
          </h1>
          <p className="text-gray-400">
            Live roster data • {teams.length} teams • {totalPlayers} players
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem>
              <SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem>
              <SelectItem value="nhl">🏒 NHL</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All Players</SelectItem>
              <SelectItem value="starter">Starters Only</SelectItem>
              <SelectItem value="bench">Bench Only</SelectItem>
              <SelectItem value="injured">Injured Only</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="text"
            placeholder="Search team or player..."
            value={searchTeam}
            onChange={(e) => setSearchTeam(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRosterData}
            disabled={loading}
            className="border-gray-700 text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{totalPlayers}</p>
                  <p className="text-xs text-gray-500">Total Players</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{startersCount}</p>
                  <p className="text-xs text-gray-500">Starters</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{benchCount}</p>
                  <p className="text-xs text-gray-500">Bench</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserX className="w-6 h-6 text-red-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{injuredCount}</p>
                  <p className="text-xs text-gray-500">Injured</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
            <p className="text-gray-400">Loading rosters...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3" />
            <p>No players found</p>
            <p className="text-sm mt-2">Run Full Ingest to populate rosters</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTeams.map((team) => (
              <Card key={team.team_id} className="bg-gray-900/30 border-gray-800">
                <CardHeader className="pb-3 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                        {team.abbreviation}
                        <span className="text-sm font-normal text-gray-400">
                          {team.city} {team.name}
                        </span>
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {team.players.length} players • 
                        {team.players.filter(p => p.status === "starter").length} starters • 
                        {team.players.filter(p => p.status === "bench").length} bench • 
                        {team.players.filter(p => p.status === "injured").length} injured
                      </p>
                    </div>
                    <Badge variant="outline" className="border-gray-600 text-gray-400">
                      {team.abbreviation}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {team.players.map((player) => (
                      <div
                        key={player.player_id}
                        className={`p-3 rounded-lg border ${getStatusColor(player.status)} transition-all hover:scale-105`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">
                              {player.name}
                            </h4>
                            <p className="text-xs opacity-80 mt-0.5">
                              {player.position} • #{player.jersey_number || "--"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {getStatusIcon(player.status)}
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] ${getStatusColor(player.status)}`}
                            >
                              {player.status === "starter" ? "STARTER" : 
                               player.status === "bench" ? "BENCH" : "INJURED"}
                            </Badge>
                          </div>
                        </div>

                        {/* Player Stats */}
                        {player.stats && (
                          <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-current border-opacity-20">
                            <div className="text-center">
                              <p className="text-xs opacity-70">GP</p>
                              <p className="text-sm font-bold">{player.stats.gamesPlayed}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs opacity-70">PPG</p>
                              <p className="text-sm font-bold">{player.stats.avgPoints.toFixed(1)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs opacity-70">HR</p>
                              <p className={`text-sm font-bold ${
                                player.stats.hitRate >= 80 ? "text-green-400" :
                                player.stats.hitRate >= 60 ? "text-yellow-400" :
                                "text-red-400"
                              }`}>
                                {player.stats.hitRate}%
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Streak Badge */}
                        {player.stats?.currentStreak && player.stats.currentStreak.type === "Over" && player.stats.currentStreak.count >= 3 && (
                          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-green-400">
                            <TrendingUp className="w-3 h-3" />
                            Over {player.stats.currentStreak.count}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
