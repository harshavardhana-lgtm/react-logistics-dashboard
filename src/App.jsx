import { useCallback, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import Sidebar from './components/Sidebar.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import StatsBar from './components/StatsBar.jsx'
import { useFleet } from './hooks/useFleet.js'

const params = new URLSearchParams(window.location.search)

export default function App() {
  const [mode] = useState(params.get('mode') || 'simulator')
  const [endpoint] = useState(params.get('ws') || '')
  const [live, setLive] = useState(params.get('live') !== '0')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: 'ALL', cargo: 'ALL', attentionOnly: false })

  const { rows, version, phase, attempt, stats, counts, resync, reset, setRows } = useFleet({
    mode,
    endpoint,
    live
  })

  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.id, row.vessel, row.originPort, row.destinationPort, row.cargoClass, row.status]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(needle))
    )
  }, [rows, search])

  const selected = useMemo(
    () => searched.find((row) => row.id === selectedId) || null,
    [searched, selectedId]
  )

  const handleFilter = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  const handleReset = useCallback(async () => {
    await reset()
    setSelectedId(null)
  }, [reset])

  return (
    <div className="app">
      <StatsBar
        phase={phase}
        attempt={attempt}
        version={version}
        counts={counts}
        stats={stats}
        rows={rows}
        mode={mode}
        live={live}
        onToggleLive={() => setLive((value) => !value)}
        onResync={resync}
        onReset={handleReset}
      />
      <main className="body">
        <Sidebar
          rows={searched}
          counts={counts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          onFilterChange={handleFilter}
          search={search}
          onSearch={setSearch}
        />
        <MapView rows={searched} selectedId={selectedId} onSelect={setSelectedId} onReady={setRows} />
        <DetailPanel shipment={selected} onClose={() => setSelectedId(null)} />
      </main>
    </div>
  )
}
