// src/pages/RosterPage.tsx
import { useState, useEffect } from "react";

const CLEVER_ACTION_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const MLB_LINEUP_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/mlb-lineup-scraper";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Common player interface
interface Player {
  player_id: string;
  name: string;
  position: string;
  jersey?: string;
  is_starter?: boolean;
  external_id?: string;
}

// Interface for clever-action response (NBA/NFL/NHL)
interface SimpleTeam {
  team: string;
  team_name: string;
  players: Player[];
}

// Interface for mlb-lineup-scraper response
interface MLBLineup {
  team_id: string;
  team_abbreviation: string;
  team_name: string;
  game_id: string;
  game_date: string;
  opponent_abbreviation: string | null;
  probable_pitcher: string | null;
  projected_starters: Player[];
  bench_depth: Player[];
  lineup_confidence: 'high' | 'medium' | 'low';
  confirmed: boolean;
  confirmed_at: string | null;
  generated_at: string;
  sport: 'mlb';
}

export default function RosterPage() {
  const [sport, setSport] = useState<"mlb" | "nba" | "nfl" | "nhl" | "soccer">("mlb");
  const [simpleTeams, setSimpleTeams] = useState<SimpleTeam[]>([]);
  const [mlbLineups, setMlbLineups] = useState<MLBLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    fetchLineups();
  }, [sport]);

  const fetchLineups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 🔥 Use correct endpoint per sport
      const isMLB = sport === 'mlb';
      const endpoint = isMLB ? MLB_LINEUP_URL : CLEVER_ACTION_URL;
      
      const body: any = { sport };
      if (!isMLB) {
        body.operation = "get_lineups";
      }
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to load lineups");
      }
      
      if (isMLB) {
        // 🔥 MLB: Query database directly for projected_lineups
        await fetchMLBLineupsFromDB();
      } else {
        // Other sports: Use clever-action response
        setSimpleTeams(data.lineups || []);
        setMlbLineups([]);
      }
      
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Fetch MLB lineups directly from Supabase (more reliable than Edge Function for reads)
  const fetchMLBLineupsFromDB = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(
        `https://retfkpfvhuseyphvwzxg.supabase.co/rest/v1/projected_lineups?` +
        `select=*&sport=eq.mlb&game_date=eq.${today}&order=generated_at.desc`,
        {
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
          },
        }
      );
      
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Database error: ${err}`);
      }
      
      const lineups: MLBLineup[] = await response.json();
      
      // Group by team_abbreviation (in case of duplicates)
      const uniqueLineups = Array.from(
        new Map(lineups.map(l => [l.team_abbreviation, l])).values()
      );
      
      setMlbLineups(uniqueLineups);
      setSimpleTeams([]);
    } catch (err: any) {
      console.error("MLB DB fetch error:", err);
      // Fallback: try Edge Function
      const res = await fetch(MLB_LINEUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ sport: 'mlb' }),
      });
      const data = await res.json();
      if (data.success && data.teams_written > 0) {
        // Re-fetch from DB after sync
        await fetchMLBLineupsFromDB();
      }
    }
  };

  const dateLabel = new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  // 🔥 Badge component for lineup status
  const LineupBadge = ({ confirmed, probablePitcher }: { confirmed: boolean; probablePitcher: string | null }) => {
    if (confirmed) {
      return (
        <span style={{
          padding: "2px 8px", borderRadius: 4,
          background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)",
          fontSize: 9, fontWeight: 700, color: "#22c55e",
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
        }}>
          ✅ CONFIRMED
        </span>
      );
    }
    if (probablePitcher) {
      return (
        <span style={{
          padding: "2px 8px", borderRadius: 4,
          background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.3)",
          fontSize: 9, fontWeight: 700, color: "#eab308",
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
        }}>
          🟡 PROJECTED
        </span>
      );
    }
    return (
      <span style={{
        padding: "2px 8px", borderRadius: 4,
        background: "rgba(75, 85, 99, 0.15)", border: "1px solid rgba(75, 85, 99, 0.3)",
        fontSize: 9, fontWeight: 700, color: "#6b7280",
        fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
      }}>
        ⚪ TBD
      </span>
    );
  };

  // 🔥 Player card component with starter/bench styling
  const PlayerCard = ({ player, isStarter, isMLB }: { player: Player; isStarter?: boolean; isMLB: boolean }) => (
    <div
      style={{
        background: isStarter && isMLB ? "rgba(234, 179, 8, 0.08)" : "#0d1117",
        border: isStarter && isMLB ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid #1e2530",
        borderRadius: 8, padding: "12px 14px",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ 
          fontSize: 13, fontWeight: isStarter && isMLB ? 800 : 700, 
          color: isStarter && isMLB ? "#fde68a" : "#cbd5e1", 
          fontFamily: "'Barlow Condensed', sans-serif" 
        }}>
          {player.name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {player.jersey && (
            <span style={{
              padding: "2px 6px", borderRadius: 3,
              background: "#141820", border: "1px solid #1e2530",
              fontSize: 8, fontWeight: 700, color: "#94a3b8",
              fontFamily: "'DM Mono', monospace",
              minWidth: 20, textAlign: "center",
            }}>
              #{player.jersey}
            </span>
          )}
          <span style={{
            padding: "2px 8px", borderRadius: 4,
            background: "#141820", border: "1px solid #1e2530",
            fontSize: 9, fontWeight: 700, color: "#5b6e8c",
            fontFamily: "'DM Mono', monospace",
          }}>
            {player.position || "–"}
          </span>
        </div>
      </div>
      {isStarter && isMLB && (
        <div style={{ fontSize: 8, color: "#eab308", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
          ★ STARTER
        </div>
      )}
    </div>
  );

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
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060a0f", padding: "32px 24px", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "#c8970a", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 6 }}>
                ◈ {sport.toUpperCase()} ROSTERS
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif" }}>
                {dateLabel}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as any)}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: "#0d1117", border: "1px solid #1e2530",
                  color: "#cbd5e1", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer",
                }}
              >
                <option value="mlb">⚾ MLB</option>
                <option value="nba">🏀 NBA</option>
                <option value="nfl">🏈 NFL</option>
                <option value="nhl">🏒 NHL</option>
                <option value="soccer">⚽ Soccer</option>
              </select>
              {lastUpdated && <span style={{ fontSize: 10, color: "#2e3748" }}>Updated {lastUpdated}</span>}
              <button onClick={fetchLineups} disabled={loading} style={{
                padding: "6px 16px", borderRadius: 8,
                border: "1px solid #1e2530", background: "#0d1117",
                color: loading ? "#2e3748" : "#4a5568",
                fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#200000", border: "1px solid #8b0000", borderRadius: 8, color: "#ff4444", fontSize: 11 }}>
              ❌ {error}
            </div>
          )}

          {loading && (simpleTeams.length === 0) && (mlbLineups.length === 0) && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#f5bc2f", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 12, animation: "pulse 2s ease infinite" }}>Loading {sport.toUpperCase()} rosters...</div>
            </div>
          )}

          {!loading && (simpleTeams.length === 0) && (mlbLineups.length === 0) && !error && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No roster data available for {sport.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>
                {sport === 'mlb' 
                  ? 'Run the MLB Lineup Scraper in Admin to sync today\'s lineups'
                  : 'Try a different sport or run Full Sync in Admin'}
              </div>
            </div>
          )}

          {/* 🔥 MLB Lineups Display */}
          {sport === 'mlb' && mlbLineups.map((lineup) => (
            <div key={lineup.team_id} style={{
              background: "#0a0e14", border: "1px solid #1a2030",
              borderRadius: 14, padding: "20px 20px 24px", marginBottom: 24,
            }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>
                      {lineup.team_abbreviation}
                    </span>
                    <LineupBadge confirmed={lineup.confirmed} probablePitcher={lineup.probable_pitcher} />
                  </div>
                  <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif", marginLeft: 0, marginTop: 4, display: "block" }}>
                    {lineup.team_name}
                  </span>
                  {lineup.probable_pitcher && !lineup.confirmed && (
                    <div style={{ fontSize: 10, color: "#eab308", marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
                      🎯 Probable: {lineup.probable_pitcher}
                    </div>
                  )}
                  {lineup.opponent_abbreviation && (
                    <div style={{ fontSize: 10, color: "#4a5568", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                      vs {lineup.opponent_abbreviation} • {lineup.game_date}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
                    {lineup.projected_starters.length} starters • {lineup.bench_depth?.length || 0} bench
                  </div>
                  <div style={{ fontSize: 9, color: lineup.lineup_confidence === 'high' ? '#22c55e' : lineup.lineup_confidence === 'medium' ? '#eab308' : '#6b7280', marginTop: 2 }}>
                    Confidence: {lineup.lineup_confidence.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Starters Section */}
              {lineup.projected_starters.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#eab308", marginBottom: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" }}>
                    ★ PROJECTED STARTERS
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
                    {lineup.projected_starters.map((player) => (
                      <PlayerCard key={`${player.mlb_id}-${player.position}`} player={player} isStarter={true} isMLB={true} />
                    ))}
                  </div>
                </>
              )}

              {/* Bench Section */}
              {lineup.bench_depth?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" }}>
                    BENCH / RESERVES
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                    {lineup.bench_depth.map((player) => (
                      <PlayerCard key={`${player.mlb_id}-${player.position}`} player={player} isStarter={false} isMLB={true} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* 🔥 Other Sports Display (NBA/NFL/NHL) */}
          {sport !== 'mlb' && simpleTeams.map((team) => (
            <div key={team.team} style={{
              background: "#0a0e14", border: "1px solid #1a2030",
              borderRadius: 14, padding: "20px 20px 24px", marginBottom: 24,
            }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>
                  {team.team}
                </span>
                <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif", marginLeft: 10 }}>
                  {team.team_name}
                </span>
                <div style={{ fontSize: 10, color: "#4a5568", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                  {team.players.length} players
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {team.players.map((player) => (
                  <PlayerCard key={player.player_id} player={player} isMLB={false} />
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: "12px 16px", background: "#0a0e14", borderRadius: 8, border: "1px solid #1a2030", fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            {sport === 'mlb' 
              ? 'MLB lineups pulled from projected_lineups table. Starters highlighted in gold.'
              : 'Rosters pulled from the Edge Function `get_lineups` endpoint. Use Admin sync to refresh.'}
          </div>
        </div>
      </div>
    </>
  );
}
