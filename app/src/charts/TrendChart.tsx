import { scaleLinear } from 'd3-scale'
import { useState, type MouseEvent } from 'react'
import { fmtDate, fmtShortDate, kindLabel } from '../lib/format'
import { axisLabel, fmt, type MetricKey } from '../lib/metrics'
import { TooltipBox, TooltipRows } from './Tooltip'
import { useWidth } from './useWidth'

export interface TrendPoint {
  sessionId: string
  time: Date
  kind: string
  mean: number
  sd: number
  n: number
  values: number[]
}

const M = { top: 12, right: 20, bottom: 52, left: 56 }
const HEIGHT = 360

/** Per-session mean (line + dots) with a ±1 SD band and the individual shots behind it. */
export function TrendChart({ points, metric }: { points: TrendPoint[]; metric: MetricKey }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const iw = Math.max(width - M.left - M.right, 10)
  const ih = HEIGHT - M.top - M.bottom

  // Sessions are evenly spaced in order; several can share a day.
  const sxi = scaleLinear().domain([-0.5, points.length - 0.5]).range([0, iw])
  const idx = new Map(points.map((p, i) => [p.sessionId, i]))
  const sx = (t: TrendPoint) => sxi(idx.get(t.sessionId)!)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(iw / 80))))
  const all = points.flatMap((p) => [...p.values, p.mean - p.sd, p.mean + p.sd])
  const sy = scaleLinear()
    .domain([Math.min(...all), Math.max(...all)])
    .range([ih, 0])
    .nice()

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p)},${sy(p.mean)}`).join('')
  const band =
    points.map((p, i) => `${i ? 'L' : 'M'}${sx(p)},${sy(p.mean + p.sd)}`).join('') +
    [...points]
      .reverse()
      .map((p) => `L${sx(p)},${sy(p.mean - p.sd)}`)
      .join('') +
    'Z'

  function onMove(e: MouseEvent<SVGRectElement>) {
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left - M.left
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(sx(p) - mx) < Math.abs(sx(points[best]) - mx)) best = i
    })
    setHover(best)
  }

  const h = hover !== null ? points[hover] : null

  return (
    <div ref={ref} className="chart-wrap">
      {width > 0 && (
        <div className="chart" style={{ width, height: HEIGHT }}>
          <svg width={width} height={HEIGHT} role="img" aria-label={`${axisLabel(metric)} per session`}>
            <g transform={`translate(${M.left},${M.top})`}>
              <g className="grid">
                {sy.ticks(6).map((t) => (
                  <g key={t}>
                    <line x1={0} x2={iw} y1={sy(t)} y2={sy(t)} />
                    <text className="tick" x={-8} y={sy(t)} dy="0.32em" textAnchor="end">
                      {t}
                    </text>
                  </g>
                ))}
                {points.map((p, i) =>
                  i % labelEvery === 0 ? (
                    <text key={p.sessionId} className="tick" x={sx(p)} y={ih + 18} textAnchor="middle">
                      {fmtShortDate(p.time)}
                      <tspan x={sx(p)} dy="1.3em">
                        {kindLabel(p.kind)}
                      </tspan>
                    </text>
                  ) : null,
                )}
              </g>
              {points.length > 1 && <path className="band" d={band} />}
              {points.flatMap((p) =>
                p.values.map((v, j) => (
                  <circle
                    key={`${p.sessionId}${j}`}
                    className="strip"
                    cx={sx(p) + (((j * 7919) % 11) - 5)}
                    cy={sy(v)}
                    r={2}
                  />
                )),
              )}
              {points.length > 1 && <path className="line" d={line} />}
              {h && <line className="crosshair" x1={sx(h)} x2={sx(h)} y1={0} y2={ih} />}
              {points.map((p, i) => (
                <circle
                  key={p.sessionId}
                  className={i === hover ? 'dot active' : 'dot solid'}
                  cx={sx(p)}
                  cy={sy(p.mean)}
                  r={i === hover ? 6 : 4.5}
                />
              ))}
              <rect
                className="hit"
                x={0}
                y={0}
                width={iw}
                height={ih}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
              />
            </g>
            <text
              className="axis-label"
              transform={`translate(14,${M.top + ih / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              {axisLabel(metric)}
            </text>
          </svg>
          {h && (
            <TooltipBox x={sx(h) + M.left} y={sy(h.mean) + M.top} width={width}>
              <div className="tooltip-title">{fmtDate(h.time.toISOString())}</div>
              <div className="tooltip-sub">{kindLabel(h.kind)}</div>
              <TooltipRows
                rows={[
                  ['Mean', fmt(metric, h.mean)],
                  ['Std. dev.', fmt(metric, h.sd)],
                  ['Shots', String(h.n)],
                ]}
              />
            </TooltipBox>
          )}
        </div>
      )}
    </div>
  )
}
