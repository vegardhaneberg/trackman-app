import { Gapping } from '../charts/Gapping'
import { clubLabel } from '../lib/clubs'
import { fmtShortDate } from '../lib/format'
import { fmtNum, METRIC, type MetricKey } from '../lib/metrics'
import { byClub, sessionsOf, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'

const TABLE_KEYS: MetricKey[] = [
  'carry',
  'total',
  'carrySide',
  'clubSpeed',
  'ballSpeed',
  'smashFactor',
  'launchAngle',
  'spinRate',
  'maxHeight',
  'landingAngle',
  'attackAngle',
  'clubPath',
  'faceAngle',
  'faceToPath',
  'dynamicLoft',
]

export function Overview({ shots }: { shots: Shot[] }) {
  const groups = byClub(shots)
  const sessions = sessionsOf(shots)
  const times = sessions.map((s) => s.time).sort()

  return (
    <div className="stack">
      <div className="tiles">
        <Tile label="Shots" value={shots.length.toLocaleString('en-GB')} />
        <Tile label="Sessions" value={String(sessions.length)} />
        <Tile label="Clubs" value={String(groups.length)} />
        <Tile
          label="Period"
          value={times.length ? `${fmtShortDate(times[0])} – ${fmtShortDate(times[times.length - 1])}` : '–'}
        />
      </div>

      <section className="card">
        <header className="card-head">
          <h2>Carry gapping</h2>
          <p className="legend">
            <span className="key key-box" /> middle 50% <span className="key key-line" /> 10–90%{' '}
            <span className="key key-median" /> median carry <span className="key key-diamond" /> median total
          </p>
        </header>
        <Gapping groups={groups} />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Per-club averages</h2>
          <p className="muted">Mean ± standard deviation. A small number shows when fewer shots have that metric.</p>
        </header>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="left">Club</th>
                <th>Shots</th>
                {TABLE_KEYS.map((k) => (
                  <th key={k}>
                    {METRIC[k].label}
                    {METRIC[k].unit && <span className="unit"> {METRIC[k].unit}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([club, ss]) => (
                <tr key={club}>
                  <th className="left">{clubLabel(club)}</th>
                  <td>{ss.length}</td>
                  {TABLE_KEYS.map((k) => {
                    const s = summarize(values(ss, k))
                    const d = METRIC[k].digits
                    return (
                      <td key={k}>
                        {fmtNum(s.mean, d)}
                        {s.sd !== undefined && <span className="sd"> ±{fmtNum(s.sd, d)}</span>}
                        {s.n > 0 && s.n < ss.length && <sup className="n">{s.n}</sup>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
    </div>
  )
}
