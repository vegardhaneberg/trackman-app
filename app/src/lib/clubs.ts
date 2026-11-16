const WEDGES = ['PitchingWedge', 'GapWedge', 'ApproachWedge', 'SandWedge', 'LobWedge']
const NUMBERED = /^(\d+)(Wood|Hybrid|Iron)$/
const FAMILY_RANK: Record<string, number> = { Wood: 100, Hybrid: 200, Iron: 300 }

/** Lower rank = less loft. Unknown clubs sort after wedges. */
export function clubRank(club: string): number {
  if (club === 'Driver') return 0
  const m = club.match(NUMBERED)
  if (m) return FAMILY_RANK[m[2]] + Number(m[1])
  const w = WEDGES.indexOf(club)
  if (w >= 0) return 400 + w
  if (club === 'Putter') return 900
  return 800
}

export function sortClubs(clubs: Iterable<string>): string[] {
  return [...clubs].sort((a, b) => clubRank(a) - clubRank(b) || a.localeCompare(b))
}

export function clubLabel(club: string): string {
  const m = club.match(NUMBERED)
  if (m) return `${m[1]} ${m[2].toLowerCase()}`
  const spaced = club.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export type FaceType = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge'

export function faceType(club: string): FaceType {
  if (club === 'Driver') return 'driver'
  if (club.endsWith('Wood')) return 'wood'
  if (club.endsWith('Hybrid')) return 'hybrid'
  if (club.endsWith('Wedge')) return 'wedge'
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
  if (club.endsWith('Wedge')) return [-7, -4]
  return [-5, -3]
}

export function isPutt(shotResult: string, club: string): boolean {
  return shotResult === 'AutoPutt' || club === 'Putter'
}
