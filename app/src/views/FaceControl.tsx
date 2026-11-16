import { ClubDelivery } from '../charts/ClubDelivery'
import { DeliveryStat } from '../charts/DeliveryStat'
import { clubLabel, faceType } from '../lib/clubs'
import { describeSigned } from '../lib/format'
import { fmtNum } from '../lib/metrics'
import { byClub, summarize, values, type Summary } from '../lib/stats'
import type { Shot } from '../lib/types'

/** Largest drawn angle we aim for, and the most we'll multiply real angles by. */
const TARGET_DRAWN = 24
const MAX_EXAGGERATION = 5

interface ClubStats {
  club: string
  n: number
  path: Summary
  face: Summary
  faceToPath: Summary
  /** Of the same shots, where measured. */
  curve: Summary
}

/** Average club path and face angle per club, drawn from above relative to the target line. */
export function FaceControl({ shots }: { shots: Shot[] }) {
  const clubs: ClubStats[] = byClub(shots).map(([club, all]) => {
    const ss = all.filter(
      (s) => s.v.clubPath !== undefined && s.v.faceAngle !== undefined && s.v.faceToPath !== undefined,
    )
    return {
      club,
      n: ss.length,
      path: summarize(values(ss, 'clubPath')),
      face: summarize(values(ss, 'faceAngle')),
      faceToPath: summarize(values(ss, 'faceToPath')),
      curve: summarize(values(ss, 'curve')),
    }
  })

  // One scale for every club, so the pictures can be compared with each other.
  const largest = Math.max(0, ...clubs.flatMap((c) => [Math.abs(c.path.mean ?? 0), Math.abs(c.face.mean ?? 0)]))
  const exaggeration = largest > 0 ? Math.max(1, Math.min(MAX_EXAGGERATION, Math.floor(TARGET_DRAWN / largest))) : 1

  const maxCurve = Math.max(0, ...clubs.map((c) => Math.abs(c.curve.mean ?? 0)))

  return (
    <section className="card">
      <header className="card-head">
        <h2>Face and path</h2>
        <p className="muted">
          Seen from straight above, right-handed, target at the top. Averages per club, ± standard deviation.
          {exaggeration > 1 && ` Angles are drawn ×${exaggeration} so small differences show; all clubs use the same scale.`}
        </p>
        <p className="legend">
          <span className="key key-arrow key-path" /> club path: where the club head is moving
          <span className="key key-arrow key-face" /> face angle: where the face is pointing
        </p>
      </header>
      <div className="facets delivery-grid">
        {clubs.map((c) => (
          <figure key={c.club} className="facet impact-facet">
            <figcaption>
              <strong>{clubLabel(c.club)}</strong>
            </figcaption>
            {c.n === 0 ? (
              <p className="empty-facet muted">No club path or face data for this club.</p>
            ) : (
              <>
                <ClubDelivery
                  ariaLabel={`${clubLabel(c.club)}: club path ${describeSigned(c.path.mean!, 'in-to-out', 'out-to-in', 'neutral')}, face ${describeSigned(c.face.mean!, 'open', 'closed', 'square')}`}
                  type={faceType(c.club)}
                  clubPath={c.path.mean!}
                  faceAngle={c.face.mean!}
                  exaggeration={exaggeration}
                />
                <dl className="delivery-stats">
                  <DeliveryStat cls="key-path" label="Club path" s={c.path} words={['in-to-out', 'out-to-in', 'neutral']} />
                  <DeliveryStat cls="key-face" label="Face angle" s={c.face} words={['open', 'closed', 'square']} />
                  <DeliveryStat label="Face to path" s={c.faceToPath} words={['open', 'closed', 'square']} />
                </dl>
                {c.curve.n > 0 && <CurveBar s={c.curve} max={maxCurve} />}
              </>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}

/** Average curve as a bar growing left or right from the centre, with the figure on the other side. */
function CurveBar({ s, max }: { s: Summary; max: number }) {
  const v = s.mean!
  const right = v >= 0
  const text = describeSigned(v, 'right', 'left', 'straight', ' m')
  // Half the track, less room for the arrowhead, is the largest average curve of any club shown.
  const share = max > 0 ? Math.abs(v) / max : 0
  return (
    <div className="curve-bar">
      <div className="curve-title">Curve</div>
      <div className="curve-track" role="img" aria-label={`Average curve ${text}`}>
        <span
          className={right ? 'curve-fill right' : 'curve-fill left'}
          style={{ [right ? 'left' : 'right']: '50%', width: `calc((50% - 9px) * ${share})` }}
        />
        <span className="curve-center" />
        <span className="curve-value" style={{ [right ? 'right' : 'left']: '50%' }}>
          {text}
          {s.sd !== undefined && <span className="sd"> ±{fmtNum(s.sd, 1)}</span>}
        </span>
      </div>
    </div>
  )
}
