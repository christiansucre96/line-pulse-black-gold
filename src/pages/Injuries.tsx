// src/pages/InjuryReport.tsx
// Shows all injured NBA players with injury type, description, return date
// Auto-triggers scraper if DB is empty

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Injury {
  id: string;
  full_name: string;
  team_abbreviation: string;
  position: string;
  injury_status: string;
  injury_type: string;
  injury_side: string;
  injury_description: string;
  return_date: string | null;
  last_updated: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; priority: number }> = {
  out:          { bg: "#200000", text: "#ff4444", border: "#8b0000", label: "OUT",          priority: 1 },
  suspended:    { bg: "#200000", text: "#ff4444", border: "#8b0000", label: "SUSPENDED",    priority: 2 },
  doubtful:     { bg: "#2a1a00", text: "#ff8800", border: "#b85c00", label: "DOUBTFUL",     priority: 3 },
  "day-to-day": { bg: "#2a2000", text: "#f5bc2f", border: "#c8970a", label: "DAY-TO-DAY",  priority: 4 },
  questionable: { bg: "#2a2000", text: "#f5bc2f", border: "#c8970a", label: "QUESTIONABLE", priority: 5 },
  probable:     { bg: "#001a00", text: "#22c55e", border: "#16a34a", label: "PROBABLE",     priority: 6 },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status.toLowerCase()] || STATUS_CONFIG.questionable;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.text, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.1em", fontFamily: "'DM Mono', monospace",
    }}>
      <svg width="5" height="5" viewBox="0 0 6 6">
        <circle cx="3" cy="3" r="3" fill={cfg.text} />
      </svg>
      {cfg.label}
    </span>
  );
}

// ─── Injury Type Badge ────────────────────────────────────────────────────────
function InjuryTypeBadge({ type }: { type: string }) {
  if (!type) return null;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4,
      background: "#0d1117", border: "1px solid #1e2530",
      color: "#64748b", fontSize: 10, fontWeight: 600,
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em",
    }}>
      {type}
    </span>
  );
}

// ─── Injury Card ──────────────────────────────────────────────────────────────
function InjuryCard({ injury }: { injury: Injury }) {
  const cfg = getStatusConfig(injury.injury_status);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${cfg.bg}80` : "#0a0e14",
        border: `1px solid ${hovered ? cfg.border : `${cfg.border}40`}`,
        borderRadius: 10, padding: "16px 18px",
        transition: "all 0.18s ease", position: "relative",
        boxShadow: hovered ? `0 0 0 1px ${cfg.border}30` : "none",
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: cfg.border, borderRadius: "10px 0 0 10px",
        opacity: hovered ? 1 : 0.5,
      }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            {/* Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                fontSize: 15, fontWeight: 700, color: "#e8d48b",
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}>
                {injury.full_name}
              </span>
              <StatusBadge status={injury.injury_status} />
              {injury.injury_type && <InjuryTypeBadge type={injury.injury_type} />}
            </div>

            {/* Team / Position */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{
                padding: "2px 8px", borderRadius: 4,
                background: "#1a1200", border: "1px solid #c8970a40",
                color: "#f5bc2f", fontSize: 11, fontWeight: 700,
                fontFamily: "'Barlow Condensed', sans-serif",
              }}>
                {injury.team_abbreviation}
              </span>
              {injury.position && (
                <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
                  {injury.position}
                </span>
              )}
            </div>
          </div>

          {/* Return date */}
          {injury.return_date && (
            <div style={{
              textAlign: "right", padding: "6px 10px",
              background: "#0d1117", border: "1px solid #1e2530",
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>
                EST. RETURN
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                {injury.return_date}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {injury.injury_description && (
          <div style={{
            padding: "8px 12px",
            background: `${cfg.bg}60`,
            borderLeft: `2px solid ${cfg.border}`,
            borderRadius: "0 6px 6px 0",
            fontSize: 11, color: "#94a3b8",
            fontFamily: "'DM Mono', monospace", lineHeight: 1.5,
            marginBottom: 8,
          }}>
            {injury.injury_description}
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>
          Updated {new Date(injury.last_updated).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", month: "short", day: "numeric"
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Team Group ───────────────────────────────────────────────────────────────
function TeamGroup({ team, injuries }: { team: string; injuries: Injury[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const worstStatus = injuries.sort((a, b) =>
    (STATUS_CONFIG[a.injury_status]?.priority || 99) - (STATUS_CONFIG[b.injury_status]?.priority || 99)
  )[0]?.injury_status;
  const cfg = getStatusConfig(worstStatus || 'questionable');

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "8px 12px", marginBottom: 10,
          background: "#0a0e14", border: "1px solid #1a2030",
          borderRadius: 8, cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{
          padding: "2px 10px", borderRadius: 4,
          background: "#1a1200", border: "1px solid #c8970a40",
          color: "#f5bc2f", fontSize: 13, fontWeight: 800,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em",
        }}>
          {team}
        </span>
        <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
          {injuries.length} player{injuries.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {['out', 'doubtful', 'questionable', 'probable'].map(s => {
            const count = injuries.filter(i => i.injury_status === s).length;
            if (!count) return null;
            const c = STATUS_CONFIG[s];
            return (
              <span key={s} style={{
                padding: "1px 6px", borderRadius: 3,
                background: c.bg, border: `1px solid ${c.border}`,
                color: c.text, fontSize: 9, fontFamily: "'DM Mono', monospace",
              }}>
                {count} {s.toUpperCase()}
              </span>
            );
          })}
        </div>
        <span style={{ color: "#2e3748", fontSize: 12 }}>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {injuries.map(inj => <InjuryCard key={inj.id} injury={inj} />)}
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function InjuryReport() {
  const [injuries, setInjuries]     = useState<Injury[]>([]);
  const [loading, setLoading]       = useState(true);
  const [scraping, setScraping]     = useState(false);
  const [filterStatus, setFilter]   = useState("all");
  const [groupBy, setGroupBy]       = useState<"team" | "status">("status");
  const [searchTerm, setSearch]     = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [statusMsg, setStatusMsg]   = useState("");

  // ── Fetch from DB ───────────────────────────────────────────────────────────
  async function fetchInjuries() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("injuries")
        .select("*")
        .eq("sport", "nba")
        .order("last_updated", { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        // Auto-trigger scraper if empty
        await runScraper();
        return;
      }

      setInjuries(data);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── Trigger scraper ─────────────────────────────────────────────────────────
  async function runScraper() {
    setScraping(true);
    setStatusMsg("⏳ Fetching injury report...");
    try {
      const { data, error } = await supabase.functions.invoke("nba-injury-scraper", { body: {} });
      if (error) throw new Error(error.message);

      setStatusMsg(`✅ ${data.total_stored} injured players loaded (NBA official: ${data.nba_official}, Today inactive: ${data.inactive_today})`);

      // Re-fetch from DB
      const { data: fresh } = await supabase
        .from("injuries").select("*").eq("sport", "nba")
        .order("last_updated", { ascending: false });
      setInjuries(fresh || []);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      setStatusMsg(`❌ ${e.message}`);
    } finally {
      setScraping(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInjuries();
    const interval = setInterval(fetchInjuries, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Filter + search ─────────────────────────────────────────────────────────
  const filtered = injuries
    .filter(i => filterStatus === "all" || i.injury_status === filterStatus)
    .filter(i => !searchTerm || i.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.team_abbreviation.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) =>
      (STATUS_CONFIG[a.injury_status]?.priority || 99) - (STATUS_CONFIG[b.injury_status]?.priority || 99)
    );

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = {
    out:          injuries.filter(i => i.injury_status === 'out').length,
    suspended:    injuries.filter(i => i.injury_status === 'suspended').length,
    doubtful:     injuries.filter(i => i.injury_status === 'doubtful').length,
    dayToDay:     injuries.filter(i => i.injury_status === 'day-to-day').length,
    questionable: injuries.filter(i => i.injury_status === 'questionable').length,
    probable:     injuries.filter(i => i.injury_status === 'probable').length,
  };

  // ── Group by team ───────────────────────────────────────────────────────────
  const byTeam = filtered.reduce((acc: Record<string, Injury[]>, inj) => {
    const t = inj.team_abbreviation || 'UNK';
    if (!acc[t]) acc[t] = [];
    acc[t].push(inj);
    return acc;
  }, {});

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
        select, input { outline: none; }
        select option { background: #0d1117; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a0f", padding: "32px 24px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontSize: 10, color: "#ff4444", fontWeight: 700, letterSpacing: "0.2em" }}>
                  NBA INJURY REPORT
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif" }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
              </div>

              {/* Status counts */}
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { label: "OUT", count: counts.out + counts.suspended, color: "#ff4444" },
                  { label: "DOUBTFUL", count: counts.doubtful, color: "#ff8800" },
                  { label: "DAY-TO-DAY", count: counts.dayToDay, color: "#f5bc2f" },
                  { label: "QUESTIONABLE", count: counts.questionable, color: "#f5bc2f" },
                  { label: "PROBABLE", count: counts.probable, color: "#22c55e" },
                ].map(({ label, count, color }) => (
                  <span key={label} style={{ fontSize: 11, color, fontFamily: "'DM Mono', monospace" }}>
                    {count} {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={fetchInjuries} disabled={loading || scraping} style={{
                padding: "6px 14px", borderRadius: 8,
                border: "1px solid #1e2530", background: "#0d1117",
                color: "#4a5568", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'DM Mono', monospace",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ animation: (loading || scraping) ? "spin 1s linear infinite" : "none", display: "inline-block" }}>↻</span>
                {scraping ? "Fetching..." : "Refresh"}
              </button>
              <button onClick={runScraper} disabled={scraping || loading} style={{
                padding: "6px 14px", borderRadius: 8,
                border: "1px solid #ff444440", background: "#200000",
                color: "#ff4444", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'DM Mono', monospace",
              }}>
                ⚡ Pull Data
              </button>
            </div>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: statusMsg.startsWith('✅') ? "#001a00" : "#200000",
              border: `1px solid ${statusMsg.startsWith('✅') ? "#166534" : "#8b0000"}`,
              borderRadius: 8,
              color: statusMsg.startsWith('✅') ? "#22c55e" : "#ff4444",
              fontSize: 11, fontFamily: "'DM Mono', monospace",
            }}>
              {statusMsg}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <input
              placeholder="Search player or team..."
              value={searchTerm}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8,
                background: "#0d1117", border: "1px solid #1e2530",
                color: "#cbd5e1", fontSize: 11, fontFamily: "'DM Mono', monospace",
                width: 200,
              }}
            />

            {/* Status filter */}
            <select value={filterStatus} onChange={e => setFilter(e.target.value)} style={{
              padding: "7px 12px", borderRadius: 8,
              background: "#0d1117", border: "1px solid #1e2530",
              color: "#cbd5e1", fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer",
            }}>
              <option value="all">All Statuses ({injuries.length})</option>
              <option value="out">Out ({counts.out})</option>
              <option value="doubtful">Doubtful ({counts.doubtful})</option>
              <option value="day-to-day">Day-To-Day ({counts.dayToDay})</option>
              <option value="questionable">Questionable ({counts.questionable})</option>
              <option value="probable">Probable ({counts.probable})</option>
            </select>

            {/* Group by */}
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {(['status', 'team'] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)} style={{
                  padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${groupBy === g ? "#c8970a" : "#1e2530"}`,
                  background: groupBy === g ? "#1a1200" : "#0d1117",
                  color: groupBy === g ? "#f5bc2f" : "#4a5568",
                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em",
                }}>
                  BY {g.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {(loading || scraping) && injuries.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#ff4444", animation: "spin 1s linear infinite", margin: "0 auto 14px" }} />
              <div style={{ fontSize: 12 }}>{scraping ? "Fetching injury data..." : "Loading..."}</div>
            </div>
          )}

          {/* Empty */}
          {!loading && !scraping && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No injuries found</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>Click ⚡ Pull Data to fetch from NBA.com</div>
            </div>
          )}

          {/* Injury list — grouped by team */}
          {!loading && groupBy === "team" && Object.entries(byTeam)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([team, teamInjuries]) => (
              <TeamGroup key={team} team={team} injuries={teamInjuries} />
            ))
          }

          {/* Injury list — grouped by status */}
          {!loading && groupBy === "status" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(inj => <InjuryCard key={inj.id} injury={inj} />)}
            </div>
          )}

          {/* Footer */}
          {lastUpdated && (
            <div style={{
              marginTop: 24, padding: "10px 14px",
              background: "#0a0e14", border: "1px solid #1a2030",
              borderRadius: 8, fontSize: 9, color: "#2e3748",
              fontFamily: "'DM Mono', monospace", textAlign: "center",
            }}>
              Last updated: {lastUpdated} • Auto-refreshes every 10 min • pg_cron runs every 2 hours
            </div>
          )}

        </div>
      </div>
    </>
  );
}
