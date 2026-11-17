import { quantileSorted } from 'd3-array'
import { attackRange, faceType, wedgeLoft, type FaceType } from './clubs'

/**
 * Launch window and stopping power: is a club landing steeply enough and spinning enough to hold a
 * green, and if not, what to change. Targets follow Trackman's PGA Tour and LPGA Tour averages per club,
 * interpolated by the player's club speed. Below LPGA speed they fall off at the rate PING's 7-iron
 * landing angle guideline chart does. Rules of thumb, not a published standard.
 */

interface Anchor {
  /** Club speed, mph. */
  mph: number
  launch: number
  spin: number
  /** Landing angle, °. */
  land: number
}

/** Trackman PGA Tour averages. */
const PGA: Record<string, Anchor> = {
  Driver: { mph: 113, launch: 10.9, spin: 2686, land: 38 },
  '3Wood': { mph: 107, launch: 9.2, spin: 3655, land: 43 },
  '5Wood': { mph: 103, launch: 9.4, spin: 4350, land: 47 },
  // Not in the table: between the 5 wood and the hybrid.
  '7Wood': { mph: 101, launch: 9.8, spin: 4400, land: 47 },
  Hybrid: { mph: 100, launch: 10.2, spin: 4437, land: 47 },
  '3Iron': { mph: 98, launch: 10.4, spin: 4630, land: 46 },
  '4Iron': { mph: 96, launch: 11.0, spin: 4836, land: 48 },
  '5Iron': { mph: 94, launch: 12.1, spin: 5361, land: 49 },
  '6Iron': { mph: 92, launch: 14.1, spin: 6231, land: 50 },
  '7Iron': { mph: 90, launch: 16.3, spin: 7097, land: 50 },
  '8Iron': { mph: 87, launch: 18.1, spin: 7998, land: 50 },
  '9Iron': { mph: 85, launch: 20.4, spin: 8647, land: 51 },
  PitchingWedge: { mph: 83, launch: 24.2, spin: 9304, land: 52 },
}

/** Trackman LPGA Tour averages. */
const LPGA: Record<string, Anchor> = {
  Driver: { mph: 94, launch: 13.2, spin: 2611, land: 37 },
  '3Wood': { mph: 90, launch: 11.2, spin: 2704, land: 39 },
  '5Wood': { mph: 88, launch: 12.1, spin: 4501, land: 43 },
  '7Wood': { mph: 85, launch: 12.7, spin: 4693, land: 46 },
  // Not in the table: hybrids take the 7 wood, the 3 iron is carried on from the 4 iron.
  Hybrid: { mph: 85, launch: 12.7, spin: 4693, land: 46 },
  '3Iron': { mph: 81, launch: 13.8, spin: 4600, land: 42 },
  '4Iron': { mph: 80, launch: 14.3, spin: 4801, land: 43 },
  '5Iron': { mph: 79, launch: 14.8, spin: 5081, land: 45 },
  '6Iron': { mph: 78, launch: 17.1, spin: 5943, land: 46 },
  '7Iron': { mph: 76, launch: 19.0, spin: 6699, land: 47 },
  '8Iron': { mph: 74, launch: 20.8, spin: 7494, land: 47 },
  '9Iron': { mph: 72, launch: 23.9, spin: 7589, land: 47 },
  PitchingWedge: { mph: 70, launch: 25.7, spin: 8403, land: 48 },
}

/**
 * Wedges past PW (our extrapolation; neither table has them): per step 2 mph slower, 2° higher
 * launch, 500 rpm more spin (capped at 11,000) and 1° steeper landing. Wedges named by a loft of
 * 48–60° (50Wedge, 54, …) take one step per 4° past 46°: 50° = GW, 54° = SW, 58° = LW.
 */
const WEDGE_STEP = { GapWedge: 1, ApproachWedge: 1, SandWedge: 2, LobWedge: 3 } as Record<string, number>

function wedgeStep(a: Anchor, step: number): Anchor {
  return {
    mph: a.mph - 2 * step,
    launch: a.launch + 2 * step,
    spin: Math.min(11000, a.spin + 500 * step),
    land: a.land + step,
  }
}

/** The table row a club uses, in either table. */
function rowFor(club: string, table: Record<string, Anchor>): Anchor {
  if (table[club]) return table[club]
  const m = club.match(/^(\d+)(Wood|Hybrid|Iron)$/)
  const n = Number(m?.[1])
  if (m?.[2] === 'Wood') return n <= 3 ? table['3Wood'] : n <= 5 ? table['5Wood'] : table['7Wood']
  if (m?.[2] === 'Hybrid') return table.Hybrid
  if (m?.[2] === 'Iron') return n <= 3 ? table['3Iron'] : table['9Iron']
  const loft = wedgeLoft(club)
  const step = WEDGE_STEP[club] ?? (loft !== undefined ? Math.max(0, (loft - 46) / 4) : undefined)
  if (step !== undefined) return wedgeStep(table.PitchingWedge, step)
  if (faceType(club) === 'wedge') return table.PitchingWedge
  return table['7Iron']
}

type Range = [number, number]

/**
 * PING's 7-iron landing angle guideline chart (revised 6/26/20): per swing speed band (keyed by its
 * middle, mph; >100 at 105), where high stopping power starts and the middle of its spin range. Only
 * used for how fast landing angle and spin fall off below LPGA speed.
 */
const PING_7I: { mph: number; land: number; spin: number }[] = [
  { mph: 45, land: 24, spin: 4625 },
  { mph: 55, land: 29, spin: 5125 },
  { mph: 65, land: 35, spin: 5625 },
  { mph: 75, land: 40, spin: 6000 },
  { mph: 85, land: 44, spin: 6625 },
  { mph: 95, land: 47, spin: 6875 },
  { mph: 105, land: 49, spin: 7125 },
]

function ping7(mph: number): { land: number; spin: number } {
  const rows = PING_7I
  const x = Math.max(rows[0].mph, Math.min(rows[rows.length - 1].mph, mph))
  let i = 0
  while (i < rows.length - 2 && rows[i + 1].mph < x) i++
  const a = rows[i]
  const b = rows[i + 1]
  const f = (x - a.mph) / (b.mph - a.mph)
  return { land: a.land + (b.land - a.land) * f, spin: a.spin + (b.spin - a.spin) * f }
}

/**
 * The tour's launch, spin and landing for a club at a club speed: PGA at or above PGA speed, a straight
 * line between LPGA and PGA, and below LPGA speed the LPGA figures with landing angle and spin falling
 * off as PING's chart does at the same 7-iron-equivalent speed. Launch stays at the LPGA figure there.
 */
function tourAt(club: string, mph: number): Anchor {
  const p = rowFor(club, PGA)
  const l = rowFor(club, LPGA)
  if (mph >= p.mph) return { ...p, mph }
  if (mph >= l.mph) {
    const f = (mph - l.mph) / (p.mph - l.mph)
    const at = (k: 'launch' | 'spin' | 'land') => l[k] + (p[k] - l[k]) * f
    return { mph, launch: at('launch'), spin: at('spin'), land: at('land') }
  }
  // 7-iron-equivalent speeds, by the PGA speed ratio to the 7 iron.
  const k = PGA['7Iron'].mph / p.mph
  const now = ping7(mph * k)
  const atL = ping7(l.mph * k)
  return { mph, launch: l.launch, spin: (l.spin * now.spin) / atL.spin, land: l.land - (atL.land - now.land) }
}

/** High stopping power starts this far under the tour landing angle, mid this far. */
const HIGH_BELOW = 3
const MID_BELOW = 9
/** Spin counts as in range within ±15%; launch within ±2° (±3° for wedges). */
const SPIN_TOL = 0.15
/** Landing up to this many degrees under mid stopping power counts as just short. */
const LANDING_CLOSE = 2
/** Landing more than this many degrees above the high range is too steep (wedges are never too steep). */
const LANDING_TOO_STEEP = 5
/** Above this 7-iron speed (mph), PING says low stopping power can be a choice for control in wind. */
const LOW_OK_MPH = 90

export interface WindowTarget {
  /** In-range launch, °. */
  launch: Range
  /** In-range spin, rpm (more is fine on wedges). */
  spin: Range
  /** Landing angle ranges for mid and high stopping power; undefined for the driver. */
  landing?: { mid: Range; high: Range }
  /** The tour landing angle at this speed (top of the high range is a few degrees above). */
  tourLanding?: number
  /** The player's average club speed, mph. */
  speed?: number
  /** That speed carried to a 7 iron. */
  speed7?: number
}

/** Targets for a club at the player's average club speed (PGA figures when it isn't known). */
export function windowTarget(club: string, clubSpeed?: number): WindowTarget {
  const p = rowFor(club, PGA)
  const t = tourAt(club, clubSpeed ?? p.mph)
  const tol = faceType(club) === 'wedge' ? 3 : 2
  const base = {
    launch: [t.launch - tol, t.launch + tol] as Range,
    spin: [t.spin * (1 - SPIN_TOL), t.spin * (1 + SPIN_TOL)] as Range,
    speed: clubSpeed,
    speed7: (clubSpeed ?? p.mph) * (PGA['7Iron'].mph / p.mph),
  }
  if (faceType(club) === 'driver') return base
  return {
    ...base,
    landing: {
      mid: [t.land - MID_BELOW, t.land - HIGH_BELOW],
      high: [t.land - HIGH_BELOW, t.land + HIGH_BELOW],
    },
    tourLanding: t.land,
  }
}

export type Level = 'low' | 'ok' | 'high'

export interface WindowInput {
  launch: number
  spin: number
  landing: number
  attack?: number
  /** Impact height in mm, positive = above centre. */
  impactHeight?: number
  spinLoft?: number
}

/** PING's stopping power from landing angle; 'close' is low but within 2° of mid. */
export type Detail = 'veryLow' | 'low' | 'ok' | 'high' | 'veryHigh'
export type SpinDetail = Detail

/** Spin more than this share beyond either end of the range is very low or very high. */
const SPIN_VERY = 0.15

export type Landing = 'tooSteep' | 'steep' | 'high' | 'mid' | 'close' | 'low'

export interface WindowResult {
  launch: Level
  spin: Level
  /** More spin than the target is no problem for this club (wedges). */
  highSpinOk: boolean
  /** Spin in five steps: more than 15% outside the range is very low or very high. */
  spinDetail: SpinDetail
  /** Launch in five steps: more than the tolerance (2°, wedges 3°) outside the range is very low or very high. */
  launchDetail: Detail
  /** More launch than the target is no problem for this club (the driver). */
  highLaunchOk: boolean
  /** undefined for the driver. */
  landing?: Landing
  verdict: 'good' | 'borderline' | 'poor'
  headline: string
  advice: string[]
}

function level(v: number, lo: number, hi: number): Level {
  return v < lo ? 'low' : v > hi ? 'high' : 'ok'
}

const deg = (v: number) => `${v.toFixed(1)}°`

/** Extra hints from the delivery data, phrased for the problem at hand. */
function attackHint(club: string, attack: number | undefined, want: 'steeper' | 'shallower'): string | undefined {
  if (attack === undefined) return undefined
  const [lo, hi] = attackRange(club)
  if (want === 'shallower' && attack < lo)
    return `Your attack angle is ${deg(attack)}, steeper than the ${deg(lo)} to ${deg(hi)} that suits this club.`
  if (want === 'steeper' && attack > hi)
    return `Your attack angle is ${deg(attack)}, shallower than the ${deg(lo)} to ${deg(hi)} that suits this club.`
  return undefined
}

function strikeHint(h: number | undefined, want: 'lower' | 'higher'): string | undefined {
  if (h === undefined) return undefined
  if (want === 'lower' && h > 5) return `Your average strike is ${h.toFixed(0)} mm above centre, which takes spin off.`
  if (want === 'higher' && h < -5) return `Your average strike is ${(-h).toFixed(0)} mm below centre, which adds spin and lowers launch.`
  return undefined
}

const ADVICE: Record<FaceType, Record<string, string>> = {
  driver: {
    'low|low': 'Low launch and low spin: the ball dives. Tee it higher, ball off the lead heel, and swing up through it.',
    'low|ok': 'Launch is low. Tee it higher and move the ball forward so you hit up on it.',
    'low|high': 'Low launch with high spin usually means hitting down on the driver. Tee it higher, ball forward, tilt your spine away from the target at address.',
    'ok|low': 'Spin is on the low side. Fine if it stays in the air; if it drops out of the sky, try a little more loft.',
    'ok|ok': 'Good launch window. Keep it.',
    'ok|high': 'Too much spin costs distance. Look for a strike higher on the face and a more upward attack.',
    'high|low': 'High launch, low spin: the long-carry window. Keep it as long as it stays straight.',
    'high|ok': 'High launch with normal spin is a good, long-carry window.',
    'high|high': 'High and spinny: it balloons. Strike higher on the face, or try less loft.',
  },
  wood: {
    'low|low': 'Low and little spin: the club is delofted at impact. Ball a touch further forward and sweep it off the turf rather than hitting down.',
    'low|ok': 'Low flight. Move the ball slightly forward and sweep it. If it still comes out low, a higher-lofted wood will hold greens better.',
    'low|high': 'Hitting down too much: spin without height. Sweep it, with a shallower attack angle.',
    'ok|low': 'Spin is low for this club, so it will release. Look for strike low on the face and keep the ball forward.',
    'ok|ok': 'Good window.',
    'ok|high': 'Extra spin: the ball may balloon into the wind. A slightly shallower strike takes some off.',
    'high|low': 'High launch but low spin, usually contact high on the face. Tee it lower (off a tee) or strike nearer the centre.',
    'high|ok': 'High launch and normal spin. Usually fine; watch for lost distance.',
    'high|high': 'Too much loft at impact: the ball balloons. Keep the hands level with or slightly ahead of the ball through impact.',
  },
  hybrid: {
    'low|low': 'Delofted at impact: hands too far ahead or the ball too far back. Ball just forward of centre and let the loft work.',
    'low|ok': 'Low flight. Move the ball slightly forward with less shaft lean.',
    'low|high': 'Too steep: hitting down too much creates spin without height. Sweep it, more like a wood than an iron.',
    'ok|low': 'Spin is low for this club and it will release. Look for strike low on the face, and check the ball.',
    'ok|ok': 'Good window.',
    'ok|high': 'Extra spin: it may balloon into the wind. A slightly shallower strike takes some off.',
    'high|low': 'High launch but low spin, usually contact high on the face. Strike nearer the centre.',
    'high|ok': 'High launch and normal spin. Usually fine; watch for lost distance.',
    'high|high': 'Too much loft at impact (flipping): it balloons. Keep the hands ahead of the clubhead through impact.',
  },
  iron: {
    'low|low': 'Delofted at impact: hands too far ahead or ball too far back. Move the ball a ball-width forward and keep a moderate shaft lean.',
    'low|ok': 'Low flight. Move the ball slightly forward with a little less shaft lean.',
    'low|high': 'Penetrating flight with plenty of spin. If it lands too shallow, you are hitting down too steeply; shallow the attack a little.',
    'ok|low': 'Spin is low for this club, so it will release. Clean the grooves, play a urethane ball, and check strike isn\'t high on the face.',
    'ok|ok': 'Good window.',
    'ok|high': 'Extra spin stops it fast but costs distance and suffers in wind.',
    'high|low': 'High launch but low spin, usually contact high on the face or a flip. Hit ball-then-turf with the hands ahead.',
    'high|ok': 'High launch and normal spin. Usually fine; watch for lost distance.',
    'high|high': 'Too much loft at impact (flipping): high, spinny and short. Get the hands ahead of the ball at impact.',
  },
  wedge: {
    'low|low': 'Delofted: hands too far ahead or ball too far back. Ball centred, and let the loft work.',
    'low|ok': 'Low flight with normal spin: a controlled wedge. Fine, as long as it lands steeply enough.',
    'low|high': 'Low and spinny: a classic one-hop-and-stop wedge. Fine for full shots.',
    'ok|low': 'Spin is low for a wedge, so it will release. Clean the grooves, play a urethane ball, and strike nearer the centre or a touch lower.',
    'ok|ok': 'Good window.',
    'ok|high': 'Plenty of spin. Fine for wedges.',
    'high|low': 'High launch but low spin, usually contact high on the face. Strike lower in the grooves; check groove wear and ball type.',
    'high|ok': 'High launch with normal spin: soft landings, but watch distance control.',
    'high|high': 'High and spinny: stops fast but floats in wind. Less loft at impact if distance control suffers.',
  },
}

/** Judge a club's average flight against its window and say what to change. */
export function judgeWindow(club: string, t: WindowTarget, v: WindowInput): WindowResult {
  const type = faceType(club)
  const launch = level(v.launch, t.launch[0], t.launch[1])
  const spin = level(v.spin, t.spin[0], t.spin[1])
  const spinDetail: SpinDetail =
    v.spin < t.spin[0] * (1 - SPIN_VERY)
      ? 'veryLow'
      : v.spin > t.spin[1] * (1 + SPIN_VERY)
        ? 'veryHigh'
        : spin
  const launchTol = (t.launch[1] - t.launch[0]) / 2
  const launchDetail: Detail =
    v.launch < t.launch[0] - launchTol ? 'veryLow' : v.launch > t.launch[1] + launchTol ? 'veryHigh' : launch
  const L = t.landing
  const steepOk = type === 'wedge'
  const landing: Landing | undefined = !L
    ? undefined
    : !steepOk && v.landing > L.high[1] + LANDING_TOO_STEEP
      ? 'tooSteep'
      : !steepOk && v.landing > L.high[1]
        ? 'steep'
        : v.landing >= L.high[0]
      ? 'high'
      : v.landing >= L.mid[0]
        ? 'mid'
        : v.landing >= L.mid[0] - LANDING_CLOSE
          ? 'close'
          : 'low'
  const short = landing === 'close' || landing === 'low'
  const fast = (t.speed7 ?? 0) > LOW_OK_MPH

  const advice: string[] = []
  const key = `${launch}|${spin}`
  // Launch and spin in range but still landing shallow: the club needs more speed than you have.
  if (key === 'ok|ok' && short) {
    advice.push(
      type === 'iron'
        ? 'Launch and spin are in range, but there isn\'t enough speed for this loft to land steeply. A hybrid or higher-lofted club will hold greens better.'
        : type === 'hybrid'
          ? 'Launch and spin are in range, but there isn\'t enough speed for this loft to land steeply. A higher-lofted hybrid will hold greens better.'
          : type === 'wood'
            ? 'Launch and spin are in range, but there isn\'t enough speed for this loft to land steeply. A higher-lofted wood will hold greens better.'
            : 'Launch and spin are in range but it lands shallow. Swing a little longer for more speed.',
    )
  } else {
    advice.push(ADVICE[type][key])
  }

  // Supporting evidence from the delivery numbers, only when they point the same way.
  const hints = [
    spin === 'high' && launch !== 'high' ? attackHint(club, v.attack, 'shallower') : undefined,
    launch === 'low' && spin === 'low' && type === 'driver' ? attackHint(club, v.attack, 'steeper') : undefined,
    spin === 'low' ? strikeHint(v.impactHeight, 'lower') : undefined,
    spin === 'high' && type !== 'wedge' ? strikeHint(v.impactHeight, 'higher') : undefined,
  ].filter((h): h is string => !!h)
  advice.push(...hints)

  if (short && L) {
    const n = Number(club.match(/^(\d+)Iron$/)?.[1])
    advice.push(
      `It lands at ${deg(v.landing)}; at your speed mid stopping power starts at ${deg(L.mid[0])} and high at ${deg(L.high[0])}.` +
        (launch !== 'high'
          ? ' Launch is the bigger lever: 1° more launch adds about 1–1.5° of landing angle, 500 rpm more spin only about 0.5°.'
          : '') +
        (n && n <= 5 ? ' At your speed a hybrid in place of this iron usually lands steeper.' : ''),
    )
    if (fast) advice.push('At your speed low stopping power can be a deliberate choice for control in wind.')
  }
  if ((landing === 'steep' || landing === 'tooSteep') && L) {
    advice.push(
      `It lands at ${deg(v.landing)}, steeper than the ${deg(L.high[1])} top of the window. It stops, but the extra height costs distance and suffers in wind.` +
        (launch === 'high' || spin === 'high' ? ' Less loft at impact (hands a little ahead) brings it down.' : ''),
    )
  }

  let verdict: WindowResult['verdict']
  let headline: string
  if (type === 'driver') {
    // The driver is judged on launch and spin: high launch with low or normal spin is the long window.
    verdict =
      launch !== 'low' && spin !== 'high' ? 'good' : launch === 'low' && spin !== 'ok' ? 'poor' : 'borderline'
    headline = verdict === 'good' ? 'Good launch window' : verdict === 'borderline' ? 'Close to the window' : 'Out of the window'
  } else if (landing === 'steep' || landing === 'tooSteep') {
    verdict = landing === 'tooSteep' ? 'borderline' : 'good'
    headline = landing === 'tooSteep' ? 'Too steep: stops, but loses distance' : 'Steep: stops fast, costs a little distance'
  } else if (landing === 'high' || landing === 'mid') {
    verdict = spin === 'low' ? 'borderline' : 'good'
    headline =
      (landing === 'high' ? 'High stopping power' : 'Mid stopping power') + (spin === 'low' ? ', but low spin' : '')
  } else {
    verdict = landing === 'close' || fast ? 'borderline' : 'poor'
    headline = landing === 'close' ? 'Just short of mid stopping power' : 'Low stopping power: it will release'
  }
  return { launch, spin, highSpinOk: type === 'wedge', spinDetail, launchDetail, highLaunchOk: type === 'driver', landing, verdict, headline, advice }
}

/** A wedge shot counts as a full swing when it carries at least this share of the club's median carry. */
const FULL_SWING = 0.9
/** The club's fast (or long) end: this quantile, so one outlier doesn't set it. */
const FAST_END = 0.9
/** Fewer full wedge swings than this and the window isn't judged. */
export const MIN_FULL_SWINGS = 5

function fastEnd(vals: number[]): number | undefined {
  const sorted = vals.filter(Number.isFinite).sort((a, b) => a - b)
  return quantileSorted(sorted, FAST_END)
}

/**
 * The shots to judge the window on. Wedges are often hit with chips and part swings, which launch,
 * spin and land differently, so only their full swings count; other clubs use every shot. A full swing
 * has a club speed of at least 90% of the club's fast end (its 90th percentile), which holds even when
 * most shots with the club are chips. Shots without club speed fall back to carry against the long end.
 */
export function fullSwings<T extends { v: { carry?: number; clubSpeed?: number } }>(club: string, shots: T[]): T[] {
  if (faceType(club) !== 'wedge') return shots
  const speed = fastEnd(shots.map((s) => s.v.clubSpeed!).filter((v) => v !== undefined))
  const carry = fastEnd(shots.map((s) => s.v.carry!).filter((v) => v !== undefined))
  return shots.filter((s) =>
    s.v.clubSpeed !== undefined && speed !== undefined
      ? s.v.clubSpeed >= FULL_SWING * speed
      : s.v.carry !== undefined && carry !== undefined && s.v.carry >= FULL_SWING * carry,
  )
}
