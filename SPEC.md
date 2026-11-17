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

- Activity kind dropdown (multi-select checkboxes, all on by default)
- Month range slider (two thumbs, from month to month, over the months between the first and last session; a thumb at either end leaves that side open, so new uploads are included). Hidden when all sessions are in one month.
- Session multi-select (grouped by date)
- Club multi-select
- "Exclude mishits" toggle: hides shots with carry < 50% of that club's median carry (median computed over the current filtered set)

Filters respect each other: each one lists and counts only the shots that pass all the *other* filters (including "Exclude mishits"), and hides options with no shots. Its own selection doesn't change its counts, so an unchecked option still shows how many shots checking it brings back. The month slider spans only the months those shots cover. "None" excludes every option, including hidden ones; "All" clears the exclusions.

Always excluded: putts (`shot_result == AutoPutt`, carried over from the course copy, or club `Putter`).

Clubs are sorted by loft (Driver → woods → hybrids → irons → wedges). A club whose name holds a number from 48 to 60 is a wedge of that loft (`50Wedge`, `54`, `Wedge 58`): it sorts among the named wedges by loft and is labelled "50° wedge". Other names ending in `Wedge` sort with the pitching wedge and use its figures. Clubs are separated by small multiples (one chart per club, shared scale), not by color: 9+ clubs is more than a colorblind-safe categorical palette can distinguish in a scatter. All shots use one series color; hover highlight is orange.

## Views (tabs)

1. **Overview**
   - Per-club stats table: n, mean ± SD for club speed, ball speed, smash, carry, total, launch angle, spin rate, attack angle, club path, face angle, face-to-path, dynamic loft, max height, landing angle. Missing → "–" with n per metric where it differs.
   - Gapping chart: one row per club, box/strip of carry with total marked, sorted by loft.
2. **Dispersion** — bird's-eye scatter: one chart per club, x = `carrySide`, y = `carry`, same meters-per-pixel in every chart, ~1σ ellipse + mean.
3. **Impact** — small multiples, one face per club, real scale in mm. Face shape per club type (driver/wood, hybrid, iron/wedge). Right-handed view from the front: toe left, heel right; driver/woods/hybrids show a shaft stub at the heel. Positive `impactOffset` = toe (inferred from the data: on woods/hybrids it correlates with a leftward spin axis, i.e. the toe gear effect; Trackman docs don't state the sign). Shows mean + 1σ ellipse, and "n of m shots have impact data".
4. **Face and path** — one top-down picture per club (right-handed, target at the top) of the average delivery: arrow for club path (where the head is moving), arrow for face angle (where the face points), both relative to the target line, plus mean ± SD for club path, face angle and face-to-path. Positive = right of target (in-to-out / open); out-to-in and closed values are shown with a minus. Angles are multiplied by one shared factor (max ×5) so a few degrees are visible. Only shots with all three values count. Below the numbers, a bar shows the average `curve` (m, positive = right) of those shots, where measured: it grows left or right from the centre on a scale shared by all clubs, with the figure printed on the opposite side.
5. **Attack and launch** — one side-on picture per club (right-handed, target to the right) of the average delivery: arrow for attack angle (whether the head is moving up or down at impact) and arrow for launch angle, both relative to level, plus mean ± SD for each. All angles (both arrows, the shaft lean and the good range) are drawn ×2 so differences show; the shaft leans with the attack angle. The driver's ball is on a tee. Where `lowPointDistance` is measured, a triangle under the ground line marks the average low point (to scale with the ball) with the figure in cm before/after the ball, and the swing arc is bent to bottom out there. The export doesn't document the sign of `lowPointDistance`, so it is inferred from the loaded shots: a negative attack angle puts the low point after the ball. A green arc at the end of the attack arrow marks a typical good attack angle range for the club (driver 0 to +5°, woods −4 to −1°, hybrids and long irons −4 to −2°, mid irons −5 to −3°, short irons and PW −6 to −3.5°, other wedges −7 to −4°); these are our own bands around Trackman's tour averages, not a published standard. Only shots with both values count.
6. **Ball flight** — one side-on chart per club (target to the right), height against distance in metres at the same scale, so angles are true; all clubs share the same axes. Shows each shot faintly and the average flight on top, with the average max height and carry marked, plus mean ± SD for ball speed, carry and max height (launch angle, spin rate and landing angle are in the window panel below). The export has no trajectory, so the curve is constructed: it leaves at the launch angle, peaks at the max height and lands at the carry distance at the landing angle (one cubic Bézier, so where along the carry it peaks is an estimate). Only shots with all four values count; no side-to-side data. A green band marks a good max height for the club: Trackman's PGA Tour average max height for it (driver 32 yd at 113 mph down to PW 29 yd at 83 mph; other wedges use the PW figures), scaled down to the club's average club speed over all its shots by (speed ÷ tour speed)^1.3, never up, ±10%. The exponent turns the tour driver height into the LPGA's (94 mph, 25 yd). Unscaled when club speed is missing.
   - **Window and stopping power** — a summary table at the top (one row per club) and a panel under each club's chart. Landing angle and spin decide whether a club holds a green; launch angle mostly explains why. All three are averages over the club's flight shots (full swings only for wedges, see below); club speed, attack angle and impact height are averages over all its shots (wedges: full swings). Targets (`lib/window.ts`):
     - Targets follow Trackman's tour averages per club. PGA Tour: driver 113 mph / 10.9° launch / 2,686 rpm / 38° landing, 3 wood 107 / 9.2 / 3,655 / 43, 5 wood 103 / 9.4 / 4,350 / 47, hybrid 100 / 10.2 / 4,437 / 47, 3 iron 98 / 10.4 / 4,630 / 46, 4 iron 96 / 11.0 / 4,836 / 48, 5 iron 94 / 12.1 / 5,361 / 49, 6 iron 92 / 14.1 / 6,231 / 50, 7 iron 90 / 16.3 / 7,097 / 50, 8 iron 87 / 18.1 / 7,998 / 50, 9 iron 85 / 20.4 / 8,647 / 51, PW 83 / 24.2 / 9,304 / 52. LPGA Tour: driver 94 / 13.2 / 2,611 / 37, 3 wood 90 / 11.2 / 2,704 / 39, 5 wood 88 / 12.1 / 4,501 / 43, 7 wood 85 / 12.7 / 4,693 / 46, 4 iron 80 / 14.3 / 4,801 / 43, 5 iron 79 / 14.8 / 5,081 / 45, 6 iron 78 / 17.1 / 5,943 / 46, 7 iron 76 / 19.0 / 6,699 / 47, 8 iron 74 / 20.8 / 7,494 / 47, 9 iron 72 / 23.9 / 7,589 / 47, PW 70 / 25.7 / 8,403 / 48. Filled in by us: PGA 7 wood 101 / 9.8 / 4,400 / 47; LPGA hybrid = LPGA 7 wood; LPGA 3 iron 81 / 13.8 / 4,600 / 42. Wedges past PW: GW/AW +1 step, SW +2, LW +3, each step −2 mph, +2° launch, +500 rpm (capped at 11,000), +1° landing; any club whose name holds a number from 48 to 60 is a wedge of that loft (`50Wedge`, `54`, …) and takes one step per 4° past 46°.
     - At the club's average club speed: PGA figures at or above PGA speed, a straight line between LPGA and PGA in between, and below LPGA speed the LPGA launch with landing angle and spin falling off as PING's 7-iron landing angle guideline chart (revised 6/26/20) does at the same 7-iron-equivalent speed (speed × 90 ÷ the club's PGA speed): landing drops by as much as the start of PING's high stopping power range does, spin in proportion to the middle of its high spin range. PGA figures when club speed is missing.
     - The landing angle window runs from 9° under the tour figure to 3° over it, shown as one range. Within it, the top 6° is high stopping power and the rest mid. Its label is Very flat (red, more than 2° under the window), Flat (orange, up to 2° under), OK (in the window), Steep (orange, above it) or Very steep (red, more than 5° above). Wedges are never steep. Launch is in range within ±2° of the tour figure (±3° for wedges), spin within ±15%. Spin is labelled Very low (red, more than 15% under the range), Low (orange), OK, High (orange) or Very high (red, more than 15% over the range); on wedges High is OK and Very high only orange. Launch is labelled the same way, with Very low / Very high for more than its tolerance (2°, wedges 3°) outside the range; on the driver High launch is OK and Very high only orange.
     - Verdict: Good for mid or high stopping power with spin in range or above, or for steep; Borderline for more than 5° above the window; Borderline for mid or high with low spin, for just short of mid, or for low when the 7-iron-equivalent speed is above 90 mph (PING: faster players may choose low stopping power for control in wind); otherwise Poor.
     - The driver isn't meant to stop and is judged on launch and spin only: Good when launch isn't low and spin isn't high, Poor when launch is low and spin is off, otherwise Borderline.
     - Wedges are judged on full swings only, so chips and part swings don't count: a shot is a full swing when its club speed is at least 90% of the club's fast end (the 90th percentile of its club speeds), which holds even when most shots with the club are chips. Shots without club speed fall back to carry against the club's long end (90th percentile carry). The wedge's targets, attack angle and impact height also come from its full swings only. With fewer than 5 full swings the wedge isn't judged and shows "Not enough full swings". The panel says how many of the shots are full swings. The flight chart still shows every shot.
     - Advice: one line per club from the launch × spin combination, worded per club type (driver, wood, hybrid, iron, wedge). When launch and spin are in range but it still lands short of mid, the advice is that there isn't enough speed for the loft (take a more lofted club). When it lands short, it says where mid and high start and that launch is the bigger lever (PING: +1° launch ≈ +1–1.5° landing, +500 rpm ≈ +0.5°), suggests a hybrid for 5 iron and longer, and above 90 mph notes that low can be a choice. Added when they point the same way: attack angle outside the club's good range, and average impact height more than 5 mm above (low spin) or below (high spin) centre.
7. **Trends** — choose club + metric; per-session mean with spread (±SD), sessions evenly spaced in time order (several can share a day).
8. **Explorer** — choose any two numeric fields for X/Y; one chart per club (shared axes) or all shots combined, with Pearson r.
9. **Shots** — sortable table of all filtered shots; hovering a row highlights the shot in charts where visible.

Every chart tooltip shows: club, session date, carry, club speed, plus the plotted values.

## Stack

Vite + React + TypeScript, Papa Parse (CSV), custom SVG charts with `d3-scale`/`d3-array`, `idb` (IndexedDB). Units: metric only.

## Out of scope (v1)

Backend/accounts, imperial units, left-handed mode, manual per-shot exclusion, sharing/export.
