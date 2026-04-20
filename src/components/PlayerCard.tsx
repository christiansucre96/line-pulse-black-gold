// src/components/PlayerCard.tsx
import React from 'react';

// ✅ TypeScript Interfaces
export interface RollingStats {
  avg_points: number | null;
  hit_rate: number | null;
  games_analyzed: number | null;
  target_games: number | null;
  is_complete: boolean | null;
}

export interface Player {
  id: string;
  full_name: string;
  position?: string | null;
  team_abbreviation?: string | null;
  status?: string | null;
  sport?: string;
  rolling_stats?: RollingStats | null;
}

export interface PlayerCardProps {
  player: Player;
  onClick?: (playerId: string) => void;
  className?: string;
}

// ✅ Main Component
export function PlayerCard({ player, onClick, className = '' }: PlayerCardProps) {
  const stats = player.rolling_stats;
  const isClickable = !!onClick;

  // Fallback values for display
  const avgPoints = stats?.avg_points ?? '—';
  const hitRate = stats?.hit_rate ?? '—';
  const gamesAnalyzed = stats?.games_analyzed ?? 0;
  const targetGames = stats?.target_games ?? 20;
  const isComplete = stats?.is_complete ?? false;

  return (
    <div
      className={`
        p-4 bg-gray-800/50 backdrop-blur-sm 
        rounded-xl border border-gray-700/50
        hover:border-blue-500/50 hover:bg-gray-800/80
        transition-all duration-200 cursor-pointer
        ${isClickable ? 'hover:shadow-lg hover:shadow-blue-500/10' : ''}
        ${className}
      `}
      onClick={() => isClickable && onClick?.(player.id)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.(player.id);
        }
      }}
    >
      {/* Header: Name + Position + Team */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white text-lg truncate" title={player.full_name}>
            {player.full_name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {player.position && (
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {player.position}
              </span>
            )}
            {player.team_abbreviation && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-xs text-blue-400 font-medium">
                  {player.team_abbreviation}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ✅ Rolling Stats Badge */}
        <div className="flex-shrink-0">
          {isComplete ? (
            <span 
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30"
              title="Full 20-game window available"
            >
              ✅ L{targetGames}
            </span>
          ) : (
            <span 
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              title={`Only ${gamesAnalyzed} games so far — updating as new games finish`}
            >
              ⏳ L{gamesAnalyzed}/{targetGames}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Avg Points */}
        <div className="p-3 bg-gray-900/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Avg Points</p>
          <p className="text-xl font-bold text-white">
            {avgPoints}
            <span className="text-sm text-gray-500 ml-1">PPG</span>
          </p>
        </div>

        {/* Hit Rate */}
        <div className="p-3 bg-gray-900/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Hit Rate</p>
          <p className="text-xl font-bold text-white">
            {hitRate}
            <span className="text-sm text-gray-500 ml-1">%</span>
          </p>
        </div>
      </div>

      {/* Helper Message */}
      {stats && !isComplete && gamesAnalyzed > 0 && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700/50">
          Stats update hourly • {targetGames - gamesAnalyzed} more games needed for full L{targetGames}
        </p>
      )}

      {/* No Data State */}
      {!stats || gamesAnalyzed === 0 ? (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700/50 text-center">
          Waiting for game data...
        </p>
      ) : null}
    </div>
  );
}

// ✅ Optional: Export a memoized version for performance
export const MemoizedPlayerCard = React.memo(PlayerCard);
