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
  last_updated: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  out: { 
    bg: "#200000", 
    text: "#ff4444", 
    border: "#8b0000",
    label: "OUT"
  },
  doubtful: { 
    bg: "#2a1a00", 
    text: "#ff8800", 
    border: "#b85c00",
    label: "DOUBTFUL"
  },
  questionable: { 
    bg: "#2a2000", 
    text: "#f5bc2f", 
    border: "#c8970a",
    label: "QUESTIONABLE"
  },
  probable: { 
    bg: "#001a00", 
    text: "#22c55e", 
    border: "#16a34a",
    label: "PROBABLE"
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.questionable;
  
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 6,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.text,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      fontFamily: "'DM Mono', monospace",
    }}>
      <svg width="6" height="6" viewBox="0 0 6 6">
        <circle cx="3" cy="3" r="3" fill={cfg.text} />
      </svg>
      {cfg.label}
    </span>
  );
}

function InjuryCard({ injury }: { injury: Injury }) {
  const cfg = STATUS_COLORS[injury.injury_status.toLowerCase()] || STATUS_COLORS.questionable;
  
  return (
    <div style={{
      background: "#0a0e14",
      border: `1px solid ${cfg.border}40`,
      borderRadius: 10,
      padding: "16px",
      marginBottom: 12,
      transition: "all 0.2s ease",
      ":hover": {
        borderColor: cfg.border,
        background: `${cfg.bg}20`,
      },
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#e8d48b",
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              {injury.full_name}
            </span>
            <StatusBadge status={injury.injury_status} />
          </div>
          
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
            <span>{injury.team_abbreviation}</span>
            <span>•</span>
            <span>{injury.position}</span>
            {injury.injury_type && (
              <>
                <span>•</span>
                <span style={{ color: cfg.text }}>{injury.injury_type}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {injury.injury_description && (
        <div style={{
          padding: "10px 12px",
          background: `${cfg.bg}40`,
          borderLeft: `3px solid ${cfg.border}`,
          borderRadius: "0 6px 6px 0",
          fontSize: 12,
          color: "#94a3b8",
          fontFamily: "'DM Mono', monospace",
          lineHeight: 1.5,
        }}>
          {injury.injury_description}
        </div>
      )}
      
      <div style={{
        marginTop: 10,
        fontSize: 10,
        color: "#2e3748",
        fontFamily: "'DM Mono', monospace",
        textAlign: "right",
      }}>
        Updated {new Date(injury.last_updated).toLocaleString()}
      </div>
    </div>
  );
}

export default function InjuryReport() {
  const [sport, setSport] = useState("nba");
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchInjuries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("injuries")
        .select("*")
        .eq("sport", sport)
        .order("injury_status", { ascending: true })
        .order("last_updated", { ascending: false });

      if (error) throw error;
      setInjuries(data || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Error fetching injuries:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerScraper = async () => {
    try {
      const response = await fetch(
        "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/nba-injury-scraper",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      const result = await response.json();
      console.log("Scraper result:", result);
      await fetchInjuries();
    } catch (err: any) {
      console.error("Error triggering scraper:", err);
    }
  };

  useEffect(() => {
    fetchInjuries();
    // Auto-refresh every 10 minutes
    const interval = setInterval(fetchInjuries, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sport]);

  const filteredInjuries = filterStatus === "all"
    ? injuries
    : injuries.filter(i => i.injury_status.toLowerCase() === filterStatus.toLowerCase());

  const statusCounts = {
    out: injuries.filter(i => i.injury_status.toLowerCase() === "out").length,
    questionable: injuries.filter(i => i.injury_status.toLowerCase() === "questionable").length,
    doubtful: injuries.filter(i => i.injury_status.toLowerCase() === "doubtful").length,
    probable: injuries.filter(i => i.injury_status.toLowerCase() === "probable").length,
  };

  return (
    <div style={{ padding: "24px", minHeight: "100vh", background: "#060a0f" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#e8d48b",
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            Injury Report – {sport.toUpperCase()}
          </h1>
        </div>
        
        <div style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "#4a5568",
          fontFamily: "'DM Mono', monospace",
        }}>
          <span style={{ color: "#ff4444" }}>{statusCounts.out} Out</span>
          <span>•</span>
          <span style={{ color: "#ff8800" }}>{statusCounts.doubtful} Doubtful</span>
          <span>•</span>
          <span style={{ color: "#f5bc2f" }}>{statusCounts.questionable} Questionable</span>
          <span>•</span>
          <span style={{ color: "#22c55e" }}>{statusCounts.probable} Probable</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#0d1117",
            border: "1px solid #1e2530",
            color: "#cbd5e1",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            cursor: "pointer",
          }}
        >
          <option value="nba">🏀 NBA</option>
          <option value="nfl">🏈 NFL</option>
          <option value="mlb">⚾ MLB</option>
          <option value="nhl">🏒 NHL</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#0d1117",
            border: "1px solid #1e2530",
            color: "#cbd5e1",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            cursor: "pointer",
          }}
        >
          <option value="all">All Statuses</option>
          <option value="out">Out</option>
          <option value="doubtful">Doubtful</option>
          <option value="questionable">Questionable</option>
          <option value="probable">Probable</option>
        </select>

        <button
          onClick={triggerScraper}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#1a1200",
            border: "1px solid #c8970a",
            color: "#f5bc2f",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          ↻ Refresh Data
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid #1e2530", borderTopColor: "#ff4444",
            animation: "spin 1s linear infinite", margin: "0 auto 16px"
          }} />
          Loading injury report...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredInjuries.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#4a5568",
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
        }}>
          No injured players reported for this sport.
        </div>
      )}

      {/* Injury List */}
      {!loading && filteredInjuries.map((injury) => (
        <InjuryCard key={injury.id} injury={injury} />
      ))}

      {/* Footer */}
      <div style={{
        marginTop: 24,
        padding: "12px 16px",
        background: "#0a0e14",
        borderRadius: 8,
        border: "1px solid #1a2030",
        fontSize: 10,
        color: "#2e3748",
        fontFamily: "'DM Mono', monospace",
        textAlign: "center",
      }}>
        Last updated: {lastUpdated || "Never"} • Auto-refreshes every 10 minutes
      </div>
    </div>
  );
}
