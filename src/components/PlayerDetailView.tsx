import { getPlayerDetail, sportDetailTabs, sportGamelogColumns, sportGamelogKeys } from "@/data/mockPlayers";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface PlayerDetailViewProps {
  playerId: string;
  onBack: () => void;
}

export function PlayerDetailView({ playerId, onBack }: PlayerDetailViewProps) {
  const player = getPlayerDetail(playerId);
  const tabs = sportDetailTabs[player.sport];
  const gamelogCols = sportGamelogColumns[player.sport];
  const gamelogKeys = sportGamelogKeys[player.sport];

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "pts");
  const [line, setLine] = useState(
    player.sport === "NFL" ? 250 : player.sport === "NBA" ? 19.5 : player.sport === "MLB" ? 1.5 : player.sport === "NHL" ? 3.5 : 1.5
  );
  const [selectedRange, setSelectedRange] = useState<number>(10);

  const getStatValue = (log: typeof player.gameLogs[0], key: string): number => {
    return Number(log[key]) || 0;
  };

  const filteredLogs = useMemo(() => player.gameLogs.slice(0, selectedRange), [player.gameLogs, selectedRange]);

  const chartData = filteredLogs.slice().reverse().map((log) => {
    const val = getStatValue(log, activeTab);
    return { name: `${log.opponent}`, value: val, aboveLine: val >= line };
  });

  const calcHR = (n: number) => {
    const logs = player.gameLogs.slice(0, Math.min(n, player.gameLogs.length));
    if (logs.length === 0) return { hr: 0, avg: 0 };
    const hits = logs.filter((l) => getStatValue(l, activeTab) >= line).length;
    return {
      hr: Math.round((hits / logs.length) * 100),
      avg: +(logs.reduce((s, l) => s + getStatValue(l, activeTab), 0) / logs.length).toFixed(1),
    };
  };

  const l5 = calcHR(5), l10 = calcHR(10), l15 = calcHR(15), l20 = calcHR(20);
  const activeTabObj = tabs.find((t) => t.key === activeTab);
  const tabLabel = activeTabObj?.label || activeTab;

  const hrColor = (hr: number) => hr >= 80 ? "text-green-400 border-green-400/30 bg-green-400/10" : hr >= 60 ? "text-primary border-primary/30 bg-primary/10" : "text-red-400 border-red-400/30 bg-red-400/10";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Player Detail</h1>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-4">
          <div className="flex gap-1 overflow-x-auto mb-4 border-b border-border pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-semibold rounded-t transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">{tabLabel}</h2>
              <p className="text-sm text-muted-foreground">Line</p>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setLine((l) => +(l - 0.5).toFixed(1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-16 text-center font-bold text-primary font-display text-xl">{line}</span>
                <button onClick={() => setLine((l) => +(l + 0.5).toFixed(1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[{ label: "L5", n: 5, ...l5 }, { label: "L10", n: 10, ...l10 }, { label: "L15", n: 15, ...l15 }, { label: "L20", n: 20, ...l20 }].map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSelectedRange(s.n)}
                  className={`px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${hrColor(s.hr)} ${selectedRange === s.n ? "ring-2 ring-primary scale-105" : "opacity-75 hover:opacity-100"}`}
                >
                  <div className="font-bold text-muted-foreground">{s.label}</div>
                  <div className="font-bold">HR {s.hr}%</div>
                  <div className="text-muted-foreground text-xs">Avg {s.avg}</div>
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 18%)", borderRadius: "8px", color: "hsl(43 30% 90%)" }} />
                  <ReferenceLine y={line} stroke="hsl(43 96% 56%)" strokeDasharray="5 5" strokeWidth={2} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.aboveLine ? "hsl(160 80% 40%)" : "hsl(0 72% 50%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No game log data available.</div>
          )}

          {player.gameLogs.length > 0 && (
            <div className="border-t border-border pt-4">
             <h3 className="text-center font-display font-bold text-foreground mb-3">Gamelog — Last {filteredLogs.length} Games</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {gamelogCols.map((h) => (
                        <th key={h} className="py-2 px-2 font-semibold text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {player.gameLogs.map((log, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="py-2 px-2 text-center font-medium">{log.opponent}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{log.date}</td>
                        {gamelogKeys.map((key) => (
                          <td key={key} className="py-2 px-2 text-center">{log[key] ?? "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
              {player.initials}
            </div>
            <div>
              <div className="font-bold text-foreground">{player.name} ({player.position})</div>
              <div className="flex gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-gold text-primary-foreground">{player.team}</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/20 text-primary">{player.sport}</span>
              </div>
            </div>
          </div>

          {player.maxStats.length > 0 && (
            <>
              <h3 className="text-sm font-display font-bold text-primary mb-2 tracking-wider">PLAYER MAX STATS</h3>
              <div className="space-y-1.5">
                {player.maxStats.map((s) => (
                  <div key={s.label} className="flex justify-between text-sm py-1 border-b border-border/50">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-semibold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {player.matchesPlayed > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Matches Played</span>
              <span className="font-bold text-primary">{player.matchesPlayed}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
