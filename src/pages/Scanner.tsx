// src/pages/Scanner.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function etToday(): string {
  const etNow = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return etNow.toISOString().split('T')[0];
}

function formatTimeET(utcTime: string): string {
  if (!utcTime) return '';
  const date = new Date(utcTime);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function HRBox({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <div className="w-9 h-6 rounded bg-gray-800 text-gray-600 text-[10px] font-bold flex items-center justify-center">—</div>;
  const bg = value >= 80 ? "bg-green-500 text-white" : value >= 60 ? "bg-yellow-500 text-black" : "bg-red-500 text-white";
  return <div className={`w-9 h-6 rounded text-[10px] font-bold flex items-center justify-center ${bg}`}>{value}%</div>;
}

function getInitials(name: string) {
  return (name || "??").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function calcRolling(values: number[], todayVal: number | null): { avg: number; count: number } {
  const window = [...values.slice(0, 19)];
  if (todayVal !== null && todayVal !== undefined) window.unshift(todayVal);
  if (!window.length) return { avg: 0, count: 0 };
  return {
    avg: Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10,
    count: window.length,
  };
}

// ── Config ────────────────────────────────────────────────────────────────────
const SPORTS = [
  { value: "nba",    label: "🏀 NBA" },
  { value: "nfl",    label: "🏈 NFL" },
  { value: "mlb",    label: "⚾ MLB" },
  { value: "nhl",    label: "🏒 NHL" },
  { value: "soccer", label: "⚽ Soccer" },
  { value: "horse-racing", label: "🏇 Horse Racing" },
];

const SOCCER_LEAGUES = [
  { id: "all",            label: "All Leagues" },
  { id: "eng.1",          label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League" },
  { id: "esp.1",          label: "🇪🇸 La Liga" },
  { id: "ger.1",          label: "🇩🇪 Bundesliga" },
  { id: "ita.1",          label: "🇮🇹 Serie A" },
  { id: "fra.1",          label: "🇫🇷 Ligue 1" },
  { id: "usa.1",          label: "🇺🇸 MLS" },
  { id: "uefa.champions", label: "🏆 Champions League" },
  { id: "uefa.europa",    label: "🥈 Europa League" },
  { id: "fifa.world",     label: "🌍 World Cup" },
  { id: "fifa.friendly",  label: "🤝 Internationals" },
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
    { id: "hits",                label: "Hits" },
    { id: "runs",                label: "Runs" },
    { id: "rbi",                 label: "RBI" },
    { id: "home_runs",           label: "HR" },
    { id: "total_bases",         label: "Total Bases" },
    { id: "strikeouts_pitching", label: "K (Pitcher)" },
    { id: "strikeouts_batting",  label: "K (Batter)" },
    { id: "stolen_bases",        label: "Stolen Bases" },
    { id: "combo_hrr",           label: "H+R+RBI" },
    { id: "combo_tb_hits",       label: "TB+Hits" },
  ],
  nhl: [
    { id: "goals",          label: "Goals" },
    { id: "assists_hockey", label: "Assists" },
    { id: "shots_on_goal",  label: "SOG" },
    { id: "time_on_ice",    label: "TOI" },
    { id: "hits_hockey",    label: "Hits" },
    { id: "blocked_shots",  label: "Blocks" },
    { id: "saves",          label: "Saves" },
    { id: "goals_allowed",  label: "Goals Allowed" },
    { id: "combo_ga",       label: "G+A" },
    { id: "combo_pts_sog",  label: "Pts+SOG" },
    { id: "combo_sog_hits", label: "SOG+Hits" },
    { id: "combo_sv_ga",    label: "SV+GA" },
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
  "horse-racing": [
    { id: "win",   label: "Win" },
    { id: "place", label: "Place" },
    { id: "show",  label: "Show" },
  ],
};

const DEFAULT_PROP: Record<string, string> = {
  nba: "points",
  nfl: "passing_yards",
  mlb: "hits",
  nhl: "goals",
  soccer: "goals",
  "horse-racing": "win",
};

interface GameOption {
  game_id: string;
  label: string;
  time: string;
  status: string;
}

interface ScannerPlayer {
  player_id:    string;
  name:         string;
  team_abbr:    string;
  position:     string;
  opponent:     string;
  game_date:    string;
  game_time:    string;
  all_props:    Record<string, any>;
  is_starter:   boolean;
  games_logged: number;
}

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sport, setSport]                   = useState("nba");
  const [filterProp, setFilterProp]         = useState("points");
  const [search, setSearch]                 = useState("");
  const [players, setPlayers]               = useState<ScannerPlayer[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh]       = useState("");
  const [sortKey, setSortKey]               = useState("l10");
  const [sortDir, setSortDir]               = useState<1 | -1>(-1);
  const [gameOptions, setGameOptions]       = useState<GameOption[]>([]);
  const [selectedGame, setSelectedGame]     = useState("__loading__");
  const [marketLine, setMarketLine]         = useState<number | null>(null);
  const [noStatsWarning, setNoStatsWarning] = useState(false);
  const [soccerLeague, setSoccerLeague]     = useState("all");

  const playerId = searchParams.get("playerId");
  const urlSport = searchParams.get("sport");
  const today    = etToday();

  useEffect(() => {
    if (urlSport && urlSport !== sport) setSport(urlSport);
  }, [urlSport]);

  const loadGames = useCallback(async (s: string, league = "all") => {
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
      .order('start_time', { ascending: true, nullsFirst: false });

    const filtered = (data || []).filter((g: any) =>
      g.home_team?.abbreviation && g.away_team?.abbreviation
    );

    const options: GameOption[] = filtered.map((g: any) => {
      const home = g.home_team?.abbreviation || '?';
      const away = g.away_team?.abbreviation || '?';
      const statusSuffix = g.status === 'finished' ? ' ✓' : g.status === 'live' ? ' 🔴' : '';
      return {
        game_id: g.external_id,
        label:   `${away} vs ${home}${statusSuffix}`,
        time:    formatTimeET(g.start_time),
        status:  g.status,
      };
    });

    setGameOptions(options);
    const upcoming = options.find(g => g.status === 'upcoming' || g.status === 'scheduled');
    const live     = options.find(g => g.status === 'live');
    const first    = options[0];
    const autoSelect = upcoming ?? live ?? first;
    setSelectedGame(autoSelect?.game_id ?? 'all');
  }, []);

  const fetchPlayers = useCallback(async (s: string, gameId: string) => {
    setLoading(true);
    setError(null);
    setNoStatsWarning(false);

    try {
      const body: any = { operation: "get_players", sport: s };
      if (gameId && gameId !== 'all') body.game_id = gameId;

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
        player_id:    p.player_id,
        name:         p.name || '',
        team_abbr:    p.team_abbr || '',
        position:     p.position || '',
        opponent:     p.opponent || '',
        game_date:    p.game_date || '',
        game_time:    p.game_time || '',
        all_props:    p.all_props || {},
        is_starter:   p.is_starter || false,
        games_logged: p.games_logged || 0,
      }));

      const withStats = mapped.filter(p => Object.keys(p.all_props).length > 0);
      if (mapped.length > 0 && withStats.length === 0) setNoStatsWarning(true);

      setPlayers(mapped);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!playerId) {
      const defaultProp = DEFAULT_PROP[sport] || (SPORT_PROPS[sport]?.[0]?.id) || "points";
      setFilterProp(defaultProp);
      setSelectedGame('__loading__');
      setPlayers([]);
      setNoStatsWarning(false);
      if (sport !== 'soccer') {
        loadGames(sport);
      } else {
        loadGames('soccer', soccerLeague);
      }
    }
  }, [sport, playerId]);

  useEffect(() => {
    if (sport === 'soccer' && !playerId) {
      setSelectedGame('__loading__');
      loadGames('soccer', soccerLeague);
    }
  }, [soccerLeague, playerId]);

  useEffect(() => {
    if (selectedGame && selectedGame !== '__loading__') {
      fetchPlayers(sport, selectedGame);
    }
  }, [selectedGame]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const displayPlayers = useMemo(() => {
    let list = [...players];
    if (filterProp !== "all") {
      const withProp = list.filter(p => p.all_props?.[filterProp]);
      if (withProp.length > 0) list = withProp;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.team_abbr.toLowerCase().includes(q) ||
        p.opponent.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      const getV = (p: ScannerPlayer) => {
        const pd = p.all_props?.[filterProp];
        if (!pd) return -Infinity;
        if (sortKey === "rolling") return calcRolling(pd.values || [], null).avg;
        return sortKey === "line" ? pd.line ?? 0
          : sortKey === "avg"    ? pd.avg_l10 ?? 0
          : sortKey === "l5"     ? pd.l5 ?? 0
          : sortKey === "l10"    ? pd.l10 ?? 0
          : sortKey === "l15"    ? pd.l15 ?? 0
          : sortKey === "l20"    ? pd.l20 ?? 0
          : sortKey === "diff"   ? (pd.avg_l10 ?? 0) - (pd.line ?? 0)
          : 0;
      };
      return sortDir * (getV(a) - getV(b));
    });
    return list;
  }, [players, filterProp, search, sortKey, sortDir]);

  const SortTh = ({ label, sk }: { label: string; sk: string }) => (
    <th
      onClick={() => handleSort(sk)}
      className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider cursor-pointer select-none hover:text-yellow-400 whitespace-nowrap"
    >
      {label}{sortKey === sk ? (sortDir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  if (playerId) {
    return (
      <PlayerDetailView playerId={playerId} sport={sport} onBack={() => navigate("/scanner")} />
    );
  }

  const currentProps = SPORT_PROPS[sport] || SPORT_PROPS["horse-racing"];
  const withStatCount = displayPlayers.filter(p => Object.keys(p.all_props).length > 0).length;
  const someNoStats = displayPlayers.some(p => Object.keys(p.all_props).length === 0);

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">⚡ LinePulse Scanner</h1>
            <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Players with games today ({today})
            </p>
          </div>
          <button
            onClick={() => fetchPlayers(sport, selectedGame)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {lastRefresh ? `Updated ${lastRefresh}` : "Refresh"}
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-2">
          {/* Sport selector with redirect for horse racing */}
          <Select
            value={sport}
            onValueChange={(s) => {
              if (s === 'horse-racing') {
                navigate('/horse-racing');
                return;
              }
              setSport(s);
            }}
          >
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-yellow-400 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {sport === 'soccer' && (
            <Select value={soccerLeague} onValueChange={setSoccerLeague}>
              <SelectTrigger className="w-52 bg-gray-900 border-yellow-700/40 text-gray-300 text-sm">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 max-h-72 overflow-y-auto">
                {SOCCER_LEAGUES.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedGame} onValueChange={setSelectedGame}>
            <SelectTrigger className="w-72 bg-gray-900 border-gray-700 text-gray-300 text-sm">
              <SelectValue placeholder="Loading games..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 max-h-64 overflow-y-auto">
              <SelectItem value="all">All Games (Today)</SelectItem>
              {gameOptions.map(g => (
                <SelectItem key={g.game_id} value={g.game_id}>
                  {g.label}{g.time ? ` — ${g.time}` : ''}
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
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players, teams..."
              className="pl-9 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9"
            />
          </div>
        </div>

        {/* Market Line */}
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400 font-medium">📊 Market Line:</span>
          <input
            type="number" step="0.5" placeholder="e.g. 26.5"
            value={marketLine ?? ""}
            onChange={e => setMarketLine(e.target.value ? parseFloat(e.target.value) : null)}
            className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
          />
          {marketLine && <span className="text-xs text-gray-600">Trend shows vs {marketLine}</span>}
        </div>

        {/* Warnings */}
        {noStatsWarning && !loading && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex items-start gap-2">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <div>
              <p className="text-yellow-400 text-sm font-semibold">Players found but no historical stats yet</p>
              <p className="text-yellow-700 text-xs mt-0.5">
                Go to <strong>Admin → {sport.toUpperCase()} → Historical Stats → Run</strong> to sync game logs.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            ❌ {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading {sport.toUpperCase()} players...</p>
          </div>
        )}

        {!loading && displayPlayers.length === 0 && (
          <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
            <p className="text-lg font-semibold">No players found</p>
            <p className="text-sm mt-1 text-gray-700">
              {gameOptions.length === 0
                ? `No ${sport.toUpperCase()} games today. Run Schedule sync or try another league.`
                : `Stats haven't been synced yet for this game.`}
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={() => fetchPlayers(sport, selectedGame)}
                className="px-4 py-2 bg-yellow-500 text-black rounded font-semibold text-sm hover:bg-yellow-600"
              >
                Retry
              </button>
              {selectedGame !== 'all' && (
                <button
                  onClick={() => setSelectedGame('all')}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded font-semibold text-sm hover:bg-gray-600"
                >
                  Show All Games
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && displayPlayers.length > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-600 flex justify-between items-center">
              <span>{displayPlayers.length} players shown</span>
              <span>
                {withStatCount} with stats
                {someNoStats && (
                  <span className="ml-1 text-yellow-700">
                    · {displayPlayers.length - withStatCount} missing — run Historical Stats
                  </span>
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-800">
                  <tr>
                    <SortTh label="Player" sk="name" />
                    <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider whitespace-nowrap">Game</th>
                    <SortTh label="Line" sk="line" />
                    <SortTh label="Avg L10" sk="avg" />
                    <SortTh label="Diff" sk="diff" />
                    <SortTh label="L5" sk="l5" />
                    <SortTh label="L10" sk="l10" />
                    <SortTh label="L15" sk="l15" />
                    <SortTh label="L20" sk="l20" />
                    <SortTh label="Rolling ↺" sk="rolling" />
                    <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider whitespace-nowrap">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPlayers.map((p, i) => {
                    const pd = p.all_props?.[filterProp]
                      ?? p.all_props?.[Object.keys(p.all_props || {})[0]]
                      ?? null;
                    const diff = pd ? ((pd.avg_l10 ?? 0) - (pd.line ?? 0)) : 0;
                    const gameTime = p.game_time ? formatTimeET(p.game_time) : '';
                    const hasStats = Object.keys(p.all_props || {}).length > 0;
                    const rolling = pd ? calcRolling(pd.values || [], null) : null;

                    return (
                      <tr
                        key={`${p.player_id}-${i}`}
                        onClick={() => navigate(`/scanner?playerId=${p.player_id}&sport=${sport}`)}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors ${!hasStats ? 'opacity-40' : ''}`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black text-xs font-bold shrink-0">
                              {getInitials(p.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                              <p className="text-[10px] text-gray-500">
                                {p.team_abbr} · {p.position}
                                {pd && ` · ${pd.label}`}
                                {p.is_starter && <span className="ml-1 text-green-400">★</span>}
                                {!hasStats && <span className="ml-1 text-yellow-800"> · no stats</span>}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <p className="text-xs text-gray-400">vs {p.opponent || '—'}</p>
                          <p className="text-[10px] text-gray-600">{gameTime}</p>
                        </td>

                        <td className="p-3">
                          <span className="text-yellow-400 font-bold text-sm">
                            {pd?.line != null ? pd.line.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-300 text-sm">
                          {pd?.avg_l10 != null ? pd.avg_l10 : '—'}
                        </td>
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
                          <div className="flex flex-col gap-1">
                            {pd?.streak ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                pd.streak.type === 'Over'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {pd.streak.type === 'Over' ? '🔺' : '🔻'} {pd.streak.count}
                              </span>
                            ) : (
                              <span className="text-gray-700 text-xs">—</span>
                            )}
                            {rolling && rolling.count > 0 && (
                              <span className="text-[10px] text-gray-500">
                                avg {rolling.avg}
                                <span className="text-gray-700"> /{rolling.count}G</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          {(() => {
                            if (marketLine && pd?.avg_l10 != null) {
                              const edge = pd.avg_l10 - marketLine;
                              const pct = marketLine > 0 ? (edge / marketLine) * 100 : 0;
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
                            if (!pd) return <span className="text-gray-700 text-xs">—</span>;
                            const trend = pd.trend || 'Neutral';
                            const styles: Record<string, string> = {
                              'Strong Over':  'bg-green-500/30 text-green-300 border border-green-500/50',
                              'Over':         'bg-green-500/10 text-green-400 border border-green-500/30',
                              'Strong Under': 'bg-red-500/30 text-red-300 border border-red-500/50',
                              'Under':        'bg-red-500/10 text-red-400 border border-red-500/30',
                              'Neutral':      'bg-gray-500/10 text-gray-400 border border-gray-500/30',
                            };
                            return (
                              <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${styles[trend] || styles['Neutral']}`}>
                                {trend}
                              </span>
                            );
                          })()}
                        </td>
                      </table>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
