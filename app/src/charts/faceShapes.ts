import type { FaceType } from '../lib/clubs'
import type { Scale } from './Scatter'

// Approximate face outlines in mm, origin at the face center, +x toward the toe, +y up.
// Viewed from the front for a right-handed club: heel left, toe right.

type P = [number, number]

function superellipse(w: number, h: number, n: number, dy = 0): P[] {
  const pts: P[] = []
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push([(w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), dy + (h / 2) * Math.sign(s) * Math.abs(s) ** (2 / n)])
  }
  return pts
}

/** Blade outline: flat leading edge, top line rising from heel to a rounded toe. */
function blade(width: number, bottom: number, heelTop: number, toeTop: number): P[] {
  const x0 = -width / 2
  const x1 = width / 2
  const pts: P[] = [[x0, bottom]]
  // Rounded toe: quarter-ish arc from the bottom edge up to the top line.
  const cx = x1 - 14
  const cy = (bottom + toeTop) / 2
  const rx = 14
  const ry = (toeTop - bottom) / 2
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  pts.push([x0, heelTop])
  return pts
}

const SHAPES: Record<FaceType, P[]> = {
  driver: superellipse(116, 56, 2.6, 1),
  wood: superellipse(96, 38, 2.6, 2),
  hybrid: superellipse(84, 36, 2.4, 2),
  iron: blade(78, -17, 10, 26),
  wedge: blade(80, -18, 14, 34),
}

export function facePath(type: FaceType, sx: Scale, sy: Scale): string {
  return SHAPES[type].map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)},${sy(y)}`).join('') + 'Z'
}

/** Horizontal score lines for irons and wedges. */
export function grooves(type: FaceType): number[] {
  if (type !== 'iron' && type !== 'wedge') return []
  const out: number[] = []
  for (let y = -13; y <= (type === 'wedge' ? 14 : 10); y += 3.5) out.push(y)
  return out
}

const MARGIN = 12

/** Face bounding box plus a margin (mm), so each face fills its chart. */
export function faceDomain(type: FaceType): { x: [number, number]; y: [number, number] } {
  const xs = SHAPES[type].map((p) => p[0])
  const ys = SHAPES[type].map((p) => p[1])
  return {
    x: [Math.min(...xs) - MARGIN, Math.max(...xs) + MARGIN],
    y: [Math.min(...ys) - MARGIN, Math.max(...ys) + MARGIN],
  }
}
