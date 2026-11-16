import { faceDomain, facePath, grooves } from '../charts/faceShapes'
import { Scatter, type Pt } from '../charts/Scatter'
import { ShotTooltip } from '../charts/Tooltip'
import { useWidth } from '../charts/useWidth'
import { clubLabel, faceType } from '../lib/clubs'
import { byClub, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'

// Large faces: two per row on a typical desktop, one on narrow screens.
const MIN_FACET = 460
const MAX_FACET = 820

/** Where on the face each shot hit, one face per club, all at the same mm scale. */
export function Impact({ shots }: { shots: Shot[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const groups = byClub(shots)

  const cols = Math.max(1, Math.min(groups.length, Math.floor((width + 24) / (MIN_FACET + 24))))
  const facetW = Math.min(MAX_FACET, Math.floor((width - (cols - 1) * 24) / cols))

  return (
    <section className="card">
      <header className="card-head">
        <h2>Impact location</h2>
        <p className="muted">
          Viewed from the front, right-handed: heel left, toe right. Ellipse = 1 standard deviation, ring = average.
          Hollow dots are off the drawn face. Each face is scaled to fill its chart; compare clubs using the mm
          figures.
        </p>
      </header>
      <div ref={ref} className="facets" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {width > 0 &&
          groups.map(([club, all]) => {
            const ss = all.filter((s) => s.v.impactOffset !== undefined && s.v.impactHeight !== undefined)
            const type = faceType(club)
            const dom = faceDomain(type)
            // Equal mm-per-pixel horizontally and vertically, so the face isn't distorted.
            const facetH = Math.round(((facetW - 12) * (dom.y[1] - dom.y[0])) / (dom.x[1] - dom.x[0])) + 12
            const off = summarize(values(ss, 'impactOffset'))
            const hgt = summarize(values(ss, 'impactHeight'))
            const pts: Pt[] = ss.map((s) => ({ id: s.id, x: s.v.impactOffset!, y: s.v.impactHeight!, shot: s }))
            return (
              <figure key={club} className="facet impact-facet" style={{ maxWidth: facetW }}>
                <figcaption>
                  <strong>{clubLabel(club)}</strong>
                  <span className="muted">
                    {' '}
                    · {ss.length} of {all.length} shots have impact data
                  </span>
                </figcaption>
                {ss.length === 0 ? (
                  <p className="empty-facet muted">No impact data for this club.</p>
                ) : (
                  <>
                    <Scatter
                      ariaLabel={`${clubLabel(club)} impact locations`}
                      bare
                      points={pts}
                      width={facetW}
                      height={facetH}
                      xDomain={dom.x}
                      yDomain={dom.y}
                      showEllipse={ss.length >= 3}
                      dotRadius={facetW > 500 ? 5.5 : 4}
                      background={(sx, sy) => (
                        <g>
                          <path className="face" d={facePath(type, sx, sy)} />
                          {grooves(type).map((y) => (
                            <line key={y} className="groove" x1={sx(-26)} x2={sx(26)} y1={sy(y)} y2={sy(y)} />
                          ))}
                          <line className="center" x1={sx(-5)} x2={sx(5)} y1={sy(0)} y2={sy(0)} />
                          <line className="center" x1={sx(0)} x2={sx(0)} y1={sy(-5)} y2={sy(5)} />
                          <text className="tick" x={sx(dom.x[0]) + 2} y={sy(dom.y[0]) - 4}>
                            Heel
                          </text>
                          <text className="tick" x={sx(dom.x[1]) - 2} y={sy(dom.y[0]) - 4} textAnchor="end">
                            Toe
                          </text>
                        </g>
                      )}
                      tooltip={(p) => <ShotTooltip shot={p.shot} keys={['impactOffset', 'impactHeight', 'smashFactor']} />}
                    />
                    <p className="facet-foot muted">
                      Avg {offsetLabel(off.mean)}, {heightLabel(hgt.mean)} · spread ±{(off.sd ?? 0).toFixed(0)} mm
                      across, ±{(hgt.sd ?? 0).toFixed(0)} mm up/down
                    </p>
                  </>
                )}
              </figure>
            )
          })}
      </div>
    </section>
  )
}

function offsetLabel(v: number | undefined) {
  if (v === undefined) return '–'
  return Math.abs(v) < 0.5 ? 'centered' : `${Math.abs(v).toFixed(0)} mm ${v > 0 ? 'toe' : 'heel'}`
}

function heightLabel(v: number | undefined) {
  if (v === undefined) return '–'
  return Math.abs(v) < 0.5 ? 'centered' : `${Math.abs(v).toFixed(0)} mm ${v > 0 ? 'high' : 'low'}`
}
