import { openDB, type DBSchema } from 'idb'
import { MPS_TO_MPH } from './metrics'
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

const dbPromise = openDB<TrackmanDB>('trackman-visualizer', 2, {
  async upgrade(db, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
      const shots = db.createObjectStore('shots', { keyPath: 'id' })
      shots.createIndex('activityId', 'activityId')
      db.createObjectStore('settings')
    }
    // v2: speeds are stored in mph instead of m/s.
    if (oldVersion === 1) {
      let cursor = await tx.objectStore('shots').openCursor()
      while (cursor) {
        const { v } = cursor.value
        if (v.clubSpeed !== undefined) v.clubSpeed *= MPS_TO_MPH
        if (v.ballSpeed !== undefined) v.ballSpeed *= MPS_TO_MPH
        await cursor.update(cursor.value)
        cursor = await cursor.continue()
      }
    }
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
 * Adds new shots and replaces stored shots with the same id (so re-importing picks up fields a
 * newer export added), then de-duplicates course-round copies across the whole store (a round's
 * two copies may arrive in different uploads). Returns how many incoming shots were added or updated.
 */
export async function mergeShots(shots: Shot[]): Promise<{ added: number; updated: number }> {
  const db = await dbPromise
  const stored = await db.getAll('shots')
  const known = new Set(stored.map((s) => s.id))
  const byId = new Map(stored.map((s) => [s.id, s]))
  for (const s of shots) {
    const old = byId.get(s.id)
    // A simulator shot's result (putt flag) comes from its course copy, which may not be in this file.
    if (old && !s.shotResult && old.shotResult) s.shotResult = old.shotResult
    byId.set(s.id, s)
  }
  const kept = dropCourseCopies([...byId.values()])
  const tx = db.transaction('shots', 'readwrite')
  await Promise.all([tx.store.clear(), ...kept.map((s) => tx.store.put(s)), tx.done])
  const incoming = new Set(shots.map((s) => s.id))
  const keptIncoming = kept.filter((s) => incoming.has(s.id))
  const added = keptIncoming.filter((s) => !known.has(s.id)).length
  return { added, updated: keptIncoming.length - added }
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
