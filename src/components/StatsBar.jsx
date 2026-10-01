const PHASE_LABEL = {
  idle: 'Idle',
  connecting: 'Connecting',
  open: 'Live',
  error: 'Error',
  closed: 'Disconnected',
  reconnecting: 'Reconnecting'
}

export default function StatsBar({ phase, attempt, version, counts, stats, rows, mode, live, onToggleLive, onResync, onReset }) {
  const total = rows.length
  const attention = rows.filter((row) => {
    const meta = counts.byStatus
    return meta && row.delayHours > 0
  }).length
  const delayed = counts.byStatus.DELAYED || 0
  const customs = counts.byStatus.CUSTOMS_HOLD || 0
  const inTransit = counts.byStatus.IN_TRANSIT || 0

  return (
    <header className="stats">
      <div className="brand">
        <span className="brand-mark">◈</span>
        <div>
          <h1>Logistics Operations</h1>
          <p>Fleet telemetry · {mode === 'simulator' ? 'local simulator' : 'live stream'}</p>
        </div>
      </div>

      <div className="metrics">
        <Metric label="Tracked" value={total} />
        <Metric label="In transit" value={inTransit} />
        <Metric label="Delayed" value={delayed} tone={delayed > 0 ? 'warn' : 'plain'} />
        <Metric label="Customs hold" value={customs} tone={customs > 0 ? 'bad' : 'plain'} />
        <Metric label="With delay flag" value={attention} tone={attention > 0 ? 'warn' : 'plain'} />
      </div>

      <div className="conn">
        <span className={`phase phase-${phase}`}>{PHASE_LABEL[phase] || phase}</span>
        {attempt > 0 ? <span className="muted">attempt {attempt}</span> : null}
        <span className="muted">v{version}</span>
        <span className="muted" title="diffs received by client">
          Δ{stats.diffs || 0} · gaps {stats.gaps || 0}
        </span>
        <button type="button" onClick={onResync}>Resync</button>
        <button type="button" onClick={onToggleLive}>{live ? 'Pause' : 'Resume'}</button>
        <button type="button" className="danger" onClick={onReset}>Clear</button>
      </div>
    </header>
  )
}

function Metric({ label, value, tone = 'plain' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  )
}
