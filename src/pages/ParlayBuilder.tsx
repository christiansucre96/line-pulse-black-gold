import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SportTabs } from "@/components/SportTabs";
import { mockPlayers, Sport } from "@/data/mockPlayers";
import { X, Sparkles } from "lucide-react";

interface ParlayLeg {
  playerId: string;
  name: string;
  team: string;
  prop: string;
  side: "over" | "under";
  odds: number;
  hitRate: number;
}

function americanToDecimal(odds: number) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export default function ParlayBuilder() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  const [wager, setWager] = useState(10);

  const players = useMemo(() => mockPlayers.filter((p) => p.sport === sport), [sport]);

  const addLeg = (playerId: string) => {
    const p = players.find((pl) => pl.id === playerId);
    if (!p || legs.some((l) => l.playerId === playerId)) return;
    setLegs((prev) => [
      ...prev,
      {
        playerId: p.id,
        name: p.name,
        team: p.team,
        prop: p.categories[0] || "Points",
        side: "over",
        odds: -110,
        hitRate: p.l10,
      },
    ]);
  };

  const removeLeg = (id: string) => setLegs((prev) => prev.filter((l) => l.playerId !== id));
  const clearAll = () => setLegs([]);

  const totalDecimal = legs.reduce((acc, l) => acc * americanToDecimal(l.odds), 1);
  const totalAmericanOdds = totalDecimal >= 2 ? Math.round((totalDecimal - 1) * 100) : Math.round(-100 / (totalDecimal - 1));
  const payout = +(wager * totalDecimal).toFixed(2);
  const avgHitRate = legs.length ? Math.round(legs.reduce((s, l) => s + l.hitRate, 0) / legs.length) : 0;

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">PARLAY BUILDER</h1>
            <p className="text-xs text-muted-foreground">Build smart parlays with data-driven picks</p>
          </div>
          <SportTabs activeSport={sport} onSportChange={setSport} />
        </div>
      </header>

      {/* Suggestion bar */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Sparkles className="text-primary shrink-0" size={18} />
          <span className="text-sm text-muted-foreground">
            <strong className="text-primary">AI Suggestion:</strong> Add high-confidence picks for tonight's slate
          </span>
          <button
            onClick={() => {
              const top3 = players.slice(0, 3);
              top3.forEach((p) => addLeg(p.id));
            }}
            className="ml-auto px-4 py-2 bg-gradient-gold text-primary-foreground rounded-lg text-sm font-display font-semibold uppercase tracking-wider shrink-0"
          >
            Auto-Pick
          </button>
        </div>
      </div>

      <div className="px-6 py-4 grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Player list */}
        <div className="space-y-2">
          {players.map((p) => {
            const inSlip = legs.some((l) => l.playerId === p.id);
            return (
              <div
                key={p.id}
                className={`bg-card border rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all ${
                  inSlip ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                }`}
                onClick={() => (inSlip ? removeLeg(p.id) : addLeg(p.id))}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {p.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{p.name} <span className="text-muted-foreground">({p.position})</span></div>
                    <div className="text-xs text-muted-foreground">{p.team} vs {p.opponent} · {p.categories[0]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">L10 HR</div>
                    <div className={`font-bold text-sm ${p.l10 >= 80 ? "text-green-400" : p.l10 >= 60 ? "text-primary" : "text-red-400"}`}>{p.l10}%</div>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${inSlip ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {inSlip ? "✓" : "+"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bet slip */}
        <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-20 self-start">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">BET SLIP</h2>
              <p className="text-xs text-muted-foreground">{legs.length} leg{legs.length !== 1 ? "s" : ""}</p>
            </div>
            {legs.length > 0 && (
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-400 transition-colors">Clear All</button>
            )}
          </div>

          {legs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="text-3xl mb-2 opacity-40">📋</div>
              <p className="text-sm">Click players to add to your parlay</p>
            </div>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto">
              {legs.map((leg) => (
                <div key={leg.playerId} className="p-3 border-b border-border relative">
                  <button onClick={() => removeLeg(leg.playerId)} className="absolute top-2 right-2 text-muted-foreground hover:text-red-400">
                    <X size={14} />
                  </button>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{leg.team}</div>
                  <div className="font-semibold text-sm text-foreground">{leg.name} — O {leg.prop}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">{leg.side.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">HR: {leg.hitRate}%</span>
                    <span className="ml-auto font-display font-bold text-sm text-foreground">{leg.odds > 0 ? "+" : ""}{leg.odds}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {legs.length > 0 && (
            <div className="p-4 bg-secondary/50">
              {/* Quality bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Parlay Quality</span>
                  <span>{avgHitRate}%</span>
                </div>
                <div className="h-1 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-gold rounded-full transition-all" style={{ width: `${avgHitRate}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Total Odds</div>
                  <div className="font-display font-bold text-lg text-primary">{totalAmericanOdds > 0 ? "+" : ""}{totalAmericanOdds}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Payout</div>
                  <div className="font-display font-bold text-lg text-green-400">${payout}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  value={wager}
                  onChange={(e) => setWager(Math.max(0, +e.target.value))}
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-foreground font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <button className="w-full py-3 bg-gradient-gold text-primary-foreground rounded-lg font-display font-bold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity">
                Place Parlay
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
