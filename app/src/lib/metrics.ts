export type MetricKey =
  | 'clubSpeed'
  | 'attackAngle'
  | 'clubPath'
  | 'faceAngle'
  | 'faceToPath'
  | 'dynamicLoft'
  | 'spinLoft'
  | 'impactOffset'
  | 'impactHeight'
  | 'lowPointDistance'
  | 'ballSpeed'
  | 'smashFactor'
  | 'carry'
  | 'total'
  | 'launchAngle'
  | 'launchDirection'
  | 'spinRate'
  | 'spinAxis'
  | 'curve'
  | 'carrySide'
  | 'totalSide'
  | 'landingAngle'
  | 'maxHeight'
  | 'hangTime'

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  digits: number
  /** Multiplier applied when parsing the CSV (e.g. meters -> mm). */
  factor?: number
}

/** m/s -> mph. Speeds arrive in m/s from the Trackman export and are stored in mph. */
export const MPS_TO_MPH = 2.2369362920544

// Units follow the metric Trackman export (m, degrees, rpm), except speeds, shown in mph.
export const METRICS: MetricDef[] = [
  { key: 'carry', label: 'Carry', unit: 'm', digits: 1 },
  { key: 'total', label: 'Total', unit: 'm', digits: 1 },
  { key: 'carrySide', label: 'Carry side', unit: 'm', digits: 1 },
  { key: 'totalSide', label: 'Total side', unit: 'm', digits: 1 },
  { key: 'curve', label: 'Curve', unit: 'm', digits: 1 },
  { key: 'clubSpeed', label: 'Club speed', unit: 'mph', digits: 1, factor: MPS_TO_MPH },
  { key: 'ballSpeed', label: 'Ball speed', unit: 'mph', digits: 1, factor: MPS_TO_MPH },
  { key: 'smashFactor', label: 'Smash factor', unit: '', digits: 2 },
  { key: 'launchAngle', label: 'Launch angle', unit: '°', digits: 1 },
  { key: 'launchDirection', label: 'Launch direction', unit: '°', digits: 1 },
  { key: 'spinRate', label: 'Spin rate', unit: 'rpm', digits: 0 },
  { key: 'spinAxis', label: 'Spin axis', unit: '°', digits: 1 },
  { key: 'maxHeight', label: 'Max height', unit: 'm', digits: 1 },
  { key: 'landingAngle', label: 'Landing angle', unit: '°', digits: 1 },
  { key: 'hangTime', label: 'Hang time', unit: 's', digits: 1 },
  { key: 'attackAngle', label: 'Attack angle', unit: '°', digits: 1 },
  { key: 'clubPath', label: 'Club path', unit: '°', digits: 1 },
  { key: 'faceAngle', label: 'Face angle', unit: '°', digits: 1 },
  { key: 'faceToPath', label: 'Face to path', unit: '°', digits: 1 },
  { key: 'dynamicLoft', label: 'Dynamic loft', unit: '°', digits: 1 },
  { key: 'spinLoft', label: 'Spin loft', unit: '°', digits: 1 },
  { key: 'impactOffset', label: 'Impact offset', unit: 'mm', digits: 0, factor: 1000 },
  { key: 'impactHeight', label: 'Impact height', unit: 'mm', digits: 0, factor: 1000 },
  { key: 'lowPointDistance', label: 'Low point', unit: 'cm', digits: 1, factor: 100 },
]

export const METRIC: Record<MetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<MetricKey, MetricDef>

export function fmtNum(v: number | undefined | null, digits: number): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmt(key: MetricKey, v: number | undefined | null): string {
  const d = METRIC[key]
  const s = fmtNum(v, d.digits)
  if (s === '–' || !d.unit) return s
  return d.unit === '°' ? `${s}°` : `${s} ${d.unit}`
}

export function axisLabel(key: MetricKey): string {
  const d = METRIC[key]
  return d.unit ? `${d.label} (${d.unit})` : d.label
}
