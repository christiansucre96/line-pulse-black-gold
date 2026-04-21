// src/pages/Scanner.tsx
// (Keep all imports exactly as before, but remove the PlayerCard import)

// ... all your existing code up to the return statement

return (
  <DashboardLayout>
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header & Controls remain unchanged – they already work */}

      {/* Table */}
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-800">
                  <tr>
                    <SortTh label="Player"  sk="name" />
                    <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase tracking-wider">Game</th>
                    <SortTh label="Line"    sk="line" />
                    <SortTh label="Avg L10" sk="avg"  />
                    <SortTh label="Diff"    sk="diff" />
                    <SortTh label="L5"      sk="l5"   />
                    <SortTh label="L10"     sk="l10"  />
                    <SortTh label="L15"     sk="l15"  />
                    <SortTh label="L20"     sk="l20"  />
                    <th className="p-3 text-left text-[11px] font-semibold text-yellow-400/70 uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPlayers.map((p, i) => {
                    const pd = p.all_props?.[filterProp] || p.all_props?.[Object.keys(p.all_props || {})[0]];
                    if (!pd) return null;
                    const diff = ((pd.avg_l10 ?? 0) - (pd.line ?? 0));
                    return (
                      <tr
                        key={`${p.player_id}-${i}`}
                        onClick={() => navigate(`/scanner?playerId=${p.player_id}&sport=${sport}`)}
                        className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition"
                      >
                        {/* Player cell */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-black text-xs font-bold shrink-0">
                              {getInitials(p.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm leading-tight">{p.name}</p>
                              <p className="text-[10px] text-gray-500">
                                {p.team_abbr} · {p.position} · {pd.label}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Game cell */}
                        <td className="p-3">
                          <div>
                            <p className="text-xs text-gray-400">vs {p.opponent}</p>
                            <p className="text-[10px] text-gray-600">{p.game_date}</p>
                          </div>
                        </td>
                        {/* Line, Avg, Diff, Hit rate boxes, Trend – exactly as in your original code */}
                        <td className="p-3"><span className="text-yellow-400 font-bold text-sm">{pd.line?.toFixed(1)}</span></td>
                        <td className="p-3 text-gray-300 text-sm">{pd.avg_l10}</td>
                        <td className="p-3">
                          <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}`}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3"><HRBox value={pd.l5} /></td>
                        <td className="p-3"><HRBox value={pd.l10} /></td>
                        <td className="p-3"><HRBox value={pd.l15} /></td>
                        <td className="p-3"><HRBox value={pd.l20} /></td>
                        <td className="p-3">
                          <span className={`text-xs font-bold ${pd.trend === 'up' ? 'text-green-400' : pd.trend === 'down' ? 'text-red-400' : 'text-gray-600'}`}>
                            {pd.trend === 'up' ? '↑ HOT' : pd.trend === 'down' ? '↓ COLD' : '→ FLAT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination – unchanged */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-gray-800 bg-gray-900/30">
                <button
                  onClick={() => fetchPlayers(Math.max(1, currentPage - 1), selectedGame === "all" ? undefined : selectedGame)}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-gray-400">Page {currentPage} of {totalPages} ({totalPlayers} total)</span>
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
    </div>
  </DashboardLayout>
);
