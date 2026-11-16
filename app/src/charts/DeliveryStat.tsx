import { describeSigned } from '../lib/format'
import { fmtNum } from '../lib/metrics'
import type { Summary } from '../lib/stats'

interface Props {
  /** Legend key class, when the stat has an arrow in the picture. */
  cls?: string
  label: string
  s: Summary
  unit?: string
  /** Words for a positive, negative and zero value. */
  words: [string, string, string]
}

/** One "label: mean ± SD" row under a delivery picture. */
export function DeliveryStat({ cls, label, s, unit = '°', words }: Props) {
  return (
    <div>
      <dt>
        {cls && <span className={`key key-arrow ${cls}`} />} {label}
      </dt>
      <dd>
        {describeSigned(s.mean!, ...words, unit)}
        {s.sd !== undefined && <span className="sd"> ±{fmtNum(s.sd, 1)}</span>}
      </dd>
    </div>
  )
}
