// src/pages/HorseRacing.tsx
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Trophy, Flag, TrendingUp, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const RACING_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/horse-racing";
const ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REGIONS = [
  { value: "all", label: "🌍 All Regions" },
  { value: "uk",  label: "🇬🇧 UK / Ireland" },
  { value: "aus", label: "🇦🇺 Australia" },
  { value: "usa", label: "🇺🇸 USA" },
];

function confidenceColor(score: number): string {
  if (score >= 0.4) return "text-green-400 bg-green-500/20 border-green-500/30"
  if (score >= 0.2) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30"
  return "text-red-400 bg-red-500/20 border-red-500/30"
}

function confidenceLabel(score: number): string {
  if (score >= 0.4) return "Strong"
  if (score >= 0.2) return "Moderate"
  if (score > 0)    return "Weak"
  return "No Data"
}

function etToday(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().split("T")[0];
}

async function callRacing(body: Record<string, unknown>) {
  const res = await fetch(RACING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

interface Pick {
  id: string;
  race_date: string;
  region: string;
  track_name: string;
  country: string;
  race_number: number;
  race_time: string;
  horse_name: string;
  saddle_number: number;
  jockey: string;
  trainer: string;
  distance: string;
  going: string;
  win_rate: number;
  place_rate: number;
  total_runs: number;
  confidence_score: number;
  tip_reason: string;
  stake_url: string;
}

export default function HorseRacing() {
  const [region, setRegion]           = useState("all");
  const [picks, setPicks]             = useState<Pick[]>([]);
  const [loading, setLoading]         = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [expandedRace, setExpandedRace] = useState<string | null>(null);
  const [raceCard, setRaceCard]       = useState<Pick[]>([]);
  const [loadingCard, setLoadingCard] = useState(false);
  const today = etToday();

  const loadPicks = async (r: string) => {
    setLoading(true); setError(null);
    try {
      const body: any = { operation: "get_picks", date: today };
      if (r !== "all") body.region = r;
      const d = await callRacing(body);
      if (!d.success) throw new Error(d.error || "Failed to load picks");
      setPicks(d.picks || []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch(e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const syncCards = async () => {
    setSyncing(true); setError(null);
    try {
      const body: any = { operation: "sync_cards", date: today };
      if (region !== "all") body.region = region;
      const d = await callRacing(body);
      if (!d.success) throw new Error(d.error);
      await loadPicks(region);
    } catch(e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const loadRaceCard = async (pick: Pick) => {
    const key = `${pick.track_name}-${pick.race_number}`;
    if (expandedRace === key) { setExpandedRace(null); setRaceCard([]); return; }
    setExpandedRace(key); setLoadingCard(true);
    try {
      const d = await callRacing({
        operation: "get_race_card", date: today,
        track_name: pick.track_name, race_number: pick.race_number,
      });
      setRaceCard(d.runners || []);
    } catch(_) {}
    finally { setLoadingCard(false); }
  };

  useEffect(() => { loadPicks(region); }, [region]);

  // Group picks by track
  const byTrack = picks.reduce((acc, pick) => {
    const key = `${pick.region}-${pick.track_name}`;
    if (!acc[key]) acc[key] = { region: pick.region, track: pick.track_name, country: pick.country, picks: [] };
    acc[key].picks.push(pick);
    return acc;
  }, {} as Record<string, { region: string; track: string; country: string; picks: Pick[] }>);

  const regionFlag = (r: string) => r === 'uk' ? '🇬🇧' : r === 'aus' ? '🇦🇺' : r === 'usa' ? '🇺🇸' : '🌍';

  return (
    <DashboardLayout>
      <div className="p-4 max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">🏇 Horse Racing</h1>
            <p className="text-gray-500 text-sm mt-0.5">Today's top picks · {today} · UK, Australia, USA</p>
          </div>
          <div className="flex gap-2">
            <button onClick={syncCards} disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-sm font-semibold transition disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Cards"}
            </button>
            <button onClick={() => loadPicks(region)} disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {lastRefresh ? `Updated ${lastRefresh}` : "Refresh"}
            </button>
          </div>
        </div>

        {/* Region Filter */}
        <div className="flex gap-2 mb-4">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-yellow-400 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {REGIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3 ml-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Strong (40%+)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Moderate (20-40%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Weak (&lt;20%)</span>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">❌ {error}</div>}

        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading today's race cards...</p>
          </div>
        )}

        {!loading && picks.length === 0 && (
          <div className="text-center py-20 border border-gray-800 rounded-xl bg-gray-900/20">
            <p className="text-gray-400 text-lg">🏇 No race cards found for today</p>
            <p className="text-gray-600 text-sm mt-1">Click "Sync Cards" to fetch today's races</p>
            <button onClick={syncCards} disabled={syncing}
              className="mt-4 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-semibold text-sm transition disabled:opacity-50">
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        )}

        {!loading && Object.values(byTrack).map(({ region: r, track, country, picks: trackPicks }) => (
          <div key={`${r}-${track}`} className="mb-4 bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">

            {/* Track Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div className="flex items-center gap-2">
                <span className="text-lg">{regionFlag(r)}</span>
                <div>
                  <span className="font-bold text-white">{track}</span>
                  <span className="ml-2 text-xs text-gray-500">{country} · {trackPicks.length} races</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase ${
                r === 'uk' ? 'border-blue-500/40 text-blue-400' :
                r === 'aus' ? 'border-green-500/40 text-green-400' :
                'border-red-500/40 text-red-400'
              }`}>{r.toUpperCase()}</span>
            </div>

            {/* Races */}
            {trackPicks.sort((a,b) => a.race_number - b.race_number).map(pick => {
              const key = `${pick.track_name}-${pick.race_number}`;
              const isExpanded = expandedRace === key;
              const confClass = confidenceColor(pick.confidence_score);

              return (
                <div key={pick.id} className="border-b border-gray-800/50 last:border-0">
                  {/* Pick Row */}
                  <div className="px-4 py-3 hover:bg-gray-800/30 transition">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Saddle Number */}
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 font-bold text-sm shrink-0">
                          {pick.saddle_number || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{pick.horse_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${confClass}`}>
                              {confidenceLabel(pick.confidence_score)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Race {pick.race_number}
                            {pick.race_time && ` · ${new Date(pick.race_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`}
                            {pick.jockey && ` · J: ${pick.jockey}`}
                            {pick.distance && ` · ${pick.distance}`}
                            {pick.going && ` · ${pick.going}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Stats */}
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-gray-500">Win Rate</div>
                          <div className="text-sm font-bold text-white">{Math.round((pick.win_rate||0)*100)}%</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-gray-500">Place Rate</div>
                          <div className="text-sm font-bold text-white">{Math.round((pick.place_rate||0)*100)}%</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-gray-500">Runs</div>
                          <div className="text-sm font-bold text-white">{pick.total_runs}</div>
                        </div>

                        {/* Bet Button */}
                        <a href={pick.stake_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-xs font-bold transition">
                          Stake <ExternalLink className="w-3 h-3" />
                        </a>

                        {/* Expand */}
                        <button onClick={() => loadRaceCard(pick)}
                          className="p-1.5 text-gray-500 hover:text-gray-300 transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Tip Reason */}
                    {pick.tip_reason && (
                      <div className="mt-1.5 ml-11 text-xs text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {pick.tip_reason}
                      </div>
                    )}
                  </div>

                  {/* Expanded Race Card */}
                  {isExpanded && (
                    <div className="bg-gray-900/50 border-t border-gray-800/50 px-4 py-3">
                      <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">
                        Full Race Card — Race {pick.race_number} · {track}
                      </p>
                      {loadingCard ? (
                        <div className="text-center py-4 text-gray-600 text-sm">Loading runners...</div>
                      ) : raceCard.length === 0 ? (
                        <div className="text-center py-4 text-gray-600 text-sm">No runners found</div>
                      ) : (
                        <div className="space-y-2">
                          {raceCard.sort((a,b) => (a.saddle_number||99)-(b.saddle_number||99)).map(runner => (
                            <div key={runner.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/50">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-bold shrink-0">
                                  {runner.saddle_number || '?'}
                                </span>
                                <div>
                                  <span className="text-sm text-white font-medium">{runner.horse_name}</span>
                                  {runner.jockey && <span className="ml-2 text-xs text-gray-500">J: {runner.jockey}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{runner.total_runs} runs</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${confidenceColor(runner.confidence_score)}`}>
                                  {Math.round((runner.win_rate||0)*100)}%W
                                </span>
                                {runner.horse_name === pick.horse_name && (
                                  <span className="text-xs text-yellow-400 font-bold flex items-center gap-0.5">
                                    <Trophy className="w-3 h-3" /> Top Pick
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
