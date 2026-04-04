// src/lib/liveData.ts
// Multi-sport data sync from ESPN to Supabase

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// Sport configurations
const SPORTS_CONFIG = {
  nba: {
    path: "basketball/nba",
    name: "NBA",
  },
  nfl: {
    path: "football/nfl",
    name: "NFL",
  },
  mlb: {
    path: "baseball/mlb",
    name: "MLB",
  },
  nhl: {
    path: "hockey/nhl",
    name: "NHL",
  },
  soccer: {
    path: "soccer/eng.1",
    name: "Soccer",
  },
};

// ───────────────────────────────
// TEAMS (All Sports)
// ───────────────────────────────
export async function syncTeams(sport: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  console.log(`🔄 Fetching ${config.name} teams...`);
  
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams`
  );
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
    body: JSON.stringify({
      operation: "teams",
      data: teams
    })
  });

  const result = await save.json();
  console.log(`💾 Saved ${config.name} teams:`, result);
  return result;
}

// ───────────────────────────────
// PLAYERS (All Sports)
// ───────────────────────────────
export async function syncPlayers(sport: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  console.log(`🔄 Fetching ${config.name} teams first...`);
  
  // First get all teams
  const teamsRes = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams`
  );
  const teamsJson = await teamsRes.json();
  const teams = teamsJson.sports?.[0]?.leagues?.[0]?.teams || [];
  
  console.log(`📋 Found ${teams.length} teams for ${config.name}`);
  
  let allPlayers: any[] = [];

  for (const t of teams) {
    try {
      const rosterRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams/${t.team.id}/roster`
      );
      const rosterJson = await rosterRes.json();
      
      // ESPN returns athletes in different formats
      const athletes = rosterJson.athletes?.flatMap((g: any) => g.items || []) || 
                      rosterJson.athletes || 
                      [];

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
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`Error fetching roster for team ${t.team.id}:`, e);
    }
  }

  console.log(`✅ ${config.name} players fetched: ${allPlayers.length}`);

  // Save in batches to avoid overwhelming the edge function
  const batchSize = 500;
  for (let i = 0; i < allPlayers.length; i += batchSize) {
    const batch = allPlayers.slice(i, i + batchSize);
    const save = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "players",
        data: batch
      })
    });
    const result = await save.json();
    console.log(`💾 Saved ${config.name} players batch ${i / batchSize + 1}:`, result);
  }

  return { players_fetched: allPlayers.length };
}

// ───────────────────────────────
// GAMES (All Sports)
// ───────────────────────────────
export async function syncGames(sport: string, date?: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  const targetDate = date || new Date().toISOString().split('T')[0];
  const formattedDate = targetDate.replace(/-/g, '');
  
  console.log(`🔄 Fetching ${config.name} games for ${targetDate}...`);
  
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard?dates=${formattedDate}`
  );
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
    body: JSON.stringify({
      operation: "games",
      data: games
    })
  });

  const result = await save.json();
  console.log(`💾 Saved ${config.name} games:`, result);
  return result;
}

// ───────────────────────────────
// LIVE SCORES (Update current games)
// ───────────────────────────────
export async function syncLiveScores(sport: string) {
  const config = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
  if (!config) throw new Error(`Unknown sport: ${sport}`);

  console.log(`🔄 Fetching live ${config.name} scores...`);
  
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard`
  );
  const json = await res.json();

  const games = json.events?.map((g: any) => {
    const competition = g.competitions?.[0];
    const home = competition?.competitors?.find((c: any) => c.homeAway === 'home');
    const away = competition?.competitors?.find((c: any) => c.homeAway === 'away');
    
    return {
      external_id: g.id,
      sport: sport,
      status: g.status?.type?.name || "upcoming",
      home_score: parseInt(home?.score || '0'),
      away_score: parseInt(away?.score || '0'),
      current_period: competition?.status?.period || null,
      time_remaining: competition?.status?.displayClock || null,
    };
  }) || [];

  // Filter to only games that have changed or are live
  const liveGames = games.filter((g: any) => g.status === 'live' || g.status === 'STATUS_IN_PROGRESS');
  
  console.log(`✅ ${config.name} live games: ${liveGames.length}`);

  for (const game of liveGames) {
    const save = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "games",
        data: [game]
      })
    });
    await save.json();
  }

  return { live_games_updated: liveGames.length };
}

// ───────────────────────────────
// SYNC EVERYTHING FOR A SPORT
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
    
    // Wait between sports to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("\n✅ All sports sync complete!");
  console.table(results);
  return results;
}

// ───────────────────────────────
// QUICK SYNC (Teams + Games only, faster)
// ───────────────────────────────
export async function quickSync(sport: string) {
  console.log(`⚡ Quick syncing ${sport.toUpperCase()} (teams + games)...`);
  
  await syncTeams(sport);
  await syncGames(sport);
  
  console.log(`✅ Quick sync complete for ${sport.toUpperCase()}`);
}

// ───────────────────────────────
// UPDATE LIVE SCORES FOR ALL SPORTS
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
