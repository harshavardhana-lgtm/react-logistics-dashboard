import { CARGO_CLASSES, PORTS, STATUSES } from '../lib/taxonomy.js'

const VESSEL_PREFIX = ['MV', 'MV', 'MV', 'MSC', 'CMA', 'ONE', 'HAP', 'EVG', 'COS', 'OOCL']
const VESSEL_NAME = [
  'Meridian', 'Nordic Star', 'Baltic Trader', 'Ocean Pioneer', 'Cape Horizon',
  'Ionian Wave', 'Malabar Express', 'Levant Runner', 'Aegean Spirit', 'Pacific Dawn',
  'Suez Venture', 'Coral Empress', 'Baltic Sentinel', 'Atlantic Compass', 'Indus Voyager'
]

export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)]
}

function blend(a, b, t) {
  return a + (b - a) * t
}

function jitter(lon, lat, rand) {
  return [lon + (rand() - 0.5) * 1.6, lat + (rand() - 0.5) * 1.1]
}

function shortMmss(epochMs, rand) {
  const d = new Date(epochMs)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day}${hh}${mm}${ss}${rand() > 0.5 ? 'Z' : ''}`
}

export function generateShipments(count, seed, now = Date.now()) {
  const rand = mulberry32(seed)
  const out = []
  for (let i = 0; i < count; i += 1) {
    const origin = pick(rand, PORTS)
    let destination = pick(rand, PORTS)
    if (destination.code === origin.code) {
      destination = PORTS[(PORTS.indexOf(origin) + 3) % PORTS.length]
    }
    const t = rand()
    const cargoClass = pick(rand, CARGO_CLASSES)
    const status = pick(rand, STATUSES)
    const [lon, lat] = jitter(blend(origin.lon, destination.lon, t), blend(origin.lat, destination.lat, t), rand)
    out.push({
      id: `SHP-${String(100000 + i)}`,
      vessel: `${pick(rand, VESSEL_PREFIX)} ${pick(rand, VESSEL_NAME)}`,
      imo: String(9000000 + Math.floor(rand() * 999999)),
      status,
      cargoClass,
      originPort: origin.code,
      destinationPort: destination.code,
      lon: Number(lon.toFixed(4)),
      lat: Number(lat.toFixed(4)),
      eta: new Date(now + Math.floor((rand() * 96 - 24) * 3600000)).toISOString(),
      teu: 200 + Math.floor(rand() * 14800),
      grossTonnage: 18000 + Math.floor(rand() * 180000),
      dwt: 20000 + Math.floor(rand() * 190000),
      progress: Number(rand().toFixed(3)),
      delayHours: rand() > 0.75 ? Number((rand() * 60).toFixed(1)) : 0,
      lastEventAt: now - Math.floor(rand() * 7200000),
      mmss: shortMmss(now, rand)
    })
  }
  return out
}

export function mutateShipment(record, tick, rand) {
  const next = { ...record }
  if (rand() < 0.22) {
    const pool = STATUSES.filter((s) => s !== record.status)
    next.status = pool[Math.floor(rand() * pool.length)]
  }
  if (rand() < 0.35) {
    next.lon = Number((record.lon + (rand() - 0.5) * 0.9).toFixed(4))
    next.lat = Number((record.lat + (rand() - 0.5) * 0.6).toFixed(4))
  }
  if (rand() < 0.1) {
    next.progress = Number(Math.min(1, record.progress + 0.01 + rand() * 0.03).toFixed(3))
  }
  if (rand() < 0.08) {
    next.delayHours = Number((rand() * 40).toFixed(1))
  }
  next.lastEventAt = Date.now()
  next.mmss = shortMmss(Date.now(), rand)
  next._tick = tick
  return next
}
