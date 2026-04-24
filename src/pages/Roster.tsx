// src/pages/RosterPage.tsx
// Fetches REAL lineup data from your espn-lineup-scraper
// Shows amber for projected starters, green for confirmed (matches ESPN)

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Status Config (matches ESPN styling) ─────────────────────────────────────
const STATUS_CONFIG = {
  probable:     { label: "PROBABLE",     bg: "#2a2000", border: "#c8970a", text: "#f5bc2f", dot: "#f5bc2f" },
  questionable: { label: "QUESTIONABLE", bg: "#1a1200", border: "#8a6500", text: "#d4a017", dot: "#d4a017" },
  out:          { label: "OUT",          bg: "#200000", border: "#8b0000", text: "#ff4444", dot: "#ff4444" },
  confirmed:    { label: "CONFIRMED",    bg: "#002a00", border: "#22c55e", text: "#22c55e", dot: "#22c55e" }, // ✅ Green for confirmed
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.probable;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 4,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      color: cfg.text, fontFamily: "'DM Mono', monospace",
    }}>
      <svg width="6" height="6" viewBox="0 0 6 6">
        <circle cx="3" cy="3" r="3" fill={cfg.dot} />
      </svg>
      {cfg.label}
    </span>
  );
}

// ─── Hit rate bar ─────────────────────────────────────────────────────────────
function HitBar({ rate }: { rate: number }) {
  const color = rate >= 60 ? "#22c55e" : rate >= 40 ? "#f5bc2f" : "#ef4444";
  return (
    <div style={{ height: 3, background: "#1e2530", borderRadius: 2, marginTop: 4 }}>
      <div style={{ height: "100%", width: `${rate}%`, background: color, borderRadius: 2,
        transition: "width 0.6s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, isStarter, lineupStatus }: { 
  player: any; 
  isStarter: boolean; 
  lineupStatus: "projected" | "confirmed" | null 
}) {
  const [hovered, setHovered] = useState(false);

  // ✅ Amber for projected starters, Green for confirmed
  const borderColor = isStarter
    ? lineupStatus === "confirmed" 
      ? hovered ? "#22c55e" : "#16a34a"  // Green
      : hovered ? "#f5bc2f" : "#c8970a"   // Amber
    : hovered ? "#2e3748" : "#1e2530";

  const bgColor = isStarter
    ? lineupStatus === "confirmed"
      ? hovered ? "#002a00" : "#001a00"  // Dark green
      : hovered ? "#1a1400" : "#141000"   // Dark amber
    : hovered ? "#141820" : "#0d1117";

  const glowStyle = isStarter ? {
    boxShadow: hovered
      ? `0 0 0 1px ${lineupStatus === "confirmed" ? "#22c55e40" : "#f5bc2f40"}, 0 4px 20px ${lineupStatus === "confirmed" ? "#22c55e20" : "#f5bc2f20"}`
      : `0 0 0 1px ${lineupStatus === "confirmed" ? "#16a34a20" : "#c8970a20"}, 0 2px 8px ${lineupStatus === "confirmed" ? "#16a34a10" : "#c8970a10"}`,
  } : {};

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "default",
        transition: "all 0.18s ease",
        position: "relative",
        overflow: "hidden",
        ...glowStyle,
      }}
    >
      {/* Accent line: Amber for projected, Green for confirmed */}
      {isStarter && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${lineupStatus === "confirmed" ? "#16a34a" : "#c8970a"}, ${lineupStatus === "confirmed" ? "#22c55e" : "#f5bc2f"}, ${lineupStatus === "confirmed" ? "#16a34a" : "#c8970a"})`,
          opacity: hovered ? 1 : 0.7,
          transition: "opacity 0.18s",
        }} />
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Jersey circle */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: isStarter 
                ? (lineupStatus === "confirmed" ? "#002a00" : "#2a1f00") 
                : "#1a2030",
              border: `1px solid ${isStarter 
                ? (lineupStatus === "confirmed" ? "#16a34a" : "#c8970a") 
                : "#2e3748"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, 
              color: isStarter 
                ? (lineupStatus === "confirmed" ? "#22c55e" : "#f5bc2f") 
                : "#4a5568",
              fontFamily: "'DM Mono', monospace", flexShrink: 0,
            }}>
              {player.jersey || "–"}
            </div>
            <span style={{
              fontSize: 13, fontWeight: 700, 
              color: isStarter 
                ? (lineupStatus === "confirmed" ? "#86efac" : "#e8d48b") 
                : "#cbd5e1",
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.03em", textTransform: "uppercase",
            }}>
              {player.full_name || player.name}
            </span>
          </div>
          <div style={{ marginTop: 3, marginLeft: 30 }}>
            <span style={{
              fontSize: 10, color: "#4a5568", fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.05em",
            }}>
              {player.position}
            </span>
          </div>
        </div>

        {/* Right badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <StatusBadge status={lineupStatus || (player.starter ? "probable" : null)} />
          {isStarter && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9, 
              color: lineupStatus === "confirmed" ? "#22c55e" : "#c8970a", 
              fontFamily: "'DM Mono', monospace",
              fontWeight: 600, letterSpacing: "0.06em",
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="3" fill="none" stroke={lineupStatus === "confirmed" ? "#22c55e" : "#c8970a"} strokeWidth="1.5" />
                <circle cx="4" cy="4" r="1.5" fill={lineupStatus === "confirmed" ? "#22c55e" : "#c8970a"} />
              </svg>
              {lineupStatus === "confirmed" ? "Confirmed Starter" : "Projected Starter"}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        borderTop: `1px solid ${isStarter 
          ? (lineupStatus === "confirmed" ? "#002a00" : "#2a1f00") 
          : "#1a2030"}`,
        paddingTop: 10, marginTop: 4,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.08em", marginBottom: 3 }}>
            L10 Avg
          </div>
          <div style={{ fontSize: 18, fontWeight: 700,
            color: player.l10avg > 0 
              ? (isStarter 
                ? (lineupStatus === "confirmed" ? "#22c55e" : "#f5bc2f") 
                : "#e2e8f0") 
              : "#2e3748",
            fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1,
          }}>
            {player.l10avg > 0 ? player.l10avg.toFixed(1) : "0.0"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.08em", marginBottom: 3 }}>
            Hit Rate
          </div>
          <div style={{ fontSize: 18, fontWeight: 700,
            color: player.hitRate >= 60 ? "#22c55e" : player.hitRate >= 40 ? "#f5bc2f" : "#ef4444",
            fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1,
          }}>
            {player.hitRate > 0 ? `${player.hitRate}%` : "0%"}
          </div>
          <HitBar rate={player.hitRate} />
        </div>
      </div>
    </div>
  );
}

// ─── Team Header ──────────────────────────────────────────────────────────────
function TeamHeader({ team }: { team: any }) {
  const starters = team.players?.filter((p: any) => p.is_starter) || [];
  const confirmed = starters.filter((p: any) => p.lineup_status === "confirmed").length;
  const projected = starters.filter((p: any) => p.lineup_status === "projected").length;
  
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 16,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 22, fontWeight: 900, color: "#f5bc2f",
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em",
          }}>
            {team.abbreviation}
          </span>
          <span style={{
            fontSize: 14, color: "#94a3b8",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 500,
          }}>
            {team.name || team.displayName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#f5bc2f", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
            {projected} Projected
          </span>
          <span style={{ color: "#2e3748", fontSize: 10 }}>•</span>
          <span style={{ fontSize: 11, color: confirmed > 0 ? "#22c55e" : "#4a5568",
            fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
            {confirmed} Confirmed
          </span>
        </div>
      </div>
      <div style={{
        padding: "4px 12px", borderRadius: 6,
        background: "#0d1117", border: "1px solid #1e2530",
        fontSize: 11, fontWeight: 700, color: "#4a5568",
        fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
      }}>
        NBA
      </div>
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────
function TeamSection({ team }: { team: any }) {
  const [activeTab, setActiveTab] = useState<"starters" | "all">("all");
  
  if (!team.players) return null;
  
  const starters = team.players.filter((p: any) => p.is_starter);
  const bench = team.players.filter((p: any) => !p.is_starter);
  const displayed = activeTab === "starters" ? starters : team.players;

  return (
    <div style={{
      background: "#0a0e14", border: "1px solid #1a2030",
      borderRadius: 14, padding: "20px 20px 24px",
      marginBottom: 24,
    }}>
      <TeamHeader team={team} />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["all", "starters"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "5px 14px", borderRadius: 6, border: "1px solid",
            borderColor: activeTab === tab ? "#c8970a" : "#1e2530",
            background: activeTab === tab ? "#1a1200" : "transparent",
            color: activeTab === tab ? "#f5bc2f" : "#4a5568",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em",
            transition: "all 0.15s ease",
          }}>
            {tab === "all" ? "ALL PLAYERS" : "STARTERS ONLY"}
          </button>
        ))}
      </div>

      {/* Section label */}
      {activeTab === "all" && starters.length > 0 && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#c8970a",
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
          marginBottom: 10, paddingLeft: 2,
        }}>
          ▸ PROJECTED STARTERS
        </div>
      )}

      {/* Starter cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {(activeTab === "all" ? starters : starters).map((p: any) => (
          <PlayerCard 
            key={p.player_id || p.id} 
            player={p} 
            isStarter={true} 
            lineupStatus={p.lineup_status} 
          />
        ))}
      </div>

      {/* Bench section */}
      {activeTab === "all" && bench.length > 0 && (
        <>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#2e3748",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em",
            margin: "16px 0 10px", paddingLeft: 2,
          }}>
            ▸ BENCH
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {bench.map((p: any) => (
              <PlayerCard 
                key={p.player_id || p.id} 
                player={p} 
                isStarter={false} 
                lineupStatus={null} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function RosterPage() {
  const [selectedTeam, setSelectedTeam] = useState("ALL");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Fetch real lineup data from your scraper's database
  const fetchLineups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Get today's games to know which teams are playing
      const { data: games, error: gamesError } = await supabase
        .from('games_data')
        .select(`
          external_id,
          home_team:teams!games_data_home_team_id_fkey(abbreviation, name),
          away_team:teams!games_data_away_team_id_fkey(abbreviation, name),
          game_date
        `)
        .eq('sport', 'nba')
        .eq('game_date', today);
      
      if (gamesError) throw gamesError;
      
      const activeTeamIds = new Set<string>();
      const activeTeamAbbrs = new Set<string>();
      
      for (const game of games || []) {
        if (game.home_team?.id) {
          activeTeamIds.add(game.home_team.id);
          activeTeamAbbrs.add(game.home_team.abbreviation);
        }
        if (game.away_team?.id) {
          activeTeamIds.add(game.away_team.id);
          activeTeamAbbrs.add(game.away_team.abbreviation);
        }
      }
      
      if (activeTeamIds.size === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }
      
      // 2. Get players for active teams with lineup status from scraper
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          full_name,
          position,
          team_id,
          is_starter,
          lineup_status,
          teams:team_id(abbreviation, name)
        `)
        .eq('sport', 'nba')
        .in('team_id', [...activeTeamIds])
        .order('is_starter', { ascending: false });
      
      if (playersError) throw playersError;
      
      // 3. Group players by team
      const teamMap: Record<string, any> = {};
      
      for (const player of players || []) {
        const team = player.teams;
        if (!team?.abbreviation) continue;
        
        if (!teamMap[team.abbreviation]) {
          teamMap[team.abbreviation] = {
            abbreviation: team.abbreviation,
            name: team.name,
            players: []
          };
        }
        
        // Add mock stats for display (replace with real stats from your player_game_stats table)
        teamMap[team.abbreviation].players.push({
          ...player,
          l10avg: Math.random() * 25 + 5, // Mock: 5-30 avg
          hitRate: Math.floor(Math.random() * 40) + 40, // Mock: 40-80%
          jersey: Math.floor(Math.random() * 99) + 1 // Mock jersey number
        });
      }
      
      setTeams(Object.values(teamMap));
      setLastUpdated(new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: true
      }));
      
    } catch (err: any) {
      console.error("Error fetching lineups:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLineups();
    
    // Auto-refresh every 5 minutes to catch confirmed starters
    const interval = setInterval(fetchLineups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayed = selectedTeam === "ALL"
    ? teams
    : teams.filter(t => t.abbreviation === selectedTeam);

  if (loading && teams.length === 0) {
    return (
      <div style={{
        minHeight: "100vh", background: "#060a0f",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{ textAlign: "center", color: "#4a5568" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid #1e2530", borderTopColor: "#f5bc2f",
            animation: "spin 1s linear infinite", margin: "0 auto 16px"
          }} />
          <div>Loading ESPN lineups...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060a0f; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #1e2530; border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#060a0f",
        padding: "32px 24px", fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Page header */}
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{
                fontSize: 10, color: "#c8970a", fontWeight: 700,
                letterSpacing: "0.2em", marginBottom: 6,
                fontFamily: "'DM Mono', monospace",
              }}>
                ◈ NBA DAILY LINEUPS
              </div>
              <div style={{
                fontSize: 28, fontWeight: 900, color: "#e8d48b",
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: "0.04em",
              }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
              </div>
            </div>
            <div style={{
              fontSize: 10, color: "#2e3748",
              fontFamily: "'DM Mono', monospace",
            }}>
              Updated {lastUpdated || "–"}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginBottom: 16, padding: "8px 12px",
              background: "#200000", border: "1px solid #8b0000",
              borderRadius: 6, color: "#ff4444", fontSize: 11,
              fontFamily: "'DM Mono', monospace",
            }}>
              ❌ {error}
            </div>
          )}

          {/* Team filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <button onClick={() => setSelectedTeam("ALL")} style={{
              padding: "6px 16px", borderRadius: 8,
              border: `1px solid ${selectedTeam === "ALL" ? "#c8970a" : "#1e2530"}`,
              background: selectedTeam === "ALL" ? "#1a1200" : "#0d1117",
              color: selectedTeam === "ALL" ? "#f5bc2f" : "#4a5568",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
            }}>ALL</button>
            {teams.map(t => (
              <button key={t.abbreviation} onClick={() => setSelectedTeam(t.abbreviation)} style={{
                padding: "6px 16px", borderRadius: 8,
                border: `1px solid ${selectedTeam === t.abbreviation ? "#c8970a" : "#1e2530"}`,
                background: selectedTeam === t.abbreviation ? "#1a1200" : "#0d1117",
                color: selectedTeam === t.abbreviation ? "#f5bc2f" : "#4a5568",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              }}>{t.abbreviation}</button>
            ))}
            <button onClick={fetchLineups} style={{
              padding: "6px 16px", borderRadius: 8,
              border: "1px solid #1e2530",
              background: "#0d1117",
              color: "#4a5568",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              marginLeft: "auto",
            }}>↻ Refresh</button>
          </div>

          {/* Teams */}
          {displayed.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              color: "#4a5568", fontFamily: "'DM Mono', monospace",
            }}>
              No games scheduled for today
            </div>
          ) : (
            displayed.map(team => (
              <TeamSection key={team.abbreviation} team={team} />
            ))
          )}

          {/* Legend */}
          <div style={{
            display: "flex", gap: 20, marginTop: 8,
            padding: "12px 16px", background: "#0a0e14",
            borderRadius: 8, border: "1px solid #1a2030",
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
              LEGEND:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 2, background: "linear-gradient(90deg, #c8970a, #f5bc2f)" }} />
              <span style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>PROJECTED STARTER</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 2, background: "linear-gradient(90deg, #16a34a, #22c55e)" }} />
              <span style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>CONFIRMED STARTER</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5bc2f" }} />
              <span style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>PROBABLE</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 9, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>HIT RATE ≥60%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
