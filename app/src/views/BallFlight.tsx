import { Flight, type FlightShape } from '../charts/Flight'
import { clubLabel } from '../lib/clubs'
import { fmt, fmtNum, METRIC, type MetricKey } from '../lib/metrics'
import { byClub, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'

const STATS: MetricKey[] = ['carry', 'launchAngle', 'spinRate', 'maxHeight', 'landingAngle']

/** Average ball flight per club, seen from the side: distance and height only. */
export function BallFlight({ shots }: { shots: Shot[] }) {
  const clubs = byClub(shots).map(([club, all]) => {
    const ss = all.filter(
      (s) =>
        s.v.carry !== undefined &&
        s.v.launchAngle !== undefined &&
        s.v.maxHeight !== undefined &&
        s.v.landingAngle !== undefined,
    )
    const stats = Object.fromEntries(STATS.map((k) => [k, summarize(values(ss, k))])) as Record<
      MetricKey,
      ReturnType<typeof summarize>
    >
    return { club, n: ss.length, flights: ss.map((s) => s.v as FlightShape), stats }
  })

  const flights = clubs.flatMap((c) => c.flights)
  const maxCarry = Math.max(10, ...flights.map((f) => f.carry)) * 1.03
  const maxHeight = Math.max(5, ...flights.map((f) => f.maxHeight)) * 1.05

  return (
    <section className="card">
      <header className="card-head">
        <h2>Ball flight</h2>
        <p className="muted">
          Seen from the side, target to the right. Height and distance in metres at the same scale, so the
          angles are true, and every club shares the same axes. The curve is drawn from carry, launch angle,
          max height and landing angle; the export has no full trajectory.
        </p>
        <p className="legend">
          <span className="key key-arrow key-path" /> average flight
          <span className="key key-arrow key-shot" /> each shot
        </p>
      </header>
      <div className="flight-list">
        {clubs.map((c) => (
          <figure key={c.club} className="facet impact-facet">
            <figcaption>
              <strong>{clubLabel(c.club)}</strong>
              {c.n > 0 && <span className="muted"> · {c.n} shots</span>}
            </figcaption>
            {c.n === 0 ? (
              <p className="empty-facet muted">No ball flight data for this club.</p>
            ) : (
              <>
                <Flight
                  ariaLabel={`${clubLabel(c.club)}: carry ${fmt('carry', c.stats.carry.mean)}, max height ${fmt('maxHeight', c.stats.maxHeight.mean)}, launch angle ${fmt('launchAngle', c.stats.launchAngle.mean)}, landing angle ${fmt('landingAngle', c.stats.landingAngle.mean)}`}
                  mean={{
                    carry: c.stats.carry.mean!,
                    launchAngle: c.stats.launchAngle.mean!,
                    maxHeight: c.stats.maxHeight.mean!,
                    landingAngle: c.stats.landingAngle.mean!,
                  }}
                  shots={c.flights}
                  maxCarry={maxCarry}
                  maxHeight={maxHeight}
                />
                <dl className="flight-stats">
                  {STATS.map((k) => (
                    <div key={k}>
                      <dt>{METRIC[k].label}</dt>
                      <dd>
                        {fmt(k, c.stats[k].mean)}
                        {c.stats[k].sd !== undefined && (
                          <span className="sd"> ±{fmtNum(c.stats[k].sd, METRIC[k].digits)}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
