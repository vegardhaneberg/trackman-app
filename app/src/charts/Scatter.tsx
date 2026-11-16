import { scaleLinear } from 'd3-scale'
import { useState, type MouseEvent, type ReactNode } from 'react'
import { covEllipse } from '../lib/stats'
import type { Shot } from '../lib/types'
import { TooltipBox } from './Tooltip'

export interface Pt {
  id: string
  x: number
  y: number
  shot: Shot
}

export type Scale = (v: number) => number

interface Props {
  points: Pt[]
  width: number
  height: number
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel?: string
  yLabel?: string
  /** Hide gridlines/ticks (e.g. the impact face draws its own reference). */
  bare?: boolean
  showEllipse?: boolean
  dotRadius?: number
  background?: (sx: Scale, sy: Scale) => ReactNode
  tooltip: (p: Pt) => ReactNode
  highlightId?: string | null
  onHover?: (id: string | null) => void
  ariaLabel: string
}

const HIT_RADIUS = 16

export function Scatter(props: Props) {
  const { points, width, height, xDomain, yDomain, bare, highlightId, onHover, dotRadius: r = 4 } = props
  const [hover, setHover] = useState<{ p: Pt; px: number; py: number } | null>(null)
  const m = bare ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 10, right: 14, bottom: 40, left: 52 }
  const iw = Math.max(width - m.left - m.right, 10)
  const ih = Math.max(height - m.top - m.bottom, 10)
  const sx = scaleLinear().domain(xDomain).range([0, iw])
  const sy = scaleLinear().domain(yDomain).range([ih, 0])

  // Points outside the domain are pinned to the edge and drawn hollow.
  const placed = points.map((p) => {
    const px = sx(p.x)
    const py = sy(p.y)
    const cx = Math.min(Math.max(px, 0), iw)
    const cy = Math.min(Math.max(py, 0), ih)
    return { p, cx, cy, clipped: cx !== px || cy !== py }
  })

  const ell = props.showEllipse ? covEllipse(placed.filter((d) => !d.clipped).map((d) => [d.cx, d.cy])) : null

  function onMove(e: MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    // The hit rect spans the whole SVG; convert to plot coordinates.
    const mx = e.clientX - r.left - m.left
    const my = e.clientY - r.top - m.top
    let best: (typeof placed)[number] | null = null
    let bestD = HIT_RADIUS ** 2
    for (const d of placed) {
      const dd = (d.cx - mx) ** 2 + (d.cy - my) ** 2
      if (dd < bestD) {
        bestD = dd
        best = d
      }
    }
    setHover(best ? { p: best.p, px: best.cx + m.left, py: best.cy + m.top } : null)
    onHover?.(best ? best.p.id : null)
  }

  function onLeave() {
    setHover(null)
    onHover?.(null)
  }

  const activeId = hover?.p.id ?? highlightId
  const active = placed.find((d) => d.p.id === activeId)

  return (
    <div className="chart" style={{ width, height }}>
      <svg width={width} height={height} role="img" aria-label={props.ariaLabel}>
        <g transform={`translate(${m.left},${m.top})`}>
          {!bare && (
            <g className="grid">
              {sx.ticks(6).map((t) => (
                <g key={`x${t}`}>
                  <line x1={sx(t)} x2={sx(t)} y1={0} y2={ih} />
                  <text className="tick" x={sx(t)} y={ih + 16} textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
              {sy.ticks(5).map((t) => (
                <g key={`y${t}`}>
                  <line x1={0} x2={iw} y1={sy(t)} y2={sy(t)} />
                  <text className="tick" x={-8} y={sy(t)} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
            </g>
          )}
          {props.background?.(sx, sy)}
          {ell && (
            <ellipse
              className="sigma"
              cx={ell.cx}
              cy={ell.cy}
              rx={ell.rx}
              ry={ell.ry}
              transform={`rotate(${ell.angle} ${ell.cx} ${ell.cy})`}
            />
          )}
          {placed.map((d) => (
            <circle
              key={d.p.id}
              className={d.clipped ? 'dot clipped' : 'dot'}
              cx={d.cx}
              cy={d.cy}
              r={d.clipped ? r - 1 : r}
            />
          ))}
          {ell && <circle className="mean" cx={ell.cx} cy={ell.cy} r={r} />}
          {active && <circle className="dot active" cx={active.cx} cy={active.cy} r={r + 2} />}
          <rect
            className="hit"
            x={-m.left}
            y={-m.top}
            width={width}
            height={height}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
          />
        </g>
        {!bare && props.xLabel && (
          <text className="axis-label" x={m.left + iw / 2} y={height - 4} textAnchor="middle">
            {props.xLabel}
          </text>
        )}
        {!bare && props.yLabel && (
          <text
            className="axis-label"
            transform={`translate(12,${m.top + ih / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {props.yLabel}
          </text>
        )}
      </svg>
      {hover && (
        <TooltipBox x={hover.px} y={hover.py} width={width}>
          {props.tooltip(hover.p)}
        </TooltipBox>
      )}
    </div>
  )
}
