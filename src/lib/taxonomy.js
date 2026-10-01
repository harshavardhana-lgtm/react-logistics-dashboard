export const CARGO_CLASSES = [
  'container',
  'refrigerated',
  'bulk',
  'breakbulk',
  'hazmat',
  'vehicle-carrier',
  'project-cargo',
  'livestock'
]

export const STATUSES = [
  'SCHEDULED',
  'LOADING',
  'IN_TRANSIT',
  'AT_ANCHORAGE',
  'DELAYED',
  'CUSTOMS_HOLD',
  'DISCHARGING',
  'DELIVERED'
]

export const STATUS_META = {
  SCHEDULED: { label: 'Scheduled', color: '#64748b', priority: 1 },
  LOADING: { label: 'Loading', color: '#0ea5e9', priority: 1 },
  IN_TRANSIT: { label: 'In transit', color: '#22c55e', priority: 0 },
  AT_ANCHORAGE: { label: 'At anchorage', color: '#eab308', priority: 2 },
  DELAYED: { label: 'Delayed', color: '#ef4444', priority: 4 },
  CUSTOMS_HOLD: { label: 'Customs hold', color: '#f97316', priority: 5 },
  DISCHARGING: { label: 'Discharging', color: '#8b5cf6', priority: 1 },
  DELIVERED: { label: 'Delivered', color: '#a855f7', priority: 0 }
}

export const SEVERITY_ORDER = [
  'CUSTOMS_HOLD',
  'DELAYED',
  'AT_ANCHORAGE',
  'LOADING',
  'DISCHARGING',
  'SCHEDULED',
  'IN_TRANSIT',
  'DELIVERED'
]

export const PORTS = [
  { code: 'SGSIN', name: 'Singapore', lon: 103.82, lat: 1.26 },
  { code: 'NLRTM', name: 'Rotterdam', lon: 4.48, lat: 51.92 },
  { code: 'DEHAM', name: 'Hamburg', lon: 9.99, lat: 53.55 },
  { code: 'CNSHA', name: 'Shanghai', lon: 121.47, lat: 31.23 },
  { code: 'INNSA', name: 'Nhava Sheva', lon: 72.95, lat: 18.95 },
  { code: 'AEJEA', name: 'Jebel Ali', lon: 55.03, lat: 25.01 },
  { code: 'USLAX', name: 'Los Angeles', lon: -118.26, lat: 33.74 },
  { code: 'BRSSZ', name: 'Santos', lon: -46.31, lat: -23.98 },
  { code: 'ZADUR', name: 'Durban', lon: 31.05, lat: -29.87 },
  { code: 'KRPUS', name: 'Busan', lon: 129.07, lat: 35.18 }
]

export const LIVE_AREA = { west: -180, south: -60, east: 180, north: 70 }
export const RASTER_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
