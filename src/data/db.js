import Dexie from 'dexie'

export const db = new Dexie('logistics-dashboard')

db.version(1).stores({
  shipments: 'id, status, cargoClass, originPort, destinationPort, lastEventAt, [status+cargoClass]',
  meta: 'key',
  searchIndex: 'id, [term+field], field',
  history: '++seq, version, at'
})

export const META_KEYS = {
  lastVersion: 'lastVersion',
  lastSnapshotAt: 'lastSnapshotAt',
  seed: 'seed'
}

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row === undefined ? fallback : row.value
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
  return value
}

export async function getLastVersion() {
  return getMeta(META_KEYS.lastVersion, 0)
}

export async function recordVersion(version) {
  const current = await getLastVersion()
  if (version > current) {
    await setMeta(META_KEYS.lastVersion, version)
    await db.history.add({ version, at: Date.now() })
    return true
  }
  return false
}

export async function applyDiff(diff) {
  const accepted = await recordVersion(diff.version)
  if (!accepted) {
    return { applied: false, added: 0, updated: 0, removed: 0 }
  }

  const apply = db.transaction('rw', db.shipments, async () => {
    if (diff.added && diff.added.length > 0) {
      await db.shipments.bulkPut(diff.added)
    }
    if (diff.updated && diff.updated.length > 0) {
      await db.shipments.bulkPut(diff.updated)
    }
    if (diff.removed && diff.removed.length > 0) {
      await db.shipments.bulkDelete(diff.removed)
    }
  })

  await apply

  return {
    applied: true,
    added: (diff.added || []).length,
    updated: (diff.updated || []).length,
    removed: (diff.removed || []).length
  }
}

export async function replaceAll(snapshot) {
  await db.transaction('rw', db.shipments, async () => {
    await db.shipments.clear()
    if (snapshot.shipments && snapshot.shipments.length > 0) {
      await db.shipments.bulkPut(snapshot.shipments)
    }
  })
  await setMeta(META_KEYS.lastVersion, snapshot.version || 0)
  await setMeta(META_KEYS.lastSnapshotAt, Date.now())
  return snapshot.shipments ? snapshot.shipments.length : 0
}

export async function allShipments() {
  return db.shipments.toArray()
}

export async function shipmentCount() {
  return db.shipments.count()
}

export async function search(term, field = 'all') {
  const needle = String(term || '').trim().toLowerCase()
  if (needle.length === 0) {
    return []
  }
  const rows = await allShipments()
  return rows.filter((row) => {
    if (field !== 'all' && field !== 'any') {
      return String(row[field] || '').toLowerCase().includes(needle)
    }
    return [row.id, row.vessel, row.cargoClass, row.originPort, row.destinationPort, row.status]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(needle))
  })
}

export async function clearAll() {
  await db.shipments.clear()
  await db.history.clear()
  await db.meta.clear()
}
