import { useCallback, useEffect, useRef, useState } from 'react'
import { applyDiff, getLastVersion, replaceAll, allShipments, clearAll } from '../data/db.js'
import { LocalSimulator } from '../data/localSimulator.js'
import { StreamClient, wsUrl } from '../data/streamClient.js'

export function useFleet({ mode, endpoint, live }) {
  const [rows, setRows] = useState([])
  const [version, setVersion] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [attempt, setAttempt] = useState(0)
  const [stats, setStats] = useState({ received: 0, snapshots: 0, diffs: 0, resyncs: 0, gaps: 0, dropped: 0 })
  const [counts, setCounts] = useState({ byStatus: {}, byCargo: {} })
  const clientRef = useRef(null)
  const simRef = useRef(null)

  const summarise = useCallback(async () => {
    const all = await allShipments()
    const byStatus = {}
    const byCargo = {}
    for (const row of all) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1
      byCargo[row.cargoClass] = (byCargo[row.cargoClass] || 0) + 1
    }
    setRows(all)
    setCounts({ byStatus, byCargo })
  }, [])

  const handleSnapshot = useCallback(
    async (frame) => {
      const payload = frame.payload || {}
      await replaceAll({ version: frame.version, shipments: payload.shipments || [] })
      setVersion(frame.version || 0)
      await summarise()
    },
    [summarise]
  )

  const handleDiff = useCallback(
    async (frame) => {
      const result = await applyDiff({ version: frame.version, ...(frame.payload || {}) })
      if (!result.applied) return
      setVersion(frame.version)
      await summarise()
    },
    [summarise]
  )

  useEffect(() => {
    let cancelled = false
    getLastVersion().then((v) => {
      if (!cancelled) setVersion(v || 0)
    })
    summarise()
    return () => {
      cancelled = true
    }
  }, [summarise])

  useEffect(() => {
    if (!live) return undefined

    if (mode === 'simulator') {
      const sim = new LocalSimulator({
        onFrame: (frame) => {
          if (frame.type === 'snapshot') handleSnapshot(frame)
          else handleDiff(frame)
        }
      })
      simRef.current = sim
      setPhase('open')
      sim.start()
      return () => sim.stop()
    }

    const client = new StreamClient({
      url: wsUrl(endpoint),
      onSnapshot: handleSnapshot,
      onDiff: handleDiff,
      onState: (state) => {
        if (state.phase) setPhase(state.phase)
        if (typeof state.attempt === 'number') setAttempt(state.attempt)
      }
    })
    clientRef.current = client
    client.start()
    const timer = setInterval(() => {
      if (clientRef.current) setStats({ ...clientRef.current.stats })
    }, 1000)
    return () => {
      clearInterval(timer)
      client.stop()
      clientRef.current = null
    }
  }, [mode, endpoint, live, handleSnapshot, handleDiff])

  const resync = useCallback(() => {
    if (mode === 'simulator') {
      setPhase('open')
      return
    }
    if (clientRef.current) clientRef.current.requestResync()
  }, [mode])

  const reset = useCallback(async () => {
    await clearAll()
    setRows([])
    setVersion(0)
    await summarise()
  }, [summarise])

  return { rows, version, phase, attempt, stats, counts, resync, reset, setRows }
}
