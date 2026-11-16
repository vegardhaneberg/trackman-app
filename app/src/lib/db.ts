import { openDB, type DBSchema } from 'idb'
import { dropCourseCopies } from './parse'
import type { Filters, Shot, Tab } from './types'

interface Settings {
  filters: Filters
  tab: Tab
}

interface TrackmanDB extends DBSchema {
  shots: { key: string; value: Shot; indexes: { activityId: string } }
  settings: { key: string; value: Settings[keyof Settings] }
}

const dbPromise = openDB<TrackmanDB>('trackman-visualizer', 1, {
  upgrade(db) {
    const shots = db.createObjectStore('shots', { keyPath: 'id' })
    shots.createIndex('activityId', 'activityId')
    db.createObjectStore('settings')
  },
})

/** Loads all shots, removing course-round duplicates left over from earlier imports. */
export async function loadShots(): Promise<Shot[]> {
  const db = await dbPromise
  const stored = await db.getAll('shots')
  const kept = dropCourseCopies(stored)
  if (kept.length !== stored.length) {
    const keep = new Set(kept.map((s) => s.id))
    const tx = db.transaction('shots', 'readwrite')
    await Promise.all([
      ...stored.filter((s) => !keep.has(s.id)).map((s) => tx.store.delete(s.id)),
      // Twins now carry the course copy's shot result (putt flag).
      ...kept.filter((s) => s.kind === 'SIMULATOR').map((s) => tx.store.put(s)),
      tx.done,
    ])
  }
  return kept
}

/**
 * Adds shots whose id isn't stored yet, then de-duplicates course-round copies across the whole
 * store (a round's two copies may arrive in different uploads). Returns how many new shots remain.
 */
export async function mergeShots(shots: Shot[]): Promise<number> {
  const db = await dbPromise
  const stored = await db.getAll('shots')
  const known = new Set(stored.map((s) => s.id))
  const combined = [...stored, ...shots.filter((s) => !known.has(s.id))]
  const kept = dropCourseCopies(combined)
  const tx = db.transaction('shots', 'readwrite')
  await Promise.all([tx.store.clear(), ...kept.map((s) => tx.store.put(s)), tx.done])
  return kept.filter((s) => !known.has(s.id)).length
}

export async function deleteSession(activityId: string): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction('shots', 'readwrite')
  const keys = await tx.store.index('activityId').getAllKeys(activityId)
  await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done])
}

export async function clearShots(): Promise<void> {
  await (await dbPromise).clear('shots')
}

export async function loadSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
  return (await (await dbPromise).get('settings', key)) as Settings[K] | undefined
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await (await dbPromise).put('settings', value, key)
}
