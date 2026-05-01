// src/components/PlayerDetailView.tsx
// LinePulse — Black & Gold brand
// FIXED: Team stats now query games_data directly via Supabase
// FIXED: Injury position JSON cleaned up

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Brand tokens
const GOLD = "#c9a84c";
const GOLD_BRIGHT = "#f0b429";
const GOLD_DIM = "#7a5c1e";
const BG_DEEP = "#020617";
const BG_CARD = "#0b1120";
const BG_ROW = "#0f172a";
const BORDER = "#1e293b";
const GREEN = "#22c55e";
const GREEN_DARK = "#16a34a";
const GREEN_LIGHT = "#4ade80";
const RED = "#ef4444";

// ── STAT TAB DEFINITIONS ──────────────────────────────────────
const STAT_TABS: Record<string, { key: string; label: string; components?: string[] }[]> = {
  nba: [
    { key: "minutes_played", label: "MIN" },
    { key: "points", label: "PTS" },
    { key: "rebounds", label: "REBS" },
    { key: "assists", label: "ASTS" },
    { key: "steals", label: "STL" },
    { key: "blocks", label: "BLKS" },
    { key: "turnovers", label: "TOV" },
    { key: "three_pointers_made", label: "3PM" },
    { key: "free_throws_made", label: "FTM" },
    { key: "field_goals_made", label: "FGM" },
    { key: "combo_pa", label: "PA", components: ["points", "assists"] },
    { key: "combo_pr", label: "PR", components: ["points", "rebounds"] },
    { key: "combo_ra", label: "RA", components: ["rebounds", "assists"] },
    { key: "combo_pra", label: "PRA", components: ["points", "rebounds", "assists"] },
    { key: "combo_bs", label: "BLKS+STL", components: ["blocks", "steals"] },
  ],
  nfl: [
    { key: "passing_yards", label: "PASS YDS" },
    { key: "rushing_yards", label: "RUSH YDS" },
    { key: "receiving_yards", label: "REC YDS" },
    { key: "passing_tds", label: "PASS TD" },
    { key: "receptions", label: "REC" },
    { key: "combo_pass_rush", label: "PASS+RUSH", components: ["passing_yards", "rushing_yards"] },
    { key: "combo_rush_rec", label: "RUSH+REC", components: ["rushing_yards", "receiving_yards"] },
  ],
  mlb: [
    { key: "hits", label: "H" },
    { key: "runs", label: "R" },
    { key: "rbi", label: "RBI" },
    { key: "home_runs", label: "HR" },
    { key: "total_bases", label: "TB" },
    { key: "strikeouts_pitching", label: "K" },
    { key: "combo_hrr", label: "H+R+RBI", components: ["hits", "runs", "rbi"] },
  ],
  nhl: [
    { key: "goals", label: "G" },
    { key: "assists_hockey", label: "A" },
    { key: "shots_on_goal", label: "SOG" },
    { key: "blocked_shots", label: "BLK" },
    { key: "plus_minus", label: "+/-" },
    { key: "combo_ga", label: "G+A", components: ["goals", "assists_hockey"] },
  ],
  soccer: [
    { key: "goals_soccer", label: "G" },
    { key: "assists_soccer", label: "A" },
    { key: "shots_soccer", label: "SH" },
    { key: "shots_on_target", label: "SOT" },
    { key: "tackles", label: "TKL" },
    { key: "key_passes", label: "KP" },
    { key: "combo_ga_soccer", label: "G+A", components: ["goals_soccer", "assists_soccer"] },
  ],
};

const GAMELOG_COLS: Record<string, { key: string; label: string; combo?: string[] }[]> = {
  nba: [
    { key: "points", label: "Pts" },
    { key: "rebounds", label: "Rebs" },
    { key: "assists", label: "Asts" },
    { key: "pa", label: "PA", combo: ["points", "assists"] },
    { key: "pr", label: "PR", combo: ["points", "rebounds"] },
    { key: "pra", label: "PRA", combo: ["points", "rebounds", "assists"] },
    { key: "blocks", label: "Blks" },
    { key: "steals", label: "St" },
    { key: "turnovers", label: "Tov" },
    { key: "three_pointers_made", label: "3PM" },
  ],
  nfl: [
    { key: "passing_yards", label: "Pass" },
    { key: "rushing_yards", label: "Rush" },
    { key: "receiving_yards", label: "Rec" },
    { key: "passing_tds", label: "TD" },
    { key: "receptions", label: "Rec#" },
  ],
  mlb: [
    { key: "hits", label: "H" },
    { key: "runs", label: "R" },
    { key: "rbi", label: "RBI" },
    { key: "home_runs", label: "HR" },
    { key: "total_bases", label: "TB" },
    { key: "hrr", label: "H+R+RBI", combo: ["hits", "runs", "rbi"] },
  ],
  nhl: [
    { key: "goals", label: "G" },
    { key: "assists_hockey", label: "A" },
    { key: "ga", label: "G+A", combo: ["goals", "assists_hockey"] },
    { key: "shots_on_goal", label: "SOG" },
    { key: "blocked_shots", label: "BLK" },
    { key: "plus_minus", label: "+/-" },
  ],
  soccer: [
    { key: "goals_soccer", label: "G" },
    { key: "assists_soccer", label: "A" },
    { key: "ga", label: "G+A", combo: ["goals_soccer", "assists_soccer"] },
    { key: "shots_soccer", label: "SH" },
    { key: "shots_on_target", label: "SOT" },
    { key: "tackles", label: "TKL" },
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
function getVal(log: any, key: string, combo?: string[]): number {
  if (combo) return combo.reduce((s, k) => s + (Number(log[k]) || 0), 0);
  return Number(log[key]) || 0;
}
function hitRate(vals: number[], line: number): number {
  if (!vals.length) return 0;
  return Math.round((vals.filter(v => v >= line).length / vals.length) * 100);
}
function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function roundHalf(n: number) { return Math.round(n / 0.5) * 0.5; }
function getInitials(name: string) {
  return (name || "??").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
function fmtDate(d: string) {
  if (!d) return "—";
  try { const [, m, day] = d.split("-"); return `${m}-${day}`; } catch { return d; }
}

// ── FETCH TEAM GAMES FROM games_data ─────────────────────────
async function fetchTeamGames(teamId: string): Promise<any[]> {
  if (!teamId) return [];

  try {
    // Get games where this team is home or away, with final scores
    const { data, error } = await supabase
      .from('games_data')
      .select(`
        id, game_date, home_score, away_score, status,
        home_team_id, away_team_id
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not('home_score', 'eq', 0)
      .order('game_date', { ascending: false })
      .limit(25);

    if (error || !data?.length) {
      // Fallback: also try status=final
      const { data: data2 } = await supabase
        .from('games_data')
        .select('id, game_date, home_score, away_score, status, home_team_id, away_team_id')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .in('status', ['final', 'Final', 'STATUS_FINAL', 'completed'])
        .order('game_date', { ascending: false })
        .limit(25);
      if (!data2?.length) return [];
      return formatTeamGames(data2, teamId);
    }

    return formatTeamGames(data, teamId);
  } catch (e: any) {
    console.error('fetchTeamGames error:', e.message);
    return [];
  }
}

function formatTeamGames(games: any[], teamId: string): any[] {
  return games.map(g => {
    const isHome = g.home_team_id === teamId;
    const teamScore = isHome ? Number(g.home_score) : Number(g.away_score);
    const oppScore  = isHome ? Number(g.away_score)  : Number(g.home_score);
    return {
      game_date:  g.game_date,
      team_score: teamScore,
      opp_score:  oppScore,
      opponent:   isHome ? 'vs OPP' : '@ OPP', // will enhance with team names
      score:      teamScore,
      opp:        oppScore,
      margin:     teamScore - oppScore,
      total:      teamScore + oppScore,
    };
  }).filter(g => g.team_score > 0 || g.opp_score > 0);
}

// ── HIT RATE BOX ─────────────────────────────────────────────
function HRBox({ label, hr, av }: { label: string; hr: number | null; av?: number }) {
  if (hr === null || hr === undefined) {
    return (
      <div className="px-2.5 py-1.5 rounded-lg text-center min-w-[62px]" style={{ background: "#111827", border: `1px solid ${BORDER}` }}>
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className="text-xs font-bold text-gray-600">— %</p>
        {av !== undefined && <p className="text-[10px] text-gray-600">Avg —</p>}
      </div>
    );
  }
  const bg = hr >= 80 ? GREEN_DARK : hr >= 60 ? "#92400e" : "#7f1d1d";
  const fg = hr >= 80 ? "#bbf7d0" : hr >= 60 ? "#fde68a" : "#fecaca";
  return (
    <div className="px-2.5 py-1.5 rounded-lg text-center min-w-[62px]" style={{ background: bg, border: `1px solid ${hr >= 80 ? "#166534" : hr >= 60 ? "#78350f" : "#991b1b"}` }}>
      <p className="text-[10px] font-semibold" style={{ color: fg }}>{label}</p>
      <p className="text-xs font-bold" style={{ color: fg }}>HR {hr}%</p>
      {av !== undefined && <p className="text-[10px] opacity-80" style={{ color: fg }}>Avg {av.toFixed(1)}</p>}
    </div>
  );
}

// ── SCROLLABLE TAB BAR ────────────────────────────────────────
function TabBar({ tabs, active, onSelect }: { tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div className="flex gap-0 overflow-x-auto scrollbar-none border-b" style={{ borderColor: BORDER }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0"
          style={{ color: active === t.key ? GOLD_BRIGHT : "#6b7280", borderBottom: active === t.key ? `2px solid ${GOLD_BRIGHT}` : "2px solid transparent", background: "transparent" }}>
          {t.label}
        </button>
      ))}
      <div className="flex items-center px-2 text-gray-600 flex-shrink-0"><ChevronRight className="w-3.5 h-3.5" /></div>
    </div>
  );
}

// ── STACKED BAR CHART ─────────────────────────────────────────
function BarChart({ gameLogs, tab, line }: { gameLogs: any[]; tab: { key: string; label: string; components?: string[] }; line: number }) {
  const logs = [...gameLogs].reverse();
  if (!logs.length) return <div className="h-52 flex items-center justify-center text-gray-600 text-sm">No game data available</div>;

  const isCombo = !!tab.components?.length;
  const components = tab.components || [];
  const vals = logs.map(g => getVal(g, tab.key, tab.components));
  const maxVal = Math.max(...vals, line, 1) * 1.25;
  const chartH = 180;

  return (
    <div>
      <div className="flex items-end justify-between gap-1" style={{ height: chartH }}>
        {logs.map((g, i) => {
          const total = vals[i];
          const isOver = total >= line;
          const barH = Math.max(4, Math.round((total / maxVal) * chartH));
          const lineY = Math.round((line / maxVal) * chartH);
          let segments: { val: number; col: string }[] = [];
          if (isCombo && components.length > 1) {
            const [k1, k2, k3] = components;
            const v1 = Number(g[k1]) || 0;
            const v2 = Number(g[k2]) || 0;
            const v3 = k3 ? Number(g[k3]) || 0 : 0;
            segments = [{ val: v3, col: GREEN_LIGHT }, { val: v2, col: "#86efac" }, { val: v1, col: isOver ? GREEN_DARK : RED }].filter(s => s.val > 0);
          }
          return (
            <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
              <span className="text-[9px] font-bold mb-0.5" style={{ color: isOver ? GREEN : RED }}>{total > 0 ? total : ""}</span>
              <div className="relative w-full flex flex-col justify-end" style={{ height: chartH - 16 }}>
                <div className="absolute left-0 right-0 border-t border-dashed" style={{ bottom: lineY, borderColor: `${GOLD}80` }} />
                {isCombo && segments.length > 1 ? (
                  <div className="w-full flex flex-col" style={{ height: barH }}>
                    {segments.map((seg, si) => <div key={si} className="w-full rounded-sm" style={{ flex: seg.val, background: seg.col, marginBottom: si < segments.length - 1 ? 1 : 0 }} />)}
                  </div>
                ) : (
                  <div className="w-full rounded-sm" style={{ height: barH, background: isOver ? GREEN_DARK : RED }} />
                )}
              </div>
              <div className="text-center mt-0.5" style={{ minWidth: 0 }}>
                <p className="text-[8px] text-gray-500 truncate w-full">{g.opponent || g.team_abbreviation || "—"}</p>
                <p className="text-[8px] text-gray-600 truncate w-full">{fmtDate(g.game_date)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: GREEN_DARK }} /><span className="text-[10px] text-gray-500">Over line</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: RED }} /><span className="text-[10px] text-gray-500">Under line</span></div>
        <div className="flex items-center gap-1 ml-auto"><div className="w-5 h-0 border-t border-dashed" style={{ borderColor: GOLD }} /><span className="text-[10px] text-gray-500">Line {line.toFixed(1)}</span></div>
      </div>
    </div>
  );
}

// ── LINE ADJUSTER ─────────────────────────────────────────────
function LineAdjuster({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(0, +(value - 0.5).toFixed(1)))} className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-lg transition hover:opacity-80" style={{ background: "#1e293b", border: `1px solid ${BORDER}` }}>−</button>
      <span className="w-14 text-center font-bold text-xl tabular-nums" style={{ color: GOLD_BRIGHT }}>{value.toFixed(1)}</span>
      <button onClick={() => onChange(+(value + 0.5).toFixed(1))} className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-lg transition hover:opacity-80" style={{ background: "#1e293b", border: `1px solid ${BORDER}` }}>+</button>
    </div>
  );
}

const PERIODS = [{ label: "L5", n: 5 }, { label: "L10", n: 10 }, { label: "L15", n: 15 }, { label: "L20", n: 20 }];

// ── PLAYER STATS SECTION ─────────────────────────────────────
function PlayerStatSection({ title, tabs, gameLogs, sport, defaultTab }: {
  title: string; tabs: { key: string; label: string; components?: string[] }[];
  gameLogs: any[]; sport: string; defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [activePeriod, setActivePeriod] = useState(10);
  const [customLines, setCustomLines] = useState<Record<string, number>>({});

  const tab = tabs.find(t => t.key === activeTab) || tabs[0];
  const allVals = gameLogs.map(g => getVal(g, tab.key, tab.components));
  const slices: Record<number, number[]> = { 5: allVals.slice(0, 5), 10: allVals.slice(0, 10), 15: allVals.slice(0, 15), 20: allVals.slice(0, 20) };
  const a5 = avg(slices[5]); const a10 = avg(slices[10]); const a20 = avg(slices[20]);
  const proj = slices[5].length >= 3 ? a5 * 0.5 + a10 * 0.3 + a20 * 0.2 : a10;
  const defaultLine = roundHalf(proj);
  const line = customLines[tab.key] ?? defaultLine;
  const activeSlice = slices[activePeriod] || slices[10];
  const activeAvg = avg(activeSlice);
  const activeHitRate = hitRate(activeSlice, line);
  const actualGames = activeSlice.length;
  const chartKey = `${tab.key}-${activePeriod}-${line}-${actualGames}`;
  const insufficientData = activePeriod > gameLogs.length;

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: BG_CARD, borderColor: BORDER }}>
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <span className="font-bold text-sm" style={{ color: GOLD }}>{title}</span>
      </div>
      <TabBar tabs={tabs} active={activeTab} onSelect={key => { setActiveTab(key); setActivePeriod(10); }} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">{tab.label} · Line</p>
            <LineAdjuster value={line} onChange={v => setCustomLines(prev => ({ ...prev, [tab.key]: v }))} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(({ label, n }) => {
              const sl = slices[n] || [];
              const hr = hitRate(sl, line);
              const av = avg(sl);
              const isActive = activePeriod === n;
              const hasEnoughGames = sl.length > 0;
              const bg = hr >= 80 ? GREEN_DARK : hr >= 60 ? "#92400e" : "#7f1d1d";
              const fg = hr >= 80 ? "#bbf7d0" : hr >= 60 ? "#fde68a" : "#fecaca";
              const activeBorder = hr >= 80 ? "#22c55e" : hr >= 60 ? GOLD_BRIGHT : RED;
              return (
                <button key={n} onClick={() => hasEnoughGames && setActivePeriod(n)}
                  className="px-2.5 py-1.5 rounded-lg text-center transition-all"
                  style={{ background: bg, border: `2px solid ${isActive ? activeBorder : "transparent"}`, minWidth: 64, boxShadow: isActive ? `0 0 8px ${activeBorder}55` : "none", transform: isActive ? "scale(1.05)" : "scale(1)", opacity: hasEnoughGames ? 1 : 0.5, cursor: hasEnoughGames ? "pointer" : "not-allowed" }}>
                  <p className="text-[10px] font-bold" style={{ color: fg }}>{label}</p>
                  <p className="text-[11px] font-bold" style={{ color: fg }}>HR {sl.length ? hr : 0}%</p>
                  <p className="text-[10px] opacity-80" style={{ color: fg }}>Avg {sl.length ? av.toFixed(1) : "—"}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: `${GOLD_DIM}30`, color: GOLD, border: `1px solid ${GOLD_DIM}` }}>
            Showing {actualGames === activePeriod ? `Last ${activePeriod} games` : `Last ${activePeriod} (${actualGames} available)`}
          </span>
          <span className="text-gray-500">
            Avg <span className="font-bold" style={{ color: GOLD_BRIGHT }}>{activeAvg.toFixed(1)}</span>
            &nbsp;· HR <span className="font-bold" style={{ color: activeHitRate >= 80 ? GREEN : activeHitRate >= 60 ? GOLD : RED }}>{activeHitRate}%</span>
          </span>
        </div>
        {insufficientData ? (
          <div className="h-52 flex items-center justify-center text-gray-500 text-sm border rounded-lg" style={{ borderColor: BORDER }}>
            Showing {gameLogs.length} available games (building towards L{activePeriod})
          </div>
        ) : (
          <BarChart key={chartKey} gameLogs={gameLogs.slice(0, activePeriod)} tab={tab} line={line} />
        )}
      </div>
    </div>
  );
}

// ── TEAM STATS SECTION ───────────────────────────────────────
function TeamStatsSection({ teamGameLogs, sport, playerTeamName, loadingTeam }: {
  teamGameLogs: any[]; sport: string; playerTeamName?: string; loadingTeam: boolean;
}) {
  const [activeTab, setActiveTab] = useState("score");
  const [activePeriod, setActivePeriod] = useState(10);
  const [customLines, setCustomLines] = useState<Record<string, number>>({});

  const TEAM_TABS = [
    { key: "score", label: "PTS" },
    { key: "opp", label: "OPP" },
    { key: "margin", label: "MARGIN" },
    { key: "total", label: "TOTAL" },
  ];

  const tab = TEAM_TABS.find(t => t.key === activeTab) || TEAM_TABS[0];

  // Map tab key to game log field
  const vals = teamGameLogs.map(g => {
    if (tab.key === "score")  return Number(g.team_score) || 0;
    if (tab.key === "opp")    return Number(g.opp_score)  || 0;
    if (tab.key === "margin") return Number(g.margin)     || 0;
    if (tab.key === "total")  return Number(g.total)      || 0;
    return 0;
  });

  const slices: Record<number, number[]> = {
    5:  vals.slice(0, 5),
    10: vals.slice(0, 10),
    15: vals.slice(0, 15),
    20: vals.slice(0, 20),
  };

  const a10 = avg(slices[10]);
  const defaultLine = roundHalf(a10 || 110); // fallback to 110 for NBA
  const line = customLines[tab.key] ?? defaultLine;
  const activeSlice = slices[activePeriod] || slices[10];
  const activeAvg = avg(activeSlice);
  const activeHitRate = hitRate(activeSlice, line);
  const actualGames = activeSlice.length;

  const chartLogs = teamGameLogs.slice(0, activePeriod).map(g => ({
    opponent: g.opponent || "—",
    game_date: g.game_date || "",
    [tab.key]: tab.key === "score"  ? Number(g.team_score)
             : tab.key === "opp"    ? Number(g.opp_score)
             : tab.key === "margin" ? Number(g.margin)
             : Number(g.total),
  }));

  const chartKey = `${tab.key}-${activePeriod}-${line}-${actualGames}`;
  const insufficientData = activePeriod > teamGameLogs.length;

  if (loadingTeam) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: BG_CARD, borderColor: BORDER }}>
        <div className="px-4 py-2.5 border-b" style={{ borderColor: BORDER }}>
          <span className="font-bold text-sm" style={{ color: GOLD }}>🏟 Team Stats</span>
        </div>
        <div className="p-8 text-center text-gray-500 text-sm">Loading team game data...</div>
      </div>
    );
  }

  if (!teamGameLogs.length) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: BG_CARD, borderColor: BORDER }}>
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <span className="font-bold text-sm" style={{ color: GOLD }}>🏟 Team Stats</span>
          <span className="text-[10px] text-gray-600">No completed game data yet</span>
        </div>
        <div className="p-8 text-center text-gray-500 text-sm">
          Team game scores will appear once games complete.<br />
          {playerTeamName && <span className="text-gray-600 text-xs">Team: {playerTeamName}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: BG_CARD, borderColor: BORDER }}>
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
        <span className="font-bold text-sm" style={{ color: GOLD }}>🏟 Team Stats</span>
        <span className="text-[10px] text-gray-500">{teamGameLogs.length} games loaded</span>
      </div>
      <TabBar tabs={TEAM_TABS} active={activeTab} onSelect={setActiveTab} />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">{tab.label} · Line</p>
            <LineAdjuster value={line} onChange={v => setCustomLines(prev => ({ ...prev, [tab.key]: v }))} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(({ label, n }) => {
              const sl = slices[n] || [];
              const hr = hitRate(sl, line);
              const av = avg(sl);
              const isActive = activePeriod === n;
              const hasEnoughGames = sl.length > 0;
              const bg = hr >= 80 ? GREEN_DARK : hr >= 60 ? "#92400e" : "#7f1d1d";
              const fg = hr >= 80 ? "#bbf7d0" : hr >= 60 ? "#fde68a" : "#fecaca";
              const activeBorder = hr >= 80 ? "#22c55e" : hr >= 60 ? GOLD_BRIGHT : RED;
              return (
                <button key={n} onClick={() => hasEnoughGames && setActivePeriod(n)}
                  className="px-2.5 py-1.5 rounded-lg text-center transition-all"
                  style={{ background: bg, border: `2px solid ${isActive ? activeBorder : "transparent"}`, minWidth: 64, boxShadow: isActive ? `0 0 8px ${activeBorder}55` : "none", transform: isActive ? "scale(1.05)" : "scale(1)", opacity: hasEnoughGames ? 1 : 0.5, cursor: hasEnoughGames ? "pointer" : "not-allowed" }}>
                  <p className="text-[10px] font-bold" style={{ color: fg }}>{label}</p>
                  <p className="text-[11px] font-bold" style={{ color: fg }}>HR {sl.length ? hr : 0}%</p>
                  <p className="text-[10px] opacity-80" style={{ color: fg }}>Avg {sl.length ? av.toFixed(1) : "—"}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: `${GOLD_DIM}30`, color: GOLD, border: `1px solid ${GOLD_DIM}` }}>
            {actualGames === activePeriod ? `Last ${activePeriod} games` : `Last ${activePeriod} (${actualGames} available)`}
          </span>
          <span className="text-gray-500">
            Avg <span className="font-bold" style={{ color: GOLD_BRIGHT }}>{activeAvg.toFixed(1)}</span>
            &nbsp;· HR <span className="font-bold" style={{ color: activeHitRate >= 80 ? GREEN : activeHitRate >= 60 ? GOLD : RED }}>{activeHitRate}%</span>
          </span>
        </div>
        {insufficientData ? (
          <div className="h-52 flex items-center justify-center text-gray-500 text-sm border rounded-lg" style={{ borderColor: BORDER }}>
            Showing {teamGameLogs.length} available games (building towards L{activePeriod})
          </div>
        ) : (
          <BarChart key={chartKey} gameLogs={chartLogs} tab={{ key: tab.key, label: tab.label }} line={line} />
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
interface Props {
  playerId: string;
  sport: string;
  onBack: () => void;
  playerName?: string;
}

export function PlayerDetailView({ playerId, sport, onBack, playerName }: Props) {
  const [player, setPlayer]           = useState<any>(null);
  const [gameLogs, setGameLogs]       = useState<any[]>([]);
  const [teamGameLogs, setTeamGameLogs] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        // Fetch player details + game logs from clever-action
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_player_details", sport, player_id: playerId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load");

        setPlayer(data.player);
        const logs = data.player.game_logs || [];
        setGameLogs(logs);
        console.log(`[PlayerDetail] ${logs.length} game logs for ${data.player.full_name}`);

        // Fetch team games directly from games_data via Supabase
        if (data.player.team_id) {
          setLoadingTeam(true);
          try {
            const teamGames = await fetchTeamGames(data.player.team_id);
            console.log(`[TeamStats] ${teamGames.length} team games found`);
            setTeamGameLogs(teamGames);
          } catch (te: any) {
            console.warn('Team games fetch failed:', te.message);
          } finally {
            setLoadingTeam(false);
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, sport]);

  const tabs = STAT_TABS[sport] || STAT_TABS.nba;
  const glCols = GAMELOG_COLS[sport] || GAMELOG_COLS.nba;

  const maxStats = useMemo(() => {
    if (!gameLogs.length) return {};
    const maxOf = (k: string) => Math.max(...gameLogs.map(g => Number(g[k]) || 0));
    if (sport === "nba") return { Points: maxOf("points"), Rebounds: maxOf("rebounds"), Assists: maxOf("assists"), Steals: maxOf("steals"), Blocks: maxOf("blocks"), "3PM": maxOf("three_pointers_made") };
    if (sport === "nfl") return { "Pass Yds": maxOf("passing_yards"), "Rush Yds": maxOf("rushing_yards"), "Rec Yds": maxOf("receiving_yards"), "Pass TDs": maxOf("passing_tds") };
    if (sport === "mlb") return { Hits: maxOf("hits"), Runs: maxOf("runs"), RBI: maxOf("rbi"), HR: maxOf("home_runs"), TB: maxOf("total_bases") };
    if (sport === "nhl") return { Goals: maxOf("goals"), Assists: maxOf("assists_hockey"), SOG: maxOf("shots_on_goal"), Blocked: maxOf("blocked_shots") };
    return { Goals: maxOf("goals_soccer"), Assists: maxOf("assists_soccer"), Shots: maxOf("shots_soccer") };
  }, [gameLogs, sport]);

  const name = player?.full_name || playerName || "Player";
  const initials = getInitials(name);
  const avail = gameLogs.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG_DEEP }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: `${GOLD} transparent transparent transparent` }} />
          <p className="text-gray-400 text-sm">Loading player data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4" style={{ background: BG_DEEP }}>
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="p-4 rounded-xl border border-red-800/40 bg-red-900/10 text-red-400 text-sm">❌ {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: BG_DEEP }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3" style={{ background: `${BG_DEEP}e8`, backdropFilter: "blur(8px)", borderColor: BORDER }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition hover:opacity-80" style={{ color: GOLD }}><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="w-px h-5 mx-1" style={{ background: BORDER }} />
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: `${GOLD_DIM}55`, border: `1.5px solid ${GOLD_DIM}`, color: GOLD_BRIGHT }}>{initials}</div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-base leading-tight truncate" style={{ color: GOLD_BRIGHT }}>{name}</h1>
          <p className="text-[11px] text-gray-500 truncate">{player?.team} · {player?.position} · {sport.toUpperCase()} · {avail} games</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto">
        {/* Left column */}
        <div className="flex-1 space-y-4 min-w-0">
          <PlayerStatSection title="⚡ Player Stats" tabs={tabs} gameLogs={gameLogs} sport={sport} defaultTab={tabs[1]?.key || tabs[0]?.key} />
          <TeamStatsSection teamGameLogs={teamGameLogs} sport={sport} playerTeamName={player?.team} loadingTeam={loadingTeam} />

          {/* Game log table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: BG_CARD, borderColor: BORDER }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
              <span className="font-bold text-sm" style={{ color: GOLD }}>Gamelog — Last {Math.min(15, avail)} Games</span>
            </div>
            {gameLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">No game logs available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: BG_ROW, borderBottom: `1px solid ${BORDER}` }}>
                      <th className="p-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: GOLD_DIM }}>Opponent</th>
                      <th className="p-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: GOLD_DIM }}>Date</th>
                      {glCols.map(c => <th key={c.key} className="p-2.5 text-center text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: GOLD_DIM }}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {gameLogs.slice(0, 15).map((g, i) => (
                      <tr key={i} className="transition-colors hover:bg-white/5" style={{ borderBottom: `1px solid ${BORDER}33` }}>
                        <td className="p-2.5 font-medium text-gray-300 whitespace-nowrap text-xs">{g.opponent || g.team_abbreviation || "—"}</td>
                        <td className="p-2.5 text-gray-500 whitespace-nowrap text-xs">{g.game_date ? g.game_date.slice(5).replace("-", "-") : "—"}</td>
                        {glCols.map(c => {
                          const val = getVal(g, c.key, c.combo);
                          return <td key={c.key} className="p-2.5 text-center text-xs font-medium"><span style={{ color: val > 0 ? "#e5e7eb" : "#374151" }}>{val}</span></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="lg:w-64 space-y-4 flex-shrink-0">
          <div className="rounded-xl border p-4" style={{ background: BG_CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ background: `${GOLD_DIM}40`, border: `2px solid ${GOLD_DIM}`, color: GOLD_BRIGHT }}>{initials}</div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight truncate" style={{ color: GOLD_BRIGHT }}>{name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${GOLD_DIM}30`, color: GOLD, border: `1px solid ${GOLD_DIM}` }}>{player?.team || "—"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#1e293b", color: "#94a3b8", border: `1px solid ${BORDER}` }}>{sport.toUpperCase()}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#1e293b", color: "#94a3b8", border: `1px solid ${BORDER}` }}>{player?.position || "—"}</span>
                </div>
              </div>
            </div>
            <div className="border-t pt-3" style={{ borderColor: BORDER }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: GOLD_DIM }}>Player Max Stats</p>
              <div className="space-y-1.5">
                {Object.entries(maxStats).map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">{label}</span>
                    <span className="text-[11px] font-bold text-white">{val as number}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-lg p-3 text-center" style={{ background: `${GOLD_DIM}20`, border: `1px solid ${GOLD_DIM}40` }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${GOLD_DIM}40`, border: `1px solid ${GOLD_DIM}` }}><span className="text-[10px]">🎯</span></div>
                <p className="text-[10px] text-gray-400 font-medium">Games Played</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: GOLD_BRIGHT }}>{avail}</p>
            </div>
          </div>

          {gameLogs.length > 0 && (
            <div className="rounded-xl border p-4 space-y-2" style={{ background: BG_CARD, borderColor: BORDER }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: GOLD_DIM }}>Quick Hit Rates (L10)</p>
              {tabs.slice(0, 8).map(t => {
                const vals = gameLogs.map(g => getVal(g, t.key, t.components));
                const l10 = vals.slice(0, 10);
                const a10 = avg(l10);
                const line = roundHalf(a10);
                const hr = hitRate(l10, line);
                const bg = hr >= 80 ? "#052e16" : hr >= 60 ? "#1c1000" : "#1c0505";
                const fg = hr >= 80 ? GREEN : hr >= 60 ? GOLD : RED;
                return (
                  <div key={t.key} className="flex items-center justify-between py-1 border-b last:border-0" style={{ borderColor: `${BORDER}66` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-16 truncate">{t.label}</span>
                      <span className="text-[10px] text-gray-600">{line.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]" style={{ color: "#6b7280" }}>{a10.toFixed(1)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: bg, color: fg }}>{hr}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerDetailView;
