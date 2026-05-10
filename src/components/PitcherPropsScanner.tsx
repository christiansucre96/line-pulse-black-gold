import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROP_TYPES = [
  { value: "strikeouts", label: "Strikeouts (K)", icon: "⚾" },
  { value: "hits_allowed", label: "Hits Allowed", icon: "🎯" },
  { value: "earned_runs", label: "Earned Runs", icon: "💰" },
  { value: "walks", label: "Walks", icon: "🚶" },
  { value: "first_strikeout", label: "First Strikeout", icon: "1️⃣" },
  { value: "first_earned_run", label: "First Earned Run", icon: "🔥" },
  { value: "era", label: "ERA", icon: "📊" },
  { value: "whip", label: "WHIP", icon: "📈" },
];

interface PitcherProp {
  player_name: string;
  team: string;
  opponent: string;
  game_date: string;
  prop_type: string;
  l20_avg: number;
  l5_avg: number;
  l10_avg: number;
  l15_avg: number;
  l20_pct?: number;
  over_under?: number;
  edge?: string;
}

export function PitcherPropsScanner() {
  const [selectedProp, setSelectedProp] = useState("strikeouts");
  const [props, setProps] = useState<PitcherProp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProps();
  }, [selectedProp]);

  const loadProps = async () => {
    setLoading(true);
    try {
      const response = await fetch("YOUR_API_ENDPOINT/pitcher-props", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ prop_type: selectedProp }),
      });
      const data = await response.json();
      setProps(data.props || []);
    } catch (err) {
      console.error("Error loading props:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEdgeColor = (edge?: string) => {
    if (!edge) return "bg-gray-500";
    if (edge === "strong_over") return "bg-green-500";
    if (edge === "lean_over") return "bg-yellow-500";
    if (edge === "lean_under") return "bg-orange-500";
    if (edge === "strong_under") return "bg-red-500";
    return "bg-gray-500";
  };

  const getEdgeLabel = (edge?: string) => {
    if (!edge) return "Neutral";
    return edge.replace("_", " ").toUpperCase();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">⚾ Pitcher Props Scanner</h2>
        
        <Select value={selectedProp} onValueChange={setSelectedProp}>
          <SelectTrigger className="w-64 bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {PROP_TYPES.map(prop => (
              <SelectItem key={prop.value} value={prop.value}>
                {prop.icon} {prop.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400">Loading pitcher props...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {props.map((prop, idx) => (
            <Card key={idx} className="bg-gray-800 border-gray-700 hover:border-yellow-500 transition">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {prop.player_name}
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {prop.team}
                      </Badge>
                      <span className="text-sm text-gray-400">vs {prop.opponent}</span>
                    </CardTitle>
                  </div>
                  <Badge className={`${getEdgeColor(prop.edge)} text-white`}>
                    {getEdgeLabel(prop.edge)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {/* L5 */}
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">L5</div>
                    <div className="text-xl font-bold text-white">{prop.l5_avg}</div>
                    {prop.l20_pct !== undefined && selectedProp.includes("first") && (
                      <div className="text-xs text-yellow-400 mt-1">
                        {Math.round(prop.l20_pct * 100)}% rate
                      </div>
                    )}
                  </div>

                  {/* L10 */}
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">L10</div>
                    <div className="text-xl font-bold text-white">{prop.l10_avg}</div>
                  </div>

                  {/* L15 */}
                  <div className="bg-gray-900 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">L15</div>
                    <div className="text-xl font-bold text-white">{prop.l15_avg}</div>
                  </div>

                  {/* L20 */}
                  <div className="bg-gray-900 rounded-lg p-3 text-center border-2 border-yellow-500">
                    <div className="text-xs text-gray-400 mb-1">L20</div>
                    <div className="text-xl font-bold text-yellow-400">{prop.l20_avg}</div>
                    {prop.over_under && (
                      <div className="text-xs text-gray-500 mt-1">
                        Line: {prop.over_under}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
