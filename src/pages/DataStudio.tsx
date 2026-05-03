// src/pages/DataStudio.tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Database, RefreshCw, Loader2, Search, Filter, 
  TrendingUp, Users, Calendar, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const API = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const SPORTS = [
  { key: "nfl", label: "NFL", icon: "🏈", color: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-400" },
  { key: "nhl", label: "NHL", icon: "🏒", color: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-400" },
  { key: "mlb", label: "MLB", icon: "⚾", color: "border-red-500", bg: "bg-red-500/10", text: "text-red-400" },
  { key: "soccer", label: "Soccer", icon: "⚽", color: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { key: "nba", label: "NBA", icon: "🏀", color: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-400" },
];

const OPERATIONS = [
  { key: "teams", label: "Sync Teams", icon: "🏟️", desc: "Fetch all team rosters" },
  { key: "schedule", label: "Sync Schedule", icon: "📅", desc: "Upcoming 3-day games" },
  { key: "players", label: "Sync Players", icon: "👤", desc: "Active player rosters" },
  { key: "historical_stats", label: "Historical Stats", icon: "📊", desc: "Last 20 game logs" },
  { key: "boxscores", label: "Today's Box Scores", icon: "🔢", desc: "Archive finished games" },
  { key: "sync_sport", label: "Full Sync", icon: "⚡", desc: "All operations at once" },
];

async function callAPI(operation: string, sport: string | null, extra = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ operation, sport, ...extra }),
  });
  return res.json();
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { 
    idle: "bg-gray-600", 
    running: "bg-yellow-500 animate-pulse", 
    success: "bg-green-500", 
    error: "bg-red-500" 
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-gray-600"}`} />;
}

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { bg: string; color: string; text: string }> = {
    "Strong Over": { bg: "bg-green-500/20", color: "text-green-400", text: "↑↑ Strong Over" },
    "Over": { bg: "bg-green-500/10", color: "text-green-300", text: "↑ Over" },
    "Strong Under": { bg: "bg-red-500/20", color: "text-red-400", text: "↓↓ Strong Under" },
    "Under": { bg: "bg-red-500/10", color: "text-red-300", text: "↓ Under" },
    "Neutral": { bg: "bg-gray-500/10", color: "text-gray-400", text: "→ Neutral" },
  };
  const s = map[trend] || map["Neutral"];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.color} tracking-wide`}>
      {s.text}
    </span>
  );
}

function StatBar({ value, max = 100, colorClass }: { value: number; max?: number; colorClass?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1 bg-gray-800 rounded overflow-hidden w-full">
      <div 
        className={`h-full rounded transition-all duration-500 ${colorClass || "bg-yellow-500"}`}
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}

function PlayerCard({ player, sport }: { player: any; sport: string }) {
  const [expanded, setExpanded] = useState(false);
  const props = player.all_props || {};
  const propKeys = Object.keys(props);
  const primaryKey = propKeys[0];
  const primary = props[primaryKey];
  
  if (!primary) return null;

  const hitColor = (v: number) => v >= 70 ? "text-green-400" : v >= 50 ? "text-yellow-400" : "text-red-400";
  const sportConfig = SPORTS.find(s => s.key === sport) || SPORTS[0];

  return (
    <Card 
      className={`bg-[#0f0f0f] border-gray-800 cursor-pointer transition-all hover:border-gray-700 ${expanded ? 'ring-1 ring-yellow-500/30' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">{player.name}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {player.team_abbr} · {player.position} · vs {player.opponent}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`font-bold text-lg ${sportConfig.text}`}>{primary.line}</div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wide">{primary.label}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          {[["L5", primary.l5], ["L10", primary.l10], ["L15", primary.l15], ["L20", primary.l20]].map(([label, val]: [string, number]) => (
            <div key={label} className="text-center">
              <div className={`text-xs font-bold ${hitColor(val)}`}>{val}%</div>
              <div className="text-[9px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-2">
          <TrendBadge trend={primary.trend} />
          <span className="text-[10px] text-gray-500">{player.games_logged}G</span>
        </div>

        {expanded && propKeys.length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">All Props</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {propKeys.slice(0, 8).map((k: string) => {
                const p = props[k];
                return (
                  <div key={k} className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 truncate flex-1">{p.label}</span>
                    <span className="font-bold text-white w-10 text-center">{p.line}</span>
                    <span className={hitColor(p.l10)}>{p.l10}%</span>
                    <TrendBadge trend={p.trend} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DataStudio() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [selectedSport, setSelectedSport] = useState("nfl");
  const [viewSport, setViewSport] = useState("nfl");
  const [jobStatus, setJobStatus] = useState<Record<string, string>>({});
  const [jobResults, setJobResults] = useState<Record<string, any>>({});
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("l10");
  const [filterPosition, setFilterPosition] = useState("All");
  const [syncRange, setSyncRange] = useState({ start: "", end: "", days: 7 });
  const [activeTab, setActiveTab] = useState<"admin" | "props">("admin");

  const fetchHealth = useCallback(async () => {
    try {
      const data = await callAPI("health", null);
      if (data.success) setHealth(data);
    } catch (e) { console.error("Health check failed:", e); }
  }, []);

  useEffect(() => { 
    fetchHealth(); 
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const runOperation = async (operation: string) => {
    const key = `${selectedSport}-${operation}`;
    setJobStatus(prev => ({ ...prev, [key]: "running" }));
    setJobResults(prev => ({ ...prev, [key]: null }));
    
    try {
      const data = await callAPI(operation, selectedSport);
      setJobStatus(prev => ({ ...prev, [key]: data.success ? "success" : "error" }));
      setJobResults(prev => ({ ...prev, [key]: data }));
      
      if (data.success) {
        toast.success(`${selectedSport.toUpperCase()} ${operation} completed`);
        fetchHealth();
      } else {
        toast.error(data.error || "Operation failed");
      }
    } catch (e: any) {
      setJobStatus(prev => ({ ...prev, [key]: "error" }));
      setJobResults(prev => ({ ...prev, [key]: { error: e.message } }));
      toast.error(`Error: ${e.message}`);
    }
  };

  const runRangeSync = async () => {
    const key = `${selectedSport}-range`;
    setJobStatus(prev => ({ ...prev, [key]: "running" }));
    
    try {
      const extra = syncRange.start
        ? { start_date: syncRange.start, end_date: syncRange.end || new Date().toISOString().split("T")[0] }
        : { days: syncRange.days };
      
      const data = await callAPI("sync_stats_range", selectedSport, extra);
      setJobStatus(prev => ({ ...prev, [key]: data.success ? "success" : "error" }));
      setJobResults(prev => ({ ...prev, [key]: data }));
      
      if (data.success) {
        toast.success(`Backfilled ${data.stats_upserted || 0} stats for ${selectedSport.toUpperCase()}`);
      }
    } catch (e: any) {
      setJobStatus(prev => ({ ...prev, [key]: "error" }));
      toast.error(`Backfill failed: ${e.message}`);
    }
  };

  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    setPlayers([]);
    try {
      const data = await callAPI("get_players", viewSport);
      if (data.success) setPlayers(data.players || []);
    } catch (e: any) {
      toast.error(`Failed to load players: ${e.message}`);
    }
    setLoadingPlayers(false);
  };

  useEffect(() => {
    if (activeTab === "props") fetchPlayers();
  }, [activeTab, viewSport]);

  // Auth check - redirect if not admin
  if (authLoading) return <div className="p-10 text-center text-yellow-400">Loading...</div>;
  
  const forceAdmin = user?.email === 'christiansucre1@gmail.com';
  if (!isAdmin && !forceAdmin) return <Navigate to="/scanner" replace />;

  const positions = ["All", ...new Set(players.map(p => p.position).filter(Boolean))].slice(0, 10);
  
  const filtered = players
    .filter(p => filterPosition === "All" || p.position === filterPosition)
    .filter(p => !searchQuery || 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.team_abbr || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const pa = a.all_props?.[Object.keys(a.all_props || {})[0]];
      const pb = b.all_props?.[Object.keys(b.all_props || {})[0]];
      if (!pa || !pb) return 0;
      if (sortBy === "l10") return (pb.l10 || 0) - (pa.l10 || 0);
      if (sortBy === "diff") return Math.abs(pb.trend_diff || 0) - Math.abs(pa.trend_diff || 0);
      if (sortBy === "games") return (b.games_logged || 0) - (a.games_logged || 0);
      return 0;
    });

  const sportConfig = SPORTS.find(s => s.key === selectedSport) || SPORTS[0];
  const viewSportConfig = SPORTS.find(s => s.key === viewSport) || SPORTS[0];

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
              <Database className="w-6 h-6" /> Data Studio
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Sync sports data & analyze player props</p>
          </div>
          
          {health && (
            <div className="flex gap-4 text-xs text-gray-400">
              <span>🏟️ {health.teams?.toLocaleString()} teams</span>
              <span>👤 {health.players?.toLocaleString()} players</span>
              <span>📊 {health.player_game_stats?.toLocaleString()} stats</span>
            </div>
          )}
          
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            <button 
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                activeTab === "admin" 
                  ? "bg-yellow-500 text-black" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ⚙ Admin
            </button>
            <button 
              onClick={() => setActiveTab("props")}
              className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                activeTab === "props" 
                  ? "bg-yellow-500 text-black" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📈 Props
            </button>
          </div>
        </div>

        {/* ── ADMIN TAB ───────────────────────────────────────────────────── */}
        {activeTab === "admin" && (
          <>
            {/* Sport Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {SPORTS.map(s => (
                <button 
                  key={s.key} 
                  onClick={() => setSelectedSport(s.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
                    selectedSport === s.key 
                      ? `${s.bg} ${s.text} ${s.color}` 
                      : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* Operations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {OPERATIONS.map(op => {
                const key = `${selectedSport}-${op.key}`;
                const status = jobStatus[key] || "idle";
                const result = jobResults[key];
                
                return (
                  <Card key={op.key} className={`bg-[#0b1120] border-gray-800 ${
                    status === "running" ? `ring-1 ring-yellow-500/30` : 
                    status === "success" ? "border-green-900/50" : 
                    status === "error" ? "border-red-900/50" : ""
                  }`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <span>{op.icon}</span> {op.label}
                          </CardTitle>
                          <p className="text-xs text-gray-500 mt-0.5">{op.desc}</p>
                        </div>
                        <StatusDot status={status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {result && (
                        <div className={`text-[10px] mb-2 ${
                          status === "error" ? "text-red-400" : "text-green-400"
                        }`}>
                          {status === "error" 
                            ? `✗ ${result.error || "Failed"}` 
                            : `✓ ${result.count !== undefined ? `${result.count} items` : 
                               result.archived !== undefined ? `${result.archived} archived` : 
                               result.message || "Done"}`}
                        </div>
                      )}
                      <Button 
                        onClick={() => runOperation(op.key)} 
                        disabled={status === "running"}
                        size="sm"
                        className={`w-full text-xs ${
                          status === "running" 
                            ? "bg-gray-800 text-gray-500" 
                            : `bg-${sportConfig.color.split('-')[1]}-500/10 hover:bg-${sportConfig.color.split('-')[1]}-500/20 ${sportConfig.text} border border-${sportConfig.color.split('-')[1]}-500/30`
                        }`}
                      >
                        {status === "running" ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running...</> : "Run"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Backfill Range */}
            <Card className="bg-[#0b1120] border-gray-800 mb-6">
              <CardHeader>
                <CardTitle className="text-yellow-400 text-sm flex items-center gap-2">
                  📦 Backfill Box Scores by Date Range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Start Date</label>
                    <Input 
                      type="date" 
                      value={syncRange.start} 
                      onChange={e => setSyncRange(p => ({ ...p, start: e.target.value }))}
                      className="bg-gray-900 border-gray-700 text-white text-sm w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">End Date</label>
                    <Input 
                      type="date" 
                      value={syncRange.end} 
                      onChange={e => setSyncRange(p => ({ ...p, end: e.target.value }))}
                      className="bg-gray-900 border-gray-700 text-white text-sm w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">Or Last N Days</label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={60}
                      value={syncRange.days} 
                      onChange={e => setSyncRange(p => ({ ...p, days: parseInt(e.target.value) || 7 }))}
                      className="bg-gray-900 border-gray-700 text-white text-sm w-20"
                    />
                  </div>
                  <Button 
                    onClick={runRangeSync} 
                    disabled={jobStatus[`${selectedSport}-range`] === "running"}
                    size="sm"
                    className={`${sportConfig.bg} ${sportConfig.text} border ${sportConfig.color} hover:opacity-90`}
                  >
                    {jobStatus[`${selectedSport}-range`] === "running" 
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</> 
                      : "⚡ Run Backfill"}
                  </Button>
                </div>
                {jobResults[`${selectedSport}-range`] && (
                  <div className="mt-3 text-xs text-green-400">
                    ✓ Backfilled: {JSON.stringify(jobResults[`${selectedSport}-range`]).replace(/[{}"]/g, "").slice(0, 150)}...
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── PROPS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "props" && (
          <>
            {/* Sport Selector for Props */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {SPORTS.map(s => (
                <button 
                  key={s.key} 
                  onClick={() => setViewSport(s.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
                    viewSport === s.key 
                      ? `${s.bg} ${s.text} ${s.color}` 
                      : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
              <Button 
                onClick={fetchPlayers} 
                size="sm"
                variant="outline"
                className="ml-auto border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loadingPlayers ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input 
                  placeholder="Search player or team..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-900 border-gray-700 text-white text-sm"
                />
              </div>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48 bg-gray-900 border-gray-700 text-gray-300 text-sm">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="l10">L10 Hit Rate</SelectItem>
                  <SelectItem value="diff">Trend Strength</SelectItem>
                  <SelectItem value="games">Most Games</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-1 flex-wrap">
                {positions.map(pos => (
                  <Badge 
                    key={pos}
                    variant={filterPosition === pos ? "default" : "outline"}
                    className={`cursor-pointer ${
                      filterPosition === pos 
                        ? `${viewSportConfig.bg} ${viewSportConfig.text} border-${viewSportConfig.color.split('-')[1]}-500` 
                        : "border-gray-700 text-gray-400 hover:text-white"
                    }`}
                    onClick={() => setFilterPosition(pos)}
                  >
                    {pos}
                  </Badge>
                ))}
              </div>
              
              <span className="text-xs text-gray-500 ml-auto">
                {filtered.length} players
              </span>
            </div>

            {/* Player Grid */}
            {loadingPlayers ? (
              <div className="text-center py-20">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
                <p className="text-gray-500 text-sm">Loading {viewSport.toUpperCase()} player props...</p>
              </div>
            ) : filtered.length === 0 ? (
              <Card className="bg-[#0b1120] border-gray-800">
                <CardContent className="text-center py-12">
                  <Database className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No players found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Run a sync for {viewSport.toUpperCase()} in the Admin tab first.
                  </p>
                  <Button 
                    onClick={() => setActiveTab("admin")}
                    size="sm"
                    className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    → Go to Admin
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(p => (
                  <PlayerCard key={p.player_id} player={p} sport={viewSport} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer Help */}
        <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg text-xs text-blue-400">
          <strong>💡 Tips:</strong> 
          • Use <strong>Admin</strong> tab to sync fresh data from ESPN 
          • Use <strong>Props</strong> tab to analyze player trends 
          • Click any player card to expand and see all props 
          • Backfill historical data with date range for deeper analysis
        </div>
      </div>
    </DashboardLayout>
  );
}
