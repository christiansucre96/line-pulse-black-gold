// src/pages/InjuryReport.tsx
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface Injury {
  id: string;
  full_name: string;
  team_abbreviation: string;
  position: string;
  injury_status: string;
  injury_type: string;
  injury_side: string;
  injury_description: string;
  long_description: string;
  return_estimate: string;
  last_updated: string;
}

const STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  out:          { bg: "#1a0000", text: "#ff4444", border: "#8b0000", label: "OUT" },
  doubtful:     { bg: "#1a0a00", text: "#ff6600", border: "#993d00", label: "DOUBTFUL" },
  questionable: { bg: "#1a1400", text: "#f5bc2f", border: "#c8970a", label: "QUESTIONABLE" },
  probable:     { bg: "#001200", text: "#22c55e", border: "#16a34a", label: "PROBABLE" },
  unknown:      { bg: "#0d1117", text: "#4a5568", border: "#1e2530", label: "UNKNOWN" },
}

function cfg(s: string) { return STATUS[s?.toLowerCase()] || STATUS.unknown }

// Clean position — remove JSON if it snuck in
function cleanPosition(pos: string): string {
  if (!pos) return ''
  try {
    const parsed = JSON.parse(pos)
    return parsed.abbreviation || parsed.name || ''
  } catch {
    return pos
  }
}

// ─── NEW: Clean any field that might contain JSON ────────────────────────────
function cleanField(value: string | null | undefined): string {
  if (!value) return ''
  
  // If it's JSON, try to extract useful data
  if (value.includes('{')) {
    try {
      const parsed = JSON.parse(value)
      // Return the most useful field
      return parsed.description || 
             parsed.name || 
             parsed.abbreviation || 
             parsed.text || 
             ''
    } catch {
      // Invalid JSON - return empty
      return ''
    }
  }
  
  return value
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const links = [
    { path: '/roster',  label: '📋 Lineups' },
    { path: '/injuries', label: '🏥 Injuries' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 28,
      padding: '4px', background: '#0a0e14',
      borderRadius: 10, border: '1px solid #1a2030',
      width: 'fit-content',
    }}>
      {links.map(l => {
        const active = location.pathname === l.path
        return (
          <button key={l.path} onClick={() => navigate(l.path)} style={{
            padding: '8px 20px', borderRadius: 7,
            border: 'none', cursor: 'pointer',
            background: active ? '#1a1200' : 'transparent',
            color: active ? '#f5bc2f' : '#4a5568',
            fontSize: 12, fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.06em',
            transition: 'all 0.15s ease',
            outline: active ? '1px solid #c8970a' : 'none',
          }}>
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = cfg(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      fontSize: 10, fontWeight: 700, color: c.text,
      fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
    }}>
      <svg width="6" height="6" viewBox="0 0 6 6">
        <circle cx="3" cy="3" r="3" fill={c.text} />
      </svg>
      {c.label}
    </span>
  )
}

// ─── Return Chip ──────────────────────────────────────────────────────────────
function ReturnChip({ estimate }: { estimate: string }) {
  if (!estimate || estimate === 'TBD') return null
  const isLong = /season|month/i.test(estimate)
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 5,
      background: isLong ? '#1a0000' : '#0d1117',
      border: `1px solid ${isLong ? '#8b000050' : '#1e2530'}`,
      fontSize: 10, color: isLong ? '#ff4444' : '#64748b',
      fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap',
    }}>
      ⏱ {estimate}
    </span>
  )
}

// ─── Injury Card ──────────────────────────────────────────────────────────────
function InjuryCard({ injury }: { injury: Injury }) {
  const [open, setOpen] = useState(false)
  const c = cfg(injury.injury_status)
  
  // ✅ Clean all fields before display
  const pos = cleanField(cleanPosition(injury.position))
  const injuryType = cleanField(injury.injury_type)
  const injurySide = cleanField(injury.injury_side)
  const description = cleanField(injury.injury_description)
  const longDesc = cleanField(injury.long_description)
  
  const hasMore = longDesc && longDesc !== description

  return (
    <div style={{
      background: '#0a0e14', borderRadius: 10, marginBottom: 6,
      border: `1px solid ${c.border}30`,
      overflow: 'hidden', transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = `${c.border}80`}
    onMouseLeave={e => e.currentTarget.style.borderColor = `${c.border}30`}
    >
      {/* Main row */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>

          {/* Left: name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <StatusBadge status={injury.injury_status} />
              <span style={{
                fontSize: 15, fontWeight: 700, color: '#e8d48b',
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {injury.full_name}
              </span>
              <ReturnChip estimate={cleanField(injury.return_estimate)} />
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Team pill */}
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: '#141820', border: '1px solid #1e2530',
                fontSize: 11, fontWeight: 700, color: '#94a3b8',
                fontFamily: "'DM Mono', monospace",
              }}>{injury.team_abbreviation}</span>

              {pos && (
                <span style={{ fontSize: 11, color: '#4a5568', fontFamily: "'DM Mono', monospace" }}>
                  {pos}
                </span>
              )}

              {injuryType && (
                <>
                  <span style={{ color: '#1e2530' }}>·</span>
                  <span style={{ fontSize: 11, color: c.text, fontFamily: "'DM Mono', monospace" }}>
                    {injuryType}
                  </span>
                </>
              )}

              {injurySide && (
                <span style={{ fontSize: 11, color: '#2e3748', fontFamily: "'DM Mono', monospace" }}>
                  ({injurySide})
                </span>
              )}
            </div>
          </div>

          {/* Right: date + expand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: '#2e3748', fontFamily: "'DM Mono', monospace" }}>
              {new Date(injury.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {hasMore && (
              <button onClick={() => setOpen(!open)} style={{
                background: 'none', border: `1px solid #1e2530`, borderRadius: 4,
                color: '#2e3748', fontSize: 10, cursor: 'pointer',
                padding: '2px 6px', fontFamily: "'DM Mono', monospace",
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.text }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2530'; e.currentTarget.style.color = '#2e3748' }}
              >
                {open ? '▴ less' : '▾ more'}
              </button>
            )}
          </div>
        </div>

        {/* Short description - now clean */}
        {description && (
          <div style={{
            marginTop: 10,
            paddingLeft: 12,
            borderLeft: `2px solid ${c.border}60`,
            fontSize: 11, color: '#94a3b8',
            fontFamily: "'DM Mono', monospace", lineHeight: 1.6,
          }}>
            {description}
          </div>
        )}
      </div>

      {/* Expanded long description */}
      {open && hasMore && (
        <div style={{
          padding: '10px 16px 14px',
          borderTop: `1px solid #1a2030`,
          background: '#060a0f',
          fontSize: 11, color: '#64748b',
          fontFamily: "'DM Mono', monospace", lineHeight: 1.7,
        }}>
          {longDesc}
        </div>
      )}
    </div>
  )
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function Pill({ count, label, color, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
      border: `1px solid ${active ? color : '#1e2530'}`,
      background: active ? `${color}18` : '#0d1117',
      color: active ? color : '#4a5568',
      fontSize: 12, fontWeight: 700,
      fontFamily: "'DM Mono', monospace",
      transition: 'all 0.15s',
    }}>
      {count} {label}
    </button>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function InjuryReport() {
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading]   = useState(true)
  const [scraping, setScraping] = useState(false)
  const [filter, setFilter]     = useState('all')
  const [team, setTeam]         = useState('all')
  const [search, setSearch]     = useState('')
  const [lastUpdated, setLast]  = useState('')
  const [msg, setMsg]           = useState('')
  const [error, setError]       = useState<string | null>(null)

  async function loadFromDB() {
    const { data, error: e } = await supabase
      .from('injuries').select('*').eq('sport', 'nba')
      .order('injury_status').order('team_abbreviation').order('full_name')
    if (e) throw e
    return (data || []).map(i => ({ ...i, position: cleanPosition(i.position) }))
  }

  async function runScraper() {
    setScraping(true); setMsg('⏳ Fetching from ESPN...')
    try {
      const { data, error: e } = await supabase.functions.invoke('nba-injury-scraper', { body: {} })
      if (e) throw new Error(e.message)
      setMsg(`✅ ${data.stored} injuries loaded`)
      const fresh = await loadFromDB()
      setInjuries(fresh)
      setLast(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) { setError(`Scraper failed: ${e.message}`) }
    finally { setScraping(false); setLoading(false) }
  }

  async function fetchInjuries() {
    setLoading(true); setError(null); setMsg('')
    try {
      const data = await loadFromDB()
      if (data.length === 0) { await runScraper(); return }
      setInjuries(data)
      setLast(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchInjuries()
    const t = setInterval(fetchInjuries, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const teams = [...new Set(injuries.map(i => i.team_abbreviation))].sort()
  const priority: Record<string, number> = { out: 1, doubtful: 2, questionable: 3, probable: 4 }

  const filtered = injuries
    .filter(i => filter === 'all' || i.injury_status === filter)
    .filter(i => team === 'all' || i.team_abbreviation === team)
    .filter(i => !search || i.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (priority[a.injury_status] || 5) - (priority[b.injury_status] || 5))

  const counts = {
    out:          injuries.filter(i => i.injury_status === 'out').length,
    doubtful:     injuries.filter(i => i.injury_status === 'doubtful').length,
    questionable: injuries.filter(i => i.injury_status === 'questionable').length,
    probable:     injuries.filter(i => i.injury_status === 'probable').length,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:#060a0f}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0e14}
        ::-webkit-scrollbar-thumb{background:#1e2530;border-radius:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        input:focus{outline:none;border-color:#c8970a !important}
      `}</style>

      <div style={{ minHeight: '100vh', background: '#060a0f', padding: '32px 24px', fontFamily: "'DM Mono', monospace" }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Nav */}
          <Nav />

          {/* Header */}
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontSize: 10, color: '#ff4444', fontWeight: 700, letterSpacing: '0.2em' }}>NBA INJURY REPORT</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#e8d48b', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {lastUpdated && <span style={{ fontSize: 10, color: '#2e3748' }}>Updated {lastUpdated}</span>}
              <button onClick={fetchInjuries} disabled={loading || scraping} style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #1e2530',
                background: '#0d1117', color: '#4a5568', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', animation: (loading || scraping) ? 'spin 1s linear infinite' : 'none' }}>↻</span>
                {scraping ? 'Scraping...' : 'Refresh'}
              </button>
              <button onClick={runScraper} disabled={scraping} style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #8b000060',
                background: '#1a0000', color: '#ff4444', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}>⚡ Pull ESPN</button>
            </div>
          </div>

          {/* Banners */}
          {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#1a0000', border: '1px solid #8b0000', borderRadius: 8, color: '#ff4444', fontSize: 11 }}>❌ {error}</div>}
          {msg && !error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#001200', border: '1px solid #16a34a', borderRadius: 8, color: '#22c55e', fontSize: 11 }}>{msg}</div>}

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Pill count={injuries.length} label="Total"        color="#94a3b8" active={filter === 'all'}          onClick={() => setFilter('all')} />
            <Pill count={counts.out}          label="Out"          color="#ff4444" active={filter === 'out'}          onClick={() => setFilter('out')} />
            <Pill count={counts.doubtful}     label="Doubtful"     color="#ff6600" active={filter === 'doubtful'}     onClick={() => setFilter('doubtful')} />
            <Pill count={counts.questionable} label="Questionable" color="#f5bc2f" active={filter === 'questionable'} onClick={() => setFilter('questionable')} />
            <Pill count={counts.probable}     label="Probable"     color="#22c55e" active={filter === 'probable'}     onClick={() => setFilter('probable')} />
          </div>

          {/* Search + team */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              placeholder="Search player..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8,
                background: '#0d1117', border: '1px solid #1e2530',
                color: '#cbd5e1', fontSize: 12, fontFamily: "'DM Mono', monospace",
              }}
            />
            <select value={team} onChange={e => setTeam(e.target.value)} style={{
              padding: '8px 12px', borderRadius: 8,
              background: '#0d1117', border: '1px solid #1e2530',
              color: '#cbd5e1', fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
            }}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Loading */}
          {(loading || scraping) && injuries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a5568' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #1e2530', borderTopColor: '#ff4444', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ animation: 'pulse 2s ease infinite' }}>{scraping ? 'Fetching from ESPN...' : 'Loading...'}</div>
            </div>
          )}

          {/* Empty */}
          {!loading && !scraping && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4a5568' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No injuries found</div>
              <div style={{ fontSize: 11, color: '#2e3748' }}>Click ⚡ Pull ESPN to fetch latest</div>
            </div>
          )}

          {/* List */}
          {filtered.map(i => <InjuryCard key={i.id} injury={i} />)}

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#0a0e14', borderRadius: 8, border: '1px solid #1a2030', fontSize: 10, color: '#2e3748', fontFamily: "'DM Mono', monospace", display: 'flex', justifyContent: 'space-between' }}>
              <span>Showing {filtered.length} of {injuries.length} players</span>
              <span>ESPN • Click ▾ more to expand details</span>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
