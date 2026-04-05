// src/lib/liveData.ts
// Multi-sport data sync from ESPN to Supabase

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Sport configurations
const SPORTS_CONFIG = {
  nba: { path: "basketball/nba", name: "NBA" },
  nfl: { path: "football/nfl", name: "NFL" },
  mlb: { path: "baseball/mlb", name: "MLB" },
  nhl: { path: "hockey/nhl", name: "NHL" },
  soccer: { path: "soccer/eng.1", name: "Soccer" },
};

// ───────────────────────────────
// TEAMS
// ───────────────────────────────
export async function syncTeams(sport: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  console.log(`🔄 Fetching ${config.name} teams...`);
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams`);
  const json = await res.json();

  const teams = json.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => ({
    external_id: t.team.id,
    sport: sport,
    name: t.team.displayName,
    abbreviation: t.team.abbreviation,
    city: t.team.location || null,
    logo_url: t.team.logos?.[0]?.href || null,
  })) || [];

  console.log(`✅ ${config.name} teams fetched: ${teams.length}`);
  const save = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "teams", data: teams })
  });
  const result = await save.json();
  console.log(`💾 Saved ${config.name} teams:`, result);
  return result;
}

// ───────────────────────────────
// PLAYERS
// ───────────────────────────────
export async function syncPlayers(sport: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  const teamsRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams`);
  const teamsJson = await teamsRes.json();
  const teams = teamsJson.sports?.[0]?.leagues?.[0]?.teams || [];

  console.log(`📋 Found ${teams.length} teams for ${config.name}`);
  let allPlayers: any[] = [];

  for (const t of teams) {
    try {
      const rosterRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams/${t.team.id}/roster`);
      const rosterJson = await rosterRes.json();
      const athletes = rosterJson.athletes?.flatMap((g: any) => g.items || []) || rosterJson.athletes || [];
      for (const a of athletes) {
        allPlayers.push({
          external_id: a.id,
          sport: sport,
          full_name: a.fullName || a.displayName,
          first_name: a.firstName || null,
          last_name: a.lastName || null,
          position: a.position?.abbreviation || a.position?.name || null,
          jersey_number: a.jersey || null,
          headshot_url: a.headshot?.href || null,
        });
      }
      await new Promise(r => setTimeout(r, 100));
    } catch (e) { console.error(`Error fetching roster for team ${t.team.id}:`, e); }
  }

  console.log(`✅ ${config.name} players fetched: ${allPlayers.length}`);
  const batchSize = 500;
  for (let i = 0; i < allPlayers.length; i += batchSize) {
    const batch = allPlayers.slice(i, i + batchSize);
    const save = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "players", data: batch })
    });
    const result = await save.json();
    console.log(`💾 Saved ${config.name} players batch ${i / batchSize + 1}:`, result);
  }
  return { players_fetched: allPlayers.length };
}

// ───────────────────────────────
// GAMES
// ───────────────────────────────
export async function syncGames(sport: string, date?: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  const targetDate = date || new Date().toISOString().split('T')[0];
  const formattedDate = targetDate.replace(/-/g, '');
  console.log(`🔄 Fetching ${config.name} games for ${targetDate}...`);
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard?dates=${formattedDate}`);
  const json = await res.json();

  const games = json.events?.map((g: any) => ({
    external_id: g.id,
    sport: sport,
    game_date: targetDate,
    start_time: g.date,
    status: g.status?.type?.name || "upcoming",
    home_score: 0,
    away_score: 0,
    current_period: null,
    time_remaining: null,
    venue: g.competitions?.[0]?.venue?.fullName || null,
  })) || [];

  console.log(`✅ ${config.name} games fetched: ${games.length}`);
  const save = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "games", data: games })
  });
  const result = await save.json();
  console.log(`💾 Saved ${config.name} games:`, result);
  return result;
}

// ───────────────────────────────
// 🔥 NEW: PLAYER STATS (NBA example – works for finished games)
// ───────────────────────────────
export async function syncNBAStats() {
  console.log("🏀 Fetching NBA player stats...");

  // Get today's scoreboard (or any date with finished games)
  const scoreboardRes = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
  const scoreboard = await scoreboardRes.json();
  const events = scoreboard.events || [];

  let allStats: any[] = [];

  for (const event of events) {
    const gameId = event.id;
    const status = event.status?.type?.name;
    // Only finished games have complete box scores
    if (status !== "STATUS_FINAL") continue;

    const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`);
    if (!summaryRes.ok) continue;
    const summary = await summaryRes.json();

    const boxscore = summary.boxscore?.players || [];
    for (const teamBox of boxscore) {
      for (const statGroup of teamBox.statistics || []) {
        const labels: string[] = statGroup.labels || [];
        for (const athlete of statGroup.athletes || []) {
          const rawStats = athlete.stats || [];
          const playerName = athlete.athlete?.displayName;

          const stat: any = {
            game_id: gameId,
            player_name: playerName,
            sport: "nba",
            game_date: event.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          };

          labels.forEach((label: string, idx: number) => {
            const val = rawStats[idx];
            if (label === "PTS") stat.points = parseInt(val) || 0;
            if (label === "REB") stat.rebounds = parseInt(val) || 0;
            if (label === "AST") stat.assists = parseInt(val) || 0;
            if (label === "STL") stat.steals = parseInt(val) || 0;
            if (label === "BLK") stat.blocks = parseInt(val) || 0;
            if (label === "TO") stat.turnovers = parseInt(val) || 0;
            if (label === "MIN") stat.minutes_played = parseFloat(val) || 0;
          });

          if (playerName && (stat.points !== undefined || stat.rebounds !== undefined)) {
            allStats.push(stat);
          }
        }
      }
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }

  console.log(`📊 Fetched ${allStats.length} player stats`);

  // Send to edge function in batches
  for (let i = 0; i < allStats.length; i += 200) {
    const batch = allStats.slice(i, i + 200);
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "stats", data: batch })
    });
    const result = await res.json();
    console.log(`  Batch ${Math.floor(i/200)+1}: ${result.inserted} stats saved`);
  }

  console.log("✅ NBA stats sync complete!");
}

// ───────────────────────────────
// SYNC EVERYTHING FOR A SPORT (teams + players + games)
// ───────────────────────────────
export async function syncSport(sport: string) {
  console.log(`🔥 Syncing ${sport.toUpperCase()} data...`);
  try {
    await syncTeams(sport);
    await syncPlayers(sport);
    await syncGames(sport);
    console.log(`✅ ${sport.toUpperCase()} sync complete!`);
    return { success: true, sport };
  } catch (error: any) {
    console.error(`❌ ${sport.toUpperCase()} sync failed:`, error.message);
    return { success: false, sport, error: error.message };
  }
}

// ───────────────────────────────
// SYNC ALL SPORTS
// ───────────────────────────────
export async function syncAllSports() {
  console.log("🚀 Starting sync for all sports...");
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const results = [];
  for (const sport of sports) {
    console.log(`\n📦 Syncing ${sport.toUpperCase()}...`);
    const result = await syncSport(sport);
    results.push(result);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("\n✅ All sports sync complete!");
  console.table(results);
  return results;
}

// ───────────────────────────────
// QUICK SYNC (teams + games only)
// ───────────────────────────────
export async function quickSync(sport: string) {
  console.log(`⚡ Quick syncing ${sport.toUpperCase()} (teams + games)...`);
  await syncTeams(sport);
  await syncGames(sport);
  console.log(`✅ Quick sync complete for ${sport.toUpperCase()}`);
}

// ───────────────────────────────
// UPDATE LIVE SCORES
// ───────────────────────────────
export async function updateAllLiveScores() {
  console.log("🕐 Updating live scores for all sports...");
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const results = [];
  for (const sport of sports) {
    const result = await syncLiveScores(sport);
    results.push(result);
  }
  return results;
}
