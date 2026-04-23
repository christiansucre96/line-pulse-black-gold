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
  Star,
  TrendingDown
} from "lucide-react";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

interface Player {
  player_id: string;
  name: string;
  team_abbr: string;
  position: string;
  opponent: string;
  game_date: string;
  all_props: Record<string, any>;
}

interface ParlayLeg {
  id: string;
  player: Player;
  propType: string;
  line: number;
  confidence: number;
  odds: number;
  reasoning: string;
  hitRate: number;
  streak: { type: string; count: number } | null;
}

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
  const [allSuggestions, setAllSuggestions] = useState<ParlayLeg[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("all");
  
  // ✅ NEW: Filter settings - let users control strictness
  const [minConfidence, setMinConfidence] = useState(50); // Lowered from 70 to 50
  const [showOnlyHighConfidence, setShowOnlyHighConfidence] = useState(false);
  const [searchPlayer, setSearchPlayer] = useState("");

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
      generateAllSuggestions(allPlayers);
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🤖 AI LOGIC: Generate ALL picks (not just high confidence)
  const generateAllSuggestions = (playerList: Player[]) => {
    const suggestions: ParlayLeg[] = [];

    for (const player of playerList) {
      if (!player.all_props) continue;

      for (const [propType, propData] of Object.entries(player.all_props)) {
        const data = propData as any;
        if (!data?.line) continue;
        
        let confidence = 0;
        let reasoning: string[] = [];
        
        // Factor 1: Hit Rate (40% weight)
        const hrScore = (data.l10 || 0) / 100;
        confidence += hrScore * 40;
        if (data.l10 >= 80) reasoning.push(`🔥 ${data.l10}% HR`);
        else if (data.l10 >= 60) reasoning.push(`📊 ${data.l10}% HR`);
        
        // Factor 2: Streak (25% weight)
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
        
        // Factor 3: Avg vs Line (25% weight)
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
          } else if (pctDiff <= -8) {
            reasoning.push(`↘️ ${pctDiff.toFixed(0)}%`);
          }
        }
        
        // Factor 4: Sample Size (10% weight)
        if (data.games_n >= 20) {
          confidence += 10;
        } else if (data.games_n >= 15) {
          confidence += 7;
        } else if (data.games_n >= 10) {
          confidence += 5;
        }

        // ✅ LOWERED THRESHOLD: Show picks with 40%+ confidence (was 70%)
        if (confidence >= 40) {
          suggestions.push({
            id: `${player.player_id}-${propType}`,
            player,
            propType,
            line: data.line,
            confidence: Math.round(confidence),
            odds: calculateOdds(confidence),
            reasoning: reasoning.join(" • ") || "Statistical edge",
            hitRate: data.l10 || 0,
            streak: data.streak || null,
          });
        }
      }
    }

    // Sort by confidence (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    setAllSuggestions(suggestions);
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

  // ✅ Filter suggestions based on user settings
  const filteredSuggestions = useMemo(() => {
    let filtered = [...allSuggestions];
    
    // Filter by confidence threshold
    if (showOnlyHighConfidence) {
      filtered = filtered.filter(s => s.confidence >= 70);
    } else {
      filtered = filtered.filter(s => s.confidence >= minConfidence);
    }
    
    // Filter by search
    if (searchPlayer.trim()) {
      const search = searchPlayer.toLowerCase();
      filtered = filtered.filter(s => 
        s.player.name.toLowerCase().includes(search) ||
        s.player.team_abbr.toLowerCase().includes(search) ||
        s.propType.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [allSuggestions, minConfidence, showOnlyHighConfidence, searchPlayer]);

  const addToParlay = (suggestion: ParlayLeg) => {
    if (parlayLegs.length >= 5) {
      alert("Maximum 5 legs per parlay");
      return;
    }
    if (parlayLegs.find(leg => leg.id === suggestion.id)) return;
    setParlayLegs([...parlayLegs, suggestion]);
  };

  const removeFromParlay = (id: string) => {
    setParlayLegs(parlayLegs.filter(leg => leg.id !== id));
  };

  const autoPick = () => {
    const topPicks = filteredSuggestions.slice(0, 3);
    if (topPicks.length >= 1) {
      setParlayLegs(topPicks);
    } else {
      alert("No picks available with current filters");
    }
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8" />
            ⚡ AI Parlay Builder
          </h1>
          <p className="text-gray-400">
            Build smart parlays • {allSuggestions.length} picks available • You decide
          </p>
        </div>

        {/* ✅ NEW: Filter Controls */}
        <Card className="mb-6 bg-gray-900/50 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">Filters</h3>
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                {/* Search Player */}
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search player..."
                    value={searchPlayer}
                    onChange={(e) => setSearchPlayer(e.target.value)}
                    className="w-48 bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                {/* Confidence Slider */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-gray-400 whitespace-nowrap">
                    Min Confidence: <span className="text-yellow-400 font-bold">{minConfidence}%</span>
                  </Label>
                  <input
                    type="range"
                    min="40"
                    max="80"
                    step="5"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    disabled={showOnlyHighConfidence}
                    className="w-32 accent-yellow-500 disabled:opacity-50"
                  />
                </div>

                {/* High Confidence Only Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showOnlyHighConfidence}
                    onCheckedChange={setShowOnlyHighConfidence}
                    id="high-confidence"
                  />
                  <Label htmlFor="high-confidence" className="text-sm text-gray-400 cursor-pointer">
                    High Confidence Only (70%+)
                  </Label>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                Showing <span className="text-white font-bold">{filteredSuggestions.length}</span> of <span className="text-white font-bold">{allSuggestions.length}</span> picks
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMinConfidence(50);
                  setShowOnlyHighConfidence(false);
                  setSearchPlayer("");
                }}
                className="border-gray-700 text-gray-300 text-xs"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestion Banner */}
        {filteredSuggestions.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="text-yellow-400 font-semibold">
                    🤖 AI Suggestions Ready
                  </p>
                  <p className="text-sm text-gray-400">
                    Top pick: {filteredSuggestions[0]?.player.name} - {filteredSuggestions[0]?.confidence}% confidence
                  </p>
                </div>
              </div>
              <Button
                onClick={autoPick}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AUTO-PICK TOP 3
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: All Picks */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Available Picks
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
            ) : filteredSuggestions.length === 0 ? (
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
                    }}
                    className="mt-4 border-gray-700 text-gray-300"
                  >
                    Lower Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredSuggestions.map((suggestion) => (
                  <Card 
                    key={suggestion.id}
                    className={`bg-gray-900/50 border hover:border-yellow-500/50 transition-all cursor-pointer ${getConfidenceBg(suggestion.confidence)}`}
                    onClick={() => addToParlay(suggestion)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-sm shrink-0`}>
                            {suggestion.player.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-white text-lg truncate">
                              {suggestion.player.name}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {suggestion.player.team_abbr} vs {suggestion.player.opponent} • {suggestion.propType}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${
                                suggestion.hitRate >= 80 ? 'border-green-500 text-green-400' :
                                suggestion.hitRate >= 60 ? 'border-yellow-500 text-yellow-400' :
                                'border-gray-500 text-gray-400'
                              }`}>
                                HR: {suggestion.hitRate}%
                              </Badge>
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                                Line: {suggestion.line}
                              </Badge>
                              {suggestion.streak && (
                                <Badge variant="outline" className={`text-xs ${
                                  suggestion.streak.type === 'Over'
                                    ? 'border-green-500 text-green-400'
                                    : 'border-red-500 text-red-400'
                                }`}>
                                  {suggestion.streak.type === 'Over' ? '🔺' : '🔻'} {suggestion.streak.count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getConfidenceColor(suggestion.confidence)}`}>
                              {suggestion.confidence}%
                            </div>
                            <div className="text-xs text-gray-500">Confidence</div>
                            <div className="text-[10px] text-gray-400 mt-1 max-w-[150px] truncate">
                              {suggestion.reasoning}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); addToParlay(suggestion); }}
                            disabled={parlayLegs.length >= 5 || parlayLegs.find(l => l.id === suggestion.id)}
                            className={`${
                              suggestion.confidence >= 70 ? 'bg-green-600 hover:bg-green-700' :
                              suggestion.confidence >= 60 ? 'bg-yellow-600 hover:bg-yellow-700' :
                              'bg-gray-600 hover:bg-gray-700'
                            } disabled:opacity-50 shrink-0`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right: Bet Slip */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900/80 border-gray-700 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Bet Slip
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-sm text-gray-400 mb-4">
                  {parlayLegs.length}/5 legs selected
                </div>

                {parlayLegs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Click picks to add to your parlay</p>
                    <p className="text-xs mt-2">Or use AUTO-PICK for instant suggestions</p>
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
                              {leg.propType} Over {leg.line}
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
                      onClick={() => alert("🎯 Parlay placed! (Demo mode)\n\nIn production, this would connect to your sportsbook API.")}
                    >
                      Place Parlay
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
