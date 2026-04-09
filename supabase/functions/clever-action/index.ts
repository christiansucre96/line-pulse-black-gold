import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

// ---------- ESPN Helpers ----------
const ESPN_PATH: Record<string, string> = {
  nba: "basketball/nba",
  nfl: "football/nfl",
  mlb: "baseball/mlb",
  nhl: "hockey/nhl",
  soccer: "soccer/eng.1",
};

async function fetchESPN(url: string, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise(r => setTimeout(r, 500 * i));
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });
      if (res.ok) return await res.json();
    } catch { /* ignore */ }
  }
  throw new Error(`ESPN fetch failed: ${url}`);
}

async function fetchGamesForRange(sport: string, daysAhead = 2) {
  const today = new Date();
  const dates = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  const games = [];
  for (const date of dates) {
    const fmt = date.replace(/-/g, "");
    const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/scoreboard?dates=${fmt}`;
    try {
      const data = await fetchESPN(url);
      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0];
        const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
        const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
        games.push({
          id: ev.id,
          home_team_id: home?.team?.id,
          away_team_id: away?.team?.id,
        });
      }
    } catch { /* ignore */ }
  }
  return games;
}

async function syncUpcoming(supabase: any, sport: string) {
  const games = await fetchGamesForRange(sport, 2);
  if (games.length === 0) return { teams: 0, players: 0 };

  const teamExtIds = new Set<string>();
  for (const g of games) {
    if (g.home_team_id) teamExtIds.add(g.home_team_id);
    if (g.away_team_id) teamExtIds.add(g.away_team_id);
  }

  for (const extId of teamExtIds) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${extId}`;
      const teamData = await fetchESPN(url);
      const team = teamData.team || teamData;
      await supabase.from("teams").upsert({
        external_id: String(team.id),
        sport,
        name: team.displayName,
        abbreviation: team.abbreviation,
      }, { onConflict: "sport,external_id" });
    } catch { /* ignore */ }
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, external_id")
    .eq("sport", sport)
    .in("external_id", Array.from(teamExtIds));
  const teamIdMap = new Map(teams?.map(t => [t.external_id, t.id]));

  let playersCount = 0;
  for (const extId of teamExtIds) {
    const teamId = teamIdMap.get(extId);
    if (!teamId) continue;
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${extId}/roster`;
      const data = await fetchESPN(url);
      const athletes = data.athletes || [];
      const flat = Array.isArray(athletes) ? athletes.flatMap((g: any) => g.items || [g]) : [];
      for (let idx = 0; idx < flat.length; idx++) {
        const a = flat[idx];
        await supabase.from("players").upsert({
          external_id: String(a.id),
          sport,
          full_name: a.fullName || a.displayName,
          position: a.position?.abbreviation || null,
          team_id: teamId,
          is_starter: idx < (sport === "soccer" ? 11 : sport === "nfl" ? 22 : 5),
        }, { onConflict: "sport,external_id" });
        playersCount++;
      }
    } catch { /* ignore */ }
  }
  return { teams: teamExtIds.size, players: playersCount };
}

// ---------- Odds-API.io Helpers ----------
const SPORT_MAP: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
  soccer: "soccer_epl",
};

const MARKETS = [
  "player_points", "player_rebounds", "player_assists",
  "player_points_rebounds", "player_points_assists", "player_rebounds_assists", "player_points_rebounds_assists",
  "player_passing_yards", "player_rushing_yards", "player_receiving_yards",
  "player_passing_tds", "player_rushing_tds", "player_receiving_tds",
  "player_strikeouts", "player_hits", "player_home_runs", "player_runs_batted_in",
  "player_goals", "player_assists", "player_points", "player_shots_on_goal",
  "player_goals", "player_assists", "player_shots", "player_shots_on_target"
];

async function fetchAllProps(sport: string, bookmaker: string) {
  const API_KEY = Deno.env.get("ODDS_API_KEY");
  if (!API_KEY) throw new Error("Missing ODDS_API_KEY");
  const oddsSport = SPORT_MAP[sport];
  if (!oddsSport) return [];
  const allProps = [];
  for (const market of MARKETS) {
    const url = `https://api.odds-api.io/v4/sports/${oddsSport}/odds/?apiKey=${API_KEY}&regions=us&markets=${market}&bookmakers=${bookmaker}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const event of data) {
        for (const bk of event.bookmakers || []) {
          if (bk.key !== bookmaker) continue;
          for (const mkt of bk.markets || []) {
            if (mkt.key === market) {
              for (const outcome of mkt.outcomes || []) {
                allProps.push({
                  sport,
                  event_id: event.id,
                  player_name: outcome.description,
                  player_id: outcome.id || null,
                  bookmaker: bk.key,
                  market_type: market,
                  line: outcome.point,
                  odds: outcome.price,
                  is_combo: market.includes("_") && !["player_points", "player_rebounds", "player_assists"].includes(market),
                  last_updated: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Error fetching ${market} for ${sport}:`, err);
    }
  }
  return allProps;
}

async function syncAllProps(supabase: any) {
  const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
  const bookmakers = ["Stake", "BetOnline"];
  const results = {};
  for (const sport of sports) {
    results[sport] = {};
    for (const bookmaker of bookmakers) {
      try {
        const props = await fetchAllProps(sport, bookmaker);
        if (props.length) {
          await supabase.from("player_props_cache").delete().eq("sport", sport).eq("bookmaker", bookmaker);
          const { error } = await supabase.from("player_props_cache").insert(props);
          if (error) throw error;
          results[sport][bookmaker] = { success: true, count: props.length };
        } else {
          results[sport][bookmaker] = { success: false, count: 0 };
        }
      } catch (err) {
        results[sport][bookmaker] = { success: false, error: err.message };
      }
    }
  }
  return results;
}

// ---------- Database read operations ----------
async function getPlayers(supabase: any, sport: string) {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, full_name, position, status, injury_description, is_starter, teams:team_id(name, abbreviation)")
    .eq("sport", sport)
    .limit(500);
  if (error) throw error;
  return players.map(p => ({
    id: p.id,
    name: p.full_name,
    position: p.position || "N/A",
    team: p.teams?.name || "Unknown",
    teamAbbr: p.teams?.abbreviation || "N/A",
    opponent: "TBD",
    status: p.status || "active",
    injury_description: p.injury_description,
    is_starter: p.is_starter || false,
  }));
}

async function getProps(supabase: any, sport: string, bookmaker: string, marketType?: string) {
  let query = supabase.from("player_props_cache").select("*").eq("sport", sport).eq("bookmaker", bookmaker);
  if (marketType) query = query.eq("market_type", marketType);
  const { data, error } = await query.order("last_updated", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getPlayerDetails(supabase: any, playerId: string) {
  const { data: player, error } = await supabase
    .from("players")
    .select("id, full_name, position, status, injury_description, is_starter, teams:team_id(name, abbreviation, logo_url)")
    .eq("id", playerId)
    .single();
  if (error) throw error;
  const { data: props, error: propsError } = await supabase
    .from("player_props_cache")
    .select("*")
    .eq("player_name", player.full_name)
    .order("last_updated", { ascending: false });
  if (propsError) console.warn("Props error:", propsError);
  return { ...player, props: props || [] };
}

// ---------- Main handler ----------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    let { operation, sport, bookmaker, market, player_id } = body;

    if (!operation && sport) operation = "get_players";

    switch (operation) {
      case "get_players":
        const players = await getPlayers(supabase, sport);
        return new Response(JSON.stringify({ success: true, players, count: players.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "get_props":
        if (!bookmaker) bookmaker = "Stake";
        const props = await getProps(supabase, sport, bookmaker, market);
        return new Response(JSON.stringify({ success: true, props, count: props.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "get_player_details":
        if (!player_id) throw new Error("Missing player_id");
        const details = await getPlayerDetails(supabase, player_id);
        return new Response(JSON.stringify({ success: true, player: details }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "sync_upcoming":
        if (!sport) throw new Error("Missing sport");
        const syncResult = await syncUpcoming(supabase, sport);
        return new Response(JSON.stringify({ success: true, ...syncResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      case "sync_props":
        const allResults = await syncAllProps(supabase);
        return new Response(JSON.stringify({ success: true, results: allResults }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      default:
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
