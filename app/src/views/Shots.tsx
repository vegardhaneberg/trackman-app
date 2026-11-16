import { useState } from 'react'
import { Scatter, type Pt } from '../charts/Scatter'
import { ShotTooltip } from '../charts/Tooltip'
import { useWidth } from '../charts/useWidth'
import { clubLabel, clubRank } from '../lib/clubs'
import { fmtShortDate, fmtTime, kindLabel } from '../lib/format'
import { fmtNum, METRIC, type MetricKey } from '../lib/metrics'
import type { Shot } from '../lib/types'

const COLS: MetricKey[] = [
  'carry',
  'total',
  'carrySide',
  'clubSpeed',
  'ballSpeed',
  'smashFactor',
  'launchAngle',
  'spinRate',
  'faceToPath',
  'impactOffset',
  'impactHeight',
]

type SortKey = MetricKey | 'time' | 'club'

export function Shots({ shots }: { shots: Shot[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'time', desc: true })
  const [hoverId, setHoverId] = useState<string | null>(null)

  const sorted = [...shots].sort((a, b) => {
    // Shots missing the sorted metric always go last.
    const ma = isMissing(a, sort.key)
    const mb = isMissing(b, sort.key)
    if (ma || mb) return Number(ma) - Number(mb)
    const d = compare(a, b, sort.key)
    return sort.desc ? -d : d
  })

  const pts: Pt[] = shots
    .filter((s) => s.v.carry !== undefined && s.v.carrySide !== undefined)
    .map((s) => ({ id: s.id, x: s.v.carrySide!, y: s.v.carry!, shot: s }))
  const half = Math.max(10, ...pts.map((p) => Math.abs(p.x)))
  const maxCarry = Math.max(10, ...pts.map((p) => p.y))

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'club' }))
  }

  const th = (key: SortKey, label: string, unit?: string, left = false) => (
    <th key={key} className={left ? 'left sortable' : 'sortable'} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => toggle(key)}>
        {label}
        {unit && <span className="unit"> {unit}</span>}
        <span className="sort-ind">{sort.key === key ? (sort.desc ? '▼' : '▲') : ''}</span>
      </button>
    </th>
  )

  return (
    <div className="shots-layout">
      <section className="card shots-map">
        <header className="card-head">
          <h2>All shots</h2>
          <p className="muted">Hover a row to find the shot here.</p>
        </header>
        <div ref={ref}>
          {width > 0 && (
            <Scatter
              ariaLabel="Carry vs side for all shots"
              points={pts}
              width={width}
              height={Math.min(520, Math.max(300, width * 1.2))}
              xDomain={[-half, half]}
              yDomain={[0, maxCarry * 1.05]}
              xLabel="← left · side (m) · right →"
              yLabel="Carry (m)"
              highlightId={hoverId}
              onHover={setHoverId}
              tooltip={(p) => <ShotTooltip shot={p.shot} keys={['carrySide']} />}
            />
          )}
        </div>
      </section>
      <section className="card shots-table">
        <div className="table-scroll tall">
          <table className="data">
            <thead>
              <tr>
                {th('time', 'Date', undefined, true)}
                <th className="left">Session</th>
                {th('club', 'Club', undefined, true)}
                {COLS.map((k) => th(k, METRIC[k].label, METRIC[k].unit))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.id}
                  className={s.id === hoverId ? 'hovered' : undefined}
                  onMouseEnter={() => setHoverId(s.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <td className="left">
                    {fmtShortDate(s.shotTime ?? s.activityTime)} {fmtTime(s.shotTime ?? s.activityTime)}
                  </td>
                  <td className="left">
                    {kindLabel(s.kind)}
                  </td>
                  <td className="left">{clubLabel(s.club)}</td>
                  {COLS.map((k) => (
                    <td key={k}>{fmtNum(s.v[k], METRIC[k].digits)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function compare(a: Shot, b: Shot, key: SortKey): number {
  if (key === 'time') return (a.shotTime ?? a.activityTime).localeCompare(b.shotTime ?? b.activityTime)
  if (key === 'club') return clubRank(a.club) - clubRank(b.club)
  return a.v[key]! - b.v[key]!
}

function isMissing(s: Shot, key: SortKey): boolean {
  return key !== 'time' && key !== 'club' && s.v[key] === undefined
}
