// src/pages/RosterPage.tsx
import { useState, useEffect } from "react";

const CLEVER_ACTION_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Player {
  player_id?: string;
  name?: string;
  full_name?: string;
  position?: string;
  jersey?: string;
  is_starter?: boolean;
  external_id?: string;
  mlb_id?: string;
  espn_id?: string;
  athlete?: {
    id?: string;
    displayName?: string;
    fullName?: string;
    position?: { abbreviation?: string };
    jersey?: string;
    number?: string | number;
  };
}

interface SimpleTeam {
  team: string;
  team_name: string;
  projected_starters: Player[];
  bench_depth: Player[];
}

interface Game {
  external_id: string;
  home_team: { abbreviation: string; name: string };
  away_team: { abbreviation: string; name: string };
  start_time: string;
  status: string;
}

export default function RosterPage() {
  const [sport, setSport] = useState<"mlb" | "nba" | "nfl" | "nhl" | "soccer">("mlb");
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [filterByToday, setFilterByToday] = useState(false); // 🔥 Start with FALSE (show all)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    fetchLineups();
  }, [sport, filterByToday]);

  const fetchLineups = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo("");
    
    try {
      // 1. Try to fetch today's games (but don't fail if it returns 0)
      let todayTeamAbbrs = new Set<string>();
      let todayGamesCount = 0;
      
      try {
        const gamesRes = await fetch(CLEVER_ACTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ operation: "get_games", sport }),
        });
        const gamesData = await gamesRes.json();
        const todayGames: Game[] = gamesData.games || [];
        todayGamesCount = todayGames.length;
        setGames(todayGames);
        
        // Extract team abbreviations
        for (const game of todayGames) {
          if (game.home_team?.abbreviation) todayTeamAbbrs.add(game.home_team.abbreviation);
          if (game.away_team?.abbreviation) todayTeamAbbrs.add(game.away_team.abbreviation);
        }
        console.log(`[${sport}] Fetched ${todayGamesCount} games, ${todayTeamAbbrs.size} teams`);
      } catch (e) {
        console.warn(`[${sport}] Failed to fetch games, showing all teams`);
      }
      
      // 2. Fetch all lineups
      const lineupsRes = await fetch(CLEVER_ACTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ operation: "get_lineups", sport }),
      });
      const lineupsData = await lineupsRes.json();
      
      if (!lineupsData.success) {
        throw new Error(lineupsData.error || "Failed to load lineups");
      }
      
      const allTeams = lineupsData.lineups || [];
      
      // 3. Filter logic: only filter if we have games AND filter is enabled
      const filteredTeams = (filterByToday && todayTeamAbbrs.size > 0)
        ? allTeams.filter((team: any) => todayTeamAbbrs.has(team.team))
        : allTeams; // 🔥 Default: show all teams
      
      console.log(`[${sport}] Total: ${allTeams.length}, Filtered: ${filteredTeams.length}`);
      
      // 4. Normalize players
      const normalizedTeams = filteredTeams.map((team: any) => ({
        team: team.team,
        team_name: team.team_name,
        projected_starters: (team.projected_starters || []).map((p: any) => normalizePlayer(p, sport)),
        bench_depth: (team.bench_depth || []).map((p: any) => normalizePlayer(p, sport)),
      }));
      
      setTeams(normalizedTeams);
      
      // 5. Update debug info
      const filterStatus = filterByToday && todayTeamAbbrs.size > 0 
        ? `• Showing ${filteredTeams.length}/${allTeams.length} teams` 
        : `• Showing all ${allTeams.length} teams`;
      setDebugInfo(`${todayGamesCount} games today${filterStatus}`);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizePlayer = (player: any, sport: string): Player => {
    const athlete = player.athlete || player;
    return {
      player_id: player.player_id || athlete.id?.toString() || '',
      name: player.name || athlete.displayName || athlete.fullName || player.full_name || '',
      position: player.position || athlete.position?.abbreviation || player.pos || '',
      jersey: player.jersey || athlete.jersey || player.jerseyNumber || athlete.number?.toString() || '',
      is_starter: player.is_starter !== undefined ? player.is_starter : 
                  player.starter !== undefined ? player.starter :
                  player.isStarter !== undefined ? player.isStarter : false,
      external_id: player.external_id || athlete.id?.toString() || '',
      mlb_id: player.mlb_id || '',
      espn_id: athlete.id?.toString() || '',
    };
  };

  const getPlayerName = (player: Player): string => 
    player.name || player.full_name || player.athlete?.displayName || 'Unknown Player';
  
  const getPlayerPosition = (player: Player): string => 
    player.position || player.athlete?.position?.abbreviation || 'N/A';
  
  const getPlayerJersey = (player: Player): string => 
    player.jersey || player.athlete?.jersey || player.athlete?.number?.toString() || '';

  const dateLabel = new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  const LineupBadge = ({ confirmed }: { confirmed?: boolean }) => {
    if (confirmed) {
      return (
        <span style={{
          padding: "2px 8px", borderRadius: 4,
          background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)",
          fontSize: 9, fontWeight: 700, color: "#22c55e",
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
        }}>
          CONFIRMED
        </span>
      );
    }
    return (
      <span style={{
        padding: "2px 8px", borderRadius: 4,
        background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.3)",
        fontSize: 9, fontWeight: 700, color: "#eab308",
        fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em",
      }}>
        PROJECTED
      </span>
    );
  };

  const PlayerCard = ({ 
    player, 
    isStarter, 
    isProjectedStarter 
  }: { 
    player: Player; 
    isStarter?: boolean;
    isProjectedStarter?: boolean;
  }) => {
    const name = getPlayerName(player);
    const position = getPlayerPosition(player);
    const jersey = getPlayerJersey(player);
    const starter = isStarter !== undefined ? isStarter : (player.is_starter || false);
    const isMLB = sport === 'mlb';
    const isAmber = isProjectedStarter && starter;

    return (
      <div
        style={{
          background: isAmber ? "rgba(234, 179, 8, 0.12)" : 
                     (starter && isMLB) ? "rgba(234, 179, 8, 0.08)" : "#0d1117",
          border: isAmber ? "1px solid rgba(234, 179, 8, 0.5)" : 
                 (starter && isMLB) ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid #1e2530",
          borderRadius: 8, 
          padding: "12px 14px",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ 
            fontSize: 13, 
            fontWeight: isAmber ? 800 : ((starter && isMLB) ? 800 : 700), 
            color: isAmber ? "#fde68a" : ((starter && isMLB) ? "#fde68a" : "#cbd5e1"), 
            fontFamily: "'Barlow Condensed', sans-serif",
            wordBreak: "break-word",
          }}>
            {name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {jersey && (
              <span style={{
                padding: "2px 6px", borderRadius: 3,
                background: isAmber ? "rgba(234, 179, 8, 0.2)" : "#141820", 
                border: isAmber ? "1px solid rgba(234, 179, 8, 0.4)" : "1px solid #1e2530",
                fontSize: 8, fontWeight: 700, 
                color: isAmber ? "#fde68a" : "#94a3b8",
                fontFamily: "'DM Mono', monospace",
                minWidth: 20, textAlign: "center",
              }}>
                #{jersey}
              </span>
            )}
            <span style={{
              padding: "2px 8px", borderRadius: 4,
              background: isAmber ? "rgba(234, 179, 8, 0.2)" : "#141820", 
              border: isAmber ? "1px solid rgba(234, 179, 8, 0.4)" : "1px solid #1e2530",
              fontSize: 9, fontWeight: 700, 
              color: isAmber ? "#fde68a" : "#5b6e8c",
              fontFamily: "'DM Mono', monospace",
            }}>
              {position}
            </span>
          </div>
        </div>
        {starter && (isMLB || isProjectedStarter) && (
          <div style={{ fontSize: 8, color: "#eab308", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
            ★ STARTER
          </div>
        )}
      </div>
    );
  };

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
                {sport.toUpperCase()} ROSTERS
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
                <option value="mlb">MLB</option>
                <option value="nba">NBA</option>
                <option value="nfl">NFL</option>
                <option value="nhl">NHL</option>
                <option value="soccer">Soccer</option>
              </select>
              
              {/* 🔥 Toggle: Filter by Today's Games */}
              <button 
                onClick={() => setFilterByToday(!filterByToday)}
                disabled={games.length === 0}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: filterByToday ? "rgba(234, 179, 8, 0.2)" : "#0d1117",
                  border: filterByToday ? "1px solid rgba(234, 179, 8, 0.4)" : "1px solid #1e2530",
                  color: filterByToday ? "#eab308" : (games.length === 0 ? "#2e3748" : "#4a5568"),
                  fontSize: 11, fontWeight: 700, 
                  cursor: games.length === 0 ? "not-allowed" : "pointer",
                  fontFamily: "'DM Mono', monospace",
                  opacity: games.length === 0 ? 0.5 : 1,
                }}
                title={games.length === 0 ? "No games fetched - showing all teams" : "Toggle filter by today's games"}
              >
                {filterByToday ? '✓ Today Only' : '📅 Filter by Today'}
              </button>
              
              {lastUpdated && <span style={{ fontSize: 10, color: "#2e3748" }}>Updated {lastUpdated}</span>}
              <button onClick={fetchLineups} disabled={loading} style={{
                padding: "6px 16px", borderRadius: 8,
                border: "1px solid #1e2530", background: "#0d1117",
                color: loading ? "#2e3748" : "#4a5568",
                fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>Refresh</span>
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#200000", border: "1px solid #8b0000", borderRadius: 8, color: "#ff4444", fontSize: 11 }}>
              Error: {error}
            </div>
          )}

          {debugInfo && (
            <div style={{ marginBottom: 16, padding: "8px 12px", background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, color: "#94a3b8", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
              {debugInfo}
            </div>
          )}

          {loading && teams.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #1e2530", borderTopColor: "#f5bc2f", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 12, animation: "pulse 2s ease infinite" }}>Loading {sport.toUpperCase()} rosters...</div>
            </div>
          )}

          {!loading && teams.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#4a5568" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                No roster data available for {sport.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: "#2e3748" }}>
                Run `sync_sport` or `get_lineups` in Admin to populate rosters.
              </div>
            </div>
          )}

          {/* Team Cards */}
          {teams.map((team, teamIdx) => (
            <div key={team.team || teamIdx} style={{
              background: "#0a0e14", border: "1px solid #1a2030",
              borderRadius: 14, padding: "20px 20px 24px", marginBottom: 24,
            }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "#e8d48b", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>
                      {team.team}
                    </span>
                    <LineupBadge confirmed={sport === 'mlb' ? false : undefined} />
                  </div>
                  <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif", marginLeft: 0, marginTop: 4, display: "block" }}>
                    {team.team_name}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
                    {team.projected_starters.length} starters • {team.bench_depth.length} bench
                  </div>
                </div>
              </div>

              {/* PROJECTED STARTERS — AMBER THEME */}
              {team.projected_starters.length > 0 && (
                <>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: "#eab308", 
                    marginBottom: 10, 
                    fontFamily: "'Barlow Condensed', sans-serif", 
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <span style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(234, 179, 8, 0.15)",
                      border: "1px solid rgba(234, 179, 8, 0.3)",
                      fontSize: 9
                    }}>★</span>
                    PROJECTED STARTERS
                  </div>
                  
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
                    gap: 10, 
                    marginBottom: 24,
                    padding: "12px",
                    background: "rgba(234, 179, 8, 0.04)",
                    border: "1px dashed rgba(234, 179, 8, 0.2)",
                    borderRadius: 8
                  }}>
                    {team.projected_starters.map((player, playerIdx) => (
                      <PlayerCard 
                        key={player.player_id || `${player.name}-${playerIdx}`} 
                        player={player} 
                        isStarter={true}
                        isProjectedStarter={true}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* BENCH — Standard dark theme */}
              {team.bench_depth.length > 0 && (
                <>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: "#64748b", 
                    marginBottom: 10, 
                    fontFamily: "'Barlow Condensed', sans-serif", 
                    letterSpacing: "0.05em" 
                  }}>
                    BENCH / RESERVES
                  </div>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
                    gap: 10 
                  }}>
                    {team.bench_depth.map((player, playerIdx) => (
                      <PlayerCard 
                        key={player.player_id || `${player.name}-${playerIdx}`} 
                        player={player} 
                        isStarter={false}
                        isProjectedStarter={false}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}

          <div style={{ marginTop: 16, padding: "12px 16px", background: "#0a0e14", borderRadius: 8, border: "1px solid #1a2030", fontSize: 9, color: "#2e3748", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
            {filterByToday && games.length > 0 
              ? `Showing ${teams.length} teams playing today • Click "Filter by Today" to show all`
              : `Showing all ${teams.length} teams • Click "Filter by Today" to see only today's games`}
          </div>
        </div>
      </div>
    </>
  );
}
