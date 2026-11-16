import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FilterBar } from './FilterBar'
import { clearShots, deleteSession, loadSetting, loadShots, mergeShots, saveSetting } from './lib/db'
import { parseTrackmanCsv } from './lib/parse'
import { applyFilters, sessionsOf } from './lib/stats'
import { DEFAULT_FILTERS, type Filters, type Shot, type Tab } from './lib/types'
import { AttackLaunch } from './views/AttackLaunch'
import { Dispersion } from './views/Dispersion'
import { ExportGuide } from './views/ExportGuide'
import { Explorer } from './views/Explorer'
import { FaceControl } from './views/FaceControl'
import { Impact } from './views/Impact'
import { Overview } from './views/Overview'
import { Shots } from './views/Shots'
import { StrikeCarry } from './views/StrikeCarry'
import { Trends } from './views/Trends'

const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['dispersion', 'Dispersion'],
  ['impact', 'Impact'],
  ['face', 'Face and path'],
  ['attack', 'Attack and launch'],
  ['trends', 'Trends'],
  ['explorer', 'Explorer'],
  ['shots', 'Shots'],
]

export default function App() {
  const [shots, setShots] = useState<Shot[] | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [tab, setTab] = useState<Tab>('overview')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [showGuide, setShowGuide] = useState(() => location.hash === '#export')

  useEffect(() => {
    const onHash = () => setShowGuide(location.hash === '#export')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    Promise.all([loadShots(), loadSetting('filters'), loadSetting('tab')]).then(([s, f, t]) => {
      setShots(s)
      if (f) setFilters({ ...DEFAULT_FILTERS, ...f })
      if (t) setTab(t)
    })
  }, [])

  function updateFilters(f: Filters) {
    setFilters(f)
    saveSetting('filters', f)
  }

  function updateTab(t: Tab) {
    setTab(t)
    saveSetting('tab', t)
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    try {
      if (showGuide) location.hash = ''
      let parsed: Shot[] = []
      for (const file of files) parsed = parsed.concat(parseTrackmanCsv(await file.text()))
      const before = new Set((shots ?? []).map((s) => s.activityId))
      const { added, updated } = await mergeShots(parsed)
      const all = await loadShots()
      const newSessions = sessionsOf(all).filter((s) => !before.has(s.id)).length
      setShots(all)
      setMessage({
        text: `Imported ${added} new shots in ${newSessions} new sessions and updated ${updated} already stored shots.`,
      })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true })
    }
  }

  async function removeSession(id: string) {
    await deleteSession(id)
    setShots(await loadShots())
  }

  async function clearAll() {
    if (!confirm('Delete all stored shots from this browser?')) return
    await clearShots()
    setShots([])
    updateFilters(DEFAULT_FILTERS)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    importFiles(e.dataTransfer.files)
  }

  const filtered = useMemo(() => (shots ? applyFilters(shots, filters) : []), [shots, filters])

  if (shots === null) return null

  const uploadInput = (
    <input
      ref={fileInput}
      type="file"
      accept=".csv,text/csv"
      multiple
      hidden
      onChange={(e) => {
        importFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <div
      className={dragging ? 'app dragging' : 'app'}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {uploadInput}
      <header className="top">
        <div className="brand">
          <h1>Shot visualizer</h1>
          <span className="muted">Trackman CSV · stored only in this browser</span>
        </div>
        <div className="top-actions">
          {showGuide ? (
            <a className="button ghost" href="#">
              ← Back
            </a>
          ) : (
            <a className="button ghost" href="#export">
              How to export
            </a>
          )}
          <button className="primary" onClick={() => fileInput.current?.click()}>
            Upload CSV
          </button>
          {shots.length > 0 && (
            <button className="ghost" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className={message.error ? 'notice error' : 'notice'} role="status">
          <span>{message.text}</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {showGuide ? (
        <ExportGuide onUpload={() => fileInput.current?.click()} />
      ) : shots.length === 0 ? (
        <>
          <button className="dropzone" onClick={() => fileInput.current?.click()}>
            <strong>Drop a Trackman CSV export here</strong>
            <span className="muted">
              or click to choose a file. You can upload more exports later. Sessions you already have are skipped.
            </span>
          </button>
          <p className="muted dropzone-help">
            No export yet? <a href="#export">Here's how to get one from Trackman.</a>
          </p>
        </>
      ) : (
        <>
          <div className="sticky">
            <FilterBar shots={shots} filters={filters} onChange={updateFilters} onDeleteSession={removeSession} />
            <nav className="tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => updateTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <main>
            {filtered.length === 0 ? (
              <p className="empty muted">No shots match the current filters.</p>
            ) : (
              <>
                {tab === 'overview' && <Overview shots={filtered} />}
                {tab === 'dispersion' && <Dispersion shots={filtered} />}
                {tab === 'impact' && (
                  <div className="stack">
                    <Impact shots={filtered} />
                    <StrikeCarry shots={filtered} />
                  </div>
                )}
                {tab === 'face' && <FaceControl shots={filtered} />}
                {tab === 'attack' && <AttackLaunch shots={filtered} />}
                {tab === 'trends' && <Trends shots={filtered} />}
                {tab === 'explorer' && <Explorer shots={filtered} />}
                {tab === 'shots' && <Shots shots={filtered} />}
              </>
            )}
          </main>
        </>
      )}
    </div>
  )
}
