// src/pages/InjuryReport.tsx
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface Injury {
  id: string;
  full_name: string;
  team_abbreviation: string;
  position: string;
  injury_status: string;
  injury_type: string;
  injury_side: string;
  injury_description: string;
  long_description: string;
  return_estimate: string;
  last_updated: string;
}

const STATUS: Record<string, { bg: string; text: string; border: string; label: string; priority: number }> = {
  out:          { bg: "#200000", text: "#ff4444", border: "#8b0000", label: "OUT",          priority: 1 },
  doubtful:     { bg: "#2a1000", text: "#ff6600", border: "#993d00", label: "DOUBTFUL",     priority: 2 },
  questionable: { bg: "#2a2000", text: "#f5bc2f", border: "#c8970a", label: "QUESTIONABLE", priority: 3 },
  probable:     { bg: "#001a00", text: "#22c55e", border: "#16a34a", label: "PROBABLE",     priority: 4 },
  unknown:      { bg: "#111827", text: "#4a5568", border: "#1e2530", label: "UNKNOWN",      priority: 5 },
}

function getStatus(s: string) { return STATUS[s?.toLowerCase()] || STATUS.unknown }

function ReturnBadge({ estimate }: { estimate: string }) {
  if (!estimate || estimate === "TBD") return null;
  const isLong = estimate.toLowerCase().includes("season") || estimate.toLowerCase().includes("month");
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4,
      background: isLong ? "#200000" : "#0d1117",
      border: `1px solid ${isLong ? "#8b000060" : "#1e2530"}`,
      fontSize: 10, fontWeight: 600,
      color: isLong ? "#ff4444" : "#94a3b8",
      fontFamily: "'DM Mono', monospace",
    }}>⏱ {estimate}</span>
  );
}

function InjuryCard({ injury }: { injury: Injury }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getStatus(injury.injury_status);
  const hasLong = injury.long_description && injury.long_description !== injury.injury_description;

  return (
    <div
      onClick={() => hasLong && setExpanded(!expanded)}
      style={{
        background: "#0a0e14", border: `1px solid ${cfg.border}40`,
        borderRadius: 10, padding: "14px 16px", marginBottom: 8,
        cursor: hasLong ? "pointer" : "default", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => { if (hasLong) e.currentTarget.style.borderColor = cfg.border }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${cfg.border}40` }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 4,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              fontSize: 10, fontWeight: 700, color: cfg.text,
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
            }}>
              <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={cfg.text} /></svg>
              {cfg.label}
            </span>
            <span style={{
              fontSize: 15, fontWeight: 700, color: "#e8d48b",
              fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase",
            }}>{injury.full_name}</span>
            <ReturnBadge estimate={injury.return_estimate} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
            <span style={{ padding: "1px 7px", borderRadius: 4, background: "#141820", border: "1px solid #1e2530", color: "#94a3b8", fontWeight: 600 }}>
              {injury.team_abbreviation}
            </span>
            {injury.position && <span>{injury.position}</span>}
            {injury.injury_type && <><span style={{ color: "#2e3748" }}>•</span><span style={{ color: cfg.text }}>{injury.injury_type}</span></>}
            {injury.injury_side && <span>({injury.injury_side})</span>}
          </div>
        </div>
        {hasLong && (
          <span style={{ color: "#2e3748", fontSize: 14, marginLeft: 8, transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}>▾</span>
        )}
      </div>

      {injury.injury_description && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: `${cfg.bg}60`, borderLeft: `2px solid ${cfg.border}`, borderRadius: "0 6px 6px 0", fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
          {injury.injury_description}
        </div>
      )}

      {expanded && hasLong && (
        <div style={{ marginTop: 6, padding: "8px 12px", background: "#060a0f", borderLeft: `2px solid ${cfg.border}40`, borderRadius: "0 6px 6px 0", fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
          {injury.long_description}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>
        {new Date(injury.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

function StatPill({ count, label, color, onClick, active }: any) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 8, cursor: "pointer",
      border: `1px solid ${active ? color : "#1e2530"}`,
      background: active ? `${color}20` : "#0d1117",
      color: active ? color : "#4a5568",
      fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
      transition: "all 0.15s ease",
    }}>
      {count} {label}
    </button>
  );
}

export default function InjuryReport() {
  const [injuries, setInjuries]   = useState<Injury[]>([]);
  const [loading, setLoading]     = useState(true);
  const [scraping, setScraping]   = useState(false);
  const [filterStatus, setFilter] = useState("all");
  const [filterTeam, setTeam]     = useState("all");
  const [search, setSearch]       = useState("");
  const [lastUpdated, setLast]    = useState("");
  const [statusMsg, setMsg]       = useState("");
  const [error, setError]         = useState<string | null>(null);

  async function loadFromDB() {
    const { data, error: e } = await supabase
      .from("injuries").select("*").eq("sport", "nba")
      .order("injury_status").order("team_abbreviation").order("full_name");
    if (e) throw e;
    return data || [];
  }

  async function runScraper() {
    setScraping(true);
    setMsg("⏳ Fetching from ESPN...");
    try {
      const { data, error: e } = await supabase.functions.invoke("nba-injury-scraper", { body: {} });
      if (e) throw new Error(e.message);
      setMsg(`✅ ${data.stored} injuries loaded from ESPN`);
      const fresh = await loadFromDB();
      setInjuries(fresh);
      setLast(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      setError(`Scraper failed: ${e.message}`);
    } finally {
      setScraping(false);
      setLoading(false);
    }
  }

  async function fetchInjuries() {
    setLoading(true); setError(null); setMsg("");
    try {
      const data = await loadFromDB();
      if (data.length === 0) { await runScraper(); return; }
      setInjuries(data);
      setLast(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchInjuries();
    const t = setInterval(fetchInjuries, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const teams = [...new Set(injuries.map(i => i.team_abbreviation))].sort();
  const priorityOrder: Record<string, number> = { out: 1, doubtful: 2, questionable: 3, probable: 4 };

  const filtered = injuries
    .filter(i => filterStatus === "all" || i.injury_status === filterStatus)
    .filter(i => filterTeam === "all" || i.team_abbreviation === filterTeam)
    .filter(i => !search || i.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (priorityOrder[a.injury_status] || 5) - (priorityOrder[b.injury_status] || 5));

  const counts = {
    out:          injuries.filter(i => i.injury_status === "out").length,
    doubtful:     injuries.filter(i => i.injury_status === "doubtful").length,
    questionable: injuries.filter(i => i.injury_status === "questionable").length,
    probable:     injuries.filter(i => i.injury_status === "probable").length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:#060a0f}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0e14}::-webkit-scrollbar-thumb{background:#1e2530;border-radius:2px}
        @keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        input:focus{outline:none;border-color:#c8970a !important}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a0f", padding: "32px 24px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontSize: 10, color: "#ff4444", fontWeight: 700, letterSpacing: "0.2em" }}>NBA INJURY REPORT</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif" }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {lastUpdated && <span style={{ fontSize: 10, color: "#2e3748" }}>Updated {lastUpdated}</span>}
              <button onClick={fetchInjuries} disabled={loading || scraping} style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #1e2530",
                background: "#0d1117", color: "#4a5568", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'DM Mono', monospace",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-block", animation: (loading || scraping) ? "spin 1s linear infinite" : "none" }}>↻</span>
                {scraping ? "Scraping..." : "Refresh"}
              </button>
              <button onClick={runScraper} disabled={scraping} style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #8b000060",
                background: "#200000", color: "#ff4444", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "'DM Mono', monospace",
              }}>⚡ Pull ESPN</button>
            </div>
          </div>

          {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#200000", border: "1px solid #8b0000", borderRadius: 8, color: "#ff4444", fontSize: 11 }}>❌ {error}</div>}
          {statusMsg && !error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#001a00", border: "1px solid #16a34a", borderRadius: 8, color: "#22c55e", fontSize: 11 }}>{statusMsg}</div>}

          {/* Status pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <StatPill count={injuries.length} label="Total"        color="#94a3b8" active={filterStatus === "all"}          onClick={() => setFilter("all")} />
            <StatPill count={counts.out}          label="Out"          color="#ff4444" active={filterStatus === "out"}          onClick={() => setFilter("out")} />
            <StatPill count={counts.doubtful}     label="Doubtful"     color="#ff6600" active={filterStatus === "doubtful"}     onClick={() => setFilter("doubtful")} />
            <StatPill count={counts.questionable} label="Questionable" color="#f5bc2f" active={filterStatus === "questionable"} onClick={() => setFilter("questionable")} />
            <StatPill count={counts.probable}     label="Probable"     color="#22c55e" active={filterStatus === "probable"}     onClick={() => setFilter("probable")} />
          </div>

          {/* Search + team filter */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <input placeholder="Search player..." value={search} onChange={e => setSearch(e.target.value)} style={{
              flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8,
              background: "#0d1117", border: "1px solid #1e2530",
              color: "#cbd5e1", fontSize: 12, fontFamily: "'DM Mono', monospace",
            }} />
            <select value={filterTeam} onChange={e => setTeam(e.target.value)} style={{
              padding: "8px 12px", borderRadius: 8,
              background: "#0d1117", border: "1px solid #1e2530",
              color: "#cbd5e1", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer",
            }}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Loading */}
          {(loading || scraping) && injuries.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#ff4444", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ animation: "pulse 2s ease infinite" }}>{scraping ? "Fetching from ESPN..." : "Loading injuries..."}</div>
            </div>
          )}

          {/* Empty */}
          {!loading && !scraping && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No injuries found</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>Click ⚡ Pull ESPN to fetch latest data</div>
            </div>
          )}

          {/* List */}
          {filtered.map(i => <InjuryCard key={i.id} injury={i} />)}

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#0a0e14", borderRadius: 8, border: "1px solid #1a2030", fontSize: 10, color: "#2e3748", fontFamily: "'DM Mono', monospace", display: "flex", justifyContent: "space-between" }}>
              <span>Showing {filtered.length} of {injuries.length} injuries</span>
              <span>Source: ESPN • Click a card to expand details</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
