const GAP_TOLERANCE = 1

export class StreamClient {
  constructor({ url, onSnapshot, onDiff, onState, pingIntervalMs = 20000 }) {
    this.url = url
    this.onSnapshot = onSnapshot || (() => {})
    this.onDiff = onDiff || (() => {})
    this.onState = onState || (() => {})
    this.pingIntervalMs = pingIntervalMs
    this.socket = null
    this.lastVersion = 0
    this.attempt = 0
    this.closed = false
    this.pingTimer = null
    this.reconnectTimer = null
    this.stats = { received: 0, snapshots: 0, diffs: 0, resyncs: 0, gaps: 0, dropped: 0 }
  }

  start() {
    this.closed = false
    this.#connect()
    this.#schedulePing()
  }

  stop() {
    this.closed = true
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.socket) {
      try {
        this.socket.close()
      } catch {
        this.socket = null
      }
    }
  }

  send(payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload))
    }
  }

  requestResync() {
    this.stats.resyncs += 1
    this.send({ type: 'resync' })
  }

  #schedulePing() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), this.pingIntervalMs)
  }

  #connect() {
    if (this.closed) return
    this.onState({ phase: 'connecting', attempt: this.attempt })
    let socket
    try {
      socket = new WebSocket(this.url)
    } catch {
      this.#scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.onState({ phase: 'open', attempt: 0 })
      this.requestResync()
    }

    socket.onmessage = (event) => {
      let frame
      try {
        frame = JSON.parse(event.data)
      } catch {
        this.stats.dropped += 1
        return
      }
      this.stats.received += 1
      this.#dispatch(frame)
    }

    socket.onerror = () => {
      this.onState({ phase: 'error' })
    }

    socket.onclose = () => {
      this.onState({ phase: 'closed' })
      this.#scheduleReconnect()
    }
  }

  #dispatch(frame) {
    if (!frame || typeof frame !== 'object') {
      this.stats.dropped += 1
      return
    }
    if (frame.type === 'snapshot') {
      this.stats.snapshots += 1
      this.lastVersion = frame.version || 0
      this.onSnapshot(frame)
      return
    }
    if (frame.type === 'diff') {
      const version = frame.version || 0
      if (version <= this.lastVersion) {
        this.stats.dropped += 1
        return
      }
      if (this.lastVersion > 0 && version > this.lastVersion + GAP_TOLERANCE) {
        this.stats.gaps += 1
        this.requestResync()
        return
      }
      this.lastVersion = version
      this.stats.diffs += 1
      this.onDiff(frame)
      return
    }
    if (frame.type === 'pong' || frame.type === 'stats') {
      this.onState({ phase: 'open', stats: frame })
    }
  }

  #scheduleReconnect() {
    if (this.closed) return
    this.attempt += 1
    const delay = Math.min(15000, 400 * 2 ** Math.min(this.attempt, 5))
    this.onState({ phase: 'reconnecting', attempt: this.attempt, delay })
    this.reconnectTimer = setTimeout(() => this.#connect(), delay)
  }
}

export function wsUrl(input) {
  if (!input) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.hostname}:8090/ws`
  }
  if (input.startsWith('ws://') || input.startsWith('wss://')) return input
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${input}`
}
