import { fmtNum } from './metrics'

const KIND_LABELS: Record<string, string> = {
  SIMULATOR: 'Round',
  VIRTUAL_RANGE: 'Range',
  COURSE_PLAY: 'Course play',
  MAP_MY_BAG: 'Map my bag',
}

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.toLowerCase().replace(/_/g, ' ')
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "2.3° open" / "−2.3° closed": signed value plus the word for its direction. */
export function describeSigned(v: number, positive: string, negative: string, zero: string, unit = '°'): string {
  const r = Math.round(v * 10) / 10
  if (r === 0) return `0.0${unit} ${zero}`.trim()
  return `${r < 0 ? '−' : ''}${fmtNum(Math.abs(r), 1)}${unit} ${r > 0 ? positive : negative}`.trim()
}
