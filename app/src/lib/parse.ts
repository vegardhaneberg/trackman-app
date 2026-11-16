import Papa from 'papaparse'
import { METRICS } from './metrics'
import type { Shot } from './types'

const REQUIRED = ['activity_id', 'activity_time', 'shot_index', 'club']

function num(s: string | undefined): number | undefined {
  if (s == null || s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function parseTrackmanCsv(text: string): Shot[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^﻿/, '').trim(),
  })
  const fields = res.meta.fields ?? []
  const missing = REQUIRED.filter((f) => !fields.includes(f))
  if (missing.length) {
    throw new Error(`This doesn't look like a Trackman export (missing ${missing.join(', ')}).`)
  }

  const shots = res.data
    .filter((row) => row.activity_id && row.shot_index)
    .map((row): Shot => {
      const v: Shot['v'] = {}
      for (const m of METRICS) {
        const n = num(row[m.key])
        if (n !== undefined) v[m.key] = m.factor ? n * m.factor : n
      }
      return {
        id: `${row.activity_id}#${row.shot_index}`,
        activityId: row.activity_id,
        activityTime: row.activity_time,
        kind: row.activity_kind ?? '',
        shotIndex: Number(row.shot_index),
        club: row.club || 'Unknown',
        shotTime: row.shot_time || null,
        shotResult: row.shot_result ?? '',
        v,
      }
    })
  return dropCourseCopies(shots)
}

const fingerprint = (s: Shot) => [s.club, s.v.ballSpeed, s.v.carry, s.v.spinRate, s.v.launchAngle].join('|')

/**
 * Trackman exports a simulator round twice: as a SIMULATOR session (with shot times) and as a
 * COURSE_PLAY activity with the same shots (plus hole/lie/result). Keep the simulator copy,
 * carry over the course copy's shot result (it is the only place putts are flagged), and drop
 * the duplicate. Unmatched course shots are kept only if they were actually measured: Trackman
 * also logs untracked shots there with nothing but a course-computed total.
 */
export function dropCourseCopies(shots: Shot[]): Shot[] {
  const sim = new Map<string, Shot>()
  for (const s of shots) if (s.kind === 'SIMULATOR') sim.set(fingerprint(s), s)
  return shots.filter((s) => {
    if (s.kind !== 'COURSE_PLAY') return true
    const twin = sim.get(fingerprint(s))
    if (!twin) return s.v.ballSpeed !== undefined
    twin.shotResult = s.shotResult
    return false
  })
}
