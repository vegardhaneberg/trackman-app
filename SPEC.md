# Trackman Shot Visualizer — Spec (v1)

Local, browser-only web app. Upload a Trackman CSV export, explore every shot. No backend; data never leaves the machine.

## Input

Trackman CSV export (UTF-8 with BOM, comma-separated). Columns used:

- Grouping: `activity_id`, `activity_time`, `activity_kind`, `shot_index`, `club`, `shot_time`, `shot_result`
- Club: `clubSpeed`, `attackAngle`, `clubPath`, `faceAngle`, `faceToPath`, `dynamicLoft`, `spinLoft`, `impactOffset`, `impactHeight`, `lowPointDistance`
- Ball: `ballSpeed`, `smashFactor`, `carry`, `total`, `launchAngle`, `launchDirection`, `spinRate`, `spinAxis`, `curve`, `carrySide`, `totalSide`, `landingAngle`, `maxHeight`, `hangTime`

Facts from the sample file (979 rows, 14 activities; 544 unique non-putt shots after de-duplication):

- Export units are metric: speeds m/s (converted to and shown in mph), distances m, impact offset/height in **meters** (displayed as mm).
- `activity_kind` ∈ `SIMULATOR`, `VIRTUAL_RANGE`, `COURSE_PLAY`, `MAP_MY_BAG`.
- Many fields are sparse (club speed and impact location are missing on a large share of shots). Empty cell = missing, never 0.
- `swingPlane`, `swingDirection`, `dynamicLie`, `bay` are always empty — ignored.

## Data model & storage

- A **session** = one `activity_id`. Label: `<date of activity_time> · <kind>`.
- **Course rounds are exported twice**: a `SIMULATOR` session (with shot times) and a `COURSE_PLAY` activity with the same shots (plus hole/lie/result). On import each course shot is matched to its simulator twin (club + ball speed + carry + spin + launch); the twin takes the course copy's `shot_result` (the only place putts are flagged) and the course copy is dropped. Unmatched course shots are kept only if measured (have ball speed); the rest are untracked shots with only a course-computed total and are dropped. The merged session is labelled "Round". Hole, lie and place are not used.
- The export has a single `carry` per shot (identical in both copies), so there is no separate course-adjusted carry.
- Shot identity = `activity_id + shot_index`.
- Persisted in **IndexedDB** (`idb`). Uploading a new CSV **merges**: new shots added, existing IDs skipped. Report "X new shots, Y sessions added, Z duplicates skipped".
- UI to delete a single session and to clear all data.
- Settings (filters, active tab) persisted too.

## Filtering

Global sticky filter bar, one state driving all tabs:

- Activity kind chips (multi-toggle, all on by default)
- Session multi-select (grouped by date)
- Club multi-select
- "Exclude mishits" toggle: hides shots with carry < 50% of that club's median carry (median computed over the current filtered set)

Always excluded: putts (`shot_result == AutoPutt`, carried over from the course copy, or club `Putter`).

Clubs are sorted by loft (Driver → woods → hybrids → irons → wedges). Clubs are separated by small multiples (one chart per club, shared scale), not by color: 9+ clubs is more than a colorblind-safe categorical palette can distinguish in a scatter. All shots use one series color; hover highlight is orange.

## Views (tabs)

1. **Overview**
   - Per-club stats table: n, mean ± SD for club speed, ball speed, smash, carry, total, launch angle, spin rate, attack angle, club path, face angle, face-to-path, dynamic loft, max height, landing angle. Missing → "–" with n per metric where it differs.
   - Gapping chart: one row per club, box/strip of carry with total marked, sorted by loft.
2. **Dispersion** — bird's-eye scatter: one chart per club, x = `carrySide`, y = `carry`, same meters-per-pixel in every chart, ~1σ ellipse + mean.
3. **Impact** — small multiples, one face per club, real scale in mm. Face shape per club type (driver/wood, hybrid, iron/wedge). Right-handed view from the front: toe left, heel right; driver/woods/hybrids show a shaft stub at the heel. Positive `impactOffset` = toe (inferred from the data: on woods/hybrids it correlates with a leftward spin axis, i.e. the toe gear effect; Trackman docs don't state the sign). Shows mean + 1σ ellipse, and "n of m shots have impact data".
4. **Face and path** — one top-down picture per club (right-handed, target at the top) of the average delivery: arrow for club path (where the head is moving), arrow for face angle (where the face points), both relative to the target line, plus mean ± SD for club path, face angle and face-to-path. Positive = right of target (in-to-out / open); out-to-in and closed values are shown with a minus. Angles are multiplied by one shared factor (max ×5) so a few degrees are visible. Only shots with all three values count. Below the numbers, a bar shows the average `curve` (m, positive = right) of those shots, where measured: it grows left or right from the centre on a scale shared by all clubs, with the figure printed on the opposite side.
5. **Attack and launch** — one side-on picture per club (right-handed, target to the right) of the average delivery: arrow for attack angle (whether the head is moving up or down at impact) and arrow for launch angle, both relative to level, plus mean ± SD for each. All angles (both arrows, the shaft lean and the good range) are drawn ×2 so differences show; the shaft leans with the attack angle. The driver's ball is on a tee. Where `lowPointDistance` is measured, a triangle under the ground line marks the average low point (to scale with the ball) with the figure in cm before/after the ball, and the swing arc is bent to bottom out there. The export doesn't document the sign of `lowPointDistance`, so it is inferred from the loaded shots: a negative attack angle puts the low point after the ball. A green arc at the end of the attack arrow marks a typical good attack angle range for the club (driver 0 to +5°, woods −4 to −1°, hybrids and long irons −4 to −2°, mid irons −5 to −3°, short irons and PW −6 to −3.5°, other wedges −7 to −4°); these are our own bands around Trackman's tour averages, not a published standard. Only shots with both values count.
6. **Trends** — choose club + metric; per-session mean with spread (±SD), sessions evenly spaced in time order (several can share a day).
7. **Explorer** — choose any two numeric fields for X/Y; one chart per club (shared axes) or all shots combined, with Pearson r.
8. **Shots** — sortable table of all filtered shots; hovering a row highlights the shot in charts where visible.

Every chart tooltip shows: club, session date, carry, club speed, plus the plotted values.

## Stack

Vite + React + TypeScript, Papa Parse (CSV), custom SVG charts with `d3-scale`/`d3-array`, `idb` (IndexedDB). Units: metric only.

## Out of scope (v1)

Backend/accounts, imperial units, left-handed mode, manual per-shot exclusion, sharing/export.
