import { useState } from 'react'
import { TrendChart, type TrendPoint } from '../charts/TrendChart'
import { clubLabel } from '../lib/clubs'
import { METRICS, type MetricKey } from '../lib/metrics'
import { byClub, groupBy, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'

export function Trends({ shots }: { shots: Shot[] }) {
  const groups = byClub(shots)
  const [club, setClub] = useState<string>('')
  const [metric, setMetric] = useState<MetricKey>('carry')
  const activeClub = groups.some(([c]) => c === club) ? club : (groups[0]?.[0] ?? '')
  const clubShots = groups.find(([c]) => c === activeClub)?.[1] ?? []

  const points: TrendPoint[] = [...groupBy(clubShots, (s) => s.activityId).values()]
    .map((ss) => {
      const vals = values(ss, metric)
      const s = summarize(vals)
      return {
        sessionId: ss[0].activityId,
        time: new Date(ss[0].activityTime),
        kind: ss[0].kind,
        mean: s.mean ?? NaN,
        sd: s.sd ?? 0,
        n: s.n,
        values: vals,
      }
    })
    .filter((p) => p.n > 0)
    .sort((a, b) => +a.time - +b.time)

  return (
    <section className="card">
      <header className="card-head">
        <h2>Trend over sessions</h2>
        <div className="controls">
          <label>
            Club
            <select value={activeClub} onChange={(e) => setClub(e.target.value)}>
              {groups.map(([c, ss]) => (
                <option key={c} value={c}>
                  {clubLabel(c)} ({ss.length})
                </option>
              ))}
            </select>
          </label>
          <label>
            Metric
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">Line = session average, band = ±1 standard deviation, faint dots = individual shots.</p>
      </header>
      {points.length === 0 ? (
        <p className="empty muted">No {clubLabel(activeClub).toLowerCase()} shots with this metric in the current filter.</p>
      ) : (
        <TrendChart points={points} metric={metric} />
      )}
    </section>
  )
}
