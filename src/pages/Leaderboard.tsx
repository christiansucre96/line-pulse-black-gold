import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { Sport, mockPlayers, getHitRateClass } from "@/data/mockPlayers";
import { Trophy, TrendingUp, Flame, Loader2 } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLiveData";

export default function Leaderboard() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [metric, setMetric] = useState<"l10" | "streak" | "diff">("l10");

  const { data: liveData, isLoading } = useLeaderboard(sport);

  const ranked = useMemo(() => {
    const players = (liveData && liveData.length > 0) ? liveData : mockPlayers.filter((p) => p.sport === sport);
    return [...players].sort((a, b) => (b[metric] as number) - (a[metric] as number));
  }, [liveData, sport, metric]);

  const isLive = liveData && liveData.length > 0;
  const metricLabel = metric === "l10" ? "L10 Hit Rate" : metric === "streak" ? "Hot Streak" : "Avg Diff";

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">LEADERBOARD</h1>
            <p className="text-xs text-muted-foreground">
              Top performers across all props
              {isLive && <span className="ml-2 text-green-400">● Live Data</span>}
            </p>
          </div>
          <SportTabs activeSport={sport} onSportChange={setSport} />
        </div>
      </header>

      <div className="px-6 pt-4 flex gap-2">
        {([
          { key: "l10" as const, label: "Hit Rate", icon: TrendingUp },
          { key: "streak" as const, label: "Hot Streak", icon: Flame },
          { key: "diff" as const, label: "Edge (Diff)", icon: Trophy },
        ]).map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              metric === m.key ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <m.icon size={16} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
              {ranked.slice(0, 3).map((p, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const sizes = ["text-5xl", "text-4xl", "text-4xl"];
                return (
                  <div key={p.id} className={`bg-card border border-border rounded-xl p-4 text-center ${i === 0 ? "border-primary/40 shadow-gold" : ""}`}>
                    <div className={`${sizes[i]} mb-2`}>{medals[i]}</div>
                    <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary mb-2">
                      {p.initials}
                    </div>
                    <div className="font-semibold text-foreground text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.team} · {p.position}</div>
                    <div className="mt-2 font-display font-bold text-xl text-primary">
                      {metric === "l10" ? `${p.l10}%` : metric === "streak" ? p.streak : `+${p.diff}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{metricLabel}</div>
                  </div>
                );
              })}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4 font-semibold">#</th>
                    <th className="text-left py-3 px-4 font-semibold">Player</th>
                    <th className="text-center py-3 px-4 font-semibold">L5</th>
                    <th className="text-center py-3 px-4 font-semibold">L10</th>
                    <th className="text-center py-3 px-4 font-semibold">L15</th>
                    <th className="text-center py-3 px-4 font-semibold">Streak</th>
                    <th className="text-center py-3 px-4 font-semibold">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 font-display font-bold text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                            {p.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.team} · {p.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(p.l5)}`}>{p.l5}%</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(p.l10)}`}>{p.l10}%</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(p.l15)}`}>{p.l15}%</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`font-display font-bold ${p.streak > 5 ? "text-green-400" : p.streak > 0 ? "text-primary" : "text-red-400"}`}>{p.streak}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`font-semibold ${p.diff > 5 ? "text-green-400" : "text-primary"}`}>+{p.diff}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
