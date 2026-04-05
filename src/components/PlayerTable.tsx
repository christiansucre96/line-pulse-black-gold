import { PlayerProp, getHitRateClass } from "@/data/mockPlayers";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = "diff" | "l5" | "l10" | "l15" | "streak" | "avgL10";
export type SortDir = "asc" | "desc";

interface PlayerTableProps {
  players: PlayerProp[];
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-3 px-3 font-semibold">Player</th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("avgL10")}>
              <span className="inline-flex items-center gap-1">Avg L10 <SortIcon field="avgL10" /></span>
            </th>
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("diff")}>
              <span className="inline-flex items-center gap-1">Diff <SortIcon field="diff" /></span>
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
            <th className="text-center py-3 px-2 font-semibold cursor-pointer" onClick={() => onSort("streak")}>
              <span className="inline-flex items-center gap-1">Strk <SortIcon field="streak" /></span>
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
                    {player.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{player.name} <span className="text-muted-foreground font-normal">({player.position})</span></div>
                    <div className="text-xs text-muted-foreground">{player.team} vs {player.opponent}</div>
                    <div className="text-xs text-primary">{player.categories.join(" · ")}</div>
                  </div>
                </div>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-3 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l10)}`}>{player.avgL10}</span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`font-semibold ${player.diff > 5 ? "text-green-400" : player.diff > 0 ? "text-primary" : "text-red-400"}`}>
                  {player.diff > 0 ? "+" : ""}{player.diff}
                </span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l5)}`}>{player.l5}%</span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l10)}`}>{player.l10}%</span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getHitRateClass(player.l15)}`}>{player.l15}%</span>
              </td>
              <td className="text-center py-3 px-2">
                <span className={`font-bold font-display text-lg ${player.streak > 5 ? "text-green-400" : player.streak > 0 ? "text-primary" : "text-red-400"}`}>
                  {player.streak}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {players.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No players match your filters.</div>
      )}
    </div>
  );
}
