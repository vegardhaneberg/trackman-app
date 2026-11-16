import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clubLabel, isPutt, sortClubs } from './lib/clubs'
import { fmtDate, kindLabel } from './lib/format'
import { groupBy, sessionsOf } from './lib/stats'
import type { Filters, Shot } from './lib/types'

interface Props {
  shots: Shot[]
  filters: Filters
  onChange: (f: Filters) => void
  onDeleteSession: (id: string) => void
}

const KIND_ORDER = ['SIMULATOR', 'VIRTUAL_RANGE', 'COURSE_PLAY', 'MAP_MY_BAG']

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterBar({ shots, filters, onChange, onDeleteSession }: Props) {
  const real = shots.filter((s) => !isPutt(s.shotResult, s.club))
  const byKind = groupBy(real, (s) => s.kind)
  const kinds = [...byKind.keys()].sort((a, b) => rank(a) - rank(b))
  const visibleSessions = sessionsOf(real.filter((s) => !filters.excludedKinds.includes(s.kind)))
  const clubCounts = groupBy(real, (s) => s.club)
  const clubs = sortClubs(clubCounts.keys())

  const selectedSessions = visibleSessions.filter((s) => !filters.excludedSessions.includes(s.id)).length
  const selectedClubs = clubs.filter((c) => !filters.excludedClubs.includes(c)).length

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filters">
      <div className="chips" role="group" aria-label="Activity kind">
        {kinds.map((k) => (
          <button
            key={k}
            className="chip"
            aria-pressed={!filters.excludedKinds.includes(k)}
            onClick={() => onChange({ ...filters, excludedKinds: toggle(filters.excludedKinds, k) })}
          >
            {kindLabel(k)} <span className="count">{byKind.get(k)!.length}</span>
          </button>
        ))}
      </div>

      <Dropdown label={`Sessions ${selectedSessions}/${visibleSessions.length}`}>
        <div className="dd-actions">
          <button onClick={() => onChange({ ...filters, excludedSessions: [] })}>All</button>
          <button onClick={() => onChange({ ...filters, excludedSessions: visibleSessions.map((s) => s.id) })}>
            None
          </button>
        </div>
        <ul className="dd-list">
          {visibleSessions.map((s) => (
            <li key={s.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!filters.excludedSessions.includes(s.id)}
                  onChange={() => onChange({ ...filters, excludedSessions: toggle(filters.excludedSessions, s.id) })}
                />
                <span>
                  {fmtDate(s.time)} · {kindLabel(s.kind)}
                  <span className="muted">
                    {' '}
                    · {s.count} {s.count === 1 ? 'shot' : 'shots'}
                  </span>
                </span>
              </label>
              <button
                className="icon-btn"
                title="Delete this session from storage"
                aria-label={`Delete session ${fmtDate(s.time)}`}
                onClick={() => {
                  if (confirm(`Delete the ${kindLabel(s.kind)} session from ${fmtDate(s.time)} from this browser?`)) {
                    onDeleteSession(s.id)
                  }
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Dropdown>

      <Dropdown label={`Clubs ${selectedClubs}/${clubs.length}`}>
        <div className="dd-actions">
          <button onClick={() => onChange({ ...filters, excludedClubs: [] })}>All</button>
          <button onClick={() => onChange({ ...filters, excludedClubs: clubs })}>None</button>
        </div>
        <ul className="dd-list">
          {clubs.map((c) => (
            <li key={c}>
              <label>
                <input
                  type="checkbox"
                  checked={!filters.excludedClubs.includes(c)}
                  onChange={() => onChange({ ...filters, excludedClubs: toggle(filters.excludedClubs, c) })}
                />
                <span>
                  {clubLabel(c)} <span className="muted">· {clubCounts.get(c)!.length}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Dropdown>

      <label className="check" title="Hides shots that carried less than half of that club's median">
        <input
          type="checkbox"
          checked={filters.excludeMishits}
          onChange={(e) => onChange({ ...filters, excludeMishits: e.target.checked })}
        />
        Exclude mishits
      </label>
    </div>
  )
}

function rank(kind: string) {
  const i = KIND_ORDER.indexOf(kind)
  return i < 0 ? 99 : i
}

function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <button className="dd-trigger" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <span aria-hidden>▾</span>
      </button>
      {open && <div className="dd-panel">{children}</div>}
    </div>
  )
}
