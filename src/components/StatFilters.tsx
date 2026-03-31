import { Sport, sportCategories } from "@/data/mockPlayers";
import { X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface StatFiltersProps {
  activeStats: string[];
  onToggleStat: (stat: string) => void;
  sport: Sport;
}

export function StatFilters({ activeStats, onToggleStat, sport }: StatFiltersProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cats = sportCategories[sport];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {activeStats.map((stat) => (
        <span key={stat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
          {stat}
          <button onClick={() => onToggleStat(stat)} className="hover:text-primary transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute top-full mt-1 right-0 z-50 bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[200px] max-h-72 overflow-y-auto">
            <div className="text-xs font-bold text-primary px-3 py-1">Core</div>
            {cats.core.map((stat) => (
              <label key={stat} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary cursor-pointer text-sm">
                <input type="checkbox" checked={activeStats.includes(stat)} onChange={() => onToggleStat(stat)} className="accent-primary w-4 h-4" />
                {stat}
              </label>
            ))}
            <div className="text-xs font-bold text-primary px-3 py-1 mt-1">Combos</div>
            {cats.combos.map((stat) => (
              <label key={stat} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary cursor-pointer text-sm">
                <input type="checkbox" checked={activeStats.includes(stat)} onChange={() => onToggleStat(stat)} className="accent-primary w-4 h-4" />
                {stat}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
