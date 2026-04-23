// src/pages/ParlayBuilder.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Plus, 
  X, 
  Sparkles, 
  Trophy, 
  AlertCircle,
  ChevronRight,
  Trash2,
  RefreshCw
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
  const [aiSuggestions, setAiSuggestions] = useState<ParlayLeg[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("all");

  // Fetch today's games
  useEffect(() => {
    fetchGames();
  }, [sport]);

  // Fetch players when game selected
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
          allPlayers.push(...data.players);
        }
      }
      
      setPlayers(allPlayers);
      
      // Generate AI suggestions
      generateAISuggestions(allPlayers);
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🤖 AI LOGIC: Analyze players and generate high-confidence picks
  const generateAISuggestions = (playerList: Player[]) => {
    const suggestions: ParlayLeg[] = [];

    for (const player of playerList) {
      if (!player.all_props) continue;

      // Analyze each prop type
      for (const [propType, propData] of Object.entries(player.all_props)) {
        const data = propData as any;
        
        // AI Scoring Algorithm
        let confidence = 0;
        let reasoning: string[] = [];
        
        // Factor 1: Hit Rate (40% weight)
        const hrScore = (data.l10 || 0) / 100;
        confidence += hrScore * 40;
        if (data.l10 >= 80) reasoning.push(`🔥 ${data.l10}% hit rate (L10)`);
        
        // Factor 2: Streak (25% weight)
        if (data.streak) {
          const streakBonus = data.streak.type === 'Over' 
            ? Math.min(data.streak.count * 5, 25)
            : 0;
          confidence += streakBonus;
          if (data.streak.type === 'Over' && data.streak.count >= 3) {
            reasoning.push(`📈 Over ${data.streak.count} straight`);
          }
        }
        
        // Factor 3: Avg vs Line (25% weight)
        if (data.avg_l10 && data.line) {
          const diff = data.avg_l10 - data.line;
          const pctDiff = (diff / data.line) * 100;
          
          if (pctDiff >= 15) {
            confidence += 25;
            reasoning.push(`💪 Avg ${pctDiff.toFixed(1)}% above line`);
          } else if (pctDiff >= 8) {
            confidence += 15;
            reasoning.push(`📊 Avg ${pctDiff.toFixed(1)}% above line`);
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

        // Only suggest if confidence >= 70%
        if (confidence >= 70) {
          suggestions.push({
            id: `${player.player_id}-${propType}`,
            player,
            propType,
            line: data.line || 0,
            confidence: Math.round(confidence),
            odds: calculateOdds(confidence),
            reasoning: reasoning.join(" • "),
          });
        }
      }
    }

    // Sort by confidence and take top picks
    suggestions.sort((a, b) => b.confidence - a.confidence);
    setAiSuggestions(suggestions.slice(0, 10));
  };

  // Calculate American odds from probability
  const calculateOdds = (probability: number): number => {
    if (probability >= 80) return -400;
    if (probability >= 75) return -300;
    if (probability >= 70) return -233;
    if (probability >= 65) return -186;
    if (probability >= 60) return -150;
    return -120;
  };

  // Add leg to parlay
  const addToParlay = (suggestion: ParlayLeg) => {
    if (parlayLegs.length >= 5) {
      alert("Maximum 5 legs per parlay");
      return;
    }
    if (parlayLegs.find(leg => leg.id === suggestion.id)) {
      return; // Already added
    }
    setParlayLegs([...parlayLegs, suggestion]);
  };

  // Remove leg from parlay
  const removeFromParlay = (id: string) => {
    setParlayLegs(parlayLegs.filter(leg => leg.id !== id));
  };

  // Auto-pick best parlay
  const autoPick = () => {
    if (aiSuggestions.length >= 3) {
      const topPicks = aiSuggestions.slice(0, 3);
      setParlayLegs(topPicks);
    } else {
      alert("Need at least 3 high-confidence picks available");
    }
  };

  // Calculate parlay odds
  const parlayOdds = useMemo(() => {
    if (parlayLegs.length === 0) return 0;
    
    // Convert American odds to decimal, multiply, convert back
    let decimalOdds = 1;
    for (const leg of parlayLegs) {
      const americanOdds = leg.odds;
      if (americanOdds < 0) {
        decimalOdds *= (100 / Math.abs(americanOdds)) + 1;
      } else {
        decimalOdds *= (americanOdds / 100) + 1;
      }
    }
    
    // Convert back to American
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  }, [parlayLegs]);

  // Calculate combined confidence
  const combinedConfidence = useMemo(() => {
    if (parlayLegs.length === 0) return 0;
    const avg = parlayLegs.reduce((sum, leg) => sum + leg.confidence, 0) / parlayLegs.length;
    return Math.round(avg);
  }, [parlayLegs]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">
            🎯 Parlay Builder
          </h1>
          <p className="text-gray-400">
            Build smart parlays with data-driven AI suggestions
          </p>
        </div>

        {/* AI Suggestion Banner */}
        {aiSuggestions.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="text-yellow-400 font-semibold">
                    AI Suggestion: Add high-confidence picks for tonight's slate
                  </p>
                  <p className="text-sm text-gray-400">
                    Top pick: {aiSuggestions[0]?.player.name} - {aiSuggestions[0]?.propType} ({aiSuggestions[0]?.confidence}% confidence)
                  </p>
                </div>
              </div>
              <Button
                onClick={autoPick}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                AUTO-PICK
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: AI Suggestions */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              AI-Powered Picks
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-yellow-400" />
                <p className="text-gray-400">Analyzing player data...</p>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <p>No high-confidence picks found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiSuggestions.map((suggestion) => (
                  <Card 
                    key={suggestion.id}
                    className="bg-gray-900/50 border-gray-700 hover:border-yellow-500/50 transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-black font-bold text-sm">
                            {suggestion.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">
                              {suggestion.player.name}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {suggestion.player.team_abbr} vs {suggestion.player.opponent} • {suggestion.propType}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                                L10 HR: {suggestion.player.all_props[suggestion.propType]?.l10 || 0}%
                              </Badge>
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                                Line: {suggestion.line}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-400">
                              {suggestion.confidence}%
                            </div>
                            <div className="text-xs text-gray-500">Confidence</div>
                            <div className="text-xs text-gray-400 mt-1 max-w-[200px]">
                              {suggestion.reasoning}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToParlay(suggestion)}
                            disabled={parlayLegs.length >= 5 || parlayLegs.find(l => l.id === suggestion.id)}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
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
              <CardContent className="p-4">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Bet Slip
                </h2>
                
                <div className="text-sm text-gray-400 mb-4">
                  {parlayLegs.length} {parlayLegs.length === 1 ? 'leg' : 'legs'}
                </div>

                {parlayLegs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Click players to add to your parlay</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {parlayLegs.map((leg, index) => (
                      <div 
                        key={leg.id}
                        className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500">#{index + 1}</span>
                              <h4 className="font-bold text-white text-sm">
                                {leg.player.name}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-400">
                              {leg.propType} Over {leg.line}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="text-xs bg-green-500/20 text-green-400">
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
                            className="text-gray-500 hover:text-red-400"
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
                      onClick={() => alert("Parlay placed! (Demo)")}
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
