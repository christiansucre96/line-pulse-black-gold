// src/pages/RosterPage.tsx
import { useState, useEffect } from "react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Player {
  player_id: string;
  name: string;
  position: string;
  external_id?: string;
}

interface Team {
  team: string;
  team_name: string;
  players: Player[];
}

export default function RosterPage() {
  const [sport, setSport] = useState<"mlb" | "nba" | "nfl" | "nhl" | "soccer">("mlb");
  const [teams, setTeams] = useState<Team[]>([]);
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
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ operation: "get_lineups", sport }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load lineups");
      setTeams(data.lineups || []);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

          {loading && teams.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#f5bc2f", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 12, animation: "pulse 2s ease infinite" }}>Loading rosters...</div>
            </div>
          )}

          {!loading && teams.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No roster data available for {sport.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>Try a different sport or run Full Sync in Admin</div>
            </div>
          )}

          {teams.map((team) => (
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
                  <div
                    key={player.player_id}
                    style={{
                      background: "#0d1117", border: "1px solid #1e2530",
                      borderRadius: 8, padding: "12px 14px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {player.name}
                      </span>
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
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: "12px 16px", background: "#0a0e14", borderRadius: 8, border: "1px solid #1a2030", fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            Rosters are pulled from the Edge Function `get_lineups` endpoint. Use Admin sync to refresh.
          </div>
        </div>
      </div>
    </>
  );
}
