import { median } from 'd3-array'
import { Scatter, type Pt } from '../charts/Scatter'
import { ShotTooltip } from '../charts/Tooltip'
import { useWidth } from '../charts/useWidth'
import { clubLabel } from '../lib/clubs'
import { fmt } from '../lib/metrics'
import { byClub, quantiles, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'

const MIN_FACET = 260

/** Bird's-eye view per club. Every facet uses the same meters-per-pixel so spreads compare directly. */
export function Dispersion({ shots }: { shots: Shot[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const groups = byClub(shots.filter((s) => s.v.carry !== undefined && s.v.carrySide !== undefined))

  // Scale from the 2nd–98th percentile so a single wild shot doesn't shrink everything.
  const sides = groups.flatMap(([, ss]) => values(ss, 'carrySide').map(Math.abs))
  const halfX = Math.max(10, quantiles(sides, [0.98])[0] * 1.1 || 10)
  const halfY = Math.max(
    10,
    ...groups.map(([, ss]) => {
      const c = values(ss, 'carry')
      const med = median(c)!
      const [lo, hi] = quantiles(c, [0.02, 0.98])
      return Math.max(med - lo, hi - med) * 1.15
    }),
  )

  const cols = Math.max(1, Math.floor((width + 16) / (MIN_FACET + 16)))
  const facetW = cols ? Math.floor((width - (cols - 1) * 16) / cols) : 0
  const plotW = facetW - 66
  const facetH = Math.round(Math.min(Math.max((plotW * halfY) / halfX, 160), 420)) + 50

  return (
    <section className="card">
      <header className="card-head">
        <h2>Dispersion</h2>
        <p className="muted">
          Bird's-eye view: carry against side deviation. Ellipse = 1 standard deviation, ring = average. Every
          club is on the same scale.
        </p>
      </header>
      <div ref={ref} className="facets" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {width > 0 &&
          groups.map(([club, ss]) => {
            const med = median(values(ss, 'carry'))!
            // Same span for every club, but never below 0 m.
            const y0 = Math.max(0, med - halfY)
            const carry = summarize(values(ss, 'carry'))
            const side = summarize(values(ss, 'carrySide'))
            const pts: Pt[] = ss.map((s) => ({ id: s.id, x: s.v.carrySide!, y: s.v.carry!, shot: s }))
            return (
              <figure key={club} className="facet">
                <figcaption>
                  <strong>{clubLabel(club)}</strong>
                  <span className="muted">
                    {' '}
                    · {ss.length} shots · {fmt('carry', carry.mean)} ±{fmt('carry', carry.sd)} · side{' '}
                    {sideLabel(side.mean)} ±{fmt('carrySide', side.sd)}
                  </span>
                </figcaption>
                <Scatter
                  ariaLabel={`${clubLabel(club)} dispersion`}
                  points={pts}
                  width={facetW}
                  height={facetH}
                  xDomain={[-halfX, halfX]}
                  yDomain={[y0, y0 + 2 * halfY]}
                  xLabel="← left · side (m) · right →"
                  yLabel="Carry (m)"
                  showEllipse
                  background={(sx, sy) => (
                    <line className="target" x1={sx(0)} x2={sx(0)} y1={sy(y0 + 2 * halfY)} y2={sy(y0)} />
                  )}
                  tooltip={(p) => <ShotTooltip shot={p.shot} keys={['carrySide', 'total']} />}
                />
              </figure>
            )
          })}
      </div>
    </section>
  )
}

function sideLabel(v: number | undefined) {
  if (v === undefined) return '–'
  const a = Math.abs(v).toFixed(1)
  return Math.abs(v) < 0.05 ? '0.0 m' : `${a} m ${v < 0 ? 'L' : 'R'}`
}
