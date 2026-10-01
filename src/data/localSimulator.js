import { generateShipments, mulberry32, mutateShipment } from './seed.js'

export class LocalSimulator {
  constructor({ count = 900, seed = 20260929, intervalMs = 500, onFrame }) {
    this.intervalMs = intervalMs
    this.onFrame = onFrame || (() => {})
    this.rand = mulberry32(seed + 7)
    this.version = 0
    this.state = generateShipments(count, seed)
    this.byId = new Map(this.state.map((row) => [row.id, row]))
    this.nextId = 100000 + this.state.length
    this.timer = null
  }

  start() {
    this.#emitSnapshot()
    this.timer = setInterval(() => this.#tick(), this.intervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  #emitSnapshot() {
    this.onFrame({
      type: 'snapshot',
      version: this.version,
      payload: { count: this.state.length, shipments: this.state }
    })
  }

  #tick() {
    const added = []
    const updated = []
    const removed = []
    const churn = 1 + Math.floor(this.rand() * 4)
    for (let i = 0; i < churn; i += 1) {
      const roll = this.rand()
      if (roll < 0.18 && this.state.length < 1400) {
        const fresh = generateShipments(1, Math.floor(this.rand() * 1e9), Date.now())[0]
        fresh.id = `SHP-${this.nextId}`
        this.nextId += 1
        this.state.push(fresh)
        this.byId.set(fresh.id, fresh)
        added.push(fresh)
      } else if (roll < 0.32 && this.state.length > 200) {
        const victim = this.state[Math.floor(this.rand() * this.state.length)]
        this.state = this.state.filter((row) => row.id !== victim.id)
        this.byId.delete(victim.id)
        removed.push(victim.id)
      } else {
        const index = Math.floor(this.rand() * this.state.length)
        const current = this.state[index]
        const next = mutateShipment(current, this.version + 1, this.rand)
        this.state[index] = next
        this.byId.set(next.id, next)
        updated.push(next)
      }
    }
    if (added.length === 0 && updated.length === 0 && removed.length === 0) {
      return
    }
    this.version += 1
    this.onFrame({
      type: 'diff',
      version: this.version,
      payload: { added, updated, removed, addedCount: added.length, updatedCount: updated.length, removedCount: removed.length }
    })
  }
}
