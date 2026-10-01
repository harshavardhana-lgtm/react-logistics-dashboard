import { describe, expect, it } from 'vitest'
import { StreamClient } from '../src/data/streamClient.js'
import { LocalSimulator } from '../src/data/localSimulator.js'
import { STATUS_META, SEVERITY_ORDER, CARGO_CLASSES } from '../src/lib/taxonomy.js'
import { generateShipments, mutateShipment, mulberry32 } from '../src/data/seed.js'

class FakeSocket {
  static OPEN = 1
  static CLOSED = 3
  constructor() {
    this.readyState = 1
    this.sent = []
  }
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.readyState = 3
    if (this.onclose) this.onclose({})
  }
  emit(frame) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(frame) })
  }
  open() {
    this.onopen && this.onopen({})
  }
}

let sockets = []

function attach(client) {
  sockets = []
  const previous = globalThis.WebSocket
  globalThis.WebSocket = function Stub() {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  }
  globalThis.WebSocket.OPEN = 1
  globalThis.WebSocket.CLOSED = 3
  client.start()
  const socket = sockets[0]
  socket.open()
  return { socket, restore: () => { globalThis.WebSocket = previous } }
}

describe('StreamClient versioning', () => {
  it('applies monotonic diffs and ignores stale ones', () => {
    const seen = []
    const client = new StreamClient({ url: 'ws://x/ws', onDiff: (f) => seen.push(f.version) })
    const { socket } = attach(client)
    socket.emit({ type: 'snapshot', version: 10, payload: { shipments: [] } })
    socket.emit({ type: 'diff', version: 11, payload: {} })
    socket.emit({ type: 'diff', version: 12, payload: {} })
    socket.emit({ type: 'diff', version: 11, payload: {} })
    expect(seen).toEqual([11, 12])
    expect(client.stats.dropped).toBe(1)
  })

  it('requests a resync when a version gap appears', () => {
    const client = new StreamClient({ url: 'ws://x/ws', onDiff: () => {} })
    const { socket } = attach(client)
    socket.emit({ type: 'snapshot', version: 5, payload: { shipments: [] } })
    const resyncsBefore = client.stats.resyncs
    socket.emit({ type: 'diff', version: 9, payload: {} })
    expect(client.stats.gaps).toBe(1)
    expect(client.stats.resyncs).toBe(resyncsBefore + 1)
    expect(socket.sent.some((m) => m.type === 'resync')).toBe(true)
  })

  it('resets the version baseline when a snapshot arrives', () => {
    const seen = []
    const client = new StreamClient({ url: 'ws://x/ws', onDiff: (f) => seen.push(f.version) })
    const { socket } = attach(client)
    socket.emit({ type: 'diff', version: 40, payload: {} })
    socket.emit({ type: 'snapshot', version: 2, payload: { shipments: [] } })
    socket.emit({ type: 'diff', version: 3, payload: {} })
    expect(seen).toEqual([40, 3])
  })

  it('drops unparseable frames instead of throwing', () => {
    const client = new StreamClient({ url: 'ws://x/ws', onDiff: () => {} })
    const { socket } = attach(client)
    socket.onmessage({ data: 'not json' })
    socket.onmessage({ data: 'null' })
    expect(client.stats.dropped).toBe(2)
  })

  it('sends ping on start and reports pong state', () => {
    const states = []
    const client = new StreamClient({
      url: 'ws://x/ws',
      pingIntervalMs: 10,
      onState: (s) => states.push(s.phase)
    })
    const { socket } = attach(client)
    return new Promise((resolve) => {
      setTimeout(() => {
        socket.emit({ type: 'pong' })
        expect(socket.sent.some((m) => m.type === 'ping')).toBe(true)
        expect(states).toContain('open')
        client.stop()
        resolve()
      }, 40)
    })
  })
})

describe('LocalSimulator', () => {
  it('emits a snapshot first, then versioned diffs', () => {
    const frames = []
    const sim = new LocalSimulator({ count: 300, seed: 5, intervalMs: 5, onFrame: (f) => frames.push(f) })
    sim.start()
    sim.stop()
    expect(frames[0].type).toBe('snapshot')
    expect(frames[0].payload.shipments).toHaveLength(300)
  })

  it('never emits a version gap or a repeat', () => {
    const versions = []
    const sim = new LocalSimulator({ count: 200, seed: 11, intervalMs: 1, onFrame: (f) => {
      if (f.type === 'diff') versions.push(f.version)
    } })
    sim.start()
    return new Promise((resolve) => {
      setTimeout(() => {
        sim.stop()
        for (let i = 0; i < versions.length; i += 1) {
          expect(versions[i]).toBe(i + 1)
        }
        resolve()
      }, 120)
    })
  })

  it('keeps shipment ids unique across added records', () => {
    const ids = new Set()
    const sim = new LocalSimulator({ count: 120, seed: 3, intervalMs: 1, onFrame: (f) => {
      const p = f.payload || {}
      for (const row of p.added || []) ids.add(row.id)
    } })
    sim.start()
    return new Promise((resolve) => {
      setTimeout(() => {
        sim.stop()
        expect(ids.size).toBeGreaterThan(0)
        for (const row of sim.state) ids.add(row.id)
        expect(ids.size).toBe(sim.state.length)
        resolve()
      }, 120)
    })
  })
})

describe('seed data', () => {
  it('is deterministic for a given seed and clock', () => {
    const fixed = 1756500000000
    expect(generateShipments(20, 99, fixed)).toEqual(generateShipments(20, 99, fixed))
  })

  it('produces valid records with a distinct origin and destination', () => {
    const rows = generateShipments(200, 4)
    expect(rows).toHaveLength(200)
    for (const row of rows) {
      expect(row.originPort).not.toBe(row.destinationPort)
      expect(row.lat).toBeGreaterThanOrEqual(-60)
      expect(row.lat).toBeLessThanOrEqual(70)
      expect(CARGO_CLASSES).toContain(row.cargoClass)
      expect(STATUS_META[row.status]).toBeTruthy()
      expect(row.id).toMatch(/^SHP-\d+$/)
    }
  })

  it('keeps coordinates within a plausible step of the previous position', () => {
    const rand = mulberry32(2)
    const before = generateShipments(1, 8)[0]
    const after = mutateShipment(before, 1, rand)
    expect(Math.abs(after.lon - before.lon)).toBeLessThan(1)
    expect(Math.abs(after.lat - before.lat)).toBeLessThan(1)
    expect(after.progress).toBeGreaterThanOrEqual(before.progress)
  })

  it('orders statuses by operational priority', () => {
    const priorities = SEVERITY_ORDER.map((s) => STATUS_META[s].priority)
    expect(priorities[0]).toBe(5)
    expect(priorities[priorities.length - 1]).toBe(0)
  })
})
