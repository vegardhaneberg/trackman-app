import { Scatter, type Pt } from '../charts/Scatter'
import { ShotTooltip, TooltipRows } from '../charts/Tooltip'
import { useWidth } from '../charts/useWidth'
import { clubLabel } from '../lib/clubs'
import { byClub, pearson, quantiles } from '../lib/stats'
import type { Shot } from '../lib/types'

const MIN_FACET = 300

/** Straight-line distance (mm) from the face center, combining heel/toe and high/low. */
function offCenter(s: Shot): number | undefined {
  const x = s.v.impactOffset
  const y = s.v.impactHeight
  return x === undefined || y === undefined ? undefined : Math.hypot(x, y)
}

function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (!sxx) return null
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

/** The fit line between x = 0 and maxX, trimmed to the visible y range. */
function clipLine(
  fit: { slope: number; intercept: number },
  maxX: number,
  [y0, y1]: [number, number],
): [[number, number], [number, number]] | null {
  const at = (x: number) => fit.intercept + fit.slope * x
  let xa = 0
  let xb = maxX
  if (fit.slope !== 0) {
    const xs = [(y0 - fit.intercept) / fit.slope, (y1 - fit.intercept) / fit.slope].sort((a, b) => a - b)
    xa = Math.max(xa, xs[0])
    xb = Math.min(xb, xs[1])
  } else if (fit.intercept < y0 || fit.intercept > y1) {
    return null
  }
  return xa < xb ? [[xa, at(xa)], [xb, at(xb)]] : null
}

/** Carry against strike distance from the face center, one chart per club. */
export function StrikeCarry({ shots }: { shots: Shot[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const groups = byClub(shots.filter((s) => offCenter(s) !== undefined && s.v.carry !== undefined)).filter(
    ([, ss]) => ss.length > 0,
  )

  // Shared x so "how far off center" reads the same in every chart; cut at p98 to ignore wild strikes.
  const dists = groups.flatMap(([, ss]) => ss.map((s) => offCenter(s)!))
  const maxX = Math.max(10, Math.ceil((quantiles(dists, [0.98])[0] * 1.1) / 5) * 5)

  const cols = Math.max(1, Math.min(groups.length, Math.floor((width + 16) / (MIN_FACET + 16))))
  const facetW = Math.floor((width - (cols - 1) * 16) / cols)

  return (
    <section className="card">
      <header className="card-head">
        <h2>Carry vs. strike distance from center</h2>
        <p className="muted">
          Distance from the face center combines heel/toe and high/low: √(offset² + height²). The line is a linear
          fit; the caption shows how much carry each 10 mm off center costs.
        </p>
      </header>
      <div ref={ref} className="facets" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {width > 0 &&
          groups.map(([club, ss]) => {
            const pts: Pt[] = ss.map((s) => ({ id: s.id, x: offCenter(s)!, y: s.v.carry!, shot: s }))
            const xs = pts.map((p) => p.x)
            const ys = pts.map((p) => p.y)
            const fit = linearFit(xs, ys)
            const r = pearson(xs, ys)
            const lo = Math.min(...ys)
            const hi = Math.max(...ys)
            const pad = (hi - lo || 10) * 0.08
            const yDomain: [number, number] = [Math.max(0, lo - pad), hi + pad]
            const seg = fit && clipLine(fit, maxX, yDomain)
            return (
              <figure key={club} className="facet">
                <figcaption>
                  <strong>{clubLabel(club)}</strong>
                  <span className="muted">
                    {' '}
                    · {ss.length} shots
                    {fit && (
                      <>
                        {' '}
                        · {fit.slope * 10 >= 0 ? '+' : '−'}
                        {Math.abs(fit.slope * 10).toFixed(1)} m carry per 10 mm off center
                      </>
                    )}
                    {r !== undefined && <> · r = {r.toFixed(2)}</>}
                  </span>
                </figcaption>
                <Scatter
                  ariaLabel={`${clubLabel(club)}: carry vs distance from face center`}
                  points={pts}
                  width={facetW}
                  height={260}
                  xDomain={[0, maxX]}
                  yDomain={yDomain}
                  xLabel="Distance from face center (mm)"
                  yLabel="Carry (m)"
                  background={(sx, sy) =>
                    seg && <line className="fit" x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} />
                  }
                  tooltip={(p) => (
                    <>
                      <ShotTooltip shot={p.shot} keys={['impactOffset', 'impactHeight']} />
                      <TooltipRows rows={[['Off center', `${p.x.toFixed(0)} mm`]]} />
                    </>
                  )}
                />
              </figure>
            )
          })}
      </div>
    </section>
  )
}
