// src/components/PlayerDetailView.tsx
// 3-Block Layout:
// Block 1: Interactive L5/L10/L15/L20 selector with props
// Block 2: Team stats
// Block 3: Game logs (last 15 games) with all props

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

// ── BAR CHART COMPONENT ─────────────────────────────────────
function BarChart({
  data,
  line,
  height = 200,
}: {
  data: { label: string; value: number; date: string }[];
  line: number;
  height?: number;
}) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-500">No data</div>;
  
  const maxValue = Math.max(...data.map((d) => d.value), line) * 1.2;

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-1 h-full pb-6">
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * 100;
          const isOver = item.value >= line;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex justify-center">
                <div
                  className={`w-full max-w-[40px] rounded-t transition-all ${
                    isOver ? "bg-green-500" : "bg-red-500"
                  }`}
                  style={{ height: `${Math.max(barHeight, 2)}%` }}
                />
                <div
                  className="absolute w-full border-t-2 border-dashed border-yellow-400/50"
                  style={{
                    bottom: `${(line / maxValue) * 100}%`,
                  }}
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
          <div className="w-2.5 h-2.5 bg-green-500 rounded" />
          <span>Over Line ({line})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-red-500 rounded" />
          <span>Under Line</span>
        </div>
      </div>
    </div>
  );
}

// ── PROP ROW WITH L5/L10/L15/L20 ───────────────────────────
function PropRow({
  propKey,
  propData,
  period,
}: {
  propKey: string;
  propData: any;
  period: 5 | 10 | 15 | 20;
}) {
  const hitRateKey = `l${period}` as keyof typeof propData;
  const hitRate = propData[hitRateKey] ?? null;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20 px-2 rounded transition">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-gray-300 w-36 truncate" title={propData.label || propKey}>
          {propData.label || propKey}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Line:</span>
          <span className="text-yellow-400 font-bold text-sm">{propData.line?.toFixed(1) ?? '0.0'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Avg:</span>
          <span className="text-green-400 font-bold text-sm">{propData.avg_l10?.toFixed(1) ?? '0.0'}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <HitRateBadge value={hitRate} size="sm" />
        {propData.trend === "up" ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : propData.trend === "down" ? (
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
  const [teamStats, setTeamStats] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<5 | 10 | 15 | 20>(10);
  const [selectedProp, setSelectedProp] = useState<string>("points");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        // Set first available prop as selected
        const firstProp = Object.keys(data.player.all_props || {})[0] || "points";
        setSelectedProp(firstProp);

        // Calculate team stats from props
        const props = data.player.all_props || {};
        const teamStatsData = {
          gamesPlayed: data.player.game_logs?.length || 0,
          avgPoints: props.points?.avg_l10 || 0,
          avgRebounds: props.rebounds?.avg_l10 || 0,
          avgAssists: props.assists?.avg_l10 || 0,
        };
        setTeamStats(teamStatsData);
      } catch (e: any) {
        console.error("❌ PlayerDetailView error:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, sport]);

  // Prepare chart data for selected prop and period
  const chartData = useMemo(() => {
    if (!gameLogs.length || !allProps[selectedProp]) return [];

    const propKey = selectedProp;
    const logs = gameLogs.slice(0, selectedPeriod);

    return logs.map((log, i) => ({
      label: `G${selectedPeriod - i}`,
      value: log[propKey] ?? 0,
      date: log.game_date,
    }));
  }, [gameLogs, selectedProp, selectedPeriod, allProps]);

  const line = allProps[selectedProp]?.line ?? 0;

  // Get props grouped by category for display
  const propsByGroup = useMemo(() => {
    const groups: Record<string, any[]> = {};
    Object.entries(allProps).forEach(([key, prop]: [string, any]) => {
      if (!prop?.group) prop.group = "Other";
      if (!groups[prop.group]) groups[prop.group] = [];
      groups[prop.group].push({ key, ...prop });
    });
    return groups;
  }, [allProps]);

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
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#020617] border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="p-2 hover:bg-gray-800 rounded">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-yellow-400 text-xl truncate">{player.full_name}</h1>
          <p className="text-xs text-gray-500 truncate">
            {player.team} • {player.position} • {player.games_logged} games logged
          </p>
        </div>
        <Select value={selectedPeriod.toString()} onValueChange={(v) => setSelectedPeriod(Number(v) as 5 | 10 | 15 | 20)}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-yellow-400">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="5">Last 5 Games</SelectItem>
            <SelectItem value="10">Last 10 Games</SelectItem>
            <SelectItem value="15">Last 15 Games</SelectItem>
            <SelectItem value="20">Last 20 Games</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-4 max-w-7xl mx-auto space-y-6">
        {/* BLOCK 1: Interactive L5/L10/L15/L20 Props Selector */}
        <Card className="bg-[#020617] border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-yellow-400 text-lg">📊 Props Analysis - Last {selectedPeriod} Games</CardTitle>
              <Select value={selectedProp} onValueChange={setSelectedProp}>
                <SelectTrigger className="w-full sm:w-56 bg-gray-900 border-gray-700 text-gray-300">
                  <SelectValue placeholder="Select Prop" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 max-h-64 overflow-y-auto">
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
          <CardContent className="space-y-4 pt-4">
            {/* Chart for selected prop */}
            {chartData.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  {allProps[selectedProp]?.label || selectedProp} - Last {selectedPeriod} Games
                </h3>
                <BarChart data={chartData} line={line} height={250} />
              </div>
            )}

            {/* All props with hit rates for selected period */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">All Props - Hit Rates (L{selectedPeriod})</h3>
              {Object.entries(propsByGroup).map(([group, props]) => (
                <div key={group} className="mb-4">
                  <div className="text-[10px] text-yellow-400/80 font-semibold uppercase tracking-wider mb-2 px-2">{group}</div>
                  <div className="space-y-1">
                    {props.map((prop) => (
                      <PropRow
                        key={prop.key}
                        propKey={prop.key}
                        propData={prop}
                        period={selectedPeriod}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* BLOCK 2: Team Stats */}
        <Card className="bg-[#020617] border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-yellow-400 text-lg">🏀 Team Stats</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Games Played</p>
                <p className="text-2xl font-bold text-yellow-400">{teamStats?.gamesPlayed ?? 0}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Avg Points</p>
                <p className="text-2xl font-bold text-green-400">{teamStats?.avgPoints?.toFixed(1) ?? '0.0'}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Avg Rebounds</p>
                <p className="text-2xl font-bold text-green-400">{teamStats?.avgRebounds?.toFixed(1) ?? '0.0'}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Avg Assists</p>
                <p className="text-2xl font-bold text-green-400">{teamStats?.avgAssists?.toFixed(1) ?? '0.0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BLOCK 3: Game Logs - Last 15 Games with All Props */}
        <Card className="bg-[#020617] border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-yellow-400 text-lg">📋 Game Log - Last 15 Games</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="p-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="p-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Opponent</th>
                    {Object.keys(allProps).slice(0, 8).map((key) => (
                      <th key={key} className="p-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        {allProps[key]?.label || key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gameLogs.slice(0, 15).map((log, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition">
                      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">
                        {log.game_date ? new Date(log.game_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }) : '—'}
                      </td>
                      <td className="p-3 text-sm text-gray-400">vs TBD</td>
                      {Object.keys(allProps).slice(0, 8).map((key) => {
                        const value = log[key] ?? 0;
                        const propLine = allProps[key]?.line ?? 0;
                        const isOver = value >= propLine;

                        return (
                          <td key={key} className="p-3 text-center">
                            <Badge
                              className={`text-[10px] font-bold px-2 py-0.5 ${
                                isOver ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {value}
                            </Badge>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gameLogs.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-sm">No game logs available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PlayerDetailView;
