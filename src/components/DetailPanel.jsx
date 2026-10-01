import { STATUS_META } from '../lib/taxonomy.js'

function fmt(value) {
  if (!value) return '—'
  return new Date(value).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function DetailPanel({ shipment, onClose }) {
  if (!shipment) {
    return (
      <aside className="detail empty-detail">
        <p>Select a shipment to inspect its current state.</p>
      </aside>
    )
  }
  const meta = STATUS_META[shipment.status] || { label: shipment.status, color: '#64748b' }
  return (
    <aside className="detail">
      <div className="detail-head">
        <div>
          <h2>{shipment.id}</h2>
          <p className="muted">{shipment.vessel}</p>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close detail">
          ×
        </button>
      </div>

      <div className="pill" style={{ background: meta.color }}>{meta.label}</div>

      <div className="progress" aria-label="Voyage progress">
        <div className="progress-fill" style={{ width: `${Math.round((shipment.progress || 0) * 100)}%` }} />
      </div>
      <p className="progress-label">{Math.round((shipment.progress || 0) * 100)}% of voyage complete</p>

      <div className="detail-grid">
        <Row label="IMO" value={shipment.imo} />
        <Row label="Cargo class" value={shipment.cargoClass} />
        <Row label="Origin" value={shipment.originPort} />
        <Row label="Destination" value={shipment.destinationPort} />
        <Row label="TEU" value={shipment.teu} />
        <Row label="Gross tonnage" value={shipment.grossTonnage} />
        <Row label="Deadweight" value={shipment.dwt} />
        <Row label="Position" value={`${shipment.lon}, ${shipment.lat}`} />
        <Row label="ETA" value={fmt(shipment.eta)} />
        <Row label="Last event" value={fmt(shipment.lastEventAt)} />
        <Row label="MMSI stamp" value={shipment.mmss || '—'} />
      </div>

      {shipment.delayHours > 0 ? (
        <div className="alert">Delay of {shipment.delayHours} hours against schedule</div>
      ) : (
        <div className="ok">On schedule</div>
      )}
    </aside>
  )
}
