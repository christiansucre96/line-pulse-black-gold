// src/pages/ParlayBuilder.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TrendingUp,
  Plus,
  X,
  Sparkles,
  Trophy,
  AlertCircle,
  ChevronRight,
  Trash2,
  RefreshCw,
  Zap,
  Filter,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

// ✅ NBA CORE PROPS ONLY
const PROP_LABELS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  three_pointers_made: "3PM",
  steals: "Steals",
  blocks: "Blocks",
  turnovers: "TOV",
  combo_pra: "PRA (P+R+A)",
  combo_pr: "P+R",
  combo_pa: "P+A",
};

// ✅ Only these props will be shown
const ALLOWED_PROPS = [
  "points",
  "rebounds",
  "assists",
  "three_pointers_made",
  "steals",
  "blocks",
  "turnovers",
  "combo_pra",
  "combo_pr",
  "combo_pa",
];

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  position: string;
  opponent: string;
  game_date: string;
  all_props: Record<string, any>;
}

interface PropPick {
  id: string;
  player: Player;
  propType: string;
  propLabel: string;
  line: number;
  confidence: number;
  odds: number;
  reasoning: string;
  hitRate: number;
  streak: { type: string; count: number } | null;
  avgL10: number;
}

interface ParlayLeg extends PropPick {}

interface Game {
  external_id: string;
  home_team: { abbreviation: string; name: string };
  away_team: { abbreviation: string; name: string };
  game_date: string;
  start_time: string;
}

export default function ParlayBuilder() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("nba");
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [allPropPicks, setAllPropPicks] = useState<PropPick[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("all");
  const [parlaySize, setParlaySize] = useState(3);
  const [minConfidence, setMinConfidence] = useState(40);
  const [showOnlyHighConfidence, setShowOnlyHighConfidence] = useState(false);
  const [searchPlayer, setSearchPlayer] = useState("");
  const [selectedPropFilter, setSelectedPropFilter] = useState<string>("all");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGames();
  }, [sport]);

  useEffect(() => {
    if (games.length > 0) {
      fetchPlayersForGames();
    }
  }, [games, selectedGame]);

  const fetchGames = async () => {
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "get_games", sport }),
      });
      const data = await res.json();
      if (data.success) {
        setGames(data.games || []);
      }
    } catch (err) {
      console.error("Error fetching games:", err);
    }
  };

  const fetchPlayersForGames = async () => {
    setLoading(true);
    try {
      const gameIds = selectedGame === "all"
        ? games.map(g => g.external_id)
        : [selectedGame];

      const allPlayers: Player[] = [];

      for (const gameId of gameIds) {
        const res = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "get_players",
            sport,
            game_id: gameId
          }),
        });
        const data = await res.json();
        if (data.success) {
          allPlayers.push(...(data.players || []));
        }
      }

      setPlayers(allPlayers);
      generateAllPropPicks(allPlayers);
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateAllPropPicks = (playerList: Player[]) => {
    const picks: PropPick[] = [];

    for (const player of playerList) {
      if (!player.all_props) continue;

      for (const [propType, propData] of Object.entries(player.all_props)) {
        // ✅ Filter: Only allow specific props
        if (!ALLOWED_PROPS.includes(propType)) continue;

        const data = propData as any;
        if (!data?.line) continue;

        let confidence = 0;
        let reasoning: string[] = [];

        const hrScore = (data.l10 || 0) / 100;
        confidence += hrScore * 40;
        if (data.l10 >= 80) reasoning.push(`🔥 ${data.l10}% HR`);
        else if (data.l10 >= 60) reasoning.push(`📊 ${data.l10}% HR`);

        if (data.streak) {
          if (data.streak.type === 'Over') {
            const streakBonus = Math.min(data.streak.count * 5, 25);
            confidence += streakBonus;
            if (data.streak.count >= 3) {
              reasoning.push(` Over ${data.streak.count}`);
            }
          } else {
            reasoning.push(`📉 Under ${data.streak.count}`);
          }
        }

        if (data.avg_l10 && data.line) {
          const diff = data.avg_l10 - data.line;
          const pctDiff = (diff / data.line) * 100;
          if (pctDiff >= 15) {
            confidence += 25;
            reasoning.push(`💪 +${pctDiff.toFixed(0)}%`);
          } else if (pctDiff >= 8) {
            confidence += 15;
            reasoning.push(`📈 +${pctDiff.toFixed(0)}%`);
          } else if (pctDiff >= 3) {
            confidence += 8;
            reasoning.push(`↗️ +${pctDiff.toFixed(0)}%`);
          }
        }

        if (data.games_n >= 20) confidence += 10;
        else if (data.games_n >= 15) confidence += 7;
        else if (data.games_n >= 10) confidence += 5;

        if (confidence >= 40) {
          picks.push({
            id: `${player.player_id}-${propType}`,
            player,
            propType,
            propLabel: PROP_LABELS[propType] || propType,
            line: data.line,
            confidence: Math.round(confidence),
            odds: calculateOdds(confidence),
            reasoning: reasoning.join(" • ") || "Statistical edge",
            hitRate: data.l10 || 0,
            streak: data.streak || null,
            avgL10: data.avg_l10 || 0,
          });
        }
      }
    }

    picks.sort((a, b) => b.confidence - a.confidence);
    setAllPropPicks(picks);
  };

  const calculateOdds = (probability: number): number => {
    if (probability >= 80) return -400;
    if (probability >= 75) return -300;
    if (probability >= 70) return -233;
    if (probability >= 65) return -186;
    if (probability >= 60) return -150;
    if (probability >= 50) return -100;
    return -100;
  };

  const filteredPicks = useMemo(() => {
    let filtered = [...allPropPicks];

    if (showOnlyHighConfidence) {
      filtered = filtered.filter(p => p.confidence >= 70);
    } else {
      filtered = filtered.filter(p => p.confidence >= minConfidence);
    }

    if (selectedPropFilter !== "all") {
      filtered = filtered.filter(p => p.propType === selectedPropFilter);
    }

    if (searchPlayer.trim()) {
      const search = searchPlayer.toLowerCase();
      filtered = filtered.filter(p =>
        p.player.name.toLowerCase().includes(search) ||
        p.player.team_abbr.toLowerCase().includes(search) ||
        p.propLabel.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [allPropPicks, minConfidence, showOnlyHighConfidence, selectedPropFilter, searchPlayer]);

  const picksByPlayer = useMemo(() => {
    const grouped: Record<string, PropPick[]> = {};
    for (const pick of filteredPicks) {
      if (!grouped[pick.player.player_id]) {
        grouped[pick.player.player_id] = [];
      }
      grouped[pick.player.player_id].push(pick);
    }
    for (const playerId of Object.keys(grouped)) {
      grouped[playerId].sort((a, b) => b.confidence - a.confidence);
    }
    return grouped;
  }, [filteredPicks]);

  const togglePlayerExpanded = (playerId: string) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayers(newExpanded);
  };

  const addToParlay = (pick: PropPick) => {
    if (parlayLegs.length >= 5) {
      alert("Maximum 5 legs per parlay");
      return;
    }
    if (parlayLegs.find(leg => leg.id === pick.id)) return;
    setParlayLegs([...parlayLegs, pick]);
  };

  const removeFromParlay = (id: string) => {
    setParlayLegs(parlayLegs.filter(leg => leg.id !== id));
  };

  const autoPick = () => {
    const availablePicks = filteredPicks.filter(
      p => !parlayLegs.find(l => l.id === p.id)
    );

    if (availablePicks.length < parlaySize) {
      alert(`Only ${availablePicks.length} picks available. Need ${parlaySize} for auto-pick.`);
      return;
    }

    const topPicks = availablePicks.slice(0, parlaySize);
    setParlayLegs([...parlayLegs, ...topPicks]);
  };

  const smartPick = () => {
    const availablePicks = filteredPicks.filter(
      p => !parlayLegs.find(l => l.id === p.id)
    );

    if (availablePicks.length < parlaySize) {
      alert(`Only ${availablePicks.length} picks available.`);
      return;
    }

    const selected: PropPick[] = [];
    const selectedPlayers = new Set<string>();
    const selectedProps = new Set<string>();

    for (const pick of availablePicks) {
      if (selected.length >= parlaySize) break;

      const playerPenalty = selectedPlayers.has(pick.player.player_id) ? -10 : 0;
      const propPenalty = selectedProps.has(pick.propType) ? -5 : 0;
      const adjustedConfidence = pick.confidence + playerPenalty + propPenalty;

      if (adjustedConfidence >= 50) {
        selected.push(pick);
        selectedPlayers.add(pick.player.player_id);
        selectedProps.add(pick.propType);
      }
    }

    if (selected.length < parlaySize) {
      const remaining = availablePicks
        .filter(p => !selected.find(s => s.id === p.id))
        .slice(0, parlaySize - selected.length);
      selected.push(...remaining);
    }

    setParlayLegs([...parlayLegs, ...selected]);
  };

  const parlayOdds = useMemo(() => {
    if (parlayLegs.length === 0) return 0;
    let decimalOdds = 1;
    for (const leg of parlayLegs) {
      const americanOdds = leg.odds;
      if (americanOdds < 0) {
        decimalOdds *= (100 / Math.abs(americanOdds)) + 1;
      } else {
        decimalOdds *= (americanOdds / 100) + 1;
      }
    }
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  }, [parlayLegs]);

  const combinedConfidence = useMemo(() => {
    if (parlayLegs.length === 0) return 0;
    const avg = parlayLegs.reduce((sum, leg) => sum + leg.confidence, 0) / parlayLegs.length;
    return Math.round(avg);
  }, [parlayLegs]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-400";
    if (confidence >= 70) return "text-yellow-400";
    if (confidence >= 60) return "text-orange-400";
    return "text-gray-400";
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500/20 border-green-500/50";
    if (confidence >= 70) return "bg-yellow-500/20 border-yellow-500/50";
    if (confidence >= 60) return "bg-orange-500/20 border-orange-500/50";
    return "bg-gray-500/20 border-gray-500/50";
  };

  const availablePropTypes = useMemo(() => {
    const types = new Set<string>();
    for (const pick of allPropPicks) {
      types.add(pick.propType);
    }
    return Array.from(types).sort();
  }, [allPropPicks]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8" />
            ⚡ AI Parlay Builder
          </h1>
          <p className="text-gray-400">
            Build smart parlays • {allPropPicks.length} prop picks available • You decide
          </p>
        </div>

        <Card className="mb-6 bg-gray-900/50 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">Filters & Settings</h3>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-400 whitespace-nowrap">
                    Parlay Size:
                  </Label>
                  <Select
                    value={parlaySize.toString()}
                    onValueChange={(val) => setParlaySize(Number(val))}
                  >
                    <SelectTrigger className="w-20 bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {[1, 2, 3, 4, 5].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} Leg{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  type="text"
                  placeholder="Search player/prop..."
                  value={searchPlayer}
                  onChange={(e) => setSearchPlayer(e.target.value)}
                  className="w-48 bg-gray-800 border-gray-700 text-white"
                />

                <Select
                  value={selectedPropFilter}
                  onValueChange={setSelectedPropFilter}
                >
                  <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All Props" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 max-h-64">
                    <SelectItem value="all">All Props</SelectItem>
                    {availablePropTypes.map(prop => (
                      <SelectItem key={prop} value={prop}>
                        {PROP_LABELS[prop] || prop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-400 whitespace-nowrap">
                    Min: <span className="text-yellow-400 font-bold">{minConfidence}%</span>
                  </Label>
                  <input
                    type="range"
                    min="40"
                    max="80"
                    step="5"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    disabled={showOnlyHighConfidence}
                    className="w-24 accent-yellow-500 disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={showOnlyHighConfidence}
                    onCheckedChange={setShowOnlyHighConfidence}
                    id="high-confidence"
                  />
                  <Label htmlFor="high-confidence" className="text-sm text-gray-400 cursor-pointer">
                    High Only (70%+)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-800 flex-wrap gap-2">
              <p className="text-sm text-gray-400">
                Showing <span className="text-white font-bold">{filteredPicks.length}</span> of <span className="text-white font-bold">{allPropPicks.length}</span> picks
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMinConfidence(40);
                    setShowOnlyHighConfidence(false);
                    setSearchPlayer("");
                    setSelectedPropFilter("all");
                  }}
                  className="border-gray-700 text-gray-300 text-xs"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={autoPick}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Auto-Pick {parlaySize}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={smartPick}
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 text-xs"
                >
                  <ListChecks className="w-3 h-3 mr-1" />
                  Smart Pick
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredPicks.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="text-yellow-400 font-semibold">
                    🤖 AI Suggestions Ready
                  </p>
                  <p className="text-sm text-gray-400">
                    Top pick: {filteredPicks[0]?.player.name} - {filteredPicks[0]?.propLabel} ({filteredPicks[0]?.confidence}% confidence)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={autoPick}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AUTO-PICK {parlaySize}
                </Button>
                <Button
                  onClick={smartPick}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <ListChecks className="w-4 h-4 mr-2" />
                  SMART PICK
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Available Prop Picks
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlayersForGames}
                disabled={loading}
                className="border-gray-700 text-gray-300"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
                <p className="text-gray-400">Analyzing player data...</p>
              </div>
            ) : filteredPicks.length === 0 ? (
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400">No picks match your filters</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMinConfidence(40);
                      setShowOnlyHighConfidence(false);
                      setSearchPlayer("");
                      setSelectedPropFilter("all");
                    }}
                    className="mt-4 border-gray-700 text-gray-300"
                  >
                    Lower Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Object.entries(picksByPlayer).map(([playerId, playerPicks]) => {
                  const player = playerPicks[0].player;
                  const isExpanded = expandedPlayers.has(playerId);

                  return (
                    <Collapsible
                      key={playerId}
                      open={isExpanded}
                      onOpenChange={() => togglePlayerExpanded(playerId)}
                    >
                      <Card className={`bg-gray-900/50 border hover:border-yellow-500/50 transition-all ${getConfidenceBg(playerPicks[0].confidence)}`}>
                        <CollapsibleTrigger asChild>
                          <CardContent className="p-4 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-sm shrink-0">
                                  {player.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-white text-lg truncate">
                                    {player.name}
                                  </h3>
                                  <p className="text-sm text-gray-400">
                                    {player.team_abbr} vs {player.opponent} • {playerPicks.length} props
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {playerPicks.slice(0, 3).map(pick => (
                                      <Badge key={pick.propType} variant="outline" className="text-xs border-gray-500 text-gray-400">
                                        {pick.propLabel}: {pick.line}
                                      </Badge>
                                    ))}
                                    {playerPicks.length > 3 && (
                                      <Badge variant="outline" className="text-xs border-gray-500 text-gray-400">
                                        +{playerPicks.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <div className={`text-xl font-bold ${getConfidenceColor(playerPicks[0].confidence)}`}>
                                    {playerPicks[0].confidence}%
                                  </div>
                                  <div className="text-[10px] text-gray-500">Top Prop</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3">
                            {playerPicks.map(pick => (
                              <div
                                key={pick.id}
                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-yellow-500/50 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className={`text-xs ${getConfidenceBg(pick.confidence)} ${getConfidenceColor(pick.confidence)}`}>
                                    {pick.confidence}%
                                  </Badge>
                                  <div>
                                    <p className="font-medium text-white text-sm">
                                      {pick.propLabel} Over {pick.line}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      Avg: {pick.avgL10} • HR: {pick.hitRate}% • {pick.reasoning}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); addToParlay(pick); }}
                                  disabled={parlayLegs.length >= 5 || parlayLegs.find(l => l.id === pick.id)}
                                  className={`${
                                    pick.confidence >= 70 ? 'bg-green-600 hover:bg-green-700' :
                                    pick.confidence >= 60 ? 'bg-yellow-600 hover:bg-yellow-700' :
                                    'bg-gray-600 hover:bg-gray-700'
                                  } disabled:opacity-50`}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-gray-900/80 border-gray-700 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Bet Slip ({parlayLegs.length}/{parlaySize})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {parlayLegs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Click props to add to your parlay</p>
                    <p className="text-xs mt-2">Or use AUTO-PICK for {parlaySize} legs</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                    {parlayLegs.map((leg, index) => (
                      <div
                        key={leg.id}
                        className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500">#{index + 1}</span>
                              <h4 className="font-bold text-white text-sm truncate">
                                {leg.player.name}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {leg.propLabel} Over {leg.line}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`text-xs ${getConfidenceBg(leg.confidence)} ${getConfidenceColor(leg.confidence)}`}>
                                {leg.confidence}%
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {leg.odds > 0 ? '+' : ''}{leg.odds}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromParlay(leg.id)}
                            className="text-gray-500 hover:text-red-400 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {parlayLegs.length > 0 && (
                  <div className="border-t border-gray-700 pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Parlay Odds:</span>
                      <span className="text-xl font-bold text-yellow-400">
                        {parlayOdds > 0 ? '+' : ''}{parlayOdds}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Avg Confidence:</span>
                      <span className={`text-lg font-bold ${
                        combinedConfidence >= 80 ? 'text-green-400' :
                        combinedConfidence >= 70 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {combinedConfidence}%
                      </span>
                    </div>
                    <Button
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-6"
                      onClick={() => alert(`🎯 Parlay placed! (Demo)\n\n${parlayLegs.length}-leg parlay at ${parlayOdds > 0 ? '+' : ''}${parlayOdds}\n\nIn production, this connects to your sportsbook.`)}
                    >
                      Place {parlayLegs.length}-Leg Parlay
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setParlayLegs([])}
                      className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Slip
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
