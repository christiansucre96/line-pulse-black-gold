import { useState, useMemo, useEffect } from "react";
import { Search, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sportsApi } from "@/lib/api/sportsApi";

import { SportTabs } from "@/components/SportTabs";
import { StatFilters } from "@/components/StatFilters";
import { PlayerTable, SortField, SortDir } from "@/components/PlayerTable";
import { PlayerDetailView } from "@/components/PlayerDetailView";
import { DashboardLayout } from "@/components/DashboardLayout";

import { Sport, sportCategories, mockPlayers } from "@/data/mockPlayers";

// Map sport names to database format
const sportDbMap: Record<Sport, string> = {
  NBA: "nba",
  NFL: "nfl",
  MLB: "mlb",
  NHL: "nhl",
  Soccer: "soccer",
};

export default function Scanner() {
  const [sport, setSport] = useState<Sport>("NBA");
  const [search, setSearch] = useState("");
  const [activeStats, setActiveStats] = useState<string[]>(sportCategories["NBA"].core.slice(0, 4));
  const [sortField, setSortField] = useState<SortField>("diff");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [dbStats, setDbStats] = useState({ teams: 0, players: 0, props: 0 });

  // Fetch real data from database
  const fetchRealData = async () => {
    setLoading(true);
    try {
      const dbSport = sportDbMap[sport];
      console.log(`📊 Fetching ${sport} data from database...`);
      
      // Fetch players from database
      const dbPlayers = await sportsApi.getPlayers(dbSport as any);
      console.log(`✅ Found ${dbPlayers.length} ${sport} players in DB`);
      
      // Fetch props for these players
      const props = await sportsApi.getProps(dbSport as any);
      console.log(`✅ Found ${props.length} ${sport} props in DB`);
      
      // Fetch teams for context
      const { data: teams } = await supabase.from("teams").select("id, name, abbreviation").eq("sport", dbSport);
      const teamMap = new Map();
      teams?.forEach(t => teamMap.set(t.id, t));
      
      // Create a map of player_id to prop
      const propMap = new Map();
      props.forEach((prop: any) => {
        if (!propMap.has(prop.player_id) || prop.confidence_score > (propMap.get(prop.player_id)?.confidence_score || 0)) {
          propMap.set(prop.player_id, prop);
        }
      });
      
      // Transform database players to match the expected format
      const transformedPlayers = dbPlayers.map((player: any) => {
        const playerProp = propMap.get(player.id);
        const teamInfo = teamMap.get(player.team_id);
        
        // Calculate trend
        let trend = "stable";
        if (playerProp?.trend === "up") trend = "up";
        else if (playerProp?.trend === "down") trend = "down";
        
        // Get projected value or generate from stats
        let projectedValue = playerProp?.projected_value || playerProp?.baseline_line || 15;
        let confidence = playerProp?.confidence_score || 0.5;
        let hitRate = playerProp?.hit_rate_last10 || 0.5;
        
        return {
          id: player.id,
          name: player.full_name || player.name || "Unknown",
          sport: sport,
          team: teamInfo?.name || player.team_name || "Unknown",
          teamAbbr: teamInfo?.abbreviation || player.team_abbreviation || "N/A",
          position: player.position || "N/A",
          line: Math.round(projectedValue * 2) / 2,
          hit_rate: Math.round(hitRate * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          trend: trend,
          diff: playerProp?.edge_type === "OVER" ? 2 : (playerProp?.edge_type === "UNDER" ? -2 : 0),
          categories: ["points", "assists", "rebounds"],
          avg_last5: playerProp?.avg_last5 || 0,
          avg_last10: playerProp?.avg_last10 || 0,
          avg_last20: playerProp?.avg_last20 || 0,
        };
      });
      
      // Update stats
      setDbStats({
        teams: teams?.length || 0,
        players: dbPlayers.length,
        props: props.length
      });
      
      if (transformedPlayers.length > 0) {
        setPlayers(transformedPlayers);
        setUsingLiveData(true);
        console.log(`✅ Using REAL data: ${transformedPlayers.length} players with ${props.length} props`);
      } else {
        // Fallback to mock data if no real data
        console.log("No real data found, using mock data");
        setPlayers(mockPlayers.filter((p) => p.sport === sport));
        setUsingLiveData(false);
      }
    } catch (error) {
      console.error("Error fetching players:", error);
      setPlayers(mockPlayers.filter((p) => p.sport === sport));
      setUsingLiveData(false);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when sport changes
  useEffect(() => {
    fetchRealData();
  }, [sport]);

  const handleSportChange = (s: Sport) => {
    setSport(s);
    setActiveStats(sportCategories[s].core.slice(0, 4));
    setSearch("");
  };

  const toggleStat = (stat: string) => {
    setActiveStats((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredPlayers = useMemo(() => {
    let result = [...players];

    if (search) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (activeStats.length > 0) {
      result = result.filter((p) =>
        p.categories?.some((c) => activeStats.includes(c))
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortField] as number;
      const bVal = b[sortField] as number;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [players, search, activeStats, sortField, sortDir]);

  if (selectedPlayer) {
    return (
      <DashboardLayout>
        <PlayerDetailView
          playerId={selectedPlayer}
          onBack={() => setSelectedPlayer(null)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Welcome to</p>
            <h1 className="text-2xl font-display font-bold text-gradient-gold tracking-wider">
              LINE PULSE
            </h1>
            <p className="text-xs text-green-400">● LIVE</p>
          </div>
          <SportTabs activeSport={sport} onSportChange={handleSportChange} />
        </div>
      </header>

      <div className="px-6 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search player by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-secondary-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {sortDir === "desc" ? "↓ Highest First" : "↑ Lowest First"}
          </button>
        </div>

        <StatFilters
          activeStats={activeStats}
          onToggleStat={toggleStat}
          sport={sport}
        />
      </div>

      <div className="px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Database Stats Banner */}
            {usingLiveData && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-xs text-green-400">
                  ✅ LIVE DATA: {dbStats.players} players • {dbStats.props} props • {dbStats.teams} teams
                </p>
              </div>
            )}
            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <PlayerTable
                players={filteredPlayers}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onPlayerClick={setSelectedPlayer}
              />
            </div>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground mt-4">
          Showing {filteredPlayers.length} results
          {usingLiveData && players.length > 0 && (
            <span className="ml-2 text-green-400">● Live Data</span>
          )}
          {!usingLiveData && players.length > 0 && (
            <span className="ml-2 text-yellow-400">● Mock Data (Run Sync in Admin)</span>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
