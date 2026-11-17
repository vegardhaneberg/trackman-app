const WEDGES = ['PitchingWedge', 'GapWedge', 'ApproachWedge', 'SandWedge', 'LobWedge']
const NUMBERED = /^(\d+)(Wood|Hybrid|Iron)$/
const FAMILY_RANK: Record<string, number> = { Wood: 100, Hybrid: 200, Iron: 300 }
/** Wedge lofts: a club name holding a number in this range is taken to be a wedge of that loft. */
const WEDGE_LOFTS = [48, 60]

/** Loft in degrees for a wedge named by loft (50Wedge, 54, Wedge 58 → 50, 54, 58), else undefined. */
export function wedgeLoft(club: string): number | undefined {
  for (const m of club.matchAll(/\d+/g)) {
    const n = Number(m[0])
    if (n >= WEDGE_LOFTS[0] && n <= WEDGE_LOFTS[1]) return n
  }
  return undefined
}

function isWedge(club: string): boolean {
  return club.endsWith('Wedge') || wedgeLoft(club) !== undefined
}

/** Lower rank = less loft. Unknown clubs sort after wedges. */
export function clubRank(club: string): number {
  if (club === 'Driver') return 0
  const m = club.match(NUMBERED)
  if (m) return FAMILY_RANK[m[2]] + Number(m[1])
  const w = WEDGES.indexOf(club)
  if (w >= 0) return 400 + w
  // Loft-named wedges sort among the named ones by loft (PW ≈ 46°, then 4° per wedge).
  const loft = wedgeLoft(club)
  if (loft !== undefined) return 400 + Math.max(0, (loft - 46) / 4)
  if (club.endsWith('Wedge')) return 400
  if (club === 'Putter') return 900
  return 800
}

export function sortClubs(clubs: Iterable<string>): string[] {
  return [...clubs].sort((a, b) => clubRank(a) - clubRank(b) || a.localeCompare(b))
}

export function clubLabel(club: string): string {
  const m = club.match(NUMBERED)
  if (m) return `${m[1]} ${m[2].toLowerCase()}`
  const loft = wedgeLoft(club)
  if (loft !== undefined) return `${loft}° wedge`
  const spaced = club.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export type FaceType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge'

export function faceType(club: string): FaceType {
  if (club === 'Driver') return 'driver'
  if (club.endsWith('Wood')) return 'wood'
  if (club.endsWith('Hybrid')) return 'hybrid'
  if (isWedge(club)) return 'wedge'
  return 'iron'
}

/**
 * Typical good attack angle range in degrees (negative = hitting down), by club. Bands built around
 * Trackman's PGA Tour averages and optimizer assumptions; guidance, not a published standard.
 */
export function attackRange(club: string): [number, number] {
  if (club === 'Driver') return [0, 5]
  const m = club.match(NUMBERED)
  if (m?.[2] === 'Wood') return [-4, -1]
  if (m?.[2] === 'Hybrid') return [-4, -2]
  if (m?.[2] === 'Iron') {
    const n = Number(m[1])
    if (n <= 5) return [-4, -2]
    return n <= 8 ? [-5, -3] : [-6, -3.5]
  }
  if (club === 'PitchingWedge') return [-6, -3.5]
  if (isWedge(club)) return [-7, -4]
  return [-5, -3]
}

export function isPutt(shotResult: string, club: string): boolean {
  return shotResult === 'AutoPutt' || club === 'Putter'
}

const YD = 0.9144

/** Trackman PGA Tour averages: club speed in mph and max height in yards. */
const TOUR: Record<string, { mph: number; yd: number }> = {
  Driver: { mph: 113, yd: 32 },
  '3Wood': { mph: 107, yd: 30 },
  '5Wood': { mph: 103, yd: 31 },
  Hybrid: { mph: 100, yd: 29 },
  '3Iron': { mph: 98, yd: 27 },
  '4Iron': { mph: 96, yd: 28 },
  '5Iron': { mph: 94, yd: 31 },
  '6Iron': { mph: 92, yd: 30 },
  '7Iron': { mph: 90, yd: 32 },
  '8Iron': { mph: 87, yd: 31 },
  '9Iron': { mph: 85, yd: 30 },
  PitchingWedge: { mph: 83, yd: 29 },
}

/** The tour figures for a club; clubs the table lacks borrow the nearest one. */
function tourFor(club: string): { mph: number; yd: number } {
  if (TOUR[club]) return TOUR[club]
  const m = club.match(NUMBERED)
  if (m?.[2] === 'Wood') return Number(m[1]) <= 3 ? TOUR['3Wood'] : TOUR['5Wood']
  if (m?.[2] === 'Hybrid') return TOUR.Hybrid
  if (m?.[2] === 'Iron') return Number(m[1]) <= 3 ? TOUR['3Iron'] : TOUR['7Iron']
  if (isWedge(club)) return TOUR.PitchingWedge
  return TOUR['7Iron']
}

/** Max height grows a little faster than club speed: this exponent turns tour driver height into LPGA's. */
const HEIGHT_SPEED_EXPONENT = 1.3
/** The good band reaches this share either side of the scaled tour height. */
const BAND = 0.1

/**
 * Good max height range in metres for a club: the PGA Tour average, scaled down to the player's
 * average club speed (never up), ±10%. Unscaled when club speed isn't known.
 */
export function heightRange(club: string, clubSpeed?: number): { range: [number, number]; speed?: number } {
  const t = tourFor(club)
  const f = clubSpeed ? Math.max(0.3, Math.min(1, clubSpeed / t.mph)) ** HEIGHT_SPEED_EXPONENT : 1
  const h = t.yd * YD * f
  return { range: [h * (1 - BAND), h * (1 + BAND)], speed: clubSpeed }
}
