// supabase/functions/clever-action/index.ts
// ... (all previous imports, helpers, etc. unchanged up to getPlayerDetails)

// ── GET PLAYER DETAILS for the detail view (ENHANCED) ────────────────────
async function getPlayerDetails(sb: any, sport: string, playerId: string) {
  // Fetch player info
  const { data: player, error: playerError } = await sb
    .from('players')
    .select('id,full_name,position,team_id,teams:team_id(name,abbreviation)')
    .eq('id', playerId).eq('sport', sport).single();
  if (playerError || !player) throw new Error('Player not found');

  // Fetch all game logs for this player (ordered newest first)
  const { data: allStats } = await sb
    .from('player_game_stats')
    .select('*')
    .eq('player_id', playerId).eq('sport', sport)
    .order('game_date', { ascending: false });
  if (!allStats) throw new Error('No stats found');

  // Define the list of all possible props for this sport (single + combos)
  const statFields = STAT_FIELDS[sport] || [];
  const combos = COMBOS[sport] || [];

  // Build a map of prop key -> data
  const allProps: Record<string, any> = {};

  // Helper to compute rolling averages and hit rates for a given stat values array
  const computePropData = (values: number[], label: string) => {
    const l5 = values.slice(0,5);
    const l10 = values.slice(0,10);
    const l15 = values.slice(0,15);
    const l20 = values.slice(0,20);
    const avg5 = l5.length ? l5.reduce((a,b)=>a+b,0)/l5.length : 0;
    const avg10 = l10.length ? l10.reduce((a,b)=>a+b,0)/l10.length : 0;
    const avg15 = l15.length ? l15.reduce((a,b)=>a+b,0)/l15.length : 0;
    const avg20 = l20.length ? l20.reduce((a,b)=>a+b,0)/l20.length : 0;
    const avgL10 = Math.round(avg10 * 10)/10;
    const line = Math.round(avgL10 * 2) / 2; // initial line = rounded avg L10
    const hitRate = (vals: number[], lineVal: number) => {
      if (!vals.length) return null;
      return Math.round(vals.filter(v => v >= lineVal).length / vals.length * 100);
    };
    return {
      label,
      values: values,           // raw values for mini game log
      line: line,
      avg_l10: avgL10,
      avg_l5: Math.round(avg5 * 10)/10,
      avg_l15: Math.round(avg15 * 10)/10,
      avg_l20: Math.round(avg20 * 10)/10,
      l5: hitRate(l5, line),
      l10: hitRate(l10, line),
      l15: hitRate(l15, line),
      l20: hitRate(l20, line),
      trend: avg5 > avg20 * 1.05 ? 'up' : avg5 < avg20 * 0.95 ? 'down' : 'stable',
    };
  };

  // For each single stat field (points, rebounds, etc.)
  for (const field of statFields) {
    const values = allStats.map(g => Number(g[field] ?? 0));
    if (values.length === 0) continue;
    // Use the pretty label from COMBOS or fallback
    let label = field.replace(/^player_/, '').replace(/_/g, ' ').toUpperCase();
    // Special handling for some fields
    if (field === 'three_pointers_made') label = '3PM';
    if (field === 'assists_hockey') label = 'AST';
    if (field === 'goals_soccer') label = 'G';
    if (field === 'assists_soccer') label = 'A';
    if (field === 'shots_soccer') label = 'Shots';
    allProps[field] = computePropData(values, label);
  }

  // For each combo prop (PRA, P+R, etc.)
  for (const combo of combos) {
    const values = allStats.map(g =>
      combo.fields.reduce((acc, f) => acc + Number(g[f] ?? 0), 0)
    );
    if (values.length === 0) continue;
    // Use the name from the combo definition
    allProps[combo.name] = computePropData(values, combo.name);
  }

  // Also compute the game dates (for reference)
  const gameDates = allStats.map(g => g.game_date);

  return {
    player_id: player.id,
    full_name: player.full_name,
    team: player.teams?.abbreviation,
    position: player.position,
    sport,
    games_logged: allStats.length,
    all_props: allProps,    // ← this is what the frontend expects
    stats: {
      points: allStats.map(g => g.points || 0).reverse(),
      rebounds: allStats.map(g => g.rebounds || 0).reverse(),
      assists: allStats.map(g => g.assists || 0).reverse(),
      game_dates: gameDates.reverse(),
    },
  };
}

// ... rest of the edge function (same as before, with all other cases)
