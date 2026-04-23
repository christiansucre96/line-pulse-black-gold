// src/pages/Roster.tsx
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, UserCheck, UserX, Users, TrendingUp, Shield } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  team_name: string;
  position: string;
  status: "starter" | "bench" | "injured";
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

  useEffect(() => { fetchRosterData(); }, [sport]);

  const fetchRosterData = async () => {
    setLoading(true);
    try {
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
          if (!teamAbbr) continue;
          if (!teamMap[teamAbbr]) teamMap[teamAbbr] = { team_id: teamAbbr, abbreviation: teamAbbr, name: p.team || teamAbbr, players: [] };

          // ✅ Use actual is_starter flag from ESPN
          const status: "starter" | "bench" | "injured" = 
            p.status === "injured" ? "injured" :
            p.is_starter === true ? "starter" : "bench";

          teamMap[teamAbbr].players.push({
            player_id: p.player_id, name: p.name, team_abbr: teamAbbr, team_name: p.team,
            position: p.position, status, opponent: p.opponent, game_date: p.game_date,
            stats: { avgPoints: p.all_props?.points?.avg_l10 || 0, hitRate: p.all_props?.points?.l10 || 0, streak: p.all_props?.points?.streak || null }
          });
        }

        // Sort and enforce max 5 starters per team
        for (const team of Object.values(teamMap)) {
          // Sort: starters first, then bench, then injured
          team.players.sort((a, b) => {
            const statusOrder = { starter: 0, bench: 1, injured: 2 };
            return statusOrder[a.status] - statusOrder[b.status];
          });

          // ✅ SAFETY: If more than 5 starters, demote extras to bench
          let starterCount = 0;
          for (const player of team.players) {
            if (player.status === 'starter') {
              starterCount++;
              if (starterCount > 5) {
                player.status = 'bench'; // Demote extra starters
              }
            }
          }
        }

        setTeams(Object.values(teamMap).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation)));
      } else {
        setTeams([]);
      }
    } catch (err) { console.error("Error fetching roster:", err); } finally { setLoading(false); }
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

  const getStatusColor = (status: string) => {
    if (status === "starter") return "bg-green-500/10 border-green-500/50 text-green-300";
    if (status === "injured") return "bg-red-500/10 border-red-500/50 text-red-300";
    return "bg-gray-500/10 border-gray-700 text-gray-400";
  };

  const getStatusIcon = (status: string) => {
    if (status === "starter") return <UserCheck className="w-3 h-3" />;
    if (status === "injured") return <UserX className="w-3 h-3" />;
    return <Users className="w-3 h-3" />;
  };

  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);
  const startersCount = teams.reduce((s, t) => s + t.players.filter(p => p.status === "starter").length, 0);
  const benchCount = teams.reduce((s, t) => s + t.players.filter(p => p.status === "bench").length, 0);
  const injuredCount = teams.reduce((s, t) => s + t.players.filter(p => p.status === "injured").length, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3"><Shield className="w-8 h-8" />Game Day Rosters</h1>
          <p className="text-gray-400">Active players for upcoming games • Next 24 hours</p>
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
              <SelectItem value="all">All Players</SelectItem><SelectItem value="starter">🟢 Starters Only</SelectItem>
              <SelectItem value="bench">⚪ Bench Only</SelectItem><SelectItem value="injured">🔴 Injured Only</SelectItem>
            </SelectContent>
          </Select>
          <input type="text" placeholder="Search team or player..." value={searchTeam} onChange={(e) => setSearchTeam(e.target.value)} className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500" />
          <Button variant="outline" size="sm" onClick={fetchRosterData} disabled={loading} className="border-gray-700 text-gray-300">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900/50 border-gray-700"><CardContent className="p-4 flex items-center gap-3"><Users className="w-6 h-6 text-blue-400" /><div><p className="text-2xl font-bold text-white">{totalPlayers}</p><p className="text-xs text-gray-500">Total Players</p></div></CardContent></Card>
          <Card className="bg-gray-900/50 border-gray-700"><CardContent className="p-4 flex items-center gap-3"><UserCheck className="w-6 h-6 text-green-400" /><div><p className="text-2xl font-bold text-white">{startersCount}</p><p className="text-xs text-gray-500">Starters</p></div></CardContent></Card>
          <Card className="bg-gray-900/50 border-gray-700"><CardContent className="p-4 flex items-center gap-3"><Users className="w-6 h-6 text-gray-400" /><div><p className="text-2xl font-bold text-white">{benchCount}</p><p className="text-xs text-gray-500">Bench</p></div></CardContent></Card>
          <Card className="bg-gray-900/50 border-gray-700"><CardContent className="p-4 flex items-center gap-3"><UserX className="w-6 h-6 text-red-400" /><div><p className="text-2xl font-bold text-white">{injuredCount}</p><p className="text-xs text-gray-500">Injured</p></div></CardContent></Card>
        </div>

        {loading ? (
          <div className="text-center py-20"><RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-yellow-400" /><p className="text-gray-400 text-lg">Loading rosters...</p></div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-gray-900/20 rounded-xl border border-gray-800">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-xl font-semibold">No players found</p>
            <p className="text-sm mt-2">Run Full Ingest to populate player data.</p>
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
                        <span className="text-green-400">{team.players.filter(p => p.status === "starter").length} Starters</span> • 
                        <span className="text-gray-400">{team.players.filter(p => p.status === "bench").length} Bench</span> • 
                        <span className="text-red-400">{team.players.filter(p => p.status === "injured").length} Injured</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs py-1 px-2">NBA</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {team.players.map((player) => (
                      <div key={player.player_id} className={`group relative p-3 rounded-xl border transition-all hover:scale-[1.02] ${getStatusColor(player.status)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0"><h4 className="font-bold text-sm truncate pr-2">{player.name}</h4><p className="text-xs opacity-80 font-mono">{player.position}</p></div>
                          <div className="flex items-center gap-1 shrink-0">
                            {getStatusIcon(player.status)}
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getStatusColor(player.status)}`}>
                              {player.status === "starter" ? "START" : player.status === "injured" ? "OUT" : "BENCH"}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-current border-opacity-10">
                          <div className="text-center"><p className="text-[10px] opacity-60">L10 Avg</p><p className="text-sm font-bold">{player.stats?.avgPoints.toFixed(1)}</p></div>
                          <div className="text-center"><p className="text-[10px] opacity-60">Hit Rate</p><p className={`text-sm font-bold ${(player.stats?.hitRate || 0) >= 80 ? "text-green-400" : (player.stats?.hitRate || 0) >= 60 ? "text-yellow-400" : "text-red-400"}`}>{player.stats?.hitRate}%</p></div>
                        </div>
                        {player.stats?.streak && player.stats.streak.type === "Over" && player.stats.streak.count >= 3 && (
                          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-green-400 bg-green-500/10 py-1 rounded"><TrendingUp className="w-3 h-3" />Hot Streak ({player.stats.streak.count})</div>
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
