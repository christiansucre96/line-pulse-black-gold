export type Sport = "NBA" | "NHL" | "MLB" | "NFL" | "Soccer";

export type StatCategory = string;

export const sportCategories: Record<Sport, { core: string[]; combos: string[] }> = {
  NBA: {
    core: ["Points", "Rebounds", "Assists", "Steals", "Blocks", "Turnovers", "3PT Made"],
    combos: ["Pts+Rebs", "Pts+Asts", "Rebs+Asts", "PRA", "Double Double", "Triple Double"],
  },
  MLB: {
    core: ["Hits", "Runs", "RBIs", "Total Bases", "Strikeouts", "Hits Allowed"],
    combos: ["Hits+Runs+RBIs", "Total Bases Ladder"],
  },
  NHL: {
    core: ["Shots on Goal", "Goals", "Assists", "Points"],
    combos: ["Goals+Assists", "Alt Shots Ladder"],
  },
  Soccer: {
    core: ["Shots", "Shots on Target", "Goals", "Assists", "Passes"],
    combos: ["Goal+Assist", "Shots Ladder"],
  },
  NFL: {
    core: ["Pass Yards", "Rush Yards", "Rec Yards", "Touchdowns"],
    combos: ["Pass+Rush Yds", "Rush+Rec Yds", "Anytime TD"],
  },
};

// Sport-specific stat tabs for the detail view
export const sportDetailTabs: Record<Sport, { key: string; label: string }[]> = {
  NBA: [
    { key: "pts", label: "PTS" }, { key: "rebs", label: "REBS" }, { key: "asts", label: "ASTS" },
    { key: "stl", label: "STL" }, { key: "blks", label: "BLKS" }, { key: "tov", label: "TOV" }, { key: "threes", label: "3PM" },
    { key: "pa", label: "PA" }, { key: "pr", label: "PR" }, { key: "ra", label: "RA" }, { key: "pra", label: "PRA" },
  ],
  MLB: [
    { key: "hits", label: "HITS" }, { key: "runs", label: "RUNS" }, { key: "rbis", label: "RBIs" },
    { key: "tb", label: "TB" }, { key: "so", label: "SO" }, { key: "ha", label: "HA" },
    { key: "hrr", label: "H+R+RBI" },
  ],
  NHL: [
    { key: "sog", label: "SOG" }, { key: "goals", label: "GOALS" }, { key: "assists", label: "ASTS" },
    { key: "points", label: "PTS" }, { key: "ga", label: "G+A" },
  ],
  Soccer: [
    { key: "shots", label: "SHOTS" }, { key: "sot", label: "SOT" }, { key: "goals", label: "GOALS" },
    { key: "assists", label: "ASTS" }, { key: "passes", label: "PASS" }, { key: "ga", label: "G+A" },
  ],
  NFL: [
    { key: "passYds", label: "PASS" }, { key: "rushYds", label: "RUSH" }, { key: "recYds", label: "REC" },
    { key: "tds", label: "TD" }, { key: "prYds", label: "P+R" }, { key: "rrYds", label: "RU+RE" },
  ],
};

// Gamelog column headers per sport
export const sportGamelogColumns: Record<Sport, string[]> = {
  NBA: ["Opponent", "Date", "Pts", "Rebs", "Asts", "Stl", "Blks", "TOV", "3PM", "PA", "PR", "RA", "PRA"],
  MLB: ["Opponent", "Date", "Hits", "Runs", "RBIs", "TB", "SO", "HA", "H+R+RBI"],
  NHL: ["Opponent", "Date", "SOG", "Goals", "Asts", "Pts", "G+A"],
  Soccer: ["Opponent", "Date", "Shots", "SOT", "Goals", "Asts", "Passes", "G+A"],
  NFL: ["Opponent", "Date", "PassYds", "RushYds", "RecYds", "TD", "P+R", "RU+RE"],
};

// Keys matching gamelog columns (excluding opponent/date)
export const sportGamelogKeys: Record<Sport, string[]> = {
  NBA: ["pts", "rebs", "asts", "stl", "blks", "tov", "threes", "pa", "pr", "ra", "pra"],
  MLB: ["hits", "runs", "rbis", "tb", "so", "ha", "hrr"],
  NHL: ["sog", "goals", "assists", "points", "ga"],
  Soccer: ["shots", "sot", "goals", "assists", "passes", "ga"],
  NFL: ["passYds", "rushYds", "recYds", "tds", "prYds", "rrYds"],
};

export interface PlayerProp {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  initials: string;
  avgL10: number;
  diff: number;
  l5: number;
  l10: number;
  l15: number;
  streak: number;
  categories: string[];
  sport: Sport;
}

export interface GameLog {
  opponent: string;
  date: string;
  [key: string]: string | number;
}

export interface PlayerDetail {
  id: string;
  name: string;
  position: string;
  team: string;
  initials: string;
  season: string;
  sport: Sport;
  maxStats: { label: string; value: number }[];
  matchesPlayed: number;
  gameLogs: GameLog[];
}

// ─── NBA Players ───
const nbaPlayers: PlayerProp[] = [
  { id: "n1", name: "Rudy Gobert", position: "C", team: "MIN", opponent: "LAL", initials: "RG", avgL10: 35.2, diff: 15.7, l5: 80, l10: 90, l15: 80, streak: 3, categories: ["PRA", "Rebounds"], sport: "NBA" },
  { id: "n2", name: "Al Horford", position: "C-F", team: "BOS", opponent: "ORL", initials: "AH", avgL10: 23.7, diff: 13.2, l5: 100, l10: 100, l15: 100, streak: 15, categories: ["Points", "Rebounds"], sport: "NBA" },
  { id: "n3", name: "Payton Pritchard", position: "G", team: "BOS", opponent: "ORL", initials: "PP", avgL10: 24.2, diff: 12.7, l5: 100, l10: 100, l15: 100, streak: 15, categories: ["Points", "Assists", "3PT Made"], sport: "NBA" },
  { id: "n4", name: "Ja Morant", position: "G", team: "MEM", opponent: "OKC", initials: "JM", avgL10: 39.8, diff: 12.3, l5: 100, l10: 100, l15: 100, streak: 19, categories: ["PRA", "Points", "Assists"], sport: "NBA" },
  { id: "n5", name: "Nikola Jokic", position: "C", team: "DEN", opponent: "LAC", initials: "NJ", avgL10: 55.2, diff: 11.7, l5: 60, l10: 80, l15: 80, streak: 1, categories: ["PRA", "Triple Double", "Assists"], sport: "NBA" },
  { id: "n6", name: "Christian Braun", position: "G", team: "DEN", opponent: "LAC", initials: "CB", avgL10: 27.5, diff: 12.0, l5: 80, l10: 90, l15: 93.3, streak: 0, categories: ["Pts+Rebs", "Points"], sport: "NBA" },
  { id: "n7", name: "Kristaps Porzingis", position: "F-C", team: "BOS", opponent: "ORL", initials: "KP", avgL10: 30.4, diff: 11.9, l5: 80, l10: 90, l15: 86.7, streak: 0, categories: ["Points", "Blocks", "Rebounds"], sport: "NBA" },
  { id: "n8", name: "OG Anunoby", position: "F-G", team: "NYK", opponent: "DET", initials: "OA", avgL10: 32.3, diff: 11.8, l5: 100, l10: 100, l15: 86.7, streak: 13, categories: ["Pts+Asts", "Steals"], sport: "NBA" },
  { id: "n9", name: "LeBron James", position: "F", team: "LAL", opponent: "MIN", initials: "LJ", avgL10: 34.1, diff: 8.6, l5: 80, l10: 70, l15: 73.3, streak: 2, categories: ["Points", "Assists", "PRA"], sport: "NBA" },
  { id: "n10", name: "Stephen Curry", position: "G", team: "GSW", opponent: "SAC", initials: "SC", avgL10: 31.2, diff: 2.7, l5: 60, l10: 60, l15: 53.3, streak: 0, categories: ["3PT Made", "Points"], sport: "NBA" },
  { id: "n11", name: "Anthony Davis", position: "F-C", team: "LAL", opponent: "MIN", initials: "AD", avgL10: 29.8, diff: 5.3, l5: 80, l10: 70, l15: 66.7, streak: 1, categories: ["Points", "Rebounds", "Blocks"], sport: "NBA" },
  { id: "n12", name: "Shai Gilgeous-Alexander", position: "G", team: "OKC", opponent: "MEM", initials: "SG", avgL10: 38.4, diff: 9.9, l5: 80, l10: 80, l15: 86.7, streak: 4, categories: ["Points", "Pts+Asts"], sport: "NBA" },
];

// ─── MLB Players ───
const mlbPlayers: PlayerProp[] = [
  { id: "m1", name: "Shohei Ohtani", position: "DH", team: "LAD", opponent: "SF", initials: "SO", avgL10: 3.1, diff: 1.6, l5: 80, l10: 90, l15: 80, streak: 4, categories: ["Total Bases", "Hits", "RBIs"], sport: "MLB" },
  { id: "m2", name: "Aaron Judge", position: "RF", team: "NYY", opponent: "BOS", initials: "AJ", avgL10: 2.8, diff: 1.3, l5: 80, l10: 80, l15: 73.3, streak: 3, categories: ["Total Bases", "Runs", "RBIs"], sport: "MLB" },
  { id: "m3", name: "Mookie Betts", position: "SS", team: "LAD", opponent: "SF", initials: "MB", avgL10: 2.4, diff: 0.9, l5: 60, l10: 70, l15: 66.7, streak: 1, categories: ["Hits", "Runs", "Hits+Runs+RBIs"], sport: "MLB" },
  { id: "m4", name: "Freddie Freeman", position: "1B", team: "LAD", opponent: "SF", initials: "FF", avgL10: 2.2, diff: 0.7, l5: 80, l10: 70, l15: 73.3, streak: 2, categories: ["Hits", "RBIs"], sport: "MLB" },
  { id: "m5", name: "Gerrit Cole", position: "SP", team: "NYY", opponent: "BOS", initials: "GC", avgL10: 7.2, diff: 1.7, l5: 100, l10: 80, l15: 86.7, streak: 8, categories: ["Strikeouts", "Hits Allowed"], sport: "MLB" },
  { id: "m6", name: "Corbin Burnes", position: "SP", team: "BAL", opponent: "TB", initials: "CB", avgL10: 6.8, diff: 1.3, l5: 80, l10: 70, l15: 73.3, streak: 3, categories: ["Strikeouts", "Hits Allowed"], sport: "MLB" },
  { id: "m7", name: "Juan Soto", position: "LF", team: "NYM", opponent: "ATL", initials: "JS", avgL10: 2.5, diff: 1.0, l5: 80, l10: 80, l15: 80, streak: 5, categories: ["Total Bases", "Runs", "Hits"], sport: "MLB" },
  { id: "m8", name: "Bobby Witt Jr.", position: "SS", team: "KC", opponent: "CLE", initials: "BW", avgL10: 2.9, diff: 1.4, l5: 100, l10: 90, l15: 86.7, streak: 7, categories: ["Hits", "Total Bases", "Hits+Runs+RBIs"], sport: "MLB" },
];

// ─── NHL Players ───
const nhlPlayers: PlayerProp[] = [
  { id: "h1", name: "Connor McDavid", position: "C", team: "EDM", opponent: "LAK", initials: "CM", avgL10: 4.8, diff: 1.8, l5: 80, l10: 90, l15: 86.7, streak: 5, categories: ["Points", "Assists", "Goals+Assists"], sport: "NHL" },
  { id: "h2", name: "Nathan MacKinnon", position: "C", team: "COL", opponent: "DAL", initials: "NM", avgL10: 4.2, diff: 1.2, l5: 80, l10: 80, l15: 73.3, streak: 3, categories: ["Shots on Goal", "Points"], sport: "NHL" },
  { id: "h3", name: "Auston Matthews", position: "C", team: "TOR", opponent: "FLA", initials: "AM", avgL10: 4.5, diff: 1.5, l5: 100, l10: 80, l15: 80, streak: 6, categories: ["Goals", "Shots on Goal"], sport: "NHL" },
  { id: "h4", name: "Nikita Kucherov", position: "RW", team: "TB", opponent: "CAR", initials: "NK", avgL10: 3.9, diff: 0.9, l5: 60, l10: 70, l15: 66.7, streak: 1, categories: ["Points", "Assists"], sport: "NHL" },
  { id: "h5", name: "David Pastrnak", position: "RW", team: "BOS", opponent: "NYR", initials: "DP", avgL10: 4.1, diff: 1.1, l5: 80, l10: 80, l15: 80, streak: 4, categories: ["Goals", "Shots on Goal", "Points"], sport: "NHL" },
  { id: "h6", name: "Leon Draisaitl", position: "C", team: "EDM", opponent: "LAK", initials: "LD", avgL10: 3.7, diff: 0.7, l5: 60, l10: 70, l15: 73.3, streak: 2, categories: ["Goals+Assists", "Points"], sport: "NHL" },
];

// ─── Soccer Players ───
const soccerPlayers: PlayerProp[] = [
  { id: "s1", name: "Erling Haaland", position: "ST", team: "MCI", opponent: "ARS", initials: "EH", avgL10: 2.3, diff: 0.8, l5: 80, l10: 70, l15: 73.3, streak: 3, categories: ["Goals", "Shots on Target", "Shots"], sport: "Soccer" },
  { id: "s2", name: "Kylian Mbappé", position: "LW", team: "RMA", opponent: "BAR", initials: "KM", avgL10: 3.1, diff: 1.1, l5: 80, l10: 80, l15: 80, streak: 4, categories: ["Shots", "Goals", "Goal+Assist"], sport: "Soccer" },
  { id: "s3", name: "Mohamed Salah", position: "RW", team: "LIV", opponent: "CHE", initials: "MS", avgL10: 2.8, diff: 0.8, l5: 60, l10: 70, l15: 66.7, streak: 1, categories: ["Shots on Target", "Assists", "Goals"], sport: "Soccer" },
  { id: "s4", name: "Vinicius Jr.", position: "LW", team: "RMA", opponent: "BAR", initials: "VJ", avgL10: 2.5, diff: 0.5, l5: 60, l10: 60, l15: 60, streak: 0, categories: ["Shots", "Goals", "Assists"], sport: "Soccer" },
  { id: "s5", name: "Cole Palmer", position: "AM", team: "CHE", opponent: "LIV", initials: "CP", avgL10: 3.4, diff: 1.4, l5: 100, l10: 90, l15: 86.7, streak: 7, categories: ["Shots", "Goals", "Goal+Assist"], sport: "Soccer" },
];

// ─── NFL Players ───
const nflPlayers: PlayerProp[] = [
  { id: "f1", name: "Patrick Mahomes", position: "QB", team: "KC", opponent: "BUF", initials: "PM", avgL10: 285.3, diff: 35.3, l5: 80, l10: 80, l15: 73.3, streak: 3, categories: ["Pass Yards", "Touchdowns", "Pass+Rush Yds"], sport: "NFL" },
  { id: "f2", name: "Josh Allen", position: "QB", team: "BUF", opponent: "KC", initials: "JA", avgL10: 298.1, diff: 48.1, l5: 100, l10: 90, l15: 86.7, streak: 6, categories: ["Pass Yards", "Rush Yards", "Pass+Rush Yds"], sport: "NFL" },
  { id: "f3", name: "Derrick Henry", position: "RB", team: "BAL", opponent: "CIN", initials: "DH", avgL10: 98.4, diff: 18.4, l5: 80, l10: 70, l15: 73.3, streak: 2, categories: ["Rush Yards", "Touchdowns", "Anytime TD"], sport: "NFL" },
  { id: "f4", name: "Tyreek Hill", position: "WR", team: "MIA", opponent: "NYJ", initials: "TH", avgL10: 92.1, diff: 12.1, l5: 60, l10: 70, l15: 66.7, streak: 1, categories: ["Rec Yards", "Touchdowns"], sport: "NFL" },
  { id: "f5", name: "CeeDee Lamb", position: "WR", team: "DAL", opponent: "PHI", initials: "CL", avgL10: 88.7, diff: 8.7, l5: 80, l10: 70, l15: 73.3, streak: 3, categories: ["Rec Yards", "Rush+Rec Yds", "Anytime TD"], sport: "NFL" },
  { id: "f6", name: "Lamar Jackson", position: "QB", team: "BAL", opponent: "CIN", initials: "LJ", avgL10: 245.8, diff: 25.8, l5: 80, l10: 80, l15: 80, streak: 4, categories: ["Pass Yards", "Rush Yards", "Pass+Rush Yds"], sport: "NFL" },
];

export const mockPlayers: PlayerProp[] = [...nbaPlayers, ...mlbPlayers, ...nhlPlayers, ...soccerPlayers, ...nflPlayers];

// ─── Player Details per sport ───
const nbaDetails: Record<string, PlayerDetail> = {
  n1: {
    id: "n1", name: "Rudy Gobert", position: "C", team: "MIN", initials: "RG", season: "2024-25", sport: "NBA",
    maxStats: [{ label: "Points", value: 35 }, { label: "Rebounds", value: 25 }, { label: "Assists", value: 7 }, { label: "Steals", value: 5 }, { label: "Blocks", value: 6 }, { label: "3PM", value: 0 }],
    matchesPlayed: 73,
    gameLogs: [
      { opponent: "LAL", date: "04-19", pts: 2, rebs: 6, asts: 1, stl: 0, blks: 1, tov: 2, threes: 0, pa: 3, pr: 8, ra: 7, pra: 9 },
      { opponent: "UTA", date: "04-13", pts: 19, rebs: 18, asts: 0, stl: 1, blks: 4, tov: 1, threes: 0, pa: 19, pr: 37, ra: 18, pra: 37 },
      { opponent: "BKN", date: "04-11", pts: 35, rebs: 11, asts: 1, stl: 0, blks: 1, tov: 3, threes: 0, pa: 36, pr: 46, ra: 12, pra: 47 },
      { opponent: "MEM", date: "04-10", pts: 13, rebs: 8, asts: 4, stl: 0, blks: 0, tov: 1, threes: 0, pa: 17, pr: 21, ra: 12, pra: 25 },
      { opponent: "MIL", date: "04-08", pts: 6, rebs: 9, asts: 2, stl: 1, blks: 0, tov: 2, threes: 0, pa: 8, pr: 15, ra: 11, pra: 17 },
      { opponent: "PHI", date: "04-05", pts: 23, rebs: 19, asts: 2, stl: 2, blks: 3, tov: 0, threes: 0, pa: 25, pr: 42, ra: 21, pra: 44 },
      { opponent: "BKN", date: "04-03", pts: 21, rebs: 18, asts: 1, stl: 0, blks: 2, tov: 1, threes: 0, pa: 22, pr: 39, ra: 19, pra: 40 },
      { opponent: "DEN", date: "04-01", pts: 19, rebs: 12, asts: 1, stl: 0, blks: 1, tov: 2, threes: 0, pa: 20, pr: 31, ra: 13, pra: 32 },
      { opponent: "DET", date: "03-30", pts: 17, rebs: 13, asts: 1, stl: 1, blks: 2, tov: 0, threes: 0, pa: 18, pr: 30, ra: 14, pra: 31 },
      { opponent: "PHX", date: "03-28", pts: 17, rebs: 13, asts: 0, stl: 0, blks: 1, tov: 1, threes: 0, pa: 17, pr: 30, ra: 13, pra: 30 },
      { opponent: "IND", date: "03-24", pts: 16, rebs: 16, asts: 3, stl: 1, blks: 2, tov: 2, threes: 0, pa: 19, pr: 32, ra: 19, pra: 35 },
      { opponent: "CLE", date: "03-22", pts: 14, rebs: 11, asts: 2, stl: 0, blks: 3, tov: 1, threes: 0, pa: 16, pr: 25, ra: 13, pra: 27 },
      { opponent: "CHI", date: "03-20", pts: 18, rebs: 14, asts: 1, stl: 1, blks: 2, tov: 0, threes: 0, pa: 19, pr: 32, ra: 15, pra: 33 },
      { opponent: "WAS", date: "03-18", pts: 22, rebs: 15, asts: 0, stl: 0, blks: 4, tov: 1, threes: 0, pa: 22, pr: 37, ra: 15, pra: 37 },
      { opponent: "ATL", date: "03-16", pts: 11, rebs: 10, asts: 2, stl: 1, blks: 1, tov: 2, threes: 0, pa: 13, pr: 21, ra: 12, pra: 23 },
    ],
  },
};

const mlbDetails: Record<string, PlayerDetail> = {
  m1: {
    id: "m1", name: "Shohei Ohtani", position: "DH", team: "LAD", initials: "SO", season: "2025", sport: "MLB",
    maxStats: [{ label: "Hits", value: 4 }, { label: "Runs", value: 3 }, { label: "RBIs", value: 5 }, { label: "Total Bases", value: 12 }, { label: "HR", value: 2 }],
    matchesPlayed: 45,
    gameLogs: [
      { opponent: "SF", date: "04-19", hits: 2, runs: 1, rbis: 3, tb: 5, so: 0, ha: 0, hrr: 6 },
      { opponent: "ARI", date: "04-17", hits: 1, runs: 2, rbis: 1, tb: 4, so: 0, ha: 0, hrr: 4 },
      { opponent: "ARI", date: "04-16", hits: 3, runs: 1, rbis: 2, tb: 7, so: 0, ha: 0, hrr: 6 },
      { opponent: "SD", date: "04-14", hits: 0, runs: 0, rbis: 0, tb: 0, so: 0, ha: 0, hrr: 0 },
      { opponent: "SD", date: "04-13", hits: 2, runs: 1, rbis: 4, tb: 8, so: 0, ha: 0, hrr: 7 },
      { opponent: "COL", date: "04-11", hits: 1, runs: 1, rbis: 1, tb: 4, so: 0, ha: 0, hrr: 3 },
      { opponent: "COL", date: "04-10", hits: 3, runs: 2, rbis: 3, tb: 6, so: 0, ha: 0, hrr: 8 },
      { opponent: "CHC", date: "04-08", hits: 1, runs: 0, rbis: 0, tb: 1, so: 0, ha: 0, hrr: 1 },
      { opponent: "CHC", date: "04-07", hits: 2, runs: 1, rbis: 2, tb: 5, so: 0, ha: 0, hrr: 5 },
      { opponent: "MIN", date: "04-05", hits: 0, runs: 1, rbis: 0, tb: 0, so: 0, ha: 0, hrr: 1 },
      { opponent: "MIN", date: "04-04", hits: 1, runs: 0, rbis: 1, tb: 4, so: 0, ha: 0, hrr: 2 },
      { opponent: "ATL", date: "04-02", hits: 2, runs: 2, rbis: 5, tb: 9, so: 0, ha: 0, hrr: 9 },
      { opponent: "ATL", date: "04-01", hits: 1, runs: 1, rbis: 1, tb: 1, so: 0, ha: 0, hrr: 3 },
      { opponent: "TEX", date: "03-30", hits: 3, runs: 1, rbis: 2, tb: 5, so: 0, ha: 0, hrr: 6 },
      { opponent: "TEX", date: "03-29", hits: 2, runs: 0, rbis: 1, tb: 3, so: 0, ha: 0, hrr: 3 },
    ],
  },
};

const nhlDetails: Record<string, PlayerDetail> = {
  h1: {
    id: "h1", name: "Connor McDavid", position: "C", team: "EDM", initials: "CM", season: "2024-25", sport: "NHL",
    maxStats: [{ label: "Goals", value: 4 }, { label: "Assists", value: 5 }, { label: "Points", value: 7 }, { label: "SOG", value: 10 }],
    matchesPlayed: 78,
    gameLogs: [
      { opponent: "LAK", date: "04-19", sog: 5, goals: 1, assists: 2, points: 3, ga: 3 },
      { opponent: "VAN", date: "04-17", sog: 7, goals: 2, assists: 1, points: 3, ga: 3 },
      { opponent: "CGY", date: "04-15", sog: 3, goals: 0, assists: 3, points: 3, ga: 3 },
      { opponent: "SEA", date: "04-13", sog: 6, goals: 1, assists: 0, points: 1, ga: 1 },
      { opponent: "MIN", date: "04-11", sog: 4, goals: 0, assists: 2, points: 2, ga: 2 },
      { opponent: "WPG", date: "04-09", sog: 8, goals: 3, assists: 1, points: 4, ga: 4 },
      { opponent: "COL", date: "04-07", sog: 5, goals: 1, assists: 2, points: 3, ga: 3 },
      { opponent: "DAL", date: "04-05", sog: 4, goals: 0, assists: 1, points: 1, ga: 1 },
      { opponent: "STL", date: "04-03", sog: 6, goals: 2, assists: 2, points: 4, ga: 4 },
      { opponent: "NSH", date: "04-01", sog: 3, goals: 1, assists: 1, points: 2, ga: 2 },
      { opponent: "CHI", date: "03-30", sog: 9, goals: 4, assists: 1, points: 5, ga: 5 },
      { opponent: "ARI", date: "03-28", sog: 5, goals: 1, assists: 3, points: 4, ga: 4 },
      { opponent: "SJS", date: "03-26", sog: 7, goals: 2, assists: 0, points: 2, ga: 2 },
      { opponent: "ANA", date: "03-24", sog: 4, goals: 0, assists: 2, points: 2, ga: 2 },
      { opponent: "VGK", date: "03-22", sog: 6, goals: 1, assists: 1, points: 2, ga: 2 },
    ],
  },
};

const soccerDetails: Record<string, PlayerDetail> = {
  s1: {
    id: "s1", name: "Erling Haaland", position: "ST", team: "MCI", initials: "EH", season: "2024-25", sport: "Soccer",
    maxStats: [{ label: "Goals", value: 3 }, { label: "Assists", value: 2 }, { label: "Shots", value: 8 }, { label: "SOT", value: 5 }],
    matchesPlayed: 34,
    gameLogs: [
      { opponent: "ARS", date: "04-19", shots: 5, sot: 3, goals: 2, assists: 0, passes: 18, ga: 2 },
      { opponent: "LIV", date: "04-15", shots: 4, sot: 2, goals: 1, assists: 1, passes: 15, ga: 2 },
      { opponent: "CHE", date: "04-12", shots: 3, sot: 1, goals: 0, assists: 0, passes: 12, ga: 0 },
      { opponent: "AVL", date: "04-08", shots: 6, sot: 4, goals: 2, assists: 1, passes: 20, ga: 3 },
      { opponent: "TOT", date: "04-05", shots: 2, sot: 1, goals: 1, assists: 0, passes: 14, ga: 1 },
      { opponent: "NEW", date: "04-01", shots: 4, sot: 2, goals: 1, assists: 0, passes: 16, ga: 1 },
      { opponent: "WHU", date: "03-29", shots: 7, sot: 5, goals: 3, assists: 0, passes: 11, ga: 3 },
      { opponent: "BOU", date: "03-25", shots: 3, sot: 2, goals: 1, assists: 1, passes: 19, ga: 2 },
      { opponent: "WOL", date: "03-22", shots: 5, sot: 3, goals: 2, assists: 0, passes: 13, ga: 2 },
      { opponent: "BRE", date: "03-18", shots: 1, sot: 0, goals: 0, assists: 0, passes: 17, ga: 0 },
      { opponent: "FUL", date: "03-15", shots: 4, sot: 3, goals: 1, assists: 2, passes: 22, ga: 3 },
      { opponent: "EVE", date: "03-11", shots: 6, sot: 4, goals: 2, assists: 0, passes: 10, ga: 2 },
      { opponent: "CRY", date: "03-08", shots: 3, sot: 1, goals: 0, assists: 1, passes: 15, ga: 1 },
      { opponent: "NTF", date: "03-04", shots: 5, sot: 3, goals: 2, assists: 0, passes: 14, ga: 2 },
      { opponent: "IPS", date: "03-01", shots: 8, sot: 5, goals: 3, assists: 0, passes: 9, ga: 3 },
    ],
  },
};

const nflDetails: Record<string, PlayerDetail> = {
  f1: {
    id: "f1", name: "Patrick Mahomes", position: "QB", team: "KC", initials: "PM", season: "2024", sport: "NFL",
    maxStats: [{ label: "Pass Yards", value: 410 }, { label: "Rush Yards", value: 52 }, { label: "TDs", value: 5 }, { label: "INT", value: 0 }],
    matchesPlayed: 17,
    gameLogs: [
      { opponent: "BUF", date: "Wk17", passYds: 312, rushYds: 28, recYds: 0, tds: 3, prYds: 340, rrYds: 28 },
      { opponent: "HOU", date: "Wk16", passYds: 290, rushYds: 15, recYds: 0, tds: 2, prYds: 305, rrYds: 15 },
      { opponent: "CLE", date: "Wk15", passYds: 340, rushYds: 32, recYds: 0, tds: 4, prYds: 372, rrYds: 32 },
      { opponent: "LV", date: "Wk14", passYds: 265, rushYds: 22, recYds: 0, tds: 2, prYds: 287, rrYds: 22 },
      { opponent: "DEN", date: "Wk13", passYds: 280, rushYds: 18, recYds: 0, tds: 1, prYds: 298, rrYds: 18 },
      { opponent: "LAC", date: "Wk12", passYds: 310, rushYds: 41, recYds: 0, tds: 3, prYds: 351, rrYds: 41 },
      { opponent: "MIA", date: "Wk11", passYds: 245, rushYds: 12, recYds: 0, tds: 2, prYds: 257, rrYds: 12 },
      { opponent: "TB", date: "Wk10", passYds: 330, rushYds: 35, recYds: 0, tds: 3, prYds: 365, rrYds: 35 },
      { opponent: "NYJ", date: "Wk9", passYds: 275, rushYds: 20, recYds: 0, tds: 2, prYds: 295, rrYds: 20 },
      { opponent: "SF", date: "Wk8", passYds: 410, rushYds: 52, recYds: 0, tds: 5, prYds: 462, rrYds: 52 },
      { opponent: "LV", date: "Wk7", passYds: 298, rushYds: 25, recYds: 0, tds: 2, prYds: 323, rrYds: 25 },
      { opponent: "MIN", date: "Wk6", passYds: 256, rushYds: 10, recYds: 0, tds: 1, prYds: 266, rrYds: 10 },
      { opponent: "NO", date: "Wk5", passYds: 320, rushYds: 38, recYds: 0, tds: 3, prYds: 358, rrYds: 38 },
      { opponent: "ATL", date: "Wk4", passYds: 289, rushYds: 14, recYds: 0, tds: 2, prYds: 303, rrYds: 14 },
      { opponent: "CIN", date: "Wk3", passYds: 345, rushYds: 30, recYds: 0, tds: 4, prYds: 375, rrYds: 30 },
    ],
  },
};

// Merge all details
const allDetails: Record<string, PlayerDetail> = { ...nbaDetails, ...mlbDetails, ...nhlDetails, ...soccerDetails, ...nflDetails };

// Generic fallback: build a detail from the prop row
function buildFallbackDetail(prop: PlayerProp): PlayerDetail {
  return {
    id: prop.id, name: prop.name, position: prop.position, team: prop.team,
    initials: prop.initials, season: "2024-25", sport: prop.sport,
    maxStats: [], matchesPlayed: 0, gameLogs: [],
  };
}

export function getPlayerDetail(id: string): PlayerDetail {
  if (allDetails[id]) return allDetails[id];
  const prop = mockPlayers.find((p) => p.id === id);
  if (prop) return buildFallbackDetail(prop);
  return allDetails["n1"];
}

export const sports: Sport[] = ["NBA", "NHL", "MLB", "NFL", "Soccer"];

export function getHitRateClass(rate: number): string {
  if (rate >= 80) return "hit-cell-high";
  if (rate >= 60) return "hit-cell-mid";
  return "hit-cell-low";
}
