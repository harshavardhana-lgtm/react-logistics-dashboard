import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RASTER_STYLE, STATUS_META, LIVE_AREA } from '../lib/taxonomy.js'

const SOURCE_ID = 'fleet'
const LAYER_ID = 'fleet-circles'
const LABEL_LAYER = 'fleet-labels'

function toGeoJson(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      id: row.id,
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
      properties: {
        id: row.id,
        vessel: row.vessel,
        status: row.status,
        cargoClass: row.cargoClass,
        colour: STATUS_META[row.status] ? STATUS_META[row.status].color : '#64748b',
        size: STATUS_META[row.status] ? 4 + STATUS_META[row.status].priority * 1.6 : 5
      }
    }))
  }
}

export default function MapView({ rows, selectedId, onSelect, onReady }) {
  const container = useRef(null)
  const map = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (map.current || !container.current) return undefined
    const instance = new maplibregl.Map({
      container: container.current,
      style: RASTER_STYLE,
      bounds: [
        [LIVE_AREA.west, LIVE_AREA.south],
        [LIVE_AREA.east, LIVE_AREA.north]
      ],
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      maxZoom: 12
    })
    map.current = instance
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left')

    instance.on('load', () => {
      instance.addSource(SOURCE_ID, { type: 'geojson', data: toGeoJson([]) })
      instance.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': ['get', 'colour'],
          'circle-radius': ['get', 'size'],
          'circle-stroke-color': '#0b1220',
          'circle-stroke-width': 1,
          'circle-opacity': 0.85
        }
      })
      instance.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 3.2,
        layout: {
          'text-field': ['get', 'id'],
          'text-size': 9,
          'text-allow-overlap': false,
          'text-offset': [0, 1.4]
        },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0b1220', 'text-halo-width': 1 }
      })
      instance.on('click', LAYER_ID, (event) => {
        const feature = event.features && event.features[0]
        if (feature && onSelectRef.current) onSelectRef.current(feature.properties.id)
      })
      instance.on('mouseenter', LAYER_ID, () => {
        instance.getCanvas().style.cursor = 'pointer'
      })
      instance.on('mouseleave', LAYER_ID, () => {
        instance.getCanvas().style.cursor = ''
      })
      if (onReady) onReady(instance)
    })

    return () => {
      instance.remove()
      map.current = null
    }
  }, [onReady])

  useEffect(() => {
    const instance = map.current
    if (!instance || !instance.isStyleLoaded()) return
    const source = instance.getSource(SOURCE_ID)
    if (source) source.setData(toGeoJson(rows))
  }, [rows])

  useEffect(() => {
    const instance = map.current
    if (!instance || !instance.isStyleLoaded() || !selectedId) return
    const target = rows.find((row) => row.id === selectedId)
    if (target) {
      instance.easeTo({ center: [target.lon, target.lat], duration: 600, zoom: Math.max(instance.getZoom(), 5) })
    }
  }, [selectedId, rows])

  return <div className="map" ref={container} data-testid="map" />
}
