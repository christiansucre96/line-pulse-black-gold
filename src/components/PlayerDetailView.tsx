// src/components/PlayerDetailView.tsx
// LinePulse — Black & Gold brand
// Matches screenshot exactly: scrollable stat tabs, stacked bar chart,
// team stats section, full gamelog table with computed combos

import { useEffect, useState, useMemo, useRef } from "react";
import { ArrowLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ── BRAND TOKENS ──────────────────────────────────────────────
const GOLD      = "#c9a84c";
const GOLD_BRIGHT = "#f0b429";
const GOLD_DIM  = "#7a5c1e";
const BG_DEEP   = "#020617";
const BG_CARD   = "#0b1120";
const BG_ROW    = "#0f172a";
const BORDER    = "#1e293b";
const GREEN     = "#22c55e";
const GREEN_DARK= "#16a34a";
const GREEN_LIGHT="#4ade80";
const RED       = "#ef4444";

// ── STAT TAB DEFINITION ───────────────────────────────────────
const STAT_TABS: Record<string, { key: string; label: string; components?: string[] }[]> = {
  nba: [
    { key: "minutes_played",         label: "MIN" },
    { key: "points",                 label: "PTS" },
    { key: "rebounds",               label: "REBS" },
    { key: "assists",                label: "ASTS" },
    { key: "steals",                 label: "STL" },
    { key: "blocks",                 label: "BLKS" },
    { key: "turnovers",              label: "TOV" },
    { key: "three_pointers_made",    label: "3PM" },
    { key: "free_throws_made",       label: "FTM" },
    { key: "field_goals_made",       label: "FGM" },
    { key: "combo_pa",  label: "PA",  components: ["points","assists"] },
    { key: "combo_pr",  label: "PR",  components: ["points","rebounds"] },
    { key: "combo_ra",  label: "RA",  components: ["rebounds","assists"] },
    { key: "combo_pra", label: "PRA", components: ["points","rebounds","assists"] },
    { key: "combo_bs",  label: "BLKS+STL", components: ["blocks","steals"] },
  ],
  nfl: [
    { key: "passing_yards",   label: "PASS YDS" },
    { key: "rushing_yards",   label: "RUSH YDS" },
    { key: "receiving_yards", label: "REC YDS" },
    { key: "passing_tds",     label: "PASS TD" },
    { key: "receptions",      label: "REC" },
    { key: "combo_pass_rush", label: "PASS+RUSH", components: ["passing_yards","rushing_yards"] },
    { key: "combo_rush_rec",  label: "RUSH+REC",  components: ["rushing_yards","receiving_yards"] },
  ],
  mlb: [
    { key: "hits",       label: "H" },
    { key: "runs",       label: "R" },
    { key: "rbi",        label: "RBI" },
    { key: "home_runs",  label: "HR" },
    { key: "total_bases",label: "TB" },
    { key: "strikeouts_pitching", label: "K" },
    { key: "hits_allowed",        label: "HA" },
    { key: "combo_hrr", label: "H+R+RBI", components: ["hits","runs","rbi"] },
  ],
  nhl: [
    { key: "goals",          label: "G" },
    { key: "assists_hockey", label: "A" },
    { key: "shots_on_goal",  label: "SOG" },
    { key: "blocked_shots",  label: "BLK" },
    { key: "plus_minus",     label: "+/-" },
    { key: "combo_ga",       label: "G+A", components: ["goals","assists_hockey"] },
  ],
  soccer: [
    { key: "goals_soccer",    label: "G" },
    { key: "assists_soccer",  label: "A" },
    { key: "shots_soccer",    label: "SH" },
    { key: "shots_on_target", label: "SOT" },
    { key: "tackles",         label: "TKL" },
    { key: "key_passes",      label: "KP" },
    { key: "combo_ga_soccer", label: "G+A", components: ["goals_soccer","assists_soccer"] },
  ],
};

// ── GAMELOG TABLE COLUMNS per sport ──────────────────────────
const GAMELOG_COLS: Record<string, { key: string; label: string; combo?: string[] }[]> = {
  nba: [
    { key: "points",   label: "Pts" },
    { key: "rebounds", label: "Rebs" },
    { key: "assists",  label: "Asts" },
    { key: "pa",       label: "PA",  combo: ["points","assists"] },
    { key: "pr",       label: "PR",  combo: ["points","rebounds"] },
    { key: "ra",       label: "RA",  combo: ["rebounds","assists"] },
    { key: "pra",      label: "PRA", combo: ["points","rebounds","assists"] },
    { key: "blocks",   label: "Blks" },
    { key: "steals",   label: "St" },
    { key: "turnovers",label: "Tov" },
    { key: "three_pointers_made", label: "3PM" },
  ],
  nfl: [
    { key: "passing_yards",   label: "Pass" },
    { key: "rushing_yards",   label: "Rush" },
    { key: "receiving_yards", label: "Rec" },
    { key: "passing_tds",     label: "TD" },
    { key: "receptions",      label: "Rec#" },
  ],
  mlb: [
    { key: "hits",      label: "H" },
    { key: "runs",      label: "R" },
    { key: "rbi",       label: "RBI" },
    { key: "home_runs", label: "HR" },
    { key: "total_bases",label: "TB" },
    { key: "hrr",       label: "H+R+RBI", combo: ["hits","runs","rbi"] },
  ],
  nhl: [
    { key: "goals",          label: "G" },
    { key: "assists_hockey", label: "A" },
    { key: "ga",             label: "G+A", combo: ["goals","assists_hockey"] },
    { key: "shots_on_goal",  label: "SOG" },
    { key: "blocked_shots",  label: "BLK" },
    { key: "plus_minus",     label: "+/-" },
  ],
  soccer: [
    { key: "goals_soccer",   label: "G" },
    { key: "assists_soccer", label: "A" },
    { key: "ga",             label: "G+A", combo: ["goals_soccer","assists_soccer"] },
    { key: "shots_soccer",   label: "SH" },
    { key: "shots_on_target",label: "SOT" },
    { key: "tackles",        label: "TKL" },
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
function getVal(log: any, key: string, combo?: string[]): number {
  if (combo) return combo.reduce((s, k) => s + (Number(log[k]) || 0), 0);
  return Number(log[key]) || 0;
}

function hitRate(vals: number[], line: number): number {
  if (!vals.length) return 0;
  return Math.round(vals.filter(v => v >= line).length / vals.length * 100);
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
  try {
    const [, m, day] = d.split("-");
    return `${m}-${day}`;
  } catch { return d; }
}

// ── HIT RATE BOX ─────────────────────────────────────────────
function HRBox({ label, hr, av }: { label: string; hr: number | null; av?: number }) {
  if (hr === null || hr === undefined)
    return (
      <div style={{ background: "#111827", border: `1px solid ${BORDER}` }}
        className="px-2.5 py-1.5 rounded-lg text-center min-w-[62px]">
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className="text-xs font-bold text-gray-600">— %</p>
        {av !== undefined && <p className="text-[10px] text-gray-600">Avg —</p>}
      </div>
    );
  const bg = hr >= 80 ? GREEN_DARK : hr >= 60 ? "#92400e" : "#7f1d1d";
  const fg = hr >= 80 ? "#bbf7d0" : hr >= 60 ? "#fde68a" : "#fecaca";
  return (
    <div style={{ background: bg, border: `1px solid ${hr >= 80 ? "#166534" : hr >= 60 ? "#78350f" : "#991b1b"}` }}
      className="px-2.5 py-1.5 rounded-lg text-center min-w-[62px]">
      <p style={{ color: fg }} className="text-[10px] font-semibold">{label}</p>
      <p style={{ color: fg }} className="text-xs font-bold">HR {hr}%</p>
      {av !== undefined && <p style={{ color: fg }} className="text-[10px] opacity-80">Avg {av.toFixed(1)}</p>}
    </div>
  );
}

// ── SCROLLABLE TAB BAR ────────────────────────────────────────
function TabBar({ tabs, active, onSelect }: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (k: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="flex gap-0 overflow-x-auto scrollbar-none border-b"
      style={{ borderColor: BORDER }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0"
          style={{
            color:       active === t.key ? GOLD_BRIGHT : "#6b7280",
            borderBottom: active === t.key ? `2px solid ${GOLD_BRIGHT}` : "2px solid transparent",
            background:  "transparent",
          }}>
          {t.label}
        </button>
      ))}
      <div className="flex items-center px-2 text-gray-600 flex-shrink-0">
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

// ── STACKED BAR CHART ─────────────────────────────────────────
// Matches screenshot: numbers above bars, opponent+date below, dashed line
function BarChart({ gameLogs, tab, line, sport }: {
  gameLogs: any[];
  tab: { key: string; label: string; components?: string[] };
  line: number;
  sport: string;
}) {
  const last10 = gameLogs.slice(0, 10).reverse();
  if (!last10.length) return (
    <div className="h-52 flex items-center justify-center text-gray-600 text-sm">
      No game data available — run data pipeline first
    </div>
  );

  const isCombo = !!tab.components?.length;
  const components = tab.components || [];

  // Get values
  const vals = last10.map(g => getVal(g, tab.key, tab.components));
  const maxVal = Math.max(...vals, line, 1) * 1.25;
  const chartH = 180;

  return (
    <div>
      <div className="flex items-end justify-between gap-1" style={{ height: chartH }}>
        {last10.map((g, i) => {
          const total = vals[i];
          const isOver = total >= line;
          const barH   = Math.max(4, Math.round((total / maxVal) * chartH));
          const lineY  = Math.round((line / maxVal) * chartH);

          // For combos split into segments
          let segments: { val: number; col: string }[] = [];
          if (isCombo && components.length > 1) {
            const [k1, k2, k3] = components;
            const v1 = Number(g[k1]) || 0;
            const v2 = Number(g[k2]) || 0;
            const v3 = k3 ? Number(g[k3]) || 0 : 0;
            const h1 = Math.round((v1 / maxVal) * chartH);
            const h2 = Math.round((v2 / maxVal) * chartH);
            const h3 = k3 ? Math.round((v3 / maxVal) * chartH) : 0;
            segments = [
              { val: v3, col: GREEN_LIGHT },   // top segment (3rd component)
              { val: v2, col: "#86efac" },     // mid segment
              { val: v1, col: isOver ? GREEN_DARK : RED }, // base
            ].filter(s => s.val > 0);
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
              {/* Value above bar */}
              <span className="text-[9px] font-bold mb-0.5"
                style={{ color: isOver ? GREEN : RED }}>
                {total > 0 ? total : ""}
              </span>

              {/* Bar */}
              <div className="relative w-full flex flex-col justify-end"
                style={{ height: chartH - 16 }}>
                {/* Dashed line */}
                <div className="absolute left-0 right-0 border-t border-dashed"
                  style={{ bottom: lineY, borderColor: `${GOLD}80` }} />

                {/* Segments */}
                {isCombo && segments.length > 1 ? (
                  <div className="w-full flex flex-col" style={{ height: barH }}>
                    {segments.map((seg, si) => (
                      <div key={si} className="w-full rounded-sm"
                        style={{
                          flex: seg.val,
                          background: seg.col,
                          marginBottom: si < segments.length - 1 ? 1 : 0,
                        }} />
                    ))}
                  </div>
                ) : (
                  <div className="w-full rounded-sm"
                    style={{ height: barH, background: isOver ? GREEN_DARK : RED }} />
                )}
              </div>

              {/* Opponent + date below */}
              <div className="text-center mt-0.5" style={{ minWidth: 0 }}>
                <p className="text-[8px] text-gray-500 truncate w-full">
                  {g.opponent || g.team_abbreviation || "—"}
                </p>
                <p className="text-[8px] text-gray-600 truncate w-full">
                  {fmtDate(g.game_date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: GREEN_DARK }} />
          <span className="text-[10px] text-gray-500">Over line</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: RED }} />
          <span className="text-[10px] text-gray-500">Under line</span>
        </div>
        {isCombo && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: GREEN_LIGHT }} />
            <span className="text-[10px] text-gray-500">Components</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-5 h-0 border-t border-dashed" style={{ borderColor: GOLD }} />
          <span className="text-[10px] text-gray-500">Line {line.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

// ── LINE ADJUSTER ─────────────────────────────────────────────
function LineAdjuster({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(0, +(value - 0.5).toFixed(1)))}
        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-lg transition hover:opacity-80"
        style={{ background: "#1e293b", border: `1px solid ${BORDER}` }}>
        −
      </button>
      <span className="w-14 text-center font-bold text-xl tabular-nums" style={{ color: GOLD_BRIGHT }}>
        {value.toFixed(1)}
      </span>
      <button onClick={() => onChange(+(value + 0.5).toFixed(1))}
        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-lg transition hover:opacity-80"
        style={{ background: "#1e293b", border: `1px solid ${BORDER}` }}>
        +
      </button>
    </div>
  );
}

// ── INTERACTIVE PERIOD SELECTOR + STAT SECTION ───────────────
// Clicking L5/L10/L15/L20 filters the bar chart to that many games
// and recalculates hit rates live
const PERIODS = [
  { label: "L5",  n: 5  },
  { label: "L10", n: 10 },
  { label: "L15", n: 15 },
  { label: "L20", n: 20 },
];

function StatSection({
  title, tabs, gameLogs, sport, defaultTab, teamMode = false,
}: {
  title: string;
  tabs: { key: string; label: string; components?: string[] }[];
  gameLogs: any[];
  sport: string;
  defaultTab: string;
  teamMode?: boolean;
}) {
  const [activeTab,    setActiveTab]    = useState(defaultTab);
  const [activePeriod, setActivePeriod] = useState(10);   // which period is selected
  const [customLines,  setCustomLines]  = useState<Record<string, number>>({});

  const tab = tabs.find(t => t.key === activeTab) || tabs[0];

  // ALL values for this stat (newest first)
  const allVals = gameLogs.map(g => getVal(g, tab.key, tab.components));

  // Slices for each period
  const slices = {
    5:  allVals.slice(0, 5),
    10: allVals.slice(0, 10),
    15: allVals.slice(0, 15),
    20: allVals.slice(0, 20),
  } as Record<number, number[]>;

  // Default line from weighted projection across all data
  const a5  = avg(slices[5]);
  const a10 = avg(slices[10]);
  const a20 = avg(slices[20]);
  const proj = slices[5].length >= 3 ? a5 * 0.5 + a10 * 0.3 + a20 * 0.2 : a10;
  const defaultLine = roundHalf(proj);
  const line = customLines[tab.key] ?? defaultLine;

  // The active period's slice drives the chart
  const activeSlice    = slices[activePeriod] || slices[10];
  const activeAvg      = avg(activeSlice);
  const activeHitRate  = hitRate(activeSlice, line);

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: BG_CARD, borderColor: BORDER }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <span className="font-bold text-sm" style={{ color: GOLD }}>{title}</span>
      </div>

      {/* Scrollable tab bar */}
      <TabBar tabs={tabs} active={activeTab} onSelect={key => {
        setActiveTab(key);
        // Reset period to L10 when switching stat
        setActivePeriod(10);
      }} />

      <div className="p-4 space-y-4">
        {/* ── ROW: line adjuster LEFT, period boxes RIGHT ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Line + label */}
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">
              {tab.label} &nbsp;·&nbsp; Line
            </p>
            <LineAdjuster
              value={line}
              onChange={v => setCustomLines(prev => ({ ...prev, [tab.key]: v }))}
            />
          </div>

          {/* Interactive period boxes — clicking one selects it */}
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(({ label, n }) => {
              const sl   = slices[n] || [];
              const hr   = hitRate(sl, line);
              const av   = avg(sl);
              const isActive = activePeriod === n;

              // Color coding
              const bg = hr >= 80 ? GREEN_DARK  : hr >= 60 ? "#92400e" : "#7f1d1d";
              const fg = hr >= 80 ? "#bbf7d0"   : hr >= 60 ? "#fde68a" : "#fecaca";
              const activeBorder = hr >= 80 ? "#22c55e" : hr >= 60 ? GOLD_BRIGHT : RED;

              return (
                <button
                  key={n}
                  onClick={() => setActivePeriod(n)}
                  className="px-2.5 py-1.5 rounded-lg text-center transition-all"
                  style={{
                    background:  bg,
                    border:      `2px solid ${isActive ? activeBorder : "transparent"}`,
                    outline:     isActive ? `1px solid ${activeBorder}44` : "none",
                    minWidth:    64,
                    boxShadow:   isActive ? `0 0 8px ${activeBorder}55` : "none",
                    transform:   isActive ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  <p style={{ color: fg }} className="text-[10px] font-bold">{label}</p>
                  <p style={{ color: fg }} className="text-[11px] font-bold">HR {sl.length ? hr : 0}%</p>
                  <p style={{ color: fg }} className="text-[10px] opacity-80">
                    Avg {sl.length ? av.toFixed(1) : "—"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active period summary pill */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${GOLD_DIM}30`, color: GOLD, border: `1px solid ${GOLD_DIM}` }}>
            Showing {activePeriod === 5 ? "Last 5" : activePeriod === 10 ? "Last 10" : activePeriod === 15 ? "Last 15" : "Last 20"} games
          </span>
          <span className="text-gray-500">
            Avg <span className="font-bold" style={{ color: GOLD_BRIGHT }}>{activeAvg.toFixed(1)}</span>
            &nbsp;· HR <span className="font-bold"
              style={{ color: activeHitRate >= 80 ? GREEN : activeHitRate >= 60 ? GOLD : RED }}>
              {activeHitRate}%
            </span>
          </span>
        </div>

        {/* Bar chart — only shows activePeriod games */}
        <BarChart
          gameLogs={gameLogs.slice(0, activePeriod)}
          tab={tab}
          line={line}
          sport={sport}
        />
      </div>
    </div>
  );
}

// ── TEAM STATS SECTION ────────────────────────────────────────
// Uses team-level aggregated data per game (total team points, etc.)
// Since we store player_game_stats not team_game_stats, we approximate
// team totals by summing all players for that game.
// For simplicity and accuracy we just show the team's game score history
// from games_data, which the edge function already returns.
function TeamStatsSection({
  tabs, teamGameLogs, sport,
}: {
  tabs: { key: string; label: string; components?: string[] }[];
  teamGameLogs: any[];  // each entry: { game_date, opponent, score, opp_score }
  sport: string;
}) {
  const [activeTab,   setActiveTab]   = useState(tabs[0]?.key || "score");
  const [customLines, setCustomLines] = useState<Record<string, number>>({});

  // For team stats the only reliable data we have is the game score
  // Represent as a synthetic tab list: Score (team pts), Opp Score, Margin
  const TEAM_TABS = [
    { key: "score",     label: "PTS",    components: undefined },
    { key: "opp_score", label: "OPP",    components: undefined },
    { key: "margin",    label: "MARGIN", components: undefined },
    { key: "total",     label: "TOTAL",  components: undefined },
  ];

  const tab = TEAM_TABS.find(t => t.key === activeTab) || TEAM_TABS[0];

  const vals = teamGameLogs.map(g => {
    if (tab.key === "score")     return Number(g.team_score   || g.home_score || 0);
    if (tab.key === "opp_score") return Number(g.opp_score    || g.away_score || 0);
    if (tab.key === "margin")    return Number(g.team_score||g.home_score||0) - Number(g.opp_score||g.away_score||0);
    if (tab.key === "total")     return Number(g.team_score||g.home_score||0) + Number(g.opp_score||g.away_score||0);
    return 0;
  });

  const l10 = vals.slice(0, 10);
  const a10 = avg(l10);
  const defaultLine = roundHalf(a10);
  const line = customLines[tab.key] ?? defaultLine;
  const hr10 = hitRate(l10, line);

  if (!teamGameLogs.length) return null;

  // Build synthetic game logs for BarChart (needs opponent + game_date + the value)
  const chartLogs = teamGameLogs.slice(0, 10).map(g => ({
    opponent:   g.opponent || g.opp_abbr || "—",
    game_date:  g.game_date || "",
    [tab.key]:  tab.key === "score"     ? Number(g.team_score||g.home_score||0)
              : tab.key === "opp_score" ? Number(g.opp_score||g.away_score||0)
              : tab.key === "margin"    ? Number(g.team_score||g.home_score||0)-Number(g.opp_score||g.away_score||0)
              :                          Number(g.team_score||g.home_score||0)+Number(g.opp_score||g.away_score||0),
  }));

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: BG_CARD, borderColor: BORDER }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <span className="font-bold text-sm" style={{ color: GOLD }}>🏟 Team Stats</span>
        <span className="text-[10px] text-gray-600 ml-auto">L10 only</span>
      </div>

      {/* Team-specific tab bar */}
      <TabBar tabs={TEAM_TABS} active={activeTab} onSelect={setActiveTab} />

      <div className="p-4 space-y-4">
        {/* Line adjuster + L10 hit rate box */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">
              {tab.label} &nbsp;·&nbsp; Line
            </p>
            <LineAdjuster
              value={line}
              onChange={v => setCustomLines(prev => ({ ...prev, [tab.key]: v }))}
            />
          </div>
          {/* L10 only — as per requirement */}
          <div className="flex gap-1.5">
            {[
              { label: "L5",  sl: vals.slice(0,5)  },
              { label: "L10", sl: vals.slice(0,10) },
              { label: "L15", sl: vals.slice(0,15) },
              { label: "L20", sl: vals.slice(0,20) },
            ].map(({ label, sl }) => {
              const hr = hitRate(sl, line);
              const av = avg(sl);
              const bg = hr >= 80 ? GREEN_DARK : hr >= 60 ? "#92400e" : "#7f1d1d";
              const fg = hr >= 80 ? "#bbf7d0"  : hr >= 60 ? "#fde68a" : "#fecaca";
              return (
                <div key={label} className="px-2.5 py-1.5 rounded-lg text-center" style={{ background: bg, minWidth: 58 }}>
                  <p style={{ color: fg }} className="text-[10px] font-bold">{label}</p>
                  <p style={{ color: fg }} className="text-[11px] font-bold">HR {sl.length ? hr : 0}%</p>
                  <p style={{ color: fg }} className="text-[10px] opacity-80">Avg {sl.length ? av.toFixed(1) : "—"}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bar chart */}
        <BarChart
          gameLogs={chartLogs}
          tab={{ key: tab.key, label: tab.label }}
          line={line}
          sport={sport}
        />
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
interface Props {
  playerId: string;
  sport: string;
  onBack: () => void;
  playerName?: string;
}

export function PlayerDetailView({ playerId, sport, onBack, playerName }: Props) {
  const [player,       setPlayer]       = useState<any>(null);
  const [gameLogs,     setGameLogs]     = useState<any[]>([]);
  const [teamGameLogs, setTeamGameLogs] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "get_player_details", sport, player_id: playerId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load");
        setPlayer(data.player);
        setGameLogs(data.player.game_logs || []);

        // ── Fetch team game scores for Team Stats section ──────
        // We use the player's team_id to get their recent game results
        if (data.player.team_id) {
          const teamRes = await fetch(EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "get_team_games",
              sport,
              team_id: data.player.team_id,
            }),
          });
          const teamData = await teamRes.json();
          if (teamData.success && teamData.games?.length) {
            setTeamGameLogs(teamData.games);
          } else {
            // Fallback: build approximate team scores from game_logs opponent field
            // Each log has game_date + opponent — build score history from games_data
            const fallbackGames = (data.player.game_logs || []).map((g: any) => ({
              game_date:  g.game_date,
              opponent:   g.opponent || "—",
              team_score: g.team_score || null,
              opp_score:  g.opp_score  || null,
            }));
            setTeamGameLogs(fallbackGames.filter((g: any) => g.team_score !== null));
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

  // Max stats
  const maxStats = useMemo(() => {
    if (!gameLogs.length) return {};
    const maxOf = (k: string) => Math.max(...gameLogs.map(g => Number(g[k]) || 0));
    return sport === "nba" ? {
      Points: maxOf("points"), Rebounds: maxOf("rebounds"), Assists: maxOf("assists"),
      Steals: maxOf("steals"), Blocks: maxOf("blocks"), Turnovers: maxOf("turnovers"),
      "3 Pointer Made": maxOf("three_pointers_made"),
    } : sport === "nfl" ? {
      "Pass Yards": maxOf("passing_yards"), "Rush Yards": maxOf("rushing_yards"),
      "Rec Yards": maxOf("receiving_yards"), "Pass TDs": maxOf("passing_tds"),
    } : sport === "mlb" ? {
      Hits: maxOf("hits"), Runs: maxOf("runs"), RBI: maxOf("rbi"),
      "Home Runs": maxOf("home_runs"), "Total Bases": maxOf("total_bases"),
    } : sport === "nhl" ? {
      Goals: maxOf("goals"), Assists: maxOf("assists_hockey"),
      "Shots on Goal": maxOf("shots_on_goal"), "Blocked": maxOf("blocked_shots"),
    } : {
      Goals: maxOf("goals_soccer"), Assists: maxOf("assists_soccer"),
      Shots: maxOf("shots_soccer"), SOT: maxOf("shots_on_target"),
    };
  }, [gameLogs, sport]);

  const name = player?.full_name || playerName || "Player";
  const initials = getInitials(name);
  const avail = gameLogs.length;

  // Loading
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG_DEEP }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: `${GOLD} transparent transparent transparent` }} />
        <p className="text-gray-400 text-sm">Loading player data…</p>
      </div>
    </div>
  );

  // Error
  if (error) return (
    <div className="min-h-screen p-4" style={{ background: BG_DEEP }}>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="p-4 rounded-xl border border-red-800/40 bg-red-900/10 text-red-400 text-sm">
        ❌ {error}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: BG_DEEP }}>

      {/* ── TOP HEADER ── */}
      <div className="sticky top-0 z-20 border-b px-4 py-3 flex items-center gap-3"
        style={{ background: `${BG_DEEP}e8`, backdropFilter: "blur(8px)", borderColor: BORDER }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition hover:opacity-80"
          style={{ color: GOLD }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="w-px h-5 mx-1" style={{ background: BORDER }} />
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: `${GOLD_DIM}55`, border: `1.5px solid ${GOLD_DIM}`, color: GOLD_BRIGHT }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-base leading-tight truncate" style={{ color: GOLD_BRIGHT }}>{name}</h1>
          <p className="text-[11px] text-gray-500 truncate">
            {player?.team} · {player?.position} · {sport.toUpperCase()} · {avail} games
          </p>
        </div>
      </div>

      {/* ── LAYOUT ── */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 max-w-6xl mx-auto">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* PLAYER STATS SECTION */}
          <StatSection
            title="⚡ Player Stats"
            tabs={tabs}
            gameLogs={gameLogs}
            sport={sport}
            defaultTab={tabs[1]?.key || tabs[0]?.key}
          />

          {/* TEAM STATS SECTION — right below player stats */}
          <TeamStatsSection
            tabs={tabs}
            teamGameLogs={teamGameLogs}
            sport={sport}
          />

          {/* GAMELOG TABLE */}
          <div className="rounded-xl border overflow-hidden" style={{ background: BG_CARD, borderColor: BORDER }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
              <span className="font-bold text-sm" style={{ color: GOLD }}>Gamelog — Last {Math.min(15, avail)} Games</span>
            </div>

            {gameLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">
                No game logs — run the data pipeline for this sport
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: BG_ROW, borderBottom: `1px solid ${BORDER}` }}>
                      <th className="p-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: GOLD_DIM }}>Opponent</th>
                      <th className="p-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: GOLD_DIM }}>Date</th>
                      {glCols.map(c => (
                        <th key={c.key} className="p-2.5 text-center text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: GOLD_DIM }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gameLogs.slice(0, 15).map((g, i) => (
                      <tr key={i} className="transition-colors hover:bg-white/5"
                        style={{ borderBottom: `1px solid ${BORDER}33` }}>
                        <td className="p-2.5 font-medium text-gray-300 whitespace-nowrap text-xs">
                          {g.opponent || g.team_abbreviation || "—"}
                        </td>
                        <td className="p-2.5 text-gray-500 whitespace-nowrap text-xs">
                          {g.game_date ? g.game_date.slice(5).replace("-","-") : "—"}
                        </td>
                        {glCols.map(c => {
                          const val = getVal(g, c.key, c.combo);
                          return (
                            <td key={c.key} className="p-2.5 text-center text-xs font-medium">
                              <span style={{ color: val > 0 ? "#e5e7eb" : "#374151" }}>{val}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="lg:w-64 space-y-4 flex-shrink-0">

          {/* Player card */}
          <div className="rounded-xl border p-4" style={{ background: BG_CARD, borderColor: BORDER }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                style={{ background: `${GOLD_DIM}40`, border: `2px solid ${GOLD_DIM}`, color: GOLD_BRIGHT }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight truncate" style={{ color: GOLD_BRIGHT }}>{name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${GOLD_DIM}30`, color: GOLD, border: `1px solid ${GOLD_DIM}` }}>
                    {player?.team || "—"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: "#1e293b", color: "#94a3b8", border: `1px solid ${BORDER}` }}>
                    {sport.toUpperCase()}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: "#1e293b", color: "#94a3b8", border: `1px solid ${BORDER}` }}>
                    {player?.position || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Player Max Stats */}
            <div className="border-t pt-3" style={{ borderColor: BORDER }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: GOLD_DIM }}>
                Player Max Stats
              </p>
              <div className="space-y-1.5">
                {Object.entries(maxStats).map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">{label}</span>
                    <span className="text-[11px] font-bold text-white">{val as number}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Match Played */}
            <div className="mt-4 rounded-lg p-3 text-center"
              style={{ background: `${GOLD_DIM}20`, border: `1px solid ${GOLD_DIM}40` }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: `${GOLD_DIM}40`, border: `1px solid ${GOLD_DIM}` }}>
                  <span className="text-[10px]">🎯</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Match Played</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: GOLD_BRIGHT }}>{avail}</p>
            </div>
          </div>

          {/* Quick hit rates for all core stats */}
          {gameLogs.length > 0 && (
            <div className="rounded-xl border p-4 space-y-2" style={{ background: BG_CARD, borderColor: BORDER }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: GOLD_DIM }}>
                Quick Hit Rates (L10)
              </p>
              {tabs.slice(0, 8).map(t => {
                const vals = gameLogs.map(g => getVal(g, t.key, t.components));
                const l10 = vals.slice(0, 10);
                const a10 = avg(l10);
                const line = roundHalf(a10);
                const hr = hitRate(l10, line);
                const bg = hr >= 80 ? "#052e16" : hr >= 60 ? "#1c1000" : "#1c0505";
                const fg = hr >= 80 ? GREEN : hr >= 60 ? GOLD : RED;
                return (
                  <div key={t.key} className="flex items-center justify-between py-1 border-b last:border-0"
                    style={{ borderColor: `${BORDER}66` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-16 truncate">{t.label}</span>
                      <span className="text-[10px] text-gray-600">{line.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]" style={{ color: "#6b7280" }}>{a10.toFixed(1)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: bg, color: fg }}>
                        {hr}%
                      </span>
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
