import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clubLabel, isPutt, sortClubs } from './lib/clubs'
import { fmtDate, fmtMonth, kindLabel, monthKey, monthsBetween } from './lib/format'
import { applyFilters, groupBy, sessionsOf } from './lib/stats'
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
  // Each filter lists and counts the shots that pass every *other* filter, so an unchecked
  // option still shows what checking it would bring back. Options with no shots are hidden.
  const others = (patch: Partial<Filters>) => applyFilters(shots, { ...filters, ...patch })
  const allSessions = sessionsOf(shots.filter((s) => !isPutt(s.shotResult, s.club)))

  const byKind = groupBy(others({ excludedKinds: [] }), (s) => s.kind)
  const kinds = [...byKind.keys()].sort((a, b) => rank(a) - rank(b))
  const visibleSessions = sessionsOf(others({ excludedSessions: [] }))
  const sessionMonths = sessionsOf(others({ fromMonth: null, toMonth: null }))
    .map((s) => monthKey(s.time))
    .sort()
  const months = sessionMonths.length ? monthsBetween(sessionMonths[0], sessionMonths[sessionMonths.length - 1]) : []
  const clubCounts = groupBy(others({ excludedClubs: [] }), (s) => s.club)
  const clubs = sortClubs(clubCounts.keys())
  const allKinds = [...new Set(allSessions.map((s) => s.kind))]

  const selectedKinds = kinds.filter((k) => !filters.excludedKinds.includes(k)).length
  const selectedSessions = visibleSessions.filter((s) => !filters.excludedSessions.includes(s.id)).length
  const selectedClubs = clubs.filter((c) => !filters.excludedClubs.includes(c)).length

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filters">
      <Dropdown label={`Types ${selectedKinds}/${kinds.length}`}>
        <div className="dd-actions">
          <button onClick={() => onChange({ ...filters, excludedKinds: [] })}>All</button>
          <button onClick={() => onChange({ ...filters, excludedKinds: allKinds })}>None</button>
        </div>
        <ul className="dd-list">
          {kinds.map((k) => (
            <li key={k}>
              <label>
                <input
                  type="checkbox"
                  checked={!filters.excludedKinds.includes(k)}
                  onChange={() => onChange({ ...filters, excludedKinds: toggle(filters.excludedKinds, k) })}
                />
                <span>
                  {kindLabel(k)} <span className="muted">· {byKind.get(k)!.length}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Dropdown>

      {months.length > 1 && (
        <MonthRange
          months={months}
          from={filters.fromMonth}
          to={filters.toMonth}
          onChange={(fromMonth, toMonth) => onChange({ ...filters, fromMonth, toMonth })}
        />
      )}

      <Dropdown label={`Sessions ${selectedSessions}/${visibleSessions.length}`}>
        <div className="dd-actions">
          <button onClick={() => onChange({ ...filters, excludedSessions: [] })}>All</button>
          <button onClick={() => onChange({ ...filters, excludedSessions: allSessions.map((s) => s.id) })}>
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
          <button onClick={() => onChange({ ...filters, excludedClubs: [...new Set(shots.map((s) => s.club))] })}>None</button>
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

interface MonthRangeProps {
  months: string[]
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
}

/** Two-thumb slider over the months that have data. A thumb at either end leaves that side open. */
function MonthRange({ months, from, to, onChange }: MonthRangeProps) {
  const last = months.length - 1
  // A stored month outside the data (after a delete) snaps to the nearest end.
  const hi = to ? Math.max(0, months.findLastIndex((m) => m <= to)) : last
  const lo = Math.min(from ? Math.max(0, months.findIndex((m) => m >= from)) : 0, hi)
  const set = (a: number, b: number) => onChange(a === 0 ? null : months[a], b === last ? null : months[b])
  const text = lo === hi ? fmtMonth(months[lo]) : `${fmtMonth(months[lo])} – ${fmtMonth(months[hi])}`
  const frac = (i: number) => i / last

  return (
    <div className="month-range" role="group" aria-label="Months">
      <div className="month-slider" style={{ '--lo': frac(lo), '--hi': frac(hi) } as CSSProperties}>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={lo}
          aria-label="From month"
          aria-valuetext={fmtMonth(months[lo])}
          // Keep the lower thumb reachable when both sit at the right end.
          style={lo === last ? { zIndex: 2 } : undefined}
          onChange={(e) => set(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={hi}
          aria-label="To month"
          aria-valuetext={fmtMonth(months[hi])}
          onChange={(e) => set(lo, Math.max(Number(e.target.value), lo))}
        />
      </div>
      <span className="month-label">{text}</span>
    </div>
  )
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
