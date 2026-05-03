// src/pages/Scanner.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Calendar } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Get today's date in Eastern Time
function etToday(): string {
  const now = new Date();
  const etOffset = -4 * 60 * 60 * 1000; // EDT (Eastern Daylight Time)
  const etNow = new Date(now.getTime() + etOffset);
  return etNow.toISOString().split('T')[0];
}

// Convert UTC time to Eastern Time display
function formatTimeET(utcTime: string): string {
  if (!utcTime) return '';
  const date = new Date(utcTime);
  if (isNaN(date.getTime())) return '';
  
  // Convert to Eastern Time
  const etString = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
  
  return etString;
}

function HRBox({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <div className="w-9 h-6 rounded bg-gray-800 text-gray-600 text-[10px] font-bold flex items-center justify-center">—</div>;
  const bg = value >= 80 ? "bg-green-500 text-white" : value >= 60 ? "bg-yellow-500 text-black" : "bg-red-500 text-white";
  return <div className={`w-9 h-6 rounded text-[10px] font-bold flex items-center justify-center ${bg}`}>{value}%</div>;
}

const SPORTS = [
  { value: "nba",    label: "🏀 NBA" },
  { value: "nfl",    label: "🏈 NFL" },
  { value: "mlb",    label: "⚾ MLB" },
  { value: "nhl",    label: "🏒 NHL" },
  { value: "soccer", label: "⚽ Soccer" },
];

const SPORT_PROPS: Record<string, { id: string; label: string }[]> = {
  nba: [
    { id: "points",              label: "Points" },
    { id: "rebounds",            label: "Rebounds" },
    { id: "assists",             label: "Assists" },
    { id: "three_pointers_made", label: "3PM" },
    { id: "steals",              label: "Steals" },
    { id: "blocks",              label: "Blocks" },
    { id: "combo_pra",           label: "PRA" },
    { id: "combo_pr",            label: "P+R" },
    { id: "combo_pa",            label: "P+A" },
    { id: "turnovers",           label: "TOV" },
  ],
  nfl: [
    { id: "passing_yards",   label: "Pass Yds" },
    { id: "rushing_yards",   label: "Rush Yds" },
    { id: "receiving_yards", label: "Rec Yds" },
    { id: "passing_tds",     label: "Pass TDs" },
    { id: "receptions",      label: "Receptions" },
    { id: "tackles",         label: "Tackles" },
    { id: "combo_pass_rush", label: "Pass+Rush Yds" },
    { id: "combo_rush_rec",  label: "Rush+Rec Yds" },
  ],
  mlb: [
    { id: "hits",                 label: "Hits" },
    { id: "runs",                 label: "Runs" },
    { id: "rbi",                  label: "RBI" },
    { id: "home_runs",            label: "HR" },
    { id: "total_bases",          label: "Total Bases" },
    { id: "strikeouts_pitching",  label: "K (Pitcher)" },
    { id: "strikeouts_batting",   label: "K (Batter)" },
    { id: "stolen_bases",         label: "Stolen Bases" },
    { id: "combo_hrr",            label: "H+R+RBI" },
    { id: "combo_tb_hits",        label: "TB+Hits" },
  ],
  nhl: [
    { id: "goals",           label: "Goals" },
    { id: "assists_hockey",  label: "Assists" },
    { id: "shots_on_goal",   label: "SOG" },
    { id: "time_on_ice",     label: "TOI" },
    { id: "hits_hockey",     label: "Hits" },
    { id: "blocked_shots",   label: "Blocks" },
    { id: "saves",           label: "Saves" },
    { id: "goals_allowed",   label: "Goals Allowed" },
    { id: "combo_ga",        label: "G+A" },
    { id: "combo_pts_sog",   label: "Pts+SOG" },
    { id: "combo_sog_hits",  label: "SOG+Hits" },
    { id: "combo_sv_ga",     label: "SV+GA" },
  ],
  soccer: [
    { id: "goals",               label: "Goals" },
    { id: "assists",             label: "Assists" },
    { id: "shots",               label: "Shots" },
    { id: "shots_on_target",     label: "SOT" },
    { id: "key_passes",          label: "Key Passes" },
    { id: "tackles",             label: "Tackles" },
    { id: "saves",               label: "Saves" },
    { id: "combo_goals_assists", label: "G+A" },
    { id: "combo_shots_sot",     label: "Shots+SOT" },
    { id: "combo_tkl_int",       label: "Tkl+Int" },
  ],
};

const DEFAULT_PROP: Record<string, string> = {
  nba: "points", nfl: "passing_yards", mlb: "hits", nhl: "goals", soccer: "goals",
};

function getInitials(name: string) {
  return (name || "??").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

interface GameOption {
  game_id: string;
  label: string;
  time: string;
}

interface ScannerPlayer {
  player_id: string;
  name: string;
  team_abbr: string;
  position: string;
  opponent: string;
  game_date: string;
  game_time: string;
  all_props: Record<string, any>;
  is_starter: boolean;
}

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sport, setSport]             = useState("nba");
  const [filterProp, setFilterProp]   = useState("points");
  const [search, setSearch]           = useState("");
  const [players, setPlayers]         = useState<ScannerPlayer[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [sortKey, setSortKey]         = useState("l10");
  const [sortDir, setSortDir]         = useState<1 | -1>(-1);
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [selectedGame, setSelectedGame] = useState("all");
  const [marketLine, setMarketLine]   = useState<number | null>(null);

  const playerId = searchParams.get("playerId");
  const urlSport = searchParams.get("sport");
  const today    = etToday();

  useEffect(() => {
    if (urlSport && urlSport !== sport) setSport(urlSport);
  }, [urlSport]);

  // ── Fetch games from games_data for selected sport ────────────────────────
  const loadGames = async (s: string) => {
    const now = new Date();
    const todayET = etToday();
    
    const { data } = await supabase
      .from('games_data')
      .select(`
        external_id, game_date, start_time, status,
        home_team:teams!games_data_home_team_id_fkey(abbreviation),
        away_team:teams!games_data_away_team_id_fkey(abbreviation)
      `)
      .eq('sport', s)
      .eq('game_date', todayET)
      .neq('status', 'finished')
      .order('start_time', { ascending: true, nullsFirst: false });

    const options: GameOption[] = (data || [])
      .filter((g: any) => {
        if (!g.start_time) return false;
        
        const gameTime = new Date(g.start_time);
        
        // Only show games that haven't started yet (with 30 min buffer)
        return gameTime > new Date(now.getTime() - 30 * 60 * 1000);
      })
      .map((g: any) => {
        const home = g.home_team?.abbreviation || '?';
        const away = g.away_team?.abbreviation || '?';
        
        // Convert UTC to Eastern Time for display
        const timeStr = formatTimeET(g.start_time);
        
        return { 
          game_id: g.external_id, 
          label: `${away} vs ${home}`, 
          time: timeStr 
        };
      });

    setGameOptions(options);
    
    // Auto-select first game if only one exists
    if (options.length === 1) {
      setSelectedGame(options[0].game_id);
    }
  };

  // ── Fetch players from clever-action ──────────────────────────────────────
  const fetchPlayers = async (s: string, gameId: string = 'all') => {
    setLoading(true); setError(null);
    try {
      const body: any = { operation: "get_players", sport: s };
      if (gameId !== 'all') body.game_id = gameId;

      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'Failed to load players');

      const mapped: ScannerPlayer[] = (d.players || []).map((p: any) => ({
        player_id: p.player_id,
        name:      p.name || '',
        team_abbr: p.team_abbr || '',
        position:  p.position || '',
        opponent:  p.opponent || '',
        game_date: p.game_date || '',
        game_time: p.game_time || '',
        all_props: p.all_props || {},
        is_starter: p.is_starter || false,
      }));

      setPlayers(mapped);
      setLastRefresh(new Date().toLocaleTimeString());
      console.log(`✅ ${mapped.length} players ready`);
    } catch (e: any) {
      console.error('❌', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playerId) {
      const defaultProp = DEFAULT_PROP[sport] || 'points';
      setFilterProp(defaultProp);
      setSelectedGame('all');
      loadGames(sport);
      fetchPlayers(sport, 'all');
    }
  }, [sport]);

  const handleSportChange = (s: string) => setSport(s);
  const handleGameChange  = (g: string) => { setSelectedGame(g); fetchPlayers(sport, g); };
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const displayPlayers = useMemo(() => {
    let list = [...players];

    if (filterProp !== "all") list = list.filter(p => p.all_props?.[filterProp]);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.team_abbr || "").toLowerCase().includes(q) ||
        (p.opponent || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortKey === "name") return sortDir * (a.name || '').localeCompare(b.name || '');
      const getV = (p: ScannerPlayer) => {
        const pd = p.all_props?.[filterProp];
        if (!pd) return -Infinity;
        return sortKey === "line" ? pd.line ?? 0
          : sortKey === "avg"  ? pd.avg_l10 ?? 0
          : sortKey === "l5"   ? pd.l5 ?? 0
          : sortKey === "l10"  ? pd.l10 ?? 0
          : sortKey === "l15"  ? pd.l15 ?? 0
          : sortKey === "l20"  ? pd.l20 ?? 0
          : sortKey === "diff" ? (pd.avg_l10 ?? 0) - (pd.line ?? 0)
          : 0;
      };
      return sortDir * (getV(a) - getV(b));
    });

    return list;
  }, [players, filterProp, search, sortKey, sortDir]);

  const SortTh = ({ label, sk }: { label: string; sk: string }) => (
    <th onClick={() => handleSort(sk)}
      className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider cursor-pointer select-none hover:text-yellow-400 whitespace-nowrap">
      {label} {sortKey === sk ? (sortDir === -1 ? "↓" : "↑") : ""}
    </th>
  );

  if (playerId) return <PlayerDetailView playerId={playerId} sport={sport} onBack={() => navigate("/scanner")} />;

  const currentProps = SPORT_PROPS[sport] || SPORT_PROPS.nba;

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">⚡ LinePulse Scanner</h1>
            <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Players with games today ({today}) · Set your own lines
            </p>
          </div>
          <button onClick={() => fetchPlayers(sport, selectedGame)} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {lastRefresh ? `Updated ${lastRefresh}` : "Refresh"}
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={sport} onValueChange={handleSportChange}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-yellow-400 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedGame} onValueChange={handleGameChange}>
            <SelectTrigger className="w-72 bg-gray-900 border-gray-700 text-gray-300 text-sm">
              <SelectValue placeholder="All Games (Today only)" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 max-h-64 overflow-y-auto">
              <SelectItem value="all">All Games (Today only)</SelectItem>
              {gameOptions.map(g => (
                <SelectItem key={g.game_id} value={g.game_id}>
                  {g.label} {g.time && `— ${g.time}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProp} onValueChange={setFilterProp}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-gray-300 text-sm">
              <SelectValue placeholder="Select prop" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {currentProps.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players, teams..."
              className="pl-9 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9" />
          </div>
        </div>

        {/* Market Line */}
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400 font-medium">📊 Market Line (from sportsbook):</span>
          <input type="number" step="0.5" placeholder="e.g. 26.5"
            value={marketLine ?? ""}
            onChange={e => setMarketLine(e.target.value ? parseFloat(e.target.value) : null)}
            className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none" />
          {marketLine && <span className="text-xs text-blue-400">Enter the line from your sportsbook → app calculates your edge</span>}
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">❌ {error}</div>}

        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading {sport.toUpperCase()} players...</p>
          </div>
        )}

        {!loading && (
          displayPlayers.length === 0 ? (
            <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
              <p className="text-lg">No players found for today</p>
              <p className="text-sm mt-1 text-gray-700">
                Try syncing {sport.toUpperCase()} data from the admin panel first
              </p>
              <button onClick={() => fetchPlayers(sport, selectedGame)}
                className="mt-4 px-4 py-2 bg-yellow-500 text-black rounded font-semibold text-sm hover:bg-yellow-600">
                Retry
              </button>
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-600 flex justify-between">
                <span>{displayPlayers.length} players shown · click any row for all prop details</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <SortTh label="Player" sk="name" />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Game</th>
                      <SortTh label="Line" sk="line" />
                      <SortTh label="Avg L10" sk="avg" />
                      <SortTh label="Diff" sk="diff" />
                      <SortTh label="L5" sk="l5" />
                      <SortTh label="L10" sk="l10" />
                      <SortTh label="L15" sk="l15" />
                      <SortTh label="L20" sk="l20" />
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Rolling</th>
                      <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPlayers.map((p, i) => {
                      const pd = p.all_props?.[filterProp] || p.all_props?.[Object.keys(p.all_props || {})[0]];
                      const diff = pd ? ((pd.avg_l10 ?? 0) - (pd.line ?? 0)) : 0;
                      
                      // Format game time properly
                      const gameTime = p.game_time ? formatTimeET(p.game_time) : (p.game_date || '');
                      
                      return (
                        <tr key={`${p.player_id}-${i}`}
                          onClick={() => navigate(`/scanner?playerId=${p.player_id}&sport=${sport}`)}
                          className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black text-xs font-bold shrink-0">
                                {getInitials(p.name)}
                              </div>
                              <div>
                                <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                                <p className="text-[10px] text-gray-500">
                                  {p.team_abbr} · {p.position}{pd ? ` · ${pd.label}` : ''}
                                  {p.is_starter && <span className="ml-1 text-green-400">★</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="text-xs text-gray-400">vs {p.opponent}</p>
                            <p className="text-[10px] text-gray-600">{gameTime}</p>
                          </td>
                          <td className="p-3"><span className="text-yellow-400 font-bold text-sm">{pd?.line?.toFixed(1) ?? '—'}</span></td>
                          <td className="p-3 text-gray-300 text-sm">{pd?.avg_l10 ?? '—'}</td>
                          <td className="p-3">
                            {pd ? (
                              <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="p-3"><HRBox value={pd?.l5 ?? null} /></td>
                          <td className="p-3"><HRBox value={pd?.l10 ?? null} /></td>
                          <td className="p-3"><HRBox value={pd?.l15 ?? null} /></td>
                          <td className="p-3"><HRBox value={pd?.l20 ?? null} /></td>
                          <td className="p-3">
                            {pd?.streak ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${pd.streak.type === 'Over' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {pd.streak.type === 'Over' ? '🔺' : '🔻'} {pd.streak.count}
                              </span>
                            ) : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="p-3">
                            {(() => {
                              if (marketLine && pd?.avg_l10) {
                                const edge = pd.avg_l10 - marketLine;
                                const pct  = marketLine > 0 ? (edge / marketLine) * 100 : 0;
                                let sig = "Neutral", cls = "bg-gray-500/10 text-gray-400 border border-gray-500/30";
                                if (pct >= 10)       { sig = "🟢 STRONG OVER";  cls = "bg-green-500/30 text-green-300 border border-green-500/50"; }
                                else if (pct >= 3)   { sig = "🟡 Over";         cls = "bg-green-500/15 text-green-400 border border-green-500/30"; }
                                else if (pct <= -10) { sig = "🔴 STRONG UNDER"; cls = "bg-red-500/30 text-red-300 border border-red-500/50"; }
                                else if (pct <= -3)  { sig = "🟠 Under";        cls = "bg-red-500/15 text-red-400 border border-red-500/30"; }
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${cls}`}>{sig}</span>
                                    <span className="text-[10px] text-gray-500">Edge: {edge > 0 ? "+" : ""}{edge.toFixed(1)}</span>
                                  </div>
                                );
                              }
                              const trend = pd?.trend || 'Neutral';
                              const styles: Record<string, string> = {
                                'Strong Over':  'bg-green-500/30 text-green-300 border border-green-500/50',
                                'Over':         'bg-green-500/10 text-green-400 border border-green-500/30',
                                'Strong Under': 'bg-red-500/30 text-red-300 border border-red-500/50',
                                'Under':        'bg-red-500/10 text-red-400 border border-red-500/30',
                                'Neutral':      'bg-gray-500/10 text-gray-400 border border-gray-500/30',
                              };
                              return <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${styles[trend] || styles['Neutral']}`}>{trend}</span>;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
