// src/pages/Roster.tsx
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, UserCheck, UserX, Users, TrendingUp, Shield, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  team_name: string;
  position: string;
  status: "starter" | "bench" | "injured";
  lineup_status: "projected" | "confirmed";
  opponent: string;
  game_date: string;
  stats?: { avgPoints: number; hitRate: number; streak: { type: string; count: number } | null };
}

interface Team {
  team_id: string;
  abbreviation: string;
  name: string;
  players: Player[];
}

export default function Roster() {
  const [sport, setSport] = useState("nba");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "starter" | "bench" | "injured">("all");
  const [searchTeam, setSearchTeam] = useState("");
  const [activeGamesCount, setActiveGamesCount] = useState(0);

  useEffect(() => { fetchRosterData(); }, [sport]);

  // ✅ UPDATED: Fetch ALL lineups (projected + confirmed) from projected_lineups
  const fetchRosterData = async () => {
    setLoading(true);
    try {
      // Get TODAY's date
      const today = new Date().toISOString().split('T')[0];
      console.log(`📅 Fetching rosters for: ${today}`);

      // 1. Fetch Games (TODAY only)
      const gamesRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_games", sport }),
      });
      const gamesData = await gamesRes.json();

      // Filter to ONLY today's games
      const todaysGames = (gamesData.games || []).filter((game: any) => {
        const gameDate = game.game_date || '';
        return gameDate === today;
      });

      console.log(`✅ Found ${todaysGames.length} games today`);

      // Extract active team abbreviations
      const activeTeamAbbrs = new Set<string>();
      setActiveGamesCount(todaysGames.length);
      for (const game of todaysGames) {
        if (game.home_team?.abbreviation) activeTeamAbbrs.add(game.home_team.abbreviation);
        if (game.away_team?.abbreviation) activeTeamAbbrs.add(game.away_team.abbreviation);
      }

      // 2. Fetch ALL lineups (projected + confirmed) from scraper storage
      const { data: allLineups } = await supabase
        .from('projected_lineups')
        .select('team_id, team_abbreviation, projected_starters, confirmed, lineup_confidence')
        .eq('game_date', today);

      // Build map: team_id → { starters: Set<string>, confirmed: boolean }
      const lineupMap = new Map<string, { starters: Set<string>, confirmed: boolean }>();
      if (allLineups) {
        for (const lineup of allLineups) {
          const starters = lineup.projected_starters || [];
          const playerIds = new Set(
            starters.map((s: any) => s.player_id || s.espnId || s.id).filter(Boolean)
          );
          lineupMap.set(lineup.team_id, {
            starters: playerIds,
            confirmed: lineup.confirmed === true
          });
        }
      }
      console.log(`📊 Loaded lineups for ${lineupMap.size} teams`);

      // 3. Fetch ALL players for active teams
      const playersRes = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_players", sport }),
      });
      const playersData = await playersRes.json();

      if (playersData.success && playersData.players?.length > 0) {
        const teamMap: Record<string, Team> = {};

        for (const p of playersData.players) {
          const teamAbbr = p.team_abbr;
          if (!activeTeamAbbrs.has(teamAbbr)) continue;

          if (!teamMap[teamAbbr]) {
            teamMap[teamAbbr] = {
              team_id: p.team_id || teamAbbr,
              abbreviation: teamAbbr,
              name: p.team || teamAbbr,
              players: []
            };
          }

          // ✅ Use lineupMap to determine starter status and confirmation
          const lineupInfo = lineupMap.get(p.team_id);
          const isStarter = lineupInfo?.starters.has(p.player_id) || lineupInfo?.starters.has(p.external_id);
          const isConfirmed = lineupInfo?.confirmed === true;

          let status: "starter" | "bench" | "injured" = "bench";
          let lineupStatus: "projected" | "confirmed" = "projected";

          if (p.status === "injured") {
            status = "injured";
          } else if (isStarter) {
            status = "starter";
            lineupStatus = isConfirmed ? "confirmed" : "projected";
          } else if (p.is_starter) {
            // Fallback: if not in lineupMap but player.is_starter is true, treat as projected starter
            status = "starter";
            lineupStatus = "projected";
          }

          teamMap[teamAbbr].players.push({
            player_id: p.player_id,
            name: p.name,
            team_abbr: teamAbbr,
            team_name: p.team,
            position: p.position,
            status,
            lineup_status: lineupStatus,
            opponent: p.opponent,
            game_date: p.game_date,
            stats: {
              avgPoints: p.all_props?.points?.avg_l10 || 0,
              hitRate: p.all_props?.points?.l10 || 0,
              streak: p.all_props?.points?.streak || null
            }
          });
        }

        // Sort players: Confirmed Starters → Projected Starters → Bench → Injured
        for (const team of Object.values(teamMap)) {
          team.players.sort((a, b) => {
            const priority = (p: Player) => {
              if (p.status === "injured") return 3;
              if (p.lineup_status === "confirmed" && p.status === "starter") return 0;
              if (p.status === "starter") return 1;
              return 2;
            };
            return priority(a) - priority(b);
          });

          // Enforce exactly 5 starters (prioritize confirmed)
          let starterCount = 0;
          for (const p of team.players) {
            if (p.status === "starter") {
              starterCount++;
              if (starterCount > 5 && p.lineup_status !== "confirmed") {
                p.status = "bench";
              }
            }
          }
        }

        setTeams(Object.values(teamMap).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation)));
      } else {
        setTeams([]);
      }
    } catch (err) {
      console.error("❌ Error fetching roster:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.map(team => {
      let players = [...team.players];
      if (filterStatus !== "all") players = players.filter(p => p.status === filterStatus);
      if (searchTeam.trim()) {
        const search = searchTeam.toLowerCase();
        const teamMatch = team.abbreviation.toLowerCase().includes(search) || team.name.toLowerCase().includes(search);
        if (!teamMatch) players = players.filter(p => p.name.toLowerCase().includes(search) || p.position.toLowerCase().includes(search));
      }
      return { ...team, players };
    }).filter(team => team.players.length > 0);
  }, [teams, filterStatus, searchTeam]);

  const getStarterColor = (status: string, lineupStatus: string) => {
    if (status === "injured") return "bg-red-500/10 border-red-500/50 text-red-300";
    if (status === "starter") {
      if (lineupStatus === "confirmed") {
        return "bg-green-500/10 border-green-500/50 text-green-300";
      }
      return "bg-amber-500/10 border-amber-500/50 text-amber-300";
    }
    return "bg-gray-500/10 border-gray-700 text-gray-400";
  };

  const getStatusIcon = (status: string, lineupStatus: string) => {
    if (status === "injured") return <UserX className="w-3 h-3" />;
    if (status === "starter") {
      return lineupStatus === "confirmed"
        ? <CheckCircle2 className="w-3 h-3 text-green-400" />
        : <Clock className="w-3 h-3 text-amber-400" />;
    }
    return <Users className="w-3 h-3" />;
  };

  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);
  const startersCount = teams.reduce((s, t) => s + t.players.filter(p => p.status === "starter").length, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8" /> Game Day Rosters
          </h1>
          <p className="text-gray-400 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Showing active teams for {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ({activeGamesCount} games)
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="nba">🏀 NBA</SelectItem><SelectItem value="nfl">🏈 NFL</SelectItem>
              <SelectItem value="mlb">⚾ MLB</SelectItem><SelectItem value="nhl">🏒 NHL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All Players</SelectItem><SelectItem value="starter">🟠 Starters</SelectItem>
              <SelectItem value="bench">⚪ Bench</SelectItem><SelectItem value="injured">🔴 Injured</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="text"
            placeholder="Search team or player..."
            value={searchTeam}
            onChange={(e) => setSearchTeam(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500"
          />
          <Button variant="outline" size="sm" onClick={fetchRosterData} disabled={loading} className="border-gray-700 text-gray-300">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-yellow-400" />
            <p className="text-gray-400 text-lg">Loading rosters...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-gray-900/20 rounded-xl border border-gray-800">
            <CalendarDays className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-xl font-semibold">No games scheduled</p>
            <p className="text-sm mt-2">Check back later for upcoming matchups.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredTeams.map((team) => (
              <Card key={team.abbreviation} className="bg-gray-900/30 border-gray-800 overflow-hidden">
                <CardHeader className="pb-4 border-b border-gray-800 bg-gray-900/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-yellow-400">{team.abbreviation}</span>
                        <span className="text-lg font-normal text-gray-400 hidden sm:inline">{team.name}</span>
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span className="text-amber-400">{team.players.filter(p => p.status === "starter" && p.lineup_status === "projected").length} Probable</span> •
                        <span className="text-green-400">{team.players.filter(p => p.status === "starter" && p.lineup_status === "confirmed").length} Confirmed</span> •
                        <span className="text-gray-400">{team.players.filter(p => p.status === "bench").length} Bench</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs py-1 px-2">NBA</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {team.players.map((player) => (
                      <div
                        key={player.player_id}
                        className={`group relative p-3 rounded-xl border transition-all hover:scale-[1.02] ${getStarterColor(player.status, player.lineup_status)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm truncate pr-2">{player.name}</h4>
                            <p className="text-xs opacity-80 font-mono">{player.position}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {getStatusIcon(player.status, player.lineup_status)}
                            {player.status === "starter" && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                player.lineup_status === "confirmed"
                                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}>
                                {player.lineup_status === "confirmed" ? "CONFIRMED" : "PROBABLE"}
                              </span>
                            )}
                            {player.status === "injured" && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                                OUT
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mb-2">
                          {player.lineup_status === "confirmed" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Confirmed by ESPN
                            </span>
                          ) : player.status === "starter" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> Projected Starter
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-current border-opacity-10">
                          <div className="text-center"><p className="text-[10px] opacity-60">L10 Avg</p><p className="text-sm font-bold">{player.stats?.avgPoints.toFixed(1)}</p></div>
                          <div className="text-center"><p className="text-[10px] opacity-60">Hit Rate</p><p className={`text-sm font-bold ${(player.stats?.hitRate || 0) >= 80 ? "text-green-400" : (player.stats?.hitRate || 0) >= 60 ? "text-yellow-400" : "text-red-400"}`}>{player.stats?.hitRate}%</p></div>
                        </div>
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
