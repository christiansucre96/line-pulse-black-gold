import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = "avgL10" | "l5" | "l10" | "l15" | "l20" | "trend";
export type SortDir = "asc" | "desc";

interface PlayerTableProps {
  players: any[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onPlayerClick: (id: string) => void;
}

export function PlayerTable({ players, sortField, sortDir, onSort, onPlayerClick }: PlayerTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === "desc" ? <ArrowDown className="w-3.5 h-3.5 text-primary" /> : <ArrowUp className="w-3.5 h-3.5 text-primary" />;
  };

  const getHitRateClass = (rate: number) => {
    if (rate >= 70) return "bg-green-500/20 text-green-400";
    if (rate >= 50) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  if (!players || players.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No players found. Run sync in Admin page to load data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-3 px-3 font-semibold">Player</th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("avgL10")}>
              <span className="inline-flex items-center gap-1">Avg L10 <SortIcon field="avgL10" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("l5")}>
              <span className="inline-flex items-center gap-1">L5 <SortIcon field="l5" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("l10")}>
              <span className="inline-flex items-center gap-1">L10 <SortIcon field="l10" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("l15")}>
              <span className="inline-flex items-center gap-1">L15 <SortIcon field="l15" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("l20")}>
              <span className="inline-flex items-center gap-1">L20 <SortIcon field="l20" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("trend")}>
              <span className="inline-flex items-center gap-1">Trend <SortIcon field="trend" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr
              key={player.id}
              className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
              onClick={() => onPlayerClick(player.id)}
            >
              <td className="py-3 px-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {player.initials || player.name?.substring(0, 2).toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{player.name} <span className="text-muted-foreground font-normal">({player.position})</span></div>
                    <div className="text-xs text-muted-foreground">{player.team} vs {player.opponent || "TBD"}</div>
                    <div className="text-xs text-primary">{player.categories?.join(" · ") || "points · assists · rebounds"}</div>
                  </div>
                </div>
              </td>
              <td className="text-center py-3 px-2">
                <span className="px-3 py-1 rounded text-xs font-semibold bg-primary/20 text-primary">
                  {typeof player.avgL10 === 'number' ? player.avgL10.toFixed(1) : player.avgL10 || 0}
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l5)}`}>
                  {player.l5 || 0}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l10)}`}>
                  {player.l10 || 0}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l15)}`}>
                  {player.l15 || 0}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l20)}`}>
                  {player.l20 || 0}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`font-bold font-display text-lg ${player.trend === "up" ? "text-green-400" : player.trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
                  {player.trend === "up" ? "↑" : player.trend === "down" ? "↓" : "→"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      <table>
    </div>
  );
}
