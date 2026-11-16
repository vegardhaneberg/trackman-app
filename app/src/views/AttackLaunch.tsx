import { DeliveryStat } from '../charts/DeliveryStat'
import { SIDE_EXAGGERATION, SideDelivery } from '../charts/SideDelivery'
import { attackRange, clubLabel, faceType } from '../lib/clubs'
import { describeSigned } from '../lib/format'
import { fmtNum } from '../lib/metrics'
import { byClub, summarize, values, type Summary } from '../lib/stats'
import type { Shot } from '../lib/types'

/** Average attack angle and launch angle per club, drawn from the side relative to level ground. */
export function AttackLaunch({ shots }: { shots: Shot[] }) {
  const after = lowPointAfterSign(shots)
  const clubs = byClub(shots).map(([club, all]) => {
    const ss = all.filter((s) => s.v.attackAngle !== undefined && s.v.launchAngle !== undefined)
    return {
      club,
      n: ss.length,
      attack: summarize(values(ss, 'attackAngle')),
      launch: summarize(values(ss, 'launchAngle')),
      // Of the same shots, where measured, as cm after the ball.
      lowPoint: summarize(values(ss, 'lowPointDistance').map((v) => v * after)),
    }
  })

  return (
    <section className="card">
      <header className="card-head">
        <h2>Attack and launch</h2>
        <p className="muted">
          Seen from the side, right-handed, target to the right. Averages per club, ± standard deviation. All
          angles are drawn ×{SIDE_EXAGGERATION} so differences show.
        </p>
        <p className="legend">
          <span className="key key-arrow key-path" /> attack angle: whether the club head is moving up or down at
          impact
          <span className="key key-arrow key-face" /> launch angle: how steeply the ball takes off
          <span className="key key-arrow key-good" /> typical good attack angle for the club
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="key key-low" /> low point: where the swing bottoms out
          </span>
        </p>
      </header>
      <div className="facets delivery-grid">
        {clubs.map((c) => (
          <figure key={c.club} className="facet impact-facet">
            <figcaption>
              <strong>{clubLabel(c.club)}</strong>
            </figcaption>
            {c.n === 0 ? (
              <p className="empty-facet muted">No attack angle data for this club.</p>
            ) : (
              <>
                <SideDelivery
                  ariaLabel={`${clubLabel(c.club)}: attack angle ${describeSigned(c.attack.mean!, 'up', 'down', 'level')}, launch angle ${describeSigned(c.launch.mean!, 'up', 'down', 'level')}`}
                  type={faceType(c.club)}
                  attackAngle={c.attack.mean!}
                  launchAngle={c.launch.mean!}
                  goodAttack={attackRange(c.club)}
                  lowPoint={c.lowPoint.mean}
                />
                <dl className="delivery-stats">
                  <DeliveryStat cls="key-face" label="Launch angle" s={c.launch} words={['', '', '']} />
                  <DeliveryStat cls="key-path" label="Attack angle" s={c.attack} words={['up', 'down', 'level']} />
                  <div>
                    <dt>
                      <span className="key key-arrow key-good" /> Good attack angle
                    </dt>
                    <dd>{rangeLabel(attackRange(c.club))}</dd>
                  </div>
                  {c.lowPoint.n > 0 && <LowPointStat s={c.lowPoint} />}
                </dl>
              </>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}

/** "−5° to −3°" / "0° to +5°". */
function rangeLabel([lo, hi]: [number, number]): string {
  const f = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${fmtNum(Math.abs(v), Number.isInteger(v) ? 0 : 1)}°`
  return `${f(lo)} to ${f(hi)}`
}

function LowPointStat({ s }: { s: Summary }) {
  const r = Math.round(s.mean! * 10) / 10
  return (
    <div>
      <dt>
        <span className="key key-low" /> Low point
      </dt>
      <dd>
        {r === 0 ? 'at the ball' : `${fmtNum(Math.abs(r), 1)} cm ${r > 0 ? 'after' : 'before'} ball`}
        {s.sd !== undefined && <span className="sd"> ±{fmtNum(s.sd, 1)}</span>}
      </dd>
    </div>
  )
}

/**
 * +1 if a positive `lowPointDistance` means the low point is after the ball, −1 if before. The export
 * doesn't document the sign, so it is read from the data: hitting down (negative attack angle) puts
 * the low point after the ball. Defaults to positive = after when there is nothing to go on.
 */
function lowPointAfterSign(shots: Shot[]): 1 | -1 {
  let agreement = 0
  for (const s of shots) {
    if (s.v.attackAngle !== undefined && s.v.lowPointDistance !== undefined) {
      agreement += s.v.attackAngle * s.v.lowPointDistance
    }
  }
  return agreement > 0 ? -1 : 1
}
