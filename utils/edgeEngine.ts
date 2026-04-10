// 🔥 SAFE STAT GETTER (handles missing data)
export const getStat = (g: any, type: string): number => {
  if (!g) return 0;

  const pts = g.points || 0;
  const reb = g.rebounds || 0;
  const ast = g.assists || 0;

  switch (type) {
    case "points": return pts;
    case "rebounds": return reb;
    case "assists": return ast;
    case "pr": return pts + reb;
    case "ra": return reb + ast;
    case "pra": return pts + reb + ast;
    default: return 0;
  }
};

// 🔥 GENERIC AVERAGE FUNCTION
export const avg = (games: any[], type: string, n: number): number => {
  if (!games || games.length === 0) return 0;

  const slice = games.slice(0, n);
  if (slice.length === 0) return 0;

  const total = slice.reduce((sum, g) => sum + getStat(g, type), 0);
  return total / slice.length;
};

// 🔥 TRUE LINE (WEIGHTED PROJECTION)
export const getTrueLine = (games: any[], type: string): number => {
  if (!games || games.length === 0) return 0;

  const l5 = avg(games, type, 5);
  const l10 = avg(games, type, 10);
  const l15 = avg(games, type, 15);
  const l20 = avg(games, type, 20);

  // Weighted toward recent games
  const trueLine = (l5 * 0.4) + (l10 * 0.3) + (l15 * 0.2) + (l20 * 0.1);

  return Number(trueLine.toFixed(2));
};

// 🔥 HIT RATE (OVER %)
export const getHitRate = (
  games: any[],
  type: string,
  line: number,
  n: number
): number => {
  if (!games || games.length === 0) return 0;

  const slice = games.slice(0, n);
  if (slice.length === 0) return 0;

  const hits = slice.filter(g => getStat(g, type) > line).length;
  const rate = (hits / slice.length) * 100;

  return Number(rate.toFixed(1));
};

// 🔥 EDGE CALCULATION
export const getEdge = (trueLine: number, line: number): number => {
  if (!trueLine || !line) return 0;
  return Number((trueLine - line).toFixed(2));
};

// 🔥 OPTIONAL: CONFIDENCE SCORE (VERY POWERFUL)
export const getConfidence = (
  edge: number,
  l5: number,
  l10: number,
  l15: number
): number => {
  // weighted confidence formula
  const score =
    (edge * 2) +
    (l5 * 0.4) +
    (l10 * 0.35) +
    (l15 * 0.25);

  // clamp between 0–100
  return Math.max(0, Math.min(100, Number(score.toFixed(0))));
};
