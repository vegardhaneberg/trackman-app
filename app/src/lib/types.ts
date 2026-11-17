import type { MetricKey } from './metrics'

export interface Shot {
  /** activityId + shotIndex, stable across re-uploads. */
  id: string
  activityId: string
  activityTime: string
  kind: string
  shotIndex: number
  club: string
  shotTime: string | null
  /** NormalShot, AutoPutt, … (only set for course rounds). */
  shotResult: string
  v: Partial<Record<MetricKey, number>>
}

export interface Session {
  id: string
  time: string
  kind: string
  count: number
}

export interface Filters {
  // Stored as exclusions so sessions/clubs from a new upload show up by default.
  excludedKinds: string[]
  excludedSessions: string[]
  excludedClubs: string[]
  excludeMishits: boolean
  /** Inclusive month range, 'YYYY-MM'. null = open-ended, so the range follows new uploads. */
  fromMonth: string | null
  toMonth: string | null
}

export const DEFAULT_FILTERS: Filters = {
  excludedKinds: [],
  excludedSessions: [],
  excludedClubs: [],
  excludeMishits: true,
  fromMonth: null,
  toMonth: null,
}

export type Tab = 'overview' | 'dispersion' | 'impact' | 'face' | 'attack' | 'flight' | 'trends' | 'explorer' | 'shots'
