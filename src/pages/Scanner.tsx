// src/pages/Scanner.tsx
// ... (all your existing imports remain)
import { PlayerCard } from '@/components/PlayerCard'; // ✅ ADD THIS

// ... (rest of your code up to the table)

{/* Table replaced with PlayerCard grid */}
{!loading && (
  displayPlayers.length === 0 ? (
    <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
      <p className="text-lg">No players found</p>
      <p className="text-sm mt-1">
        {totalPlayers === 0
          ? "Run the data pipeline first: Admin → Full Ingest → select sport"
          : "Try adjusting your filters"}
      </p>
    </div>
  ) : (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>{displayPlayers.length} players shown · click any card for all prop details</span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayPlayers.map((p, i) => {
          const pd = p.all_props?.[filterProp] || p.all_props?.[Object.keys(p.all_props || {})[0]];
          if (!pd) return null;
          // Map player data to the shape expected by PlayerCard
          const playerForCard = {
            id: p.player_id,
            name: p.name,
            position: p.position,
            team: p.team_abbr,
            opponent: p.opponent,
            gameDate: p.game_date,
            line: pd.line,
            avgLast10: pd.avg_l10,
            hitRates: {
              l5: pd.l5,
              l10: pd.l10,
              l15: pd.l15,
              l20: pd.l20,
            },
            trend: pd.trend,
          };
          return (
            <PlayerCard
              key={`${p.player_id}-${i}`}
              player={playerForCard}
              onClick={() => navigate(`/scanner?playerId=${p.player_id}&sport=${sport}`)}
            />
          );
        })}
      </div>

      {/* Pagination Controls remain the same */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-4 py-3 border-t border-gray-800 bg-gray-900/30">
          <button
            onClick={() => fetchPlayers(Math.max(1, currentPage - 1), selectedGame === "all" ? undefined : selectedGame)}
            disabled={currentPage === 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {totalPages} ({totalPlayers} total)
          </span>
          <button
            onClick={() => fetchPlayers(Math.min(totalPages, currentPage + 1), selectedGame === "all" ? undefined : selectedGame)}
            disabled={currentPage >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
)}
