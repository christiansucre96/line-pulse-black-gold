// src/components/PlayerDetailView.tsx
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ── HIT RATE BADGE ──────────────────────────────────────────
function HitRateBadge({ value, size = "md" }: { value: number | null; size?: "sm" | "md" | "lg" }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600">—</span>;
  }

  const getColor = (v: number) => {
    if (v >= 80) return "bg-green-500 text-white";
    if (v >= 60) return "bg-yellow-500 text-black";
    return "bg-red-500 text-white";
  };

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <Badge className={`${getColor(value)} ${sizeClasses[size]} font-bold`}>
      {value}%
    </Badge>
  );
}

// ── STACKED BAR CHART (like the screenshot) ─────────────────
function StackedBar({
  data,
  line,
  height = 200,
}: {
  data: { label: string; points: number; rebounds: number; assists?: number }[];
  line: number;
  height?: number;
}) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-500">No data</div>;

  const maxValue = Math.max(...data.map((d) => d.points + d.rebounds + (d.assists || 0)), line) * 1.2;

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-1 h-full pb-6">
        {data.map((item, i) => {
          const ptsHeight = (item.points / maxValue) * 100;
          const rebHeight = (item.rebounds / maxValue) * 100;
          const total = item.points + item.rebounds + (item.assists || 0);
          const isOver = total >= line;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex flex-col justify-end h-full">
                {/* Line marker */}
                <div
                  className="absolute w-full border-t border-dashed border-yellow-400/50"
                  style={{ bottom: `${(line / maxValue) * 100}%` }}
                />

                {/* Rebounds segment */}
                <div
                  className="w-full bg-green-400/80"
                  style={{ height: `${rebHeight}%` }}
                />

                {/* Points segment */}
                <div
                  className={`w-full ${isOver ? "bg-green-600" : "bg-red-500"}`}
                  style={{ height: `${ptsHeight}%` }}
                />
              </div>
              <span className="text-[9px] text-gray-500 truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-green-600 rounded" />
          <span>Points (over line)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-green-400/80 rounded" />
          <span>Rebounds</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-red-500 rounded" />
          <span>Points (under line)</span>
        </div>
      </div>
    </div>
  );
}

// ── STAT BOX (L5/L10/L15/L20) ───────────────────────────────
function StatBox({ label, hr, avg }: { label: string; hr: number | null; avg: number }) {
  return (
    <div className="bg-[#0f172a] px-3 py-2 rounded-lg text-xs text-center min-w-[60px]">
      <p className="text-gray-400">{label}</p>
      <p className="text-green-400 font-bold">HR {hr !== null ? hr : 0}%</p>
      <p className="text-gray-300">Avg {avg.toFixed(1)}</p>
    </div>
  );
}

// ── PROP ROW FOR TABLES ─────────────────────────────────────
function PropRow({ label, line, avg, hitRate, trend }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20 px-2 rounded transition">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-gray-300 w-32 truncate">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Line:</span>
          <span className="text-yellow-400 font-bold text-sm">{line?.toFixed(1) ?? '0.0'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Avg:</span>
          <span className="text-green-400 font-bold text-sm">{avg?.toFixed(1) ?? '0.0'}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <HitRateBadge value={hitRate} size="sm" />
        {trend === "up" ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : trend === "down" ? (
          <TrendingDown className="w-4 h-4 text-red-400" />
        ) : (
          <Minus className="w-4 h-4 text-gray-500" />
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────
interface PlayerDetailViewProps {
  playerId: string;
  sport: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, sport, onBack }: PlayerDetailViewProps) {
  const [player, setPlayer] = useState<any>(null);
  const [allProps, setAllProps] = useState<Record<string, any>>({});
  const [gameLogs, setGameLogs] = useState<any[]>([]);
  const [selectedProp, setSelectedProp] = useState<string>("points");
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch player details
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "get_player_details",
            sport,
            player_id: playerId,
          }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load");

        setPlayer(data.player);
        setAllProps(data.player.all_props || {});
        setGameLogs(data.player.game_logs || []);
        setCustomLine(null);
      } catch (e: any) {
        console.error("❌ PlayerDetailView error:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, sport]);

  // Current prop data
  const currentProp = allProps[selectedProp];
  const line = customLine !== null ? customLine : currentProp?.line ?? 0;
  const avgLast10 = currentProp?.avg_l10 ?? 0;
  const diff = avgLast10 - line;

  // Hit rates for the selected prop
  const hitRates = useMemo(() => ({
    l5: currentProp?.l5 ?? null,
    l10: currentProp?.l10 ?? null,
    l15: currentProp?.l15 ?? null,
    l20: currentProp?.l20 ?? null,
  }), [currentProp]);

  // Averages for the selected prop
  const averages = useMemo(() => ({
    l5: currentProp?.avg_l5 ?? 0,
    l10: currentProp?.avg_l10 ?? 0,
    l20: currentProp?.avg_l20 ?? 0,
  }), [currentProp]);

  // Chart data for PRA (Points+Rebounds+Assists) – last 10 games
  const chartData = useMemo(() => {
    return gameLogs.slice(0, 10).map((log, i) => ({
      label: `G${10 - i}`,
      points: log.points || 0,
      rebounds: log.rebounds || 0,
      assists: log.assists || 0,
    }));
  }, [gameLogs]);

  // Compute max stats for the right panel
  const maxStats = useMemo(() => {
    if (!gameLogs.length) return { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 };
    const max = (key: string) => Math.max(...gameLogs.map(g => g[key] || 0));
    return {
      points: max('points'),
      rebounds: max('rebounds'),
      assists: max('assists'),
      steals: max('steals'),
      blocks: max('blocks'),
      turnovers: max('turnovers'),
    };
  }, [gameLogs]);

  // Group props by category for the full list
  const propsByGroup = useMemo(() => {
    const groups: Record<string, any[]> = {};
    Object.entries(allProps).forEach(([key, prop]: [string, any]) => {
      const group = prop.group || "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push({ key, ...prop });
    });
    return groups;
  }, [allProps]);

  // Preset tab options (core props)
  const tabOptions = [
    { id: "points", label: "PTS" },
    { id: "rebounds", label: "REBS" },
    { id: "assists", label: "ASTS" },
    { id: "combo_pr", label: "PR" },
    { id: "combo_pra", label: "PRA" },
  ];

  const handleLineChange = (delta: number) => {
    const newLine = Math.max(0, line + delta);
    setCustomLine(newLine);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card className="bg-[#020617] border-gray-800">
          <CardContent className="p-6 text-center text-red-400">
            ❌ {error || "Player not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#020617] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#020617]/80 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="p-2 hover:bg-gray-800 rounded">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-yellow-400 text-xl truncate">{player.full_name}</h1>
          <p className="text-xs text-gray-500 truncate">
            {player.team} • {player.position} • {player.games_logged} games logged
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 p-4 max-w-7xl mx-auto">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Tabs + Prop Selector */}
          <Card className="bg-[#020617] border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {tabOptions.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedProp(tab.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                        selectedProp === tab.id
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <Select value={selectedProp} onValueChange={setSelectedProp}>
                  <SelectTrigger className="w-48 bg-gray-900 border-gray-700 text-gray-300">
                    <SelectValue placeholder="Other props" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 max-h-64">
                    {Object.entries(propsByGroup).map(([group, props]) => (
                      <div key={group}>
                        <div className="text-[10px] text-gray-500 px-3 py-1.5 font-semibold uppercase tracking-wider">{group}</div>
                        {props.map((prop) => (
                          <SelectItem key={prop.key} value={prop.key} className="text-sm">
                            {prop.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Line adjuster */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{currentProp?.label || selectedProp}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLineChange(-0.5)}
                      className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-yellow-400 font-bold text-xl w-16 text-center">{line.toFixed(1)}</span>
                    <button
                      onClick={() => handleLineChange(0.5)}
                      className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Avg L10</p>
                  <p className="text-xl font-bold text-green-400">{avgLast10.toFixed(1)}</p>
                  <p className={`text-xs font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}`}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)} diff
                  </p>
                </div>
              </div>

              {/* Stat boxes (L5/L10/L15/L20) */}
              <div className="flex flex-wrap gap-2">
                <StatBox label="L5" hr={hitRates.l5} avg={averages.l5} />
                <StatBox label="L10" hr={hitRates.l10} avg={averages.l10} />
                <StatBox label="L15" hr={hitRates.l15} avg={currentProp?.avg_l15 || 0} />
                <StatBox label="L20" hr={hitRates.l20} avg={averages.l20} />
              </div>

              {/* Stacked bar chart (PRA) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Points + Rebounds (last 10 games)</h3>
                <StackedBar data={chartData} line={line} height={250} />
              </div>

              {/* Full list of props for the selected prop type (hit rates) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">All Props - Hit Rates (L10)</h3>
                <div className="space-y-1">
                  {Object.entries(propsByGroup).map(([group, props]) => (
                    <div key={group}>
                      <div className="text-[10px] text-yellow-400/80 font-semibold uppercase tracking-wider mb-1 px-2">{group}</div>
                      {props.map((prop) => (
                        <PropRow
                          key={prop.key}
                          label={prop.label}
                          line={prop.line}
                          avg={prop.avg_l10}
                          hitRate={prop.l10}
                          trend={prop.trend}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Logs Table */}
          <Card className="bg-[#020617] border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-yellow-400 text-lg">📋 Game Log - Last 15 Games</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="p-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Date</th>
                    <th className="p-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Opponent</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">PTS</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">REB</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">AST</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">STL</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">BLK</th>
                    <th className="p-2 text-center text-[10px] font-semibold text-gray-400 uppercase">TOV</th>
                  </tr>
                </thead>
                <tbody>
                  {gameLogs.slice(0, 15).map((log, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                      <td className="p-2 text-gray-300 whitespace-nowrap">
                        {log.game_date ? new Date(log.game_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }) : '—'}
                      </td>
                      <td className="p-2 text-gray-400">vs TBD</td>
                      <td className="p-2 text-center">
                        <Badge className={`text-xs font-bold px-2 py-0.5 ${log.points >= (allProps.points?.line || 0) ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {log.points || 0}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">{log.rebounds || 0}</td>
                      <td className="p-2 text-center">{log.assists || 0}</td>
                      <td className="p-2 text-center">{log.steals || 0}</td>
                      <td className="p-2 text-center">{log.blocks || 0}</td>
                      <td className="p-2 text-center">{log.turnovers || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gameLogs.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No game logs available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL - Player Max Stats */}
        <div className="space-y-6">
          <Card className="bg-[#020617] border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-purple-400 text-lg">📈 Player Max Stats</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Points</span>
                  <span className="text-white font-bold">{maxStats.points}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Rebounds</span>
                  <span className="text-white font-bold">{maxStats.rebounds}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Assists</span>
                  <span className="text-white font-bold">{maxStats.assists}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Steals</span>
                  <span className="text-white font-bold">{maxStats.steals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Blocks</span>
                  <span className="text-white font-bold">{maxStats.blocks}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Turnovers</span>
                  <span className="text-white font-bold">{maxStats.turnovers}</span>
                </div>
              </div>
              <div className="mt-4 bg-purple-600/20 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-300">Matches Played</p>
                <p className="text-xl font-bold text-purple-400">{player.games_logged}</p>
              </div>
            </CardContent>
          </Card>

          {/* Optional: Team Averages */}
          <Card className="bg-[#020617] border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-green-400 text-lg">🏀 Team Averages (L10)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Points</span>
                <span className="text-green-400 font-bold">{allProps.points?.avg_l10?.toFixed(1) ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Rebounds</span>
                <span className="text-green-400 font-bold">{allProps.rebounds?.avg_l10?.toFixed(1) ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Assists</span>
                <span className="text-green-400 font-bold">{allProps.assists?.avg_l10?.toFixed(1) ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PlayerDetailView;
