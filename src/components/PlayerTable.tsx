import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = "line" | "edge_type" | "confidence" | "hit_rate" | "trend" | "name";
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
            <th className="text-left py-3 px-3 font-semibold cursor-pointer" onClick={() => onSort("name")}>
              <span className="inline-flex items-center gap-1">Player <SortIcon field="name" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("line")}>
              <span className="inline-flex items-center gap-1">Line <SortIcon field="line" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("edge_type")}>
              <span className="inline-flex items-center gap-1">Edge <SortIcon field="edge_type" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("confidence")}>
              <span className="inline-flex items-center gap-1">Conf <SortIcon field="confidence" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("hit_rate")}>
              <span className="inline-flex items-center gap-1">Hit Rate <SortIcon field="hit_rate" /></span>
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
                    {player.initials || player.name?.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{player.name} <span className="text-muted-foreground font-normal">({player.position})</span></div>
                    <div className="text-xs text-muted-foreground">{player.team} vs {player.opponent || "TBD"}</div>
                    <div className="text-xs text-primary">{player.categories?.join(" · ") || "points · assists · rebounds"}</div>
                  </div>
                </div>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-3 py-1 rounded text-xs font-semibold ${
                  player.edge_type === 'OVER' ? 'bg-green-500/20 text-green-400' :
                  player.edge_type === 'UNDER' ? 'bg-red-500/20 text-red-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {player.edge_type === 'OVER' ? 'O' : player.edge_type === 'UNDER' ? 'U' : ''} {player.line}
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`font-semibold ${
                  player.edge_type === 'OVER' ? 'text-green-400' :
                  player.edge_type === 'UNDER' ? 'text-red-400' : 'text-muted-foreground'
                }`}>
                  {player.edge_type}
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  player.confidence >= 70 ? "bg-green-500/20 text-green-400" :
                  player.confidence >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {Math.round(player.confidence)}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  player.hit_rate >= 70 ? "bg-green-500/20 text-green-400" :
                  player.hit_rate >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {Math.round(player.hit_rate)}%
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`font-bold font-display text-lg ${
                  player.trend === "up" ? "text-green-400" :
                  player.trend === "down" ? "text-red-400" : "text-muted-foreground"
                }`}>
                  {player.trend === "up" ? "↑" : player.trend === "down" ? "↓" : "→"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
