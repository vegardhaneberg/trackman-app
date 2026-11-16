import { useState } from 'react'
import { Scatter, type Pt } from '../charts/Scatter'
import { ShotTooltip } from '../charts/Tooltip'
import { useWidth } from '../charts/useWidth'
import { clubLabel } from '../lib/clubs'
import { axisLabel, METRICS, type MetricKey } from '../lib/metrics'
import { byClub, pearson } from '../lib/stats'
import type { Shot } from '../lib/types'

const MIN_FACET = 300

function domainOf(vals: number[]): [number, number] {
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = (hi - lo || 1) * 0.05
  return [lo - pad, hi + pad]
}

export function Explorer({ shots }: { shots: Shot[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [xKey, setX] = useState<MetricKey>('clubSpeed')
  const [yKey, setY] = useState<MetricKey>('carry')
  const [split, setSplit] = useState(true)

  const usable = shots.filter((s) => s.v[xKey] !== undefined && s.v[yKey] !== undefined)
  const toPts = (ss: Shot[]): Pt[] => ss.map((s) => ({ id: s.id, x: s.v[xKey]!, y: s.v[yKey]!, shot: s }))
  const all = toPts(usable)
  // Shared axes across facets keep clubs comparable.
  const xDomain = domainOf(all.map((p) => p.x))
  const yDomain = domainOf(all.map((p) => p.y))
  const tooltip = (p: Pt) => <ShotTooltip shot={p.shot} keys={[xKey, yKey]} />

  const cols = split ? Math.max(1, Math.floor((width + 16) / (MIN_FACET + 16))) : 1
  const facetW = Math.floor((width - (cols - 1) * 16) / cols)

  return (
    <section className="card">
      <header className="card-head">
        <h2>Metric explorer</h2>
        <div className="controls">
          <MetricSelect label="X axis" value={xKey} onChange={setX} />
          <MetricSelect label="Y axis" value={yKey} onChange={setY} />
          <label className="check">
            <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
            One chart per club
          </label>
        </div>
        <p className="muted">
          {usable.length} of {shots.length} shots have both metrics.
          {!split && <> Correlation r = {fmtR(pearson(all.map((p) => p.x), all.map((p) => p.y)))}.</>}
        </p>
      </header>
      <div ref={ref} className="facets" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {width > 0 && usable.length > 0 &&
          (split ? (
            byClub(usable).map(([club, ss]) => {
              const pts = toPts(ss)
              return (
                <figure key={club} className="facet">
                  <figcaption>
                    <strong>{clubLabel(club)}</strong>
                    <span className="muted">
                      {' '}
                      · {ss.length} shots · r = {fmtR(pearson(pts.map((p) => p.x), pts.map((p) => p.y)))}
                    </span>
                  </figcaption>
                  <Scatter
                    ariaLabel={`${clubLabel(club)}: ${axisLabel(yKey)} vs ${axisLabel(xKey)}`}
                    points={pts}
                    width={facetW}
                    height={260}
                    xDomain={xDomain}
                    yDomain={yDomain}
                    xLabel={axisLabel(xKey)}
                    yLabel={axisLabel(yKey)}
                    tooltip={tooltip}
                  />
                </figure>
              )
            })
          ) : (
            <Scatter
              ariaLabel={`${axisLabel(yKey)} vs ${axisLabel(xKey)}`}
              points={all}
              width={facetW}
              height={460}
              xDomain={xDomain}
              yDomain={yDomain}
              xLabel={axisLabel(xKey)}
              yLabel={axisLabel(yKey)}
              tooltip={tooltip}
            />
          ))}
      </div>
    </section>
  )
}

function MetricSelect({ label, value, onChange }: { label: string; value: MetricKey; onChange: (k: MetricKey) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as MetricKey)}>
        {METRICS.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function fmtR(r: number | undefined) {
  return r === undefined ? '–' : r.toFixed(2)
}
