// src/pages/Scanner.tsx
import { useState, useEffect } from 'react'
import { fetchPlayersWithRollingStats, type PlayerWithRollingStats } from '../services/playerService'
import { PlayerCard } from '../components/PlayerCard'

export default function Scanner() {
  const [players, setPlayers] = useState<PlayerWithRollingStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState('nba')

  useEffect(() => {
    async function loadPlayers() {
      try {
        setLoading(true)
        const data = await fetchPlayersWithRollingStats(selectedSport, 100)
        setPlayers(data)
        setError(null)
      } catch (err) {
        console.error('Failed to load players:', err)
        setError('Failed to load player data. Check console for details.')
      } finally {
        setLoading(false)
      }
    }
    
    loadPlayers()
  }, [selectedSport])

  // Filter players by search term
  const filteredPlayers = players.filter(p => {
    const searchLower = searchTerm.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(searchLower) ||
      (p.team_abbreviation || '').toLowerCase().includes(searchLower) ||
      (p.position || '').toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          📊 Player Scanner
        </h1>
        <p className="text-gray-400 mt-1">
          Real-time NBA stats with server-side L20 rolling averages
        </p>
      </header>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="🔍 Search players, teams, or positions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl 
                     focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 
                     transition-all placeholder:text-gray-500"
        />
        <select
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          className="px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl 
                     focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="nba">🏀 NBA</option>
          {/* Add more sports later if needed */}
        </select>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading player stats...</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-xl text-center">
          {error}
        </div>
      ) : filteredPlayers.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No players found matching "{searchTerm}"</p>
        </div>
      ) : (
        /* Player Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onClick={(playerId) => {
                // Replace with your router: navigate(`/player/${playerId}`)
                window.location.href = `/scanner?playerId=${playerId}&sport=${selectedSport}`
              }}
            />
          ))}
        </div>
      )}

      {/* Footer Hint */}
      <footer className="mt-8 text-center text-xs text-gray-600">
        Stats refresh automatically when games finish • Data updated hourly
      </footer>
    </div>
  )
}
