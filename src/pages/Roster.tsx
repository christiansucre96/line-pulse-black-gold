// src/pages/RosterPage.tsx
// Auto-triggers scraper when no data exists for today
// Amber = projected pre-game starters
// Green = confirmed (game live or finished)

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
  player_id: string;
  full_name: string;
  position: string;
  jersey: string;
  is_starter: boolean;
  lineup_status: "confirmed" | "projected" | null;
  l10avg: number;
  hitRate: number;
}

interface Team {
  abbreviation: string;
  name: string;
  opponent: string;
  game_time: string;
  confirmed: boolean;
  players: Player[];
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  confirmed: { label: "CONFIRMED", bg: "#002a00", border: "#22c55e", text: "#22c55e", dot: "#22c55e" },
  projected: { label: "PROBABLE",  bg: "#2a2000", border: "#c8970a", text: "#f5bc2f", dot: "#f5bc2f" },
};

// ─── Hit Bar ──────────────────────────────────────────────────────────────────
function HitBar({ rate }: { rate: number }) {
  const color = rate >= 60 ? "#22c55e" : rate >= 40 ? "#f5bc2f" : "#ef4444";
  return (
    <div style={{ height: 3, background: "#1e2530", borderRadius: 2, marginTop: 4 }}>
      <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: color, borderRadius: 2,
        transition: "width 0.6s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player }: { player: Player }) {
  const [hovered, setHovered] = useState(false);
  const isStarter = player.is_starter;
  const status = player.lineup_status;
  const cfg = status === "confirmed" ? STATUS_CONFIG.confirmed : STATUS_CONFIG.projected;

  const borderColor = isStarter
    ? hovered ? cfg.text : cfg.border
    : hovered ? "#2e3748" : "#1e2530";

  const bgColor = isStarter
    ? hovered ? (status === "confirmed" ? "#002a00" : "#1a1400") : (status === "confirmed" ? "#001a00" : "#141000")
    : hovered ? "#141820" : "#0d1117";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10, padding: "14px 16px",
        cursor: "default", transition: "all 0.18s ease",
        position: "relative", overflow: "hidden",
        boxShadow: isStarter && hovered
          ? `0 0 0 1px ${cfg.text}40, 0 4px 20px ${cfg.text}20`
          : isStarter ? `0 0 0 1px ${cfg.border}20` : "none",
      }}
    >
      {/* Top accent line */}
      {isStarter && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${cfg.border}, ${cfg.text}, ${cfg.border})`,
          opacity: hovered ? 1 : 0.7, transition: "opacity 0.18s",
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Jersey */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: isStarter ? `${cfg.border}20` : "#1a2030",
              border: `1px solid ${isStarter ? cfg.border : "#2e3748"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700,
              color: isStarter ? cfg.text : "#4a5568",
              fontFamily: "'DM Mono', monospace",
            }}>
              {player.jersey || "–"}
            </div>
            {/* Name */}
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: isStarter ? (status === "confirmed" ? "#86efac" : "#e8d48b") : "#cbd5e1",
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.03em", textTransform: "uppercase",
            }}>
              {player.full_name}
            </span>
          </div>
          <div style={{ marginTop: 3, marginLeft: 30 }}>
            <span style={{ fontSize: 10, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {player.position || "–"}
            </span>
          </div>
        </div>

        {/* Badges */}
        {isStarter && status && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 4,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              fontSize: 10, fontWeight: 700, color: cfg.text,
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
            }}>
              <svg width="6" height="6" viewBox="0 0 6 6">
                <circle cx="3" cy="3" r="3" fill={cfg.dot} />
              </svg>
              {cfg.label}
            </span>
            <span style={{
              fontSize: 9, color: cfg.border,
              fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.06em",
            }}>
              {status === "confirmed" ? "✓ Confirmed Starter" : "◎ Projected Starter"}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{
        borderTop: `1px solid ${isStarter ? `${cfg.border}30` : "#1a2030"}`,
        paddingTop: 10, marginTop: 4,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 3 }}>
            L10 Avg
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1,
            color: player.l10avg > 0 ? (isStarter ? cfg.text : "#e2e8f0") : "#2e3748",
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {player.l10avg > 0 ? player.l10avg.toFixed(1) : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 3 }}>
            Hit Rate
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1,
            color: player.hitRate >= 60 ? "#22c55e" : player.hitRate >= 40 ? "#f5bc2f" : "#ef4444",
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {player.hitRate > 0 ? `${player.hitRate}%` : "—"}
          </div>
          {player.hitRate > 0 && <HitBar rate={player.hitRate} />}
        </div>
      </div>
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────
function TeamSection({ team }: { team: Team }) {
  const [tab, setTab] = useState<"all" | "starters">("all");
  const starters = team.players.filter(p => p.is_starter);
  const bench    = team.players.filter(p => !p.is_starter);
  const isConfirmed = team.confirmed;

  return (
    <div style={{
      background: "#0a0e14", border: "1px solid #1a2030",
      borderRadius: 14, padding: "20px 20px 24px", marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 900,
              color: isConfirmed ? "#22c55e" : "#f5bc2f",
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>
              {team.abbreviation}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif" }}>
              {team.name} vs {team.opponent}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
              color: isConfirmed ? "#22c55e" : "#f5bc2f" }}>
              {starters.length} {isConfirmed ? "Confirmed" : "Projected"}
            </span>
            <span style={{ color: "#2e3748" }}>•</span>
            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {bench.length} Bench
            </span>
            <span style={{ color: "#2e3748" }}>•</span>
            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {team.game_time}
            </span>
          </div>
        </div>
        <div style={{
          padding: "4px 12px", borderRadius: 6,
          background: "#0d1117", border: "1px solid #1e2530",
          fontSize: 11, fontWeight: 700, color: "#4a5568",
          fontFamily: "'DM Mono', monospace",
        }}>NBA</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["all", "starters"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid",
            borderColor: tab === t ? (isConfirmed ? "#22c55e" : "#c8970a") : "#1e2530",
            background: tab === t ? (isConfirmed ? "#001a00" : "#1a1200") : "transparent",
            color: tab === t ? (isConfirmed ? "#22c55e" : "#f5bc2f") : "#4a5568",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em",
            transition: "all 0.15s ease",
          }}>
            {t === "all" ? "ALL PLAYERS" : "STARTERS ONLY"}
          </button>
        ))}
      </div>

      {/* Starters */}
      {starters.length > 0 && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700,
            color: isConfirmed ? "#22c55e" : "#c8970a",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
            marginBottom: 10, paddingLeft: 2,
          }}>
            ▸ {isConfirmed ? "CONFIRMED STARTERS" : "PROJECTED STARTERS"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {starters.map((p, i) => <PlayerCard key={`${p.player_id}-${i}`} player={p} />)}
          </div>
        </>
      )}

      {/* Bench */}
      {tab === "all" && bench.length > 0 && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#2e3748",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
            margin: "16px 0 10px", paddingLeft: 2,
          }}>▸ BENCH</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {bench.map((p, i) => <PlayerCard key={`bench-${p.player_id}-${i}`} player={p} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function RosterPage() {
  const [teams, setTeams]           = useState<Team[]>([]);
  const [loading, setLoading]       = useState(true);
  const [scraping, setScraping]     = useState(false);
  const [selectedTeam, setSelected] = useState("ALL");
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [statusMsg, setStatusMsg]   = useState("");

  // ── Transform DB rows → Team[] ──────────────────────────────────────────────
  function transformRows(rows: any[]): Team[] {
    return rows.map(row => {
      const rawStarters = row.projected_starters || [];
      const rawBench    = row.bench_depth || [];

      // If no starters in DB, promote first 5 bench as projected
      const displayStarters = rawStarters.length > 0 ? rawStarters : rawBench.slice(0, 5);
      const displayBench    = rawStarters.length > 0 ? rawBench    : rawBench.slice(5);

      const lineupStatus: "confirmed" | "projected" = row.confirmed ? "confirmed" : "projected";

      const toPlayer = (p: any, isStarter: boolean): Player => ({
        player_id:    p.espn_id || p.player_id || p.nba_id || Math.random().toString(),
        full_name:    p.full_name || p.name || "Unknown",
        position:     p.position || "–",
        jersey:       p.jersey || "",
        is_starter:   isStarter,
        lineup_status: isStarter ? lineupStatus : null,
        l10avg:       0,   // wire up to player_rolling_stats later
        hitRate:      0,
      });

      return {
        abbreviation: row.team_abbreviation,
        name:         row.team_name || row.team_abbreviation,
        opponent:     row.opponent_abbreviation || "TBD",
        game_time:    row.game_time_utc
          ? new Date(row.game_time_utc).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", timeZoneName: "short",
            })
          : "TBD",
        confirmed:    row.confirmed === true,
        players:      [
          ...displayStarters.map((p: any) => toPlayer(p, true)),
          ...displayBench.map((p: any) => toPlayer(p, false)),
        ],
      };
    });
  }

  // ── Query DB ────────────────────────────────────────────────────────────────
  async function queryDB(): Promise<Team[]> {
    // ✅ Use ET/local date, not UTC — avoids date flip for late night games
    const today = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().split("T")[0];
    console.log("📅 Querying for:", today);

    const { data, error: dbErr } = await supabase
      .from("projected_lineups")
      .select("team_id,team_abbreviation,team_name,game_id,game_date,game_time_utc,opponent_abbreviation,projected_starters,bench_depth,lineup_confidence,confirmed,confirmed_at")
      .eq("game_date", today)
      .order("game_time_utc", { ascending: true });

    if (dbErr) throw dbErr;
    console.log(`📊 Found ${data?.length || 0} rows`);
    return transformRows(data || []);
  }

  // ── Trigger edge function scraper ───────────────────────────────────────────
  async function runScraper(): Promise<void> {
    setScraping(true);
    setStatusMsg("⏳ Fetching lineups from NBA.com + ESPN...");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("espn-lineup-scraper", {
        body: { sport: "nba" },
      });
      if (fnErr) throw new Error(fnErr.message);
      console.log("Scraper result:", data);
      setStatusMsg(`✅ ${data.teams_written} teams updated (${data.nba_lineups_found || 0} NBA lineups found)`);
      const fresh = await queryDB();
      setTeams(fresh);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      setError(`Scraper failed: ${e.message}`);
    } finally {
      setScraping(false);
      setLoading(false);
    }
  }

  // ── Full refresh ────────────────────────────────────────────────────────────
  async function fetchLineups() {
    setLoading(true);
    setError(null);
    setStatusMsg("");
    try {
      const rows = await queryDB();
      if (rows.length === 0) {
        // Auto-trigger scraper when DB is empty for today
        console.log("No data for today — auto-triggering scraper...");
        await runScraper();
      } else {
        setTeams(rows);
        setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLineups();
    // Auto-refresh every 5 min
    const interval = setInterval(fetchLineups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayed = selectedTeam === "ALL"
    ? teams
    : teams.filter(t => t.abbreviation === selectedTeam);

  const dateLabel = new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060a0f; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #1e2530; borderRadius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a0f", padding: "32px 24px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 10, color: "#c8970a", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 6 }}>
                ◈ NBA DAILY LINEUPS
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif" }}>
                {dateLabel}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {lastUpdated && <span style={{ fontSize: 10, color: "#2e3748" }}>Updated {lastUpdated}</span>}
              <button onClick={fetchLineups} disabled={loading || scraping} style={{
                padding: "6px 16px", borderRadius: 8,
                border: "1px solid #1e2530", background: "#0d1117",
                color: (loading || scraping) ? "#2e3748" : "#4a5568",
                fontSize: 12, fontWeight: 700, cursor: (loading || scraping) ? "not-allowed" : "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-block", animation: (loading || scraping) ? "spin 1s linear infinite" : "none" }}>↻</span>
                {scraping ? "Scraping..." : loading ? "Loading..." : "Refresh"}
              </button>
              <button onClick={runScraper} disabled={scraping || loading} style={{
                padding: "6px 16px", borderRadius: 8,
                border: "1px solid #c8970a40", background: "#141000",
                color: scraping ? "#2e3748" : "#c8970a",
                fontSize: 12, fontWeight: 700, cursor: scraping ? "not-allowed" : "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              }}>
                ⚡ Pull NBA
              </button>
            </div>
          </div>

          {/* Status / Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#200000", border: "1px solid #8b0000", borderRadius: 8, color: "#ff4444", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
              ❌ {error}
            </div>
          )}
          {statusMsg && !error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#001a00", border: "1px solid #166534", borderRadius: 8, color: "#22c55e", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
              {statusMsg}
            </div>
          )}

          {/* Loading spinner */}
          {(loading || scraping) && teams.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#f5bc2f", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 12, animation: "pulse 2s ease infinite" }}>
                {scraping ? "Fetching from NBA.com..." : "Loading lineups..."}
              </div>
            </div>
          )}

          {/* Team filter tabs */}
          {teams.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              <button onClick={() => setSelected("ALL")} style={{
                padding: "6px 16px", borderRadius: 8,
                border: `1px solid ${selectedTeam === "ALL" ? "#c8970a" : "#1e2530"}`,
                background: selectedTeam === "ALL" ? "#1a1200" : "#0d1117",
                color: selectedTeam === "ALL" ? "#f5bc2f" : "#4a5568",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              }}>ALL</button>
              {teams.map(t => (
                <button key={t.abbreviation} onClick={() => setSelected(t.abbreviation)} style={{
                  padding: "6px 16px", borderRadius: 8,
                  border: `1px solid ${selectedTeam === t.abbreviation ? (t.confirmed ? "#22c55e" : "#c8970a") : "#1e2530"}`,
                  background: selectedTeam === t.abbreviation ? (t.confirmed ? "#001a00" : "#1a1200") : "#0d1117",
                  color: selectedTeam === t.abbreviation ? (t.confirmed ? "#22c55e" : "#f5bc2f") : "#4a5568",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                }}>{t.abbreviation}</button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !scraping && teams.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No games scheduled for today</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>Click ⚡ Pull NBA to fetch manually</div>
            </div>
          )}

          {/* Team cards */}
          {displayed.map(team => <TeamSection key={team.abbreviation} team={team} />)}

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 8, padding: "12px 16px", background: "#0a0e14", borderRadius: 8, border: "1px solid #1a2030", flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>LEGEND:</div>
            {[
              { color: "#c8970a", label: "PROJECTED STARTER" },
              { color: "#22c55e", label: "CONFIRMED STARTER" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 2, background: color }} />
                <span style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>{label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
