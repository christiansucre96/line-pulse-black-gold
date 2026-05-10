import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PitcherPlayerDetailsProps {
  playerName: string;
  team: string;
  stats: {
    game_date: string;
    opponent: string;
    strikeouts: number;
    hits_allowed: number;
    earned_runs: number;
    walks: number;
    outs: number;
    era: number;
    whip: number;
    first_strikeout: boolean;
    first_earned_run: boolean;
  }[];
  rollingAverages: {
    l5_strikeouts: number;
    l10_strikeouts: number;
    l15_strikeouts: number;
    l20_strikeouts: number;
    l5_era: number;
    l10_era: number;
    l15_era: number;
    l20_era: number;
    l5_whip: number;
    l10_whip: number;
    l15_whip: number;
    l20_whip: number;
    l5_first_k_pct: number;
    l10_first_k_pct: number;
    l15_first_k_pct: number;
    l20_first_k_pct: number;
  };
}

export function PitcherPlayerDetails({ playerName, team, stats, rollingAverages }: PitcherPlayerDetailsProps) {
  const propMetrics = [
    {
      name: "Strikeouts",
      icon: "⚾",
      l5: rollingAverages.l5_strikeouts,
      l10: rollingAverages.l10_strikeouts,
      l15: rollingAverages.l15_strikeouts,
      l20: rollingAverages.l20_strikeouts,
      hr_pct: null,
    },
    {
      name: "ERA",
      icon: "📊",
      l5: rollingAverages.l5_era,
      l10: rollingAverages.l10_era,
      l15: rollingAverages.l15_era,
      l20: rollingAverages.l20_era,
      hr_pct: null,
    },
    {
      name: "WHIP",
      icon: "📈",
      l5: rollingAverages.l5_whip,
      l10: rollingAverages.l10_whip,
      l15: rollingAverages.l15_whip,
      l20: rollingAverages.l20_whip,
      hr_pct: null,
    },
    {
      name: "First K",
      icon: "1️⃣",
      l5: rollingAverages.l5_first_k_pct,
      l10: rollingAverages.l10_first_k_pct,
      l15: rollingAverages.l15_first_k_pct,
      l20: rollingAverages.l20_first_k_pct,
      hr_pct: rollingAverages.l20_first_k_pct * 100,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{playerName}</h3>
          <p className="text-gray-400">{team}</p>
        </div>
        <Badge className="bg-blue-500">PITCHER</Badge>
      </div>

      {/* Rolling Averages */}
      <div className="grid gap-4">
        {propMetrics.map((metric) => (
          <Card key={metric.name} className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                {metric.icon} {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {/* L5 */}
                <div className="bg-gray-900 rounded p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">L5</div>
                  <div className="text-lg font-bold text-white">
                    {metric.name === "First K" 
                      ? `${Math.round(metric.l5 * 100)}%`
                      : metric.l5.toFixed(2)}
                  </div>
                </div>

                {/* L10 */}
                <div className="bg-gray-900 rounded p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">L10</div>
                  <div className="text-lg font-bold text-white">
                    {metric.name === "First K"
                      ? `${Math.round(metric.l10 * 100)}%`
                      : metric.l10.toFixed(2)}
                  </div>
                  {metric.hr_pct !== null && (
                    <div className="text-xs text-yellow-400 mt-1">
                      HR {Math.round(metric.hr_pct)}%
                    </div>
                  )}
                </div>

                {/* L15 */}
                <div className="bg-gray-900 rounded p-2 text-center">
                  <div className="text-xs text-gray-400 mb-1">L15</div>
                  <div className="text-lg font-bold text-white">
                    {metric.name === "First K"
                      ? `${Math.round(metric.l15 * 100)}%`
                      : metric.l15.toFixed(2)}
                  </div>
                </div>

                {/* L20 */}
                <div className="bg-gray-900 rounded p-2 text-center border-2 border-yellow-500">
                  <div className="text-xs text-gray-400 mb-1">L20</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {metric.name === "First K"
                      ? `${Math.round(metric.l20 * 100)}%`
                      : metric.l20.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Games */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Game Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.slice(0, 5).map((game, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-900 rounded p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{game.game_date}</span>
                  <span className="text-sm text-white">vs {game.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-white font-bold">{game.strikeouts} K</span>
                  <span className="text-gray-400">{game.hits_allowed} H</span>
                  <span className="text-gray-400">{game.earned_runs} ER</span>
                  <span className="text-gray-400">{game.walks} BB</span>
                  <span className="text-gray-400">{game.era.toFixed(2)} ERA</span>
                  {game.first_strikeout && (
                    <Badge className="bg-green-500 text-xs">1st K</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
