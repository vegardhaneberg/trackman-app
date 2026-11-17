import { scaleLinear } from 'd3-scale'
import { fmt } from '../lib/metrics'
import { useWidth } from './useWidth'

const M = { top: 20, right: 16, bottom: 22, left: 30 }

/** What defines a ball flight seen from the side. Distances in m, angles in degrees. */
export interface FlightShape {
  carry: number
  launchAngle: number
  maxHeight: number
  landingAngle: number
}

interface Props {
  ariaLabel: string
  mean: FlightShape
  shots: FlightShape[]
  /** Extent of the axes in m, shared by every club so the charts compare. */
  maxCarry: number
  maxHeight: number
  /** Good max height range in m, drawn as a band. */
  goodHeight?: [number, number]
}

/** Side view of a club's ball flight, height against distance at the same scale, target to the right. */
export function Flight({ ariaLabel, mean, shots, maxCarry, maxHeight, goodHeight }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const iw = Math.max(width - M.left - M.right, 10)
  const k = iw / maxCarry // px per m, both directions
  const ih = maxHeight * k
  const height = M.top + ih + M.bottom
  const sx = scaleLinear().domain([0, maxCarry]).range([0, iw])
  const sy = scaleLinear().domain([0, maxHeight]).range([ih, 0])
  const meanPath = flightPath(mean, k, ih)
  const apex = apexX(mean)
  // On a narrow chart the two figures collide; the stats below the chart carry them anyway.
  const labels = iw >= 420

  return (
    <div ref={ref} className="chart-wrap">
      {width > 0 && (
        <svg className="flight" width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${M.left},${M.top})`}>
            <g className="grid">
              {sy.ticks(Math.max(2, Math.floor(ih / 28))).map((t) => (
                <g key={t}>
                  {t > 0 && <line x1={0} x2={iw} y1={sy(t)} y2={sy(t)} />}
                  <text className="tick" x={-6} y={sy(t)} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {sx.ticks(Math.max(2, Math.floor(iw / 70))).map((t) => (
                <text key={t} className="tick" x={sx(t)} y={ih + 15} textAnchor="middle">
                  {t}
                </text>
              ))}
            </g>
            {goodHeight && (
              <rect
                className="flight-good"
                x={0}
                y={sy(goodHeight[1])}
                width={iw}
                height={sy(goodHeight[0]) - sy(goodHeight[1])}
              />
            )}
            <line className="flight-ground" x1={0} x2={iw} y1={ih} y2={ih} />
            {shots.map((s, i) => {
              const d = flightPath(s, k, ih)
              return d && <path key={i} className="flight-shot" d={d} />
            })}
            {meanPath && (
              <>
                <path className="flight-mean" d={meanPath} />
                <circle className="flight-dot" cx={sx(apex)} cy={sy(mean.maxHeight)} r={3.5} />
                {labels && (
                  <text className="flight-label" x={sx(apex)} y={sy(mean.maxHeight) - 8} textAnchor="middle">
                    {fmt('maxHeight', mean.maxHeight)}
                  </text>
                )}
                <circle className="flight-dot" cx={sx(mean.carry)} cy={ih} r={3.5} />
                {labels && (
                  <text
                    className="flight-label"
                    x={sx(mean.carry) + 8}
                    y={ih - 8}
                    textAnchor={sx(mean.carry) + 70 > iw ? 'end' : 'start'}
                    dx={sx(mean.carry) + 70 > iw ? -16 : 0}
                    dy={sx(mean.carry) + 70 > iw ? -8 : 0}
                  >
                    {fmt('carry', mean.carry)}
                  </text>
                )}
              </>
            )}
          </g>
        </svg>
      )}
    </div>
  )
}

const tan = (deg: number) => Math.tan((deg * Math.PI) / 180)

/**
 * Horizontal reach of the two Bézier handles: one along the launch line, one along the landing line.
 * Both end 4/3 of the max height up, which makes the curve peak at exactly the max height.
 */
function handles(f: FlightShape): [number, number] {
  const y = (4 / 3) * f.maxHeight
  return [Math.min(y / tan(f.launchAngle), f.carry), Math.min(y / tan(Math.abs(f.landingAngle)), f.carry)]
}

/**
 * Distance at which the flight peaks. The export has no trajectory, so this follows from the
 * constructed curve: a steeper landing than launch pushes the peak past halfway.
 */
function apexX(f: FlightShape): number {
  const [up, down] = handles(f)
  return 0.375 * (up + f.carry - down) + 0.125 * f.carry
}

/**
 * Curve that leaves the ground at the launch angle, peaks at the max height and lands at the carry
 * distance at the landing angle. Null when the numbers don't describe a flight (e.g. a topped shot).
 */
function flightPath(f: FlightShape, k: number, ground: number): string | null {
  const land = Math.abs(f.landingAngle)
  if (!(f.carry > 0 && f.maxHeight > 0 && f.launchAngle > 0.5 && land > 0.5 && f.launchAngle < 89 && land < 89)) {
    return null
  }
  const [up, down] = handles(f)
  const top = (ground - (4 / 3) * f.maxHeight * k).toFixed(1)
  const p = (x: number) => (x * k).toFixed(1)
  return `M0 ${ground.toFixed(1)} C${p(up)} ${top} ${p(f.carry - down)} ${top} ${p(f.carry)} ${ground.toFixed(1)}`
}
