import { scaleLinear } from 'd3-scale'
import { useState } from 'react'
import { clubLabel } from '../lib/clubs'
import { fmt } from '../lib/metrics'
import { quantiles, values } from '../lib/stats'
import type { Shot } from '../lib/types'
import { TooltipBox, TooltipRows } from './Tooltip'
import { useWidth } from './useWidth'

const ROW = 40
const M = { top: 8, right: 64, bottom: 36, left: 120 }

interface Row {
  club: string
  n: number
  carries: number[]
  q: number[] // p10, p25, p50, p75, p90
  totalMedian?: number
}

/** One row per club: carry spread as box (p25–p75) + whisker (p10–p90), median total as a diamond. */
export function Gapping({ groups }: { groups: [string, Shot[]][] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const rows: Row[] = groups
    .map(([club, shots]) => {
      const carries = values(shots, 'carry')
      const totals = values(shots, 'total')
      return {
        club,
        n: carries.length,
        carries,
        q: quantiles(carries, [0.1, 0.25, 0.5, 0.75, 0.9]),
        totalMedian: totals.length ? quantiles(totals, [0.5])[0] : undefined,
      }
    })
    .filter((r) => r.n > 0)

  const maxX = Math.max(10, ...rows.flatMap((r) => [r.q[4], r.totalMedian ?? 0]))
  const iw = Math.max(width - M.left - M.right, 10)
  const height = M.top + M.bottom + rows.length * ROW
  const sx = scaleLinear().domain([0, maxX * 1.04]).range([0, iw]).nice()

  return (
    <div ref={ref} className="chart-wrap">
      {width > 0 && (
        <div className="chart" style={{ width, height }}>
          <svg width={width} height={height} role="img" aria-label="Carry distance per club">
            <g transform={`translate(${M.left},${M.top})`}>
              <g className="grid">
                {sx.ticks(8).map((t) => (
                  <g key={t}>
                    <line x1={sx(t)} x2={sx(t)} y1={0} y2={rows.length * ROW} />
                    <text className="tick" x={sx(t)} y={rows.length * ROW + 16} textAnchor="middle">
                      {t}
                    </text>
                  </g>
                ))}
              </g>
              {rows.map((r, i) => {
                const cy = i * ROW + ROW / 2
                return (
                  <g key={r.club} className={hover === i ? 'gap-row hovered' : 'gap-row'}>
                    <text className="row-label" x={-12} y={cy} dy="0.32em" textAnchor="end">
                      {clubLabel(r.club)}
                      <tspan className="muted"> · {r.n}</tspan>
                    </text>
                    {r.carries.map((c, j) => (
                      <circle
                        key={j}
                        className="strip"
                        cx={sx(c)}
                        cy={cy + (((j * 7919) % 17) - 8)}
                        r={2}
                      />
                    ))}
                    <line className="whisker" x1={sx(r.q[0])} x2={sx(r.q[4])} y1={cy} y2={cy} />
                    <rect
                      className="box"
                      x={sx(r.q[1])}
                      y={cy - 7}
                      width={Math.max(sx(r.q[3]) - sx(r.q[1]), 2)}
                      height={14}
                      rx={4}
                    />
                    <line className="median" x1={sx(r.q[2])} x2={sx(r.q[2])} y1={cy - 9} y2={cy + 9} />
                    {r.totalMedian !== undefined && (
                      <path
                        className="total-mark"
                        d={`M${sx(r.totalMedian)},${cy - 6}l6,6l-6,6l-6,-6z`}
                      />
                    )}
                    <text className="row-value" x={iw + 8} y={cy} dy="0.32em">
                      {fmt('carry', r.q[2])}
                    </text>
                    <rect
                      className="hit"
                      x={-M.left}
                      y={i * ROW}
                      width={width}
                      height={ROW}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                )
              })}
            </g>
            <text className="axis-label" x={M.left + iw / 2} y={height - 4} textAnchor="middle">
              Carry (m)
            </text>
          </svg>
          {hover !== null && rows[hover] && (
            <TooltipBox x={sx(rows[hover].q[2]) + M.left} y={M.top + hover * ROW + ROW} width={width}>
              <div className="tooltip-title">{clubLabel(rows[hover].club)}</div>
              <TooltipRows
                rows={[
                  ['Median carry', fmt('carry', rows[hover].q[2])],
                  ['Middle 50%', `${fmt('carry', rows[hover].q[1])} – ${fmt('carry', rows[hover].q[3])}`],
                  ['10–90%', `${fmt('carry', rows[hover].q[0])} – ${fmt('carry', rows[hover].q[4])}`],
                  ['Median total', fmt('total', rows[hover].totalMedian)],
                  ['Shots', String(rows[hover].n)],
                ]}
              />
            </TooltipBox>
          )}
        </div>
      )}
    </div>
  )
}
