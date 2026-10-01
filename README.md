# Logistics Operations Dashboard (React 18, Vite, MapLibre GL, Dexie)

An offline-first operations console for tracking live vessel telemetry. Ships
sit on a map, operators filter and search them, and the UI keeps working when
the network does not.

The default view runs against a local simulator so the dashboard is fully
demonstrable with no backend. Point it at the Java stream service to consume
real WebSocket frames:

```
http://localhost:5173/?mode=server&ws=localhost:8090/ws
```

| Parameter | Values | Meaning |
| --------- | ------ | ------- |
| `mode` | `simulator` (default), `server` | data source |
| `ws` | host or full `ws://` URL | backend endpoint |
| `live` | `1` (default), `0` | start paused |

## Offline-first storage

Every frame is written to IndexedDB through Dexie before React state changes,
so the UI is derived from the database rather than held in memory:

- `shipments` — current record per id, indexed by status, cargo class, ports
- `meta` — last applied version, last snapshot time
- `history` — applied version log, for gap forensics

Three Dexie constraints on `shipments` (`status`, `cargoClass`, and the
composite `[status+cargoClass]`) mean the filter dropdowns are served by index
rather than by scanning every record, which matters once the fleet reaches tens
of thousands of rows.

Reads come from Dexie's `liveQuery`-free plain API on purpose: the diff rate here
is a few hundred records per second, and a full re-read after each tick is both
simpler and fast enough. A larger deployment would subscribe to per-table change
events instead of re-reading the whole table.

## Version handling

The server sends strictly increasing versions. The client treats them as a
contract:

- a diff at or below the last applied version is discarded as a duplicate
- a diff more than one version ahead means a frame was lost, so the client
  asks for a resync instead of applying a partial change
- a snapshot resets the baseline, so reconnects are always clean

Without the gap check, a single dropped frame leaves the local store
permanently inconsistent with the server — the map slowly diverges and there is
nothing in the UI to indicate it. The gap counter is surfaced in the header so
silent divergence is visible.

Reconnection uses exponential backoff, capped at 15 s, and the header shows the
connection phase and attempt count rather than failing silently.

## Rendering

Shipments are a single GeoJSON source feeding two MapLibre layers: circles
coloured and sized by status priority, and labels that appear at zoom 3.2 so the
map stays readable when zoomed out. Clicking a circle selects that shipment;
selecting from the list eases the camera to it.

The basemap is a CARTO raster style. It requires network access. Offline, the
shipment layers still render over the dark background — the basemap is a
convenience, not a dependency of the data path.

## What the tests cover

`tests/fleet.test.js`, 12 cases:

- duplicate and stale versions discarded
- gap detection triggers resync
- snapshot resets the version baseline
- unparseable frames dropped rather than thrown
- ping emitted on the keepalive interval, pong accepted
- simulator emits a snapshot first, then gapless sequential versions
- shipment ids stay unique as records are added and removed
- seed generation is deterministic for a given seed and clock
- coordinates move by a plausible step, progress never regresses
- status priority ordering

## Two bugs these tests caught

**Colliding shipment ids.** The simulator derived new ids from
`state.length`, which shrinks when records are removed. Ids were reused, so two
different records could collide on the same key. It now uses a monotonic
counter that never rewinds.

**Non-reproducible seed data.** `generateShipments` called `Date.now()`
internally, so the same seed produced different records on every call. The
clock is now a parameter, which is what makes the determinism test meaningful.

## Build and run

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

## Layout

```
src/lib/taxonomy.js     statuses, cargo classes, ports, priority metadata
src/data/db.js          Dexie schema, applyDiff, replaceAll, search
src/data/streamClient.js WebSocket client: versions, gaps, backoff, keepalive
src/data/localSimulator.js offline frame generator
src/data/seed.js        deterministic mock fleet
src/hooks/useFleet.js   connects client/simulator to IndexedDB and React state
src/components/         MapView, Sidebar, DetailPanel, StatsBar
```

## Note on scope

The domain is a re-skin: vessels, ports, ETAs, and delay flags stand in for the
original dashboard's structure, and none of this code is extracted from another
system. The version-handshake logic is the substantive part, since it is what
keeps a cached view honest.

Not included: authentication and per-user filtering of the fleet view, server-
side pagination for fleets far larger than a few thousand, and any real basemap
caching strategy for fully disconnected operation. The Dexie `searchIndex` table
is declared in the schema but unused — a tokenised search index was planned and
not built, so search currently scans records in memory.
