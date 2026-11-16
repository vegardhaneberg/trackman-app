import { deviation, mean, median, quantileSorted } from 'd3-array'
import { isPutt, sortClubs } from './clubs'
import type { MetricKey } from './metrics'
import type { Filters, Session, Shot } from './types'

export function values(shots: Shot[], key: MetricKey): number[] {
  const out: number[] = []
  for (const s of shots) {
    const v = s.v[key]
    if (v !== undefined) out.push(v)
  }
  return out
}

export interface Summary {
  n: number
  mean?: number
  sd?: number
}

export function summarize(vals: number[]): Summary {
  return { n: vals.length, mean: mean(vals), sd: deviation(vals) }
}

export function quantiles(vals: number[], ps: number[]): number[] {
  const sorted = [...vals].sort((a, b) => a - b)
  return ps.map((p) => quantileSorted(sorted, p) ?? NaN)
}

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  return m
}

/** Shots grouped per club, ordered by loft. */
export function byClub(shots: Shot[]): [string, Shot[]][] {
  const g = groupBy(shots, (s) => s.club)
  return sortClubs(g.keys()).map((c) => [c, g.get(c)!])
}

export function sessionsOf(shots: Shot[]): Session[] {
  return [...groupBy(shots, (s) => s.activityId).entries()]
    .map(([id, ss]) => ({
      id,
      time: ss[0].activityTime,
      kind: ss[0].kind,
      count: ss.length,
    }))
    .sort((a, b) => b.time.localeCompare(a.time))
}

export function applyFilters(shots: Shot[], f: Filters): Shot[] {
  const kinds = new Set(f.excludedKinds)
  const sessions = new Set(f.excludedSessions)
  const clubs = new Set(f.excludedClubs)
  const base = shots.filter(
    (s) =>
      !isPutt(s.shotResult, s.club) &&
      !kinds.has(s.kind) &&
      !sessions.has(s.activityId) &&
      !clubs.has(s.club),
  )
  if (!f.excludeMishits) return base

  // A mishit carries less than half of that club's median carry.
  const medians = new Map<string, number>()
  for (const [club, ss] of groupBy(base, (s) => s.club)) {
    medians.set(club, median(values(ss, 'carry')) ?? 0)
  }
  return base.filter((s) => {
    const c = s.v.carry
    return c !== undefined && c >= 0.5 * medians.get(s.club)!
  })
}

export interface Ellipse {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Rotation in degrees. */
  angle: number
}

/** 1σ covariance ellipse of points (in whatever space they're given). */
export function covEllipse(pts: [number, number][]): Ellipse | null {
  const n = pts.length
  if (n < 3) return null
  let mx = 0
  let my = 0
  for (const [x, y] of pts) {
    mx += x
    my += y
  }
  mx /= n
  my /= n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
    sxy += (x - mx) * (y - my)
  }
  sxx /= n - 1
  syy /= n - 1
  sxy /= n - 1
  const tr = (sxx + syy) / 2
  const d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2)
  const l1 = tr + d
  const l2 = Math.max(tr - d, 0)
  const angle = (Math.atan2(l1 - sxx, sxy || 1e-12) * 180) / Math.PI
  return { cx: mx, cy: my, rx: Math.sqrt(l1), ry: Math.sqrt(l2), angle }
}

export function pearson(xs: number[], ys: number[]): number | undefined {
  const n = xs.length
  if (n < 3) return undefined
  const mx = mean(xs)!
  const my = mean(ys)!
  let c = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < n; i++) {
    c += (xs[i] - mx) * (ys[i] - my)
    vx += (xs[i] - mx) ** 2
    vy += (ys[i] - my) ** 2
  }
  return vx && vy ? c / Math.sqrt(vx * vy) : undefined
}
