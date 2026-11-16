import type { FaceType } from '../lib/clubs'

const W = 240
const H = 236
const BX = W / 2
const BY = 150
const BALL_R = 7
const PATH_LEN = 112
const FACE_LEN = 84

interface Props {
  ariaLabel: string
  type: FaceType
  /** Degrees relative to the target line, positive = right of target. */
  clubPath: number
  faceAngle: number
  /** Drawn angle = real angle × this, so a few degrees are visible. */
  exaggeration: number
}

/** Top-down view of the club at impact: target straight up, golfer (right-handed) to the left of the ball. */
export function ClubDelivery({ ariaLabel, type, clubPath, faceAngle, exaggeration }: Props) {
  const path = clubPath * exaggeration
  const face = faceAngle * exaggeration

  return (
    <svg className="delivery" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <line className="delivery-target" x1={BX} y1={14} x2={BX} y2={BY} />
      <text className="tick" x={BX} y={10} textAnchor="middle">
        Target
      </text>

      {/* Swing arc, tangent to the club path at the ball and bending towards the golfer. */}
      <g transform={`rotate(${path} ${BX} ${BY})`}>
        <path className="delivery-arc" d={swingArc(300, 30)} />
      </g>

      <g transform={`rotate(${face} ${BX} ${BY}) translate(${BX} ${BY + BALL_R + 1})`}>
        {/* Shaft in line with the face: its leading edge sits on the face line (y = 0), not behind it. */}
        <line className="delivery-shaft" x1={-19} y1={2} x2={-78} y2={4} />
        <path className="delivery-head" d={headPath(type)} />
      </g>

      <Arrow className="delivery-path" angle={path} length={PATH_LEN} />
      <Arrow className="delivery-face" angle={face} length={FACE_LEN} />

      <circle className="delivery-ball" cx={BX} cy={BY} r={BALL_R} />
    </svg>
  )
}

function Arrow({ className, angle, length }: { className: string; angle: number; length: number }) {
  const tip = BY - length
  return (
    <g className={className} transform={`rotate(${angle} ${BX} ${BY})`}>
      <line x1={BX} y1={BY} x2={BX} y2={tip + 10} />
      <polygon points={`${BX},${tip} ${BX - 6},${tip + 13} ${BX + 6},${tip + 13}`} />
    </g>
  )
}

function swingArc(r: number, halfSpan: number): string {
  const a = (halfSpan * Math.PI) / 180
  const x = BX - r + r * Math.cos(a)
  const dy = r * Math.sin(a)
  return `M${x} ${BY + dy} A${r} ${r} 0 0 0 ${x} ${BY - dy}`
}

/** Head outline seen from above, face along y = 0 and centred on x = 0, heel to the left. */
function headPath(type: FaceType): string {
  switch (type) {
    case 'driver':
      return 'M-24 0 L24 0 C34 16 22 46 -2 46 C-22 46 -32 18 -24 0 Z'
    case 'wood':
      return 'M-22 0 L22 0 C30 13 20 36 -2 36 C-20 36 -29 14 -22 0 Z'
    case 'hybrid':
      return 'M-21 0 L21 0 C27 10 18 26 -2 26 C-18 26 -26 10 -21 0 Z'
    default:
      return 'M-23 0 L23 0 C26 3 25 7 21 9 C8 13 -12 13 -21 10 C-25 8 -25 3 -23 0 Z'
  }
}
