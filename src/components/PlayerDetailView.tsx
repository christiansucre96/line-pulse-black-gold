// src/components/PlayerDetailView.tsx
// Matches screenshot: all prop types, L5/L10/L15/L20 hit-rate boxes,
// user-adjustable line, grouped by category

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ── HIT RATE BOX ─────────────────────────────────────────────
function HRBox({ label, value }: { label: string; value: number | null }) {
  if (value === null) return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] text-gray-600 mb-0.5">{label}</span>
      <div className="w-8 h-7 rounded text-[10px] font-bold flex items-center justify-center bg-gray-800 text-gray-600">—</div>
    </div>
  );
  const bg = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  const text = value >= 80 ? "text-white" : value >= 60 ? "text-black" : "text-white";
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] text-gray-500 mb-0.5">{label}</span>
      <div className={`w-8 h-7 rounded text-[10px] font-bold flex items-center justify-center ${bg} ${text}`}>
        {value}%
      </div>
    </div>
  );
}

// ── SINGLE PROP ROW — matches screenshot ─────────────────────
function PropRow({
  label, propData, onLineChange
}: {
  label: string;
  propData: any;
  onLineChange: (newLine: number) => void;
}) {
  const [localLine, setLocalLine] = useState<number>(propData.line ?? 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setLocalLine(propData.line ?? 0); }, [propData.line]);

  // Recalculate hit rates when user changes the line
  const recalcHitRates = (line: number) => {
    const vals: number[] = propData.values || [];
    if (!vals.length) return { l5: null, l10: null, l15: null, l20: null };
    const hr = (n: number) => {
      const slice = vals.slice(0, n);
      if (!slice.length) return null;
      return Math.round(slice.filter((v: number) => v >= line).length / slice.length * 100);
    };
    return { l5: hr(5), l10: hr(10), l15: hr(15), l20: hr(20) };
  };

  const [hitRates, setHitRates] = useState({
    l5: propData.l5 ?? null, l10: propData.l10 ?? null,
    l15: propData.l15 ?? null, l20: propData.l20 ?? null,
  });

  const handleLineChange = (delta: number) => {
    const newLine = Math.max(0, +(localLine + delta).toFixed(1));
    setLocalLine(newLine);
    setHitRates(recalcHitRates(newLine) as any);
    onLineChange(newLine);
  };

  const trendIcon = propData.trend === 'up'
    ? <TrendingUp className="w-3 h-3 text-green-400" />
    : propData.trend === 'down'
    ? <TrendingDown className="w-3 h-3 text-red-400" />
    : <Minus className="w-3 h-3 text-gray-500" />;

  return (
    <div className="border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-800/30 transition">
        {/* Label */}
        <div className="w-36 shrink-0">
          <span className="text-sm text-gray-200 font-medium">{label}</span>
        </div>

        {/* Line adjuster */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleLineChange(-0.5)}
            className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold flex items-center justify-center transition"
          >−</button>
          <span className="w-10 text-center text-yellow-400 font-bold text-sm tabular-nums">
            {localLine.toFixed(1)}
          </span>
          <button
            onClick={() => handleLineChange(0.5)}
            className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold flex items-center justify-center transition"
          >+</button>
        </div>

        {/* Avg L10 */}
        <div className="w-12 text-center shrink-0">
          <span className="text-xs text-gray-400">{propData.avg_l10 ?? '—'}</span>
        </div>

        {/* Hit rate boxes L5 / L10 / L15 / L20 */}
        <div className="flex items-center gap-1.5 ml-1">
          <HRBox label="L5"  value={hitRates.l5}  />
          <HRBox label="L10" value={hitRates.l10} />
          <HRBox label="L15" value={hitRates.l15} />
          <HRBox label="L20" value={hitRates.l20} />
        </div>

        {/* Trend */}
        <div className="ml-2 shrink-0">{trendIcon}</div>

        {/* Expand for game log */}
        {(propData.values?.length ?? 0) > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-gray-600 hover:text-gray-400 transition"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Mini game log */}
      {expanded && propData.values?.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex gap-1 flex-wrap">
            {propData.values.slice(0, 20).map((v: number, i: number) => (
              <div
                key={i}
                className={`w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center
                  ${v >= localLine ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
              >
                {v}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Last {propData.values.length} games (newest left)</p>
        </div>
      )}
    </div>
  );
}

// ── PROP GROUP SECTION ────────────────────────────────────────
function PropGroup({
  groupName, props, allPropsData, onLineChange
}: {
  groupName: string;
  props: string[];
  allPropsData: Record<string, any>;
  onLineChange: (key: string, line: number) => void;
}) {
  const available = props.filter(k => allPropsData[k]);
  if (!available.length) return null;
  return (
    <div className="mb-4">
      <div className="px-4 py-1.5 bg-gray-800/40 border-b border-gray-700">
        <span className="text-[11px] font-semibold text-yellow-400/80 uppercase tracking-widest">{groupName}</span>
      </div>
      {available.map(key => (
        <PropRow
          key={key}
          label={allPropsData[key].label}
          propData={allPropsData[key]}
          onLineChange={(newLine) => onLineChange(key, newLine)}
        />
      ))}
    </div>
  );
}

// ── PROP STRUCTURE per sport ──────────────────────────────────
const PROP_GROUPS_BY_SPORT: Record<string, { group: string; keys: string[] }[]> = {
  nba: [
    { group: 'Core',     keys: ['points','rebounds','assists','steals','blocks','turnovers','three_pointers_made','personal_fouls','minutes_played'] },
    { group: 'Shooting', keys: ['field_goals_made','field_goals_attempted','three_pointers_attempted','free_throws_made','free_throws_attempted'] },
    { group: 'Combos',   keys: ['combo_pr','combo_pa','combo_pra','combo_bs','combo_dd','combo_td'] },
    { group: 'Quarters', keys: ['q1_points','q1_rebounds','q1_assists'] },
  ],
  nfl: [
    { group: 'Passing',   keys: ['passing_yards','passing_tds','pass_attempts','pass_completions','interceptions'] },
    { group: 'Rushing',   keys: ['rushing_yards','rushing_tds','rush_attempts'] },
    { group: 'Receiving', keys: ['receiving_yards','receiving_tds','receptions','targets'] },
    { group: 'Combos',    keys: ['combo_pass_rush','combo_rush_rec'] },
  ],
  mlb: [
    { group: 'Batting',  keys: ['hits','runs','rbi','home_runs','total_bases','stolen_bases','walks','strikeouts_batting'] },
    { group: 'Pitching', keys: ['strikeouts_pitching','hits_allowed','earned_runs','walks_allowed','outs_pitched'] },
    { group: 'Combos',   keys: ['combo_hrr'] },
  ],
  nhl: [
    { group: 'Core',   keys: ['goals','assists_hockey','shots_on_goal','blocked_shots','hits_hockey','penalty_minutes','plus_minus','faceoffs_won'] },
    { group: 'Combos', keys: ['combo_ga','combo_pts'] },
  ],
  soccer: [
    { group: 'Attacking',   keys: ['goals_soccer','assists_soccer','shots_soccer','shots_on_target'] },
    { group: 'Passing',     keys: ['key_passes','passes_soccer'] },
    { group: 'Defending',   keys: ['tackles','interceptions','clearances'] },
    { group: 'Discipline',  keys: ['fouls_committed','yellow_cards'] },
    { group: 'Core',        keys: ['dribbles_success'] },
    { group: 'Combos',      keys: ['combo_ga_soccer'] },
  ],
};

// ── MAIN DETAIL VIEW ──────────────────────────────────────────
interface Props {
  playerId: string;
  sport: string;
  onBack: () => void;
  playerName?: string;
}

export function PlayerDetailView({ playerId, sport, onBack, playerName }: Props) {
  const [player, setPlayer]     = useState<any>(null);
  const [allProps, setAllProps] = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [customLines, setCustomLines] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'get_player_details', sport, player_id: playerId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load');
        setPlayer(data.player);
        setAllProps(data.player.all_props || {});
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, sport]);

  const handleLineChange = useCallback((key: string, line: number) => {
    setCustomLines(prev => ({ ...prev, [key]: line }));
  }, []);

  const groups = PROP_GROUPS_BY_SPORT[sport] || PROP_GROUPS_BY_SPORT.nba;

  // Merge custom lines back into allProps for display
  const mergedProps = { ...allProps };
  for (const [key, line] of Object.entries(customLines)) {
    if (mergedProps[key]) mergedProps[key] = { ...mergedProps[key], line };
  }

  const displayName = player?.full_name || playerName || 'Player';
  const propCount   = Object.keys(allProps).length;

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#020617] border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="ml-2">
          <h1 className="font-bold text-yellow-400 text-lg leading-tight">{displayName}</h1>
          {player && (
            <p className="text-xs text-gray-500">
              {player.team} · {player.position} · {sport.toUpperCase()} · {player.games_logged} games logged
            </p>
          )}
        </div>
        {propCount > 0 && (
          <span className="ml-auto text-xs text-gray-600">{propCount} prop types</span>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Loading all props...</p>
        </div>
      )}

      {error && (
        <div className="m-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/60 border-b border-gray-800 text-[10px] text-gray-600 font-semibold uppercase tracking-wider sticky top-[57px] z-10">
            <div className="w-36 shrink-0">Prop</div>
            <div className="w-20 shrink-0 text-center">Your Line</div>
            <div className="w-12 text-center shrink-0">Avg L10</div>
            <div className="flex gap-1.5 ml-1">
              {['L5','L10','L15','L20'].map(l => (
                <div key={l} className="w-8 text-center">{l}</div>
              ))}
            </div>
          </div>

          {/* Prop groups */}
          {groups.map(({ group, keys }) => (
            <PropGroup
              key={group}
              groupName={group}
              props={keys}
              allPropsData={mergedProps}
              onLineChange={handleLineChange}
            />
          ))}

          {propCount === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p>No historical data yet for this player.</p>
              <p className="text-sm mt-1">Run the data pipeline to populate game logs.</p>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 py-4 border-t border-gray-800 flex gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" /> ≥80% hit rate
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500" /> 60–79%
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" /> &lt;60%
            </div>
            <div className="ml-auto">Click +/− to adjust your line · tap row to see game history</div>
          </div>
        </>
      )}
    </div>
  );
}

export default PlayerDetailView;
