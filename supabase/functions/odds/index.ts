import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Only accept POST (or GET if you prefer)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Parse request body
  let sport = "basketball_nba";
  let region = "us";
  try {
    const body = await req.json();
    sport = body.sport || sport;
    region = body.region || region;
  } catch {
    // no body – use defaults
  }

  const API_KEY = Deno.env.get("ODDS_API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Missing ODDS_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Build correct URL for odds-api.io (not the-odds-api.com)
  //    Adjust endpoint according to their actual documentation.
  const url = `https://api.odds-api.io/v3/odds?apiKey=${API_KEY}&sport=${sport}&region=${region}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Odds API returned ${res.status}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
