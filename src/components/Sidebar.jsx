import { CARGO_CLASSES, SEVERITY_ORDER, STATUS_META } from '../lib/taxonomy.js'

export default function Sidebar({ rows, counts, selectedId, onSelect, filters, onFilterChange, search, onSearch }) {
  const visible = rows.filter((row) => {
    if (filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.cargo !== 'ALL' && row.cargoClass !== filters.cargo) return false
    if (filters.attentionOnly) {
      const meta = STATUS_META[row.status]
      if (!meta || meta.priority < 3) return false
    }
    return true
  })

  const ordered = [...visible].sort((a, b) => {
    const pa = STATUS_META[a.status] ? STATUS_META[a.status].priority : 0
    const pb = STATUS_META[b.status] ? STATUS_META[b.status].priority : 0
    if (pa !== pb) return pb - pa
    if (a.delayHours !== b.delayHours) return b.delayHours - a.delayHours
    return b.lastEventAt - a.lastEventAt
  })

  return (
    <aside className="sidebar">
      <div className="filters">
        <input
          className="search"
          placeholder="Search id, vessel, port, cargo"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <div className="filter-row">
          <select value={filters.status} onChange={(event) => onFilterChange({ status: event.target.value })}>
            <option value="ALL">All statuses</option>
            {SEVERITY_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label} ({counts.byStatus[status] || 0})
              </option>
            ))}
          </select>
          <select value={filters.cargo} onChange={(event) => onFilterChange({ cargo: event.target.value })}>
            <option value="ALL">All cargo</option>
            {CARGO_CLASSES.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo} ({counts.byCargo[cargo] || 0})
              </option>
            ))}
          </select>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={filters.attentionOnly}
            onChange={(event) => onFilterChange({ attentionOnly: event.target.checked })}
          />
          Needs attention only
        </label>
      </div>

      <div className="list-head">
        <span>{ordered.length} shown</span>
        <span>{rows.length} total</span>
      </div>

      <ul className="list">
        {ordered.map((row) => {
          const meta = STATUS_META[row.status] || { label: row.status, color: '#64748b', priority: 0 }
          return (
            <li key={row.id}>
              <button
                type="button"
                className={row.id === selectedId ? 'card selected' : 'card'}
                onClick={() => onSelect(row.id)}
              >
                <span className="dot" style={{ background: meta.color }} />
                <span className="card-main">
                  <span className="card-title">{row.id}</span>
                  <span className="card-sub">
                    {row.vessel} · {row.originPort} → {row.destinationPort}
                  </span>
                </span>
                <span className="card-meta">
                  <span className="status-label" style={{ color: meta.color }}>{meta.label}</span>
                  {row.delayHours > 0 ? <span className="delay">+{row.delayHours}h</span> : null}
                </span>
              </button>
            </li>
          )
        })}
        {ordered.length === 0 ? <li className="empty">No shipments match the current filters.</li> : null}
      </ul>
    </aside>
  )
}
