import type { FaceType } from '../lib/clubs'
import type { Scale } from './Scatter'

// Approximate face outlines in mm, origin at the face center (for irons and wedges: the center of the grooves), +x toward the toe, +y up.
// Data coordinates only: the Impact view reverses the x axis, so a right-handed face is drawn as it
// looks from the front, toe left and heel (and shaft) right.

type P = [number, number]

const SOLE_CAMBER = 3 // mm the sole rises from the middle to the heel and toe ends
const HEEL_RADIUS = 5
const TOE_RADIUS = 14

interface Blade {
  width: number
  bottom: number
  heelTop: number
  toeTop: number
}

const BLADES: Record<'iron' | 'wedge', Blade> = {
  iron: { width: 78, bottom: -17, heelTop: 11, toeTop: 31 },
  wedge: { width: 80, bottom: -18, heelTop: 14, toeTop: 39 },
}
const GROOVE_HEEL_BIAS = 6 // mm from the blade midpoint to the groove center

/** Blade outline: gently cambered sole, top line rising from heel to a rounded toe. */
function blade({ width, bottom, heelTop, toeTop }: Blade): P[] {
  const x0 = -width / 2
  const x1 = width / 2
  const sole = (x: number) => bottom + SOLE_CAMBER * (x / x1) ** 2
  const pts: P[] = []
  // Rounded heel corner, from the heel edge down onto the sole.
  const hx = x0 + HEEL_RADIUS
  const hy = sole(hx) + HEEL_RADIUS
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * (Math.PI / 2)
    pts.push([hx + HEEL_RADIUS * Math.cos(a), hy + HEEL_RADIUS * Math.sin(a)])
  }
  // Sole, lowest under the face center.
  const cx = x1 - TOE_RADIUS
  for (let i = 1; i < 16; i++) pts.push([hx + ((cx - hx) * i) / 16, sole(hx + ((cx - hx) * i) / 16)])
  // Rounded toe: half ellipse from the sole up to the top line.
  const cy = (sole(cx) + toeTop) / 2
  const rx = TOE_RADIUS
  const ry = (toeTop - sole(cx)) / 2
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  pts.push([x0, heelTop])
  // The origin is the center of the grooves, which sits toward the heel of the blade's midpoint:
  // the ungrooved area is larger at the toe.
  return pts.map(([x, y]): P => [x + GROOVE_HEEL_BIAS, y])
}

/** Closed Catmull-Rom spline through the given points. */
function smooth(ctrl: P[], steps = 6): P[] {
  const n = ctrl.length
  const out: P[] = []
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [ctrl[(i + n - 1) % n], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n]]
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  return out
}

// Driver hitting face traced from a typical modern head: near-vertical rounded toe, gently crowned
// top line, deep rounded sole, and a heel that narrows to a point below the hosel. About 104 x 53 mm.
const DRIVER = smooth([
  [50.8, 19.6], [52.1, 14.9], [51.7, 8.2], [49.5, -1.1], [45.5, -9.0], [39.5, -16.4],
  [30.2, -22.3], [19.6, -25.7], [4.9, -27.3], [-9.7, -26.1], [-23.0, -22.3], [-35.0, -16.4],
  [-44.3, -8.4], [-50.3, -0.4], [-52.0, 4.9], [-48.3, 8.9], [-40.3, 14.2], [-29.7, 19.6],
  [-16.4, 23.5], [-3.1, 25.5], [10.2, 26.2], [26.2, 25.5], [39.5, 23.5], [47.5, 21.5],
])

// Fairway wood hitting face traced from a typical head: shallow, nearly flat top line, rounded toe,
// curved sole, and a heel that rises into the hosel. About 92 x 32 mm.
const WOOD = smooth([
  [41.5, 13.0], [44.9, 8.1], [44.4, 1.4], [39.7, -5.2], [31.9, -10.1], [20.3, -13.9],
  [4.3, -15.9], [-11.6, -15.4], [-26.1, -12.5], [-37.7, -7.2], [-44.4, 0.0], [-47.3, 7.2],
  [-45.5, 12.2], [-39.1, 14.5], [-21.8, 15.7], [-1.4, 15.9], [18.8, 15.7], [33.3, 15.1],
])

// Hybrid hitting face traced from a typical head: compact, flat top line, rounded toe and sole,
// heel rising into the hosel. About 82 x 31 mm.
const HYBRID = smooth([
  [38.4, 12.6], [42.2, 6.7], [41.6, -0.7], [36.8, -7.4], [27.8, -12.2], [14.4, -14.8],
  [-1.6, -15.5], [-16.0, -14.1], [-27.8, -10.0], [-36.2, -3.0], [-40.0, 5.5], [-39.4, 11.8],
  [-33.6, 14.8], [-17.6, 15.5], [1.6, 15.5], [20.8, 15.2], [32.0, 14.4],
])

export function pointsPath(pts: P[], sx: Scale, sy: Scale): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)},${sy(y)}`).join('') + 'Z'
}

const SHAPES: Record<FaceType, P[]> = {
  driver: DRIVER,
  wood: WOOD,
  hybrid: HYBRID,
  iron: blade(BLADES.iron),
  wedge: blade(BLADES.wedge),
}

export function facePath(type: FaceType, sx: Scale, sy: Scale): string {
  return pointsPath(SHAPES[type], sx, sy)
}

const GROOVE_HALF = 26 // grooves span ±26 mm around the face center
const GROOVE_PITCH = 3.5
const GROOVE_INSET = 3 // gap kept between the grooves and the top line

/**
 * Horizontal score lines for irons and wedges. They run from just above the sole up to the top line,
 * and the upper ones are cut short at the heel where the top line slopes down.
 */
export function grooves(type: FaceType): { y: number; x1: number; x2: number }[] {
  if (type !== 'iron' && type !== 'wedge') return []
  const { width, heelTop, toeTop } = BLADES[type]
  const heelX = -width / 2 + GROOVE_HEEL_BIAS
  const toeX = width / 2 - TOE_RADIUS + GROOVE_HEEL_BIAS
  const slope = (toeTop - heelTop) / (toeX - heelX)
  const out: { y: number; x1: number; x2: number }[] = []
  for (let y = -13; ; y += GROOVE_PITCH) {
    // Heel-most x where this groove still clears the top line.
    const x1 = Math.max(-GROOVE_HALF, heelX + (y + GROOVE_INSET - heelTop) / slope)
    if (GROOVE_HALF - x1 < 12) break
    out.push({ y, x1, x2: GROOVE_HALF })
  }
  return out
}

const MARGIN = 12

const SHAFT_RISE = 10 // mm of shaft shown above the crown
const LIE = (58 * Math.PI) / 180

/** Hosel + shaft stub for the rounded heads, where the outline alone doesn't show which end is the heel. */
const SHAFTS: Partial<Record<FaceType, { from: P; to: P; width: number }>> = {
  driver: shaft(104, 53, 0, [-46, 5]),
  wood: shaft(92, 32, 0, [-42, 8]),
  hybrid: shaft(82, 31, 0, [-36, 7]),
}

function shaft(w: number, h: number, dy: number, start?: P): { from: P; to: P; width: number } {
  // Starts inside the head near the heel (the face is drawn on top) and leans away from the toe.
  const from: P = start ?? [-w * 0.36, dy + h * 0.15]
  const top = dy + h / 2 + SHAFT_RISE
  const to: P = [from[0] - (top - from[1]) / Math.tan(LIE), top]
  return { from, to, width: 6 }
}

export function faceShaft(type: FaceType) {
  return SHAFTS[type]
}

/** Face bounding box plus a margin (mm), so each face fills its chart. */
export function faceDomain(type: FaceType): { x: [number, number]; y: [number, number] } {
  const xs = SHAPES[type].map((p) => p[0])
  const ys = SHAPES[type].map((p) => p[1])
  const sh = SHAFTS[type]
  if (sh) {
    xs.push(sh.to[0])
    ys.push(sh.to[1] - MARGIN) // the shaft runs off the top edge of the chart
  }
  return {
    x: [Math.min(...xs) - MARGIN, Math.max(...xs) + MARGIN],
    y: [Math.min(...ys) - MARGIN, Math.max(...ys) + MARGIN],
  }
}
