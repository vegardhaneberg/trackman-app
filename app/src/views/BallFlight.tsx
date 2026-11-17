import { Flight, type FlightShape } from '../charts/Flight'
import { clubLabel, faceType, heightRange } from '../lib/clubs'
import { fmt, fmtNum, METRIC, type MetricKey } from '../lib/metrics'
import { byClub, summarize, values } from '../lib/stats'
import type { Shot } from '../lib/types'
import { fullSwings, judgeWindow, MIN_FULL_SWINGS, windowTarget, type Detail, type Landing, type WindowResult, type WindowTarget } from '../lib/window'

const STATS: MetricKey[] = ['ballSpeed', 'carry', 'maxHeight']
const WINDOW: MetricKey[] = ['landingAngle', 'spinRate', 'launchAngle']

/** Average ball flight per club, seen from the side: distance and height only. */
export function BallFlight({ shots }: { shots: Shot[] }) {
  const clubs = byClub(shots).map(([club, all]) => {
    const ss = all.filter(
      (s) =>
        s.v.carry !== undefined &&
        s.v.launchAngle !== undefined &&
        s.v.maxHeight !== undefined &&
        s.v.landingAngle !== undefined,
    )
    const stats = Object.fromEntries(
      [...STATS, ...WINDOW].map((k) => [k, summarize(values(ss, k))]),
    ) as Record<MetricKey, ReturnType<typeof summarize>>
    // Club speed and delivery from every shot of the club, not only those with full flight data.
    const speed = summarize(values(all, 'clubSpeed')).mean
    const good = heightRange(club, speed)
    // The window is judged on full swings only for wedges (chips and part swings spin and land
    // differently), and so are their targets and delivery hints: chips would drag the club speed down.
    const wedge = faceType(club) === 'wedge'
    const full = fullSwings(club, ss)
    const delivery = wedge ? full : all
    const target = windowTarget(club, summarize(values(delivery, 'clubSpeed')).mean)
    const wstats = Object.fromEntries(WINDOW.map((k) => [k, summarize(values(full, k))])) as Stats
    const tooFew = wedge && full.length < MIN_FULL_SWINGS
    const result =
      !tooFew && full.length && wstats.spinRate.mean !== undefined
        ? judgeWindow(club, target, {
            launch: wstats.launchAngle.mean!,
            spin: wstats.spinRate.mean,
            landing: wstats.landingAngle.mean!,
            attack: summarize(values(delivery, 'attackAngle')).mean,
            impactHeight: summarize(values(delivery, 'impactHeight')).mean,
          })
        : undefined
    const win = { stats: wstats, n: full.length, of: ss.length, tooFew, target, result }
    return { club, n: ss.length, flights: ss.map((s) => s.v as FlightShape), stats, good, window: win }
  })

  const flights = clubs.flatMap((c) => c.flights)
  const maxCarry = Math.max(10, ...flights.map((f) => f.carry)) * 1.03
  const maxHeight =
    Math.max(5, ...flights.map((f) => f.maxHeight), ...clubs.filter((c) => c.n > 0).map((c) => c.good.range[1])) * 1.05

  return (
    <section className="card">
      <header className="card-head">
        <h2>Ball flight</h2>
        <p className="muted">
          Seen from the side, target to the right. Height and distance in metres at the same scale, so the
          angles are true, and every club shares the same axes. The curve is drawn from carry, launch angle,
          max height and landing angle; the export has no full trajectory.
        </p>
        <p className="muted">
          The green band is a good max height for the club: the PGA Tour average for that club (Trackman),
          scaled down to your average club speed with it, ±10%. Height is taken to grow with speed to the
          power 1.3, which turns the tour's driver height into the LPGA's.
        </p>
        <p className="muted">
          Window and stopping power: landing angle and spin are what stop the ball. Targets follow Trackman's
          PGA Tour and LPGA Tour averages for each club, on a straight line between the two by your club
          speed; below LPGA speed they fall off as PING's 7-iron landing angle chart does. Landing angle within
          3° of the tour figure is high stopping power, within 9° mid. Launch is in range within 2° of the tour
          figure (3° for wedges), spin within 15%. Wedges count full swings only.
        </p>
        <p className="legend">
          <span className="key key-arrow key-path" /> average flight
          <span className="key key-arrow key-shot" /> each shot
          <span className="key key-band" /> good max height
        </p>
      </header>
      <WindowSummary clubs={clubs} />
      <div className="flight-list">
        {clubs.map((c) => (
          <figure key={c.club} className="facet impact-facet">
            <figcaption>
              <strong>{clubLabel(c.club)}</strong>
              {c.n > 0 && <span className="muted"> · {c.n} shots</span>}
            </figcaption>
            {c.n === 0 ? (
              <p className="empty-facet muted">No ball flight data for this club.</p>
            ) : (
              <>
                <Flight
                  ariaLabel={`${clubLabel(c.club)}: carry ${fmt('carry', c.stats.carry.mean)}, max height ${fmt('maxHeight', c.stats.maxHeight.mean)}, launch angle ${fmt('launchAngle', c.stats.launchAngle.mean)}, landing angle ${fmt('landingAngle', c.stats.landingAngle.mean)}`}
                  mean={{
                    carry: c.stats.carry.mean!,
                    launchAngle: c.stats.launchAngle.mean!,
                    maxHeight: c.stats.maxHeight.mean!,
                    landingAngle: c.stats.landingAngle.mean!,
                  }}
                  shots={c.flights}
                  maxCarry={maxCarry}
                  maxHeight={maxHeight}
                  goodHeight={c.good.range}
                />
                <dl className="flight-stats">
                  {STATS.map((k) => (
                    <div key={k}>
                      <dt>{METRIC[k].label}</dt>
                      <dd>
                        {fmt(k, c.stats[k].mean)}
                        {c.stats[k].sd !== undefined && (
                          <span className="sd"> ±{fmtNum(c.stats[k].sd, METRIC[k].digits)}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>
                      <span className="key key-band" /> Good max height
                    </dt>
                    <dd>
                      {fmtNum(c.good.range[0], 0)}–{fmtNum(c.good.range[1], 0)} m
                      <span className="sd">
                        {c.good.speed ? ` at ${fmtNum(c.good.speed, 0)} mph` : ' (no club speed)'}
                      </span>
                    </dd>
                  </div>
                </dl>
                {c.window.result && <WindowPanel w={c.window} />}
                {c.window.tooFew && (
                  <p className="window window-none muted">
                    Not enough full swings to judge the window: {c.window.n} of {c.window.of} shots are full
                    swings, and it takes {MIN_FULL_SWINGS}.
                  </p>
                )}
              </>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}

type Stats = Record<MetricKey, ReturnType<typeof summarize>>

const VERDICT: Record<WindowResult['verdict'], string> = { good: 'Good', borderline: 'Borderline', poor: 'Poor' }

const rpm = (v: number) => fmtNum(Math.round(v / 50) * 50, 0)

function targetText(k: MetricKey, t: WindowTarget): string {
  if (k === 'landingAngle')
    return t.landing === undefined
      ? 'not judged'
      : `${fmtNum(t.landing.mid[0], 0)}–${fmtNum(t.landing.high[1], 0)}°`
  if (k === 'spinRate') return `${rpm(t.spin[0])}–${rpm(t.spin[1])} rpm`
  return `${fmtNum(t.launch[0], 0)}–${fmtNum(t.launch[1], 0)}°`
}

interface ClubWindow {
  stats: Stats
  /** Shots judged, out of the club's shots with flight data. */
  n: number
  of: number
  /** A wedge with too few full swings to judge. */
  tooFew: boolean
  target: WindowTarget
  result?: WindowResult
}

function chip(k: MetricKey, r: WindowResult): { text: string; tone: string } | undefined {
  if (k === 'landingAngle') {
    if (r.landing === undefined) return undefined
    const tone: Record<Landing, [string, string]> = {
      low: ['Very flat', 'bad'],
      close: ['Flat', 'warn'],
      mid: ['OK', 'ok'],
      high: ['OK', 'ok'],
      steep: ['Steep', 'warn'],
      tooSteep: ['Very steep', 'bad'],
    }
    const [text, t] = tone[r.landing]
    return { text, tone: t }
  }
  // Wedges can't really spin too much, nor a driver launch too high: high is fine there, very high a caution.
  const [detail, highOk] = k === 'spinRate' ? [r.spinDetail, r.highSpinOk] : [r.launchDetail, r.highLaunchOk]
  const labels: Record<Detail, [string, string]> = {
    veryLow: ['Very low', 'bad'],
    low: ['Low', 'warn'],
    ok: ['OK', 'ok'],
    high: ['High', highOk ? 'ok' : 'warn'],
    veryHigh: ['Very high', highOk ? 'warn' : 'bad'],
  }
  const [text, tone] = labels[detail]
  return { text, tone }
}

/** Per club: landing angle, spin and launch against their targets, a verdict, and what to change. */
function WindowPanel({ w }: { w: ClubWindow }) {
  const { stats, target } = w
  const result = w.result!
  return (
    <div className={`window window-${result.verdict}`}>
      <p className="window-head">
        <span className={`verdict verdict-${result.verdict}`}>{VERDICT[result.verdict]}</span>
        <strong>{result.headline}</strong>
        <span className="muted">
          {target.speed ? ` · targets at ${fmtNum(target.speed, 0)} mph` : ' · PGA Tour targets (no club speed)'}
          {w.n < w.of && ` · ${w.n} of ${w.of} shots are full swings`}
        </span>
      </p>
      <dl className="window-stats">
        {WINDOW.map((k) => {
          const c = chip(k, result)
          return (
            <div key={k}>
              <dt>{METRIC[k].label}</dt>
              <dd>
                {fmt(k, stats[k].mean)}
                {stats[k].sd !== undefined && <span className="sd"> ±{fmtNum(stats[k].sd, METRIC[k].digits)}</span>}
                {c && <span className={`level level-${c.tone}`}>{c.text}</span>}
              </dd>
              <dd className="window-target">{targetText(k, target)}</dd>
            </div>
          )
        })}
      </dl>
      <ul className="window-advice">
        {result.advice.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

/** One line per club so the whole bag can be scanned before the detail. */
function WindowSummary({
  clubs,
}: {
  clubs: { club: string; window: ClubWindow }[]
}) {
  const rows = clubs.filter((c) => c.window.result || c.window.tooFew)
  if (!rows.length) return null
  return (
    <div className="table-scroll window-summary">
      <table className="data">
        <thead>
          <tr>
            <th className="left">Club</th>
            <th className="left">Window</th>
            <th>Landing angle</th>
            <th>Spin rate</th>
            <th>Launch angle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const w = c.window
            if (!w.result)
              return (
                <tr key={c.club}>
                  <th className="left">{clubLabel(c.club)}</th>
                  <td className="left muted">Not enough full swings</td>
                  <td colSpan={3} className="muted">
                    {w.n} of {w.of} shots are full swings
                  </td>
                </tr>
              )
            const r = w.result
            return (
              <tr key={c.club}>
                <th className="left">{clubLabel(c.club)}</th>
                <td className="left">
                  <span className={`verdict verdict-${r.verdict}`}>{VERDICT[r.verdict]}</span> {r.headline}
                </td>
                {WINDOW.map((k) => {
                  const ch = chip(k, r)
                  return (
                    <td key={k}>
                      {fmt(k, w.stats[k].mean)} <span className="sd">/ {targetText(k, w.target)}</span>
                      {ch && <span className={`level level-${ch.tone}`}>{ch.text}</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
