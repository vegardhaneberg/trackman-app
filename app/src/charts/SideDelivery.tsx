import type { FaceType } from '../lib/clubs'

const W = 240
const H = 196
const BX = 84
const BALL_R = 7
const GROUND = 140
const TEE = 12 // how far the driver's ball sits above the ground
const ATTACK_LEN = 128
const RANGE_R = ATTACK_LEN + 10 // the good-range arc sits just past the attack arrow's tip
const LAUNCH_LEN = 112
/** Every angle in the picture (arrows, shaft lean, good range) is drawn times this, so differences show. */
export const SIDE_EXAGGERATION = 2
/** Distances along the ground are true to the ball's size (a golf ball is 4.27 cm across). */
const PX_PER_CM = (2 * BALL_R) / 4.27
const SHAFT_LEN = 180 // long enough to run off the top of the picture at any lean

interface Props {
  ariaLabel: string
  type: FaceType
  /** Degrees relative to level, positive = upwards. */
  attackAngle: number
  launchAngle: number
  /** Good attack angle range in degrees, drawn as an arc at the end of the attack arrow. */
  goodAttack: [number, number]
  /** Where the swing bottoms out, in cm after the ball (negative = before it), when measured. */
  lowPoint?: number
}

/** Side view of impact: right-handed golfer seen face-on, so the target is to the right. */
export function SideDelivery({ ariaLabel, type, attackAngle, launchAngle, goodAttack, lowPoint }: Props) {
  const attack = attackAngle * SIDE_EXAGGERATION
  const [hx, hy] = HOSEL[type]
  const tee = type === 'driver' ? TEE : 0
  const by = GROUND - BALL_R - tee
  const lowX = lowPoint === undefined ? undefined : Math.min(W - 8, Math.max(8, BX + lowPoint * PX_PER_CM))
  // Bend the swing arc so it bottoms out at the low point, when that agrees with the attack direction.
  const sinAttack = Math.sin((-attack * Math.PI) / 180)
  const fitted = lowX !== undefined && sinAttack !== 0 ? (lowX - BX) / sinAttack : 0
  const arcR = fitted >= 100 && fitted <= 900 ? fitted : 300

  return (
    <svg className="delivery" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <line className="delivery-ground" x1={0} y1={GROUND} x2={W} y2={GROUND} />

      {/* Swing arc, tangent to the attack direction at the ball and curving up on both sides. */}
      <g transform={`rotate(${-attack} ${BX} ${by})`}>
        <path className="delivery-arc" d={swingArc(by, arcR, (16 * 300) / arcR)} />
      </g>

      <g transform={`translate(${BX - BALL_R - 1} ${GROUND})`}>
        {/* Shaft leans with the attack angle: forward (towards the target) when hitting down, back when hitting up. */}
        <line
          className="delivery-shaft"
          transform={`rotate(${-attack} ${hx} ${hy})`}
          x1={hx}
          y1={hy}
          x2={hx}
          y2={hy - SHAFT_LEN}
        />
        <path className="delivery-head" d={HEAD[type]} />
      </g>

      {tee > 0 && (
        <path className="delivery-tee" d={`M${BX - 4} ${by + BALL_R - 1} L${BX + 4} ${by + BALL_R - 1} M${BX} ${by + BALL_R - 1} L${BX} ${GROUND}`} />
      )}

      {lowX !== undefined && (
        <path className="delivery-low" d={`M${lowX} ${GROUND + 2} l-6 10 h12 Z`} />
      )}

      <path className="delivery-good" d={arc(by, RANGE_R, goodAttack[0] * SIDE_EXAGGERATION, goodAttack[1] * SIDE_EXAGGERATION)} />
      <Arrow className="delivery-path" by={by} angle={attack} length={ATTACK_LEN} />
      <Arrow className="delivery-face" by={by} angle={launchAngle * SIDE_EXAGGERATION} length={LAUNCH_LEN} />

      <circle className="delivery-ball" cx={BX} cy={by} r={BALL_R} />
    </svg>
  )
}

/** Arrow from the ball towards the target, tilted up by `angle` degrees. */
function Arrow({ className, by, angle, length }: { className: string; by: number; angle: number; length: number }) {
  const tip = BX + length
  return (
    <g className={className} transform={`rotate(${-angle} ${BX} ${by})`}>
      <line x1={BX} y1={by} x2={tip - 10} y2={by} />
      <polygon points={`${tip},${by} ${tip - 13},${by - 6} ${tip - 13},${by + 6}`} />
    </g>
  )
}

/** Arc around the ball from angle `from` to `to` (degrees above level). */
function arc(by: number, r: number, from: number, to: number): string {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${BX + r * Math.cos(a)} ${by - r * Math.sin(a)}`
  }
  return `M${pt(from)} A${r} ${r} 0 0 0 ${pt(to)}`
}

function swingArc(by: number, r: number, halfSpan: number): string {
  const a = (halfSpan * Math.PI) / 180
  const dx = r * Math.sin(a)
  const y = by - r + r * Math.cos(a)
  return `M${BX - dx} ${y} A${r} ${r} 0 0 0 ${BX + dx} ${y}`
}

// Head profiles seen from the side: face on the right at x = 0, sole on y = 0, back of the head to the left.
const HEAD: Record<FaceType, string> = {
  driver: 'M0 -3 L-4 -30 C-18 -36 -44 -24 -46 -8 C-46 -2 -36 0 -20 0 L-4 0 Z',
  wood: 'M0 -2 L-4 -22 C-16 -27 -36 -18 -38 -6 C-38 -1 -30 0 -16 0 L-3 0 Z',
  hybrid: 'M0 -2 L-5 -20 C-14 -24 -28 -16 -29 -5 C-29 -1 -22 0 -12 0 L-3 0 Z',
  iron: 'M0 -1 L-14 -26 L-18 -25 L-9 -3 L-12 0 L-2 0 Z',
  wedge: 'M0 -1 L-20 -24 L-24 -22 L-10 -3 L-13 0 L-2 0 Z',
}

/** Where the shaft leaves the head: the crown on woods, the bottom of the face on irons and wedges. */
const HOSEL: Record<FaceType, [number, number]> = {
  driver: [-10, -30],
  wood: [-9, -22],
  hybrid: [-9, -20],
  iron: [-6, -2],
  wedge: [-7, -2],
}
