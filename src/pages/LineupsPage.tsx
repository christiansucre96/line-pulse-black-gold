import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerData {
  espnId?: string;
  player_id?: string;
  full_name: string;
  position: string;
  jersey?: string;
}

interface TeamLineup {
  team_abbreviation: string;
  opponent: string;
  game_time: string;
  confirmed: boolean;
  starters: PlayerData[];
  bench: PlayerData[];
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  projected: {
    label: "PROBABLE",
    border: "#c8970a", text: "#f5bc2f", bg: "#141000", hoverBg: "#1a1400", glow: "#f5bc2f",
  },
  confirmed: {
    label: "CONFIRMED",
    border: "#22c55e", text: "#22c55e", bg: "#001a00", hoverBg: "#002a00", glow: "#22c55e",
  },
};

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, isConfirmed }: { player: PlayerData; isConfirmed: boolean }) {
  const [hovered, setHovered] = useState(false);
  const cfg = isConfirmed ? STATUS_CONFIG.confirmed : STATUS_CONFIG.projected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? cfg.hoverBg : cfg.bg,
        border: `1px solid ${hovered ? cfg.glow : cfg.border}`,
        borderRadius: 10, padding: "14px 16px",
        transition: "all 0.18s ease", position: "relative", overflow: "hidden",
        boxShadow: hovered
          ? `0 0 0 1px ${cfg.glow}40, 0 4px 20px ${cfg.glow}20`
          : `0 0 0 1px ${cfg.border}20`,
      }}
    >
      {/* Accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${cfg.border}, ${cfg.glow}, ${cfg.border})`,
        opacity: hovered ? 1 : 0.7,
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: `${cfg.border}20`, border: `1px solid ${cfg.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: cfg.text,
              fontFamily: "'DM Mono', monospace", flexShrink: 0,
            }}>
              {player.jersey || "–"}
            </div>
            <span style={{
              fontSize: 13, fontWeight: 700, color: cfg.text,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.03em", textTransform: "uppercase",
            }}>
              {player.full_name}
            </span>
          </div>
          <div style={{ marginTop: 3, marginLeft: 30 }}>
            <span style={{ fontSize: 10, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {player.position}
            </span>
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "2px 8px", borderRadius: 4,
          background: `${cfg.border}20`, border: `1px solid ${cfg.border}`,
          fontSize: 10, fontWeight: 700, color: cfg.text,
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
        }}>
          <svg width="6" height="6" viewBox="0 0 6 6">
            <circle cx="3" cy="3" r="3" fill={cfg.glow} />
          </svg>
          {cfg.label}
        </span>
      </div>

      {/* Stats placeholder — wire up to player_rolling_stats later */}
      <div style={{
        borderTop: `1px solid ${cfg.border}30`,
        paddingTop: 10, marginTop: 4,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 3 }}>
            L10 Avg
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2e3748", fontFamily: "'Barlow Condensed', sans-serif" }}>
            —
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 3 }}>
            Hit Rate
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2e3748", fontFamily: "'Barlow Condensed', sans-serif" }}>
            —
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────
function TeamSection({ lineup }: { lineup: TeamLineup }) {
  const cfg = lineup.confirmed ? STATUS_CONFIG.confirmed : STATUS_CONFIG.projected;

  return (
    <div style={{
      background: "#0a0e14", border: "1px solid #1a2030",
      borderRadius: 14, padding: "20px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: cfg.text, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {lineup.team_abbreviation}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif" }}>
              vs {lineup.opponent}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: cfg.text, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
              {lineup.confirmed ? `${lineup.starters.length} Confirmed` : `${lineup.starters.length} Projected`}
            </span>
            <span style={{ color: "#2e3748" }}>•</span>
            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {lineup.bench.length} Bench
            </span>
            <span style={{ color: "#2e3748" }}>•</span>
            <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              {lineup.game_time}
            </span>
          </div>
        </div>
        <div style={{
          padding: "4px 12px", borderRadius: 6,
          background: "#0d1117", border: "1px solid #1e2530",
          fontSize: 11, fontWeight: 700, color: "#4a5568",
          fontFamily: "'DM Mono', monospace",
        }}>
          NBA
        </div>
      </div>

      {/* Starters */}
      {lineup.starters.length > 0 && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700, color: cfg.border,
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
            marginBottom: 10, paddingLeft: 2,
          }}>
            ▸ {lineup.confirmed ? "CONFIRMED STARTERS" : "PROJECTED STARTERS"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {lineup.starters.map((p, i) => (
              <PlayerCard key={`${p.espnId || p.player_id || i}`} player={p} isConfirmed={lineup.confirmed} />
            ))}
          </div>
        </>
      )}

      {/* Bench */}
      {lineup.bench.length > 0 && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#2e3748",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
            margin: "16px 0 10px", paddingLeft: 2,
          }}>
            ▸ BENCH
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {lineup.bench.map((p, i) => (
              <PlayerCard key={`bench-${p.player_id || i}`} player={p} isConfirmed={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Status Banner ────────────────────────────────────────────────────────────
function Banner({ type, message }: { type: "info" | "error" | "success"; message: string }) {
  const colors = {
    info:    { bg: "#0d1117", border: "#1e2530", text: "#4a5568" },
    error:   { bg: "#200000", border: "#8b0000", text: "#ff4444" },
    success: { bg: "#001a00", border: "#166534", text: "#22c55e" },
  };
  const c = colors[type];
  return (
    <div style={{
      marginBottom: 20, padding: "12px 16px",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, color: c.text, fontSize: 11,
      fontFamily: "'DM Mono', monospace",
    }}>
      {message}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LineupsPage() {
  const [lineups, setLineups] = useState<TeamLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // ── Query DB for today's lineups ──────────────────────────────────────────
  const queryLineups = async (): Promise<TeamLineup[]> => {
    const today = new Date().toISOString().split("T")[0]; // "2026-04-24"

    console.log("📅 Querying projected_lineups for:", today);

    const { data, error: dbError } = await supabase
      .from("projected_lineups")
      .select("*")
      .gte("game_date", today)          // >= today (handles TIMESTAMPTZ stored dates)
      .lt("game_date", `${today}T23:59:59`) // < tomorrow
      .order("game_time_utc", { ascending: true });

    // If gte/lt doesn't work (pure DATE column), fall back to eq
    if (dbError || !data) {
      console.warn("First query failed, trying eq:", dbError?.message);
      const { data: data2, error: err2 } = await supabase
        .from("projected_lineups")
        .select("*")
        .eq("game_date", today)
        .order("game_time_utc", { ascending: true });

      if (err2) throw err2;
      return transformRows(data2 || []);
    }

    console.log(`✅ Raw rows from DB: ${data.length}`);

    // Debug: log first row to inspect structure
    if (data.length > 0) {
      console.log("Sample row:", JSON.stringify(data[0], null, 2));
    }

    return transformRows(data);
  };

  // ── Transform DB rows → UI shape ─────────────────────────────────────────
  const transformRows = (data: any[]): TeamLineup[] => {
    return data.map((row: any) => ({
      team_abbreviation: row.team_abbreviation,
      opponent: row.opponent_abbreviation || "TBD",
      game_time: row.game_time_utc
        ? new Date(row.game_time_utc).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", timeZoneName: "short",
          })
        : "TBD",
      confirmed: row.confirmed === true,
      starters: (row.projected_starters || []).map((p: any) => ({
        espnId:    p.espnId || p.espn_id || "",
        player_id: p.player_id || "",
        full_name: p.full_name || p.name || "Unknown",
        position:  p.position  || "–",
        jersey:    p.jersey    || "",
      })),
      bench: (row.bench_depth || []).map((p: any) => ({
        player_id: p.player_id || "",
        full_name: p.full_name || p.name || "Unknown",
        position:  p.position  || "–",
        jersey:    p.jersey    || "",
      })),
    }));
  };

  // ── Trigger edge function scraper ─────────────────────────────────────────
  const runScraper = async () => {
    setScraping(true);
    setStatusMsg("⏳ Fetching lineups from ESPN...");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "espn-lineup-scraper",
        { body: { sport: "nba" } }
      );

      if (fnError) throw new Error(fnError.message);

      console.log("Scraper result:", data);
      setStatusMsg(
        `✅ ESPN scraped: ${data.teams_confirmed ?? 0} confirmed, ${data.teams_projected ?? 0} projected across ${data.games_today ?? 0} games`
      );

      // Now re-query the DB
      const fresh = await queryLineups();
      setLineups(fresh);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      console.error("Scraper error:", e);
      setError(`Scraper failed: ${e.message}`);
    } finally {
      setScraping(false);
      setLoading(false);
    }
  };

  // ── Full refresh: query first, scrape if empty ────────────────────────────
  const fetchLineups = async () => {
    setLoading(true);
    setError(null);
    setStatusMsg(null);

    try {
      const rows = await queryLineups();

      if (rows.length === 0) {
        // Nothing in DB — trigger the scraper automatically
        console.log("No lineups in DB, triggering scraper...");
        await runScraper();
      } else {
        setLineups(rows);
        setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  // Initial load + auto-refresh every 5 min
  useEffect(() => {
    fetchLineups();
    const interval = setInterval(fetchLineups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
        ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
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
              {lastUpdated && (
                <span style={{ fontSize: 10, color: "#2e3748" }}>Updated {lastUpdated}</span>
              )}
              {/* Manual refresh */}
              <button
                onClick={fetchLineups}
                disabled={loading || scraping}
                style={{
                  padding: "6px 16px", borderRadius: 8,
                  border: "1px solid #1e2530", background: "#0d1117",
                  color: (loading || scraping) ? "#2e3748" : "#4a5568",
                  fontSize: 12, fontWeight: 700,
                  cursor: (loading || scraping) ? "not-allowed" : "pointer",
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span style={{
                  display: "inline-block",
                  animation: (loading || scraping) ? "spin 1s linear infinite" : "none",
                }}>↻</span>
                {scraping ? "Scraping ESPN..." : loading ? "Loading..." : "Refresh"}
              </button>
              {/* Force re-scrape */}
              <button
                onClick={runScraper}
                disabled={scraping || loading}
                style={{
                  padding: "6px 16px", borderRadius: 8,
                  border: "1px solid #c8970a40", background: "#141000",
                  color: scraping ? "#2e3748" : "#c8970a",
                  fontSize: 12, fontWeight: 700,
                  cursor: scraping ? "not-allowed" : "pointer",
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                }}
              >
                ⚡ Pull ESPN
              </button>
            </div>
          </div>

          {/* Status / Error banners */}
          {error   && <Banner type="error"   message={`❌ ${error}`} />}
          {statusMsg && !error && <Banner type="success" message={statusMsg} />}

          {/* Loading spinner */}
          {(loading || scraping) && lineups.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "2px solid #1e2530", borderTopColor: "#f5bc2f",
                animation: "spin 1s linear infinite", margin: "0 auto 16px",
              }} />
              <div style={{ fontSize: 12, animation: "pulse 2s ease infinite" }}>
                {scraping ? "Fetching from ESPN..." : "Loading lineups..."}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !scraping && lineups.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>No games scheduled for today</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>
                Click ⚡ Pull ESPN to manually fetch from ESPN
              </div>
            </div>
          )}

          {/* Team sections */}
          {lineups.map((lineup) => (
            <TeamSection key={`${lineup.team_abbreviation}-${lineup.opponent}`} lineup={lineup} />
          ))}

          {/* Legend */}
          <div style={{
            display: "flex", gap: 20, marginTop: 8,
            padding: "12px 16px", background: "#0a0e14",
            borderRadius: 8, border: "1px solid #1a2030", flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
              LEGEND:
            </div>
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
