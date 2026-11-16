import type { ReactNode } from 'react'
import { clubLabel } from '../lib/clubs'
import { fmtDate, kindLabel } from '../lib/format'
import { fmt, METRIC, type MetricKey } from '../lib/metrics'
import type { Shot } from '../lib/types'

export function TooltipBox({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flip to the left of the cursor when close to the right edge.
  const flip = x > width - 220
  return (
    <div
      className="tooltip"
      style={{ top: y, left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined }}
    >
      {children}
    </div>
  )
}

export function TooltipRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const BASE_KEYS: MetricKey[] = ['carry', 'clubSpeed']

/** Standard shot tooltip: club, session, carry, club speed, plus the plotted metrics. */
export function ShotTooltip({ shot, keys = [] }: { shot: Shot; keys?: MetricKey[] }) {
  const all = [...BASE_KEYS, ...keys.filter((k) => !BASE_KEYS.includes(k))]
  return (
    <>
      <div className="tooltip-title">{clubLabel(shot.club)}</div>
      <div className="tooltip-sub">
        {fmtDate(shot.activityTime)} · {kindLabel(shot.kind)}
      </div>
      <TooltipRows rows={all.map((k) => [METRIC[k].label, fmt(k, shot.v[k])])} />
    </>
  )
}

