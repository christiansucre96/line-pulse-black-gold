import { Sport, sports } from "@/data/mockPlayers";

interface SportTabsProps {
  activeSport: Sport;
  onSportChange: (sport: Sport) => void;
}

const sportIcons: Record<Sport, string> = {
  NBA: "🏀",
  NHL: "🏒",
  MLB: "⚾",
  NFL: "🏈",
  Soccer: "⚽",
};

export function SportTabs({ activeSport, onSportChange }: SportTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-1">
      {sports.map((sport) => (
        <button
          key={sport}
          onClick={() => onSportChange(sport)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            activeSport === sport
              ? "bg-gradient-gold text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs">{sportIcons[sport]}</span>
          {sport}
        </button>
      ))}
    </div>
  );
}
