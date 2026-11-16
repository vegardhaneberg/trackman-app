/*
 * Trackman-eksport
 * ----------------
 * Henter øktene dine fra Trackman-portalen og lar deg laste ned slagdata som CSV/JSON.
 *
 * Kjøres i DevTools-konsollen på https://portal.trackmangolf.com mens du er innlogget.
 * - Bruker innloggingen du allerede har i portalen. Tokenet forlater aldri nettleseren.
 * - Snakker kun med Trackmans eget API (samme API som portalen selv bruker).
 * - Ingen tilgang til filer på maskinen; den kan bare laste ned filer du klikker på.
 *
 * Enheter fra API-et: hastigheter i m/s, distanser i meter, spinn i rpm, vinkler i grader.
 * Uoffisielt: bruker Trackmans private API, som kan endre seg uten forvarsel.
 */
(async () => {
  'use strict';

  // ---------- Innstillinger ----------
  const CSV_SEPARATOR = ',';          // Bruk ';' hvis du skal åpne filene i norsk Excel
  const DECIMAL_COMMA = false;        // true = desimalkomma (for norsk Excel sammen med ';')
  const PAGE_SIZE = 50;               // aktiviteter per side mot API-et
  const PARALLEL = 3;                 // hvor mange økter som hentes samtidig
  const DEFAULT_ENDPOINT = 'https://api.trackmangolf.com/graphql';

  const log = (...a) => console.log('%c[Trackman-eksport]', 'color:#e8662a;font-weight:bold', ...a);
  if (!/trackmangolf\.com$/.test(location.hostname)) {
    alert('Kjør dette scriptet på portal.trackmangolf.com mens du er innlogget.');
    return;
  }

  // ---------- 1. Finn tokenet portalen bruker ----------
  function decodeJwt(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
  }
  function isUsableAccessToken(t) {
    const p = decodeJwt(t);
    return !!p && !p.nonce && (!p.exp || p.exp * 1000 > Date.now()); // id_token har nonce
  }
  function findStoredToken() {
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const v = store.getItem(store.key(i));
        if (!v) continue;
        if (v.includes('access_token')) {
          try { const t = JSON.parse(v).access_token; if (t && isUsableAccessToken(t)) return t; } catch {}
        }
        const m = v.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
        if (m && isUsableAccessToken(m[0])) return m[0];
      }
    }
    for (const m of document.cookie.matchAll(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)) {
      if (isUsableAccessToken(m[0])) return m[0];
    }
    return null;
  }
  // Fallback: lytt på portalens egne GraphQL-kall og kopier hvordan de autentiseres.
  function captureFromNetwork(timeoutMs) {
    return new Promise((resolve) => {
      const origFetch = window.fetch;
      const X = XMLHttpRequest.prototype;
      const orig = { open: X.open, setRequestHeader: X.setRequestHeader, send: X.send };
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        window.fetch = origFetch;
        Object.assign(X, orig);
        resolve(result);
      };
      const isGql = (url) => /graphql/i.test(url || '');
      window.fetch = function (input, init) {
        try {
          const url = typeof input === 'string' ? input : input?.url;
          if (isGql(url)) {
            const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            const auth = headers.get('authorization');
            const creds = init?.credentials || (input instanceof Request ? input.credentials : 'same-origin');
            finish({ endpoint: url, token: auth && /^bearer /i.test(auth) ? auth.slice(7) : null, credentials: creds === 'include' ? 'include' : 'omit' });
          }
        } catch {}
        return origFetch.apply(this, arguments);
      };
      X.open = function (method, url) { this.__tmUrl = String(url); return orig.open.apply(this, arguments); };
      X.setRequestHeader = function (k, v) {
        if (/^authorization$/i.test(k) && /^bearer /i.test(v)) this.__tmToken = v.slice(7);
        return orig.setRequestHeader.apply(this, arguments);
      };
      X.send = function () {
        try {
          if (isGql(this.__tmUrl)) finish({ endpoint: this.__tmUrl, token: this.__tmToken || null, credentials: this.withCredentials ? 'include' : 'omit' });
        } catch {}
        return orig.send.apply(this, arguments);
      };
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  // Autentisering: token (Bearer) og/eller innloggings-cookie, avhengig av hva portalen bruker.
  let auth = null;
  async function post(a, query, variables) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (a.token) headers.Authorization = `Bearer ${a.token}`;
    return fetch(a.endpoint, { method: 'POST', headers, credentials: a.credentials, body: JSON.stringify({ query, variables }) });
  }
  async function works(a) {
    try {
      const res = await post(a, 'query Probe { me { profile { id } } }', {});
      if (!res.ok) return false;
      return !!(await res.json())?.data?.me;
    } catch { return false; }
  }
  async function tryAll(candidates) {
    for (const c of candidates) if (await works(c)) return c;
    return null;
  }

  const stored = findStoredToken();
  auth = await tryAll([
    ...(stored ? [{ endpoint: DEFAULT_ENDPOINT, token: stored, credentials: 'omit' }] : []),
    { endpoint: DEFAULT_ENDPOINT, token: null, credentials: 'include' },
    ...(stored ? [{ endpoint: DEFAULT_ENDPOINT, token: stored, credentials: 'include' }] : []),
  ]);
  if (!auth) {
    log('Trenger hjelp til å finne innloggingen. Klikk på et av FILTRENE øverst på Activities-siden (f.eks. «All» eller «Courses & Tournaments»). ' +
      'IKKE klikk i menyen til venstre – det laster siden på nytt og stopper scriptet. Venter i 60 sekunder...');
    const captured = await captureFromNetwork(60000);
    if (captured) {
      const endpoint = captured.endpoint.split('?')[0];
      auth = await tryAll([
        { ...captured, endpoint },
        { ...captured, endpoint, credentials: captured.credentials === 'include' ? 'omit' : 'include' },
      ]);
    }
  }
  if (!auth) {
    const pasted = prompt('Fant ikke innloggingen automatisk.\nLim inn verdien fra Authorization-headeren på en graphql-request (DevTools → Network → klikk på requesten → Headers):');
    const t = pasted ? pasted.replace(/^bearer\s+/i, '').trim() : null;
    if (t) auth = await tryAll([{ endpoint: DEFAULT_ENDPOINT, token: t, credentials: 'omit' }, { endpoint: DEFAULT_ENDPOINT, token: t, credentials: 'include' }]);
  }
  if (!auth) { log('Avbrutt: fikk ikke kontakt med API-et som innlogget bruker.'); return; }
  log(`Innlogget mot ${auth.endpoint} (${auth.token ? 'token' : 'cookie'}).`);

  // ---------- 2. GraphQL-klient som tåler felt Trackman har fjernet ----------
  const removedFields = new Set();
  async function gql(buildQuery, variables = {}, attempt = 0) {
    const res = await post(auth, buildQuery(), variables);
    if (res.status === 401) throw new Error('Innloggingen er utløpt. Last portalen på nytt og kjør scriptet igjen.');
    if (!res.ok) throw new Error(`API-feil: HTTP ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) {
      // Hvis et felt ikke finnes lenger: fjern det og prøv igjen.
      const unknown = body.errors
        .map((e) => /Cannot query field "(\w+)"/.exec(e.message || '')?.[1])
        .filter(Boolean);
      if (unknown.length && attempt < 15) {
        const fresh = unknown.filter((f) => !removedFields.has(f));
        fresh.forEach((f) => removedFields.add(f));
        if (fresh.length) log('Hopper over felt som ikke finnes i API-et:', fresh.join(', '));
        return gql(buildQuery, variables, attempt + 1);
      }
      if (!body.data) throw new Error('GraphQL-feil: ' + body.errors.map((e) => e.message).join('; '));
      console.warn('[Trackman-eksport] Delvis svar fra API-et:', body.errors);
    }
    return body.data;
  }
  const fields = (list) => list.filter((f) => !removedFields.has(f)).join(' ');

  // ---------- 3. Feltlister (fra kjent skjema, pluss noen ekstra som fjernes automatisk om de ikke finnes) ----------
  const RANGE_MEAS = ['ballSpeed', 'carry', 'total', 'carrySide', 'totalSide', 'launchAngle', 'launchDirection',
    'landingAngle', 'maxHeight', 'ballSpin', 'spinAxis', 'curve', 'hangTime', 'distanceFromPin', 'targetDistance'];
  const FULL_MEAS = ['clubSpeed', 'attackAngle', 'clubPath', 'faceAngle', 'faceToPath', 'dynamicLoft', 'spinLoft',
    'swingPlane', 'swingDirection', 'dynamicLie', 'impactOffset', 'impactHeight', 'lowPointDistance',
    'ballSpeed', 'smashFactor', 'carry', 'total', 'launchAngle', 'launchDirection', 'spinRate', 'spinAxis', 'curve',
    'carrySide', 'totalSide', 'landingAngle', 'maxHeight', 'hangTime'];
  const COURSE_MEAS = ['ballSpeed', 'clubSpeed', 'smashFactor', 'carry', 'total', 'launchAngle', 'launchDirection',
    'spinRate', 'spinAxis', 'curve', 'carrySide', 'totalSide', 'landingAngle', 'maxHeight', 'hangTime',
    'attackAngle', 'clubPath', 'faceAngle', 'faceToPath', 'dynamicLoft'];
  const SESSION_TYPES = ['MapMyBagSessionActivity', 'ShotAnalysisSessionActivity', 'SimulatorSessionActivity',
    'VirtualRangeSessionActivity', 'SessionActivity'];

  const LIST_QUERY = () => `
    query ListActivities($skip: Int, $take: Int) {
      me {
        activities(skip: $skip, take: $take) {
          totalCount
          pageInfo { hasNextPage }
          items {
            id time kind
            ... on RangePracticeActivity { numberOfStrokes location { name } }
            ... on RangeFindMyDistanceActivity { numberOfStrokes location { name } }
            ... on CoursePlayActivity { grossScore toPar thruHole course { displayName } }
            ${SESSION_TYPES.map((t) => `... on ${t} { strokeCount }`).join('\n')}
          }
        }
      }
    }`;

  // `strokes` får et eget alias per aktivitetstype: slagtypene har ulik nullbarhet på samme felt
  // (f.eks. `time: DateTime` mot `DateTime!`), og da avviser API-et spørringen hvis de deler navn.
  // normalizeNode() samler dem tilbake til `strokes`.
  function normalizeNode(node) {
    if (!node) return null;
    for (const key of Object.keys(node)) {
      if (!key.startsWith('strokes_')) continue;
      if (node[key] != null) node.strokes = node[key];
      delete node[key];
    }
    return node;
  }

  const DETAIL_QUERY = () => `
    query Activity($id: ID!) {
      node(id: $id) {
        __typename
        ... on PlayerActivity { id time kind }
        ... on RangePracticeActivity {
          location { name }
          strokes_RangePractice: strokes { time club bayName measurement { ${fields(RANGE_MEAS)} } }
        }
        ... on RangeFindMyDistanceActivity {
          location { name }
          strokes_RangeFindMyDistance: strokes { time club measurement { ${fields(RANGE_MEAS)} } }
        }
        ${SESSION_TYPES.map((t) => `... on ${t} { strokes_${t}: strokes { time club measurement { ${fields(FULL_MEAS)} } } }`).join('\n')}
        ... on CoursePlayActivity {
          gameType grossScore netScore toPar
          course { displayName }
          scorecard {
            par grossScore netScore toPar courseHcp teeName numberOfHolesPlayed isCompleted
            holes {
              holeNumber par strokeIndex distance grossScore netScore putts greenInRegulation hcpStrokes
              shots { shotNumber club total launchLie finalLie shotResult measurement { ${fields(COURSE_MEAS)} } }
            }
          }
        }
      }
    }`;

  // ---------- 4. Hent liste over alle aktiviteter ----------
  log('Henter aktivitetslisten...');
  const activities = [];
  for (let skip = 0; ; ) {
    const data = await gql(LIST_QUERY, { skip, take: PAGE_SIZE });
    const page = data?.me?.activities;
    if (!page?.items?.length) break;
    activities.push(...page.items.filter(Boolean));
    skip += page.items.length;
    if (!page.pageInfo?.hasNextPage) break;
  }
  log(`Fant ${activities.length} aktiviteter.`);

  const place = (a) => a.location?.name || a.course?.displayName || '';
  const shotCount = (a) => a.numberOfStrokes ?? a.strokeCount ?? (a.kind === 'COURSE_PLAY' ? `${a.grossScore ?? '?'} slag` : '');

  // ---------- 5. Hent detaljer og flat ut til tabeller ----------
  const detailCache = new Map();
  async function fetchDetails(ids, onProgress) {
    const todo = ids.filter((id) => !detailCache.has(id));
    let done = ids.length - todo.length;
    const worker = async () => {
      while (todo.length) {
        const id = todo.shift();
        try { detailCache.set(id, normalizeNode((await gql(DETAIL_QUERY, { id }))?.node)); }
        catch (e) { console.warn('[Trackman-eksport] Klarte ikke å hente', id, e); detailCache.set(id, null); }
        onProgress(++done, ids.length);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    return ids.map((id) => detailCache.get(id)).filter(Boolean);
  }

  function buildTables(details) {
    const sessions = [], shots = [], holes = [];
    for (const d of details) {
      const base = { activity_id: d.id, activity_time: d.time, activity_kind: d.kind, place: place(d) };
      if (Array.isArray(d.strokes)) {
        sessions.push({ ...base, shots: d.strokes.length, gross_score: '', to_par: '' });
        d.strokes.forEach((s, i) => shots.push({
          ...base, shot_index: i + 1, hole: '', shot_on_hole: '', club: s.club, shot_time: s.time,
          bay: s.bayName ?? '', launch_lie: '', final_lie: '', shot_result: '', ...(s.measurement || {}),
        }));
      } else if (d.scorecard) {
        const sc = d.scorecard;
        let idx = 0;
        sessions.push({ ...base, shots: (sc.holes || []).reduce((n, h) => n + (h.shots?.length || 0), 0),
          gross_score: sc.grossScore ?? d.grossScore, to_par: sc.toPar ?? d.toPar });
        for (const h of sc.holes || []) {
          holes.push({ ...base, tee: sc.teeName, course_hcp: sc.courseHcp, hole: h.holeNumber, par: h.par,
            stroke_index: h.strokeIndex, distance: h.distance, gross_score: h.grossScore, net_score: h.netScore,
            putts: h.putts, gir: h.greenInRegulation, hcp_strokes: h.hcpStrokes });
          for (const s of h.shots || []) shots.push({
            ...base, shot_index: ++idx, hole: h.holeNumber, shot_on_hole: s.shotNumber, club: s.club, shot_time: '',
            bay: '', launch_lie: s.launchLie, final_lie: s.finalLie, shot_result: s.shotResult,
            ...(s.measurement || {}), total: s.measurement?.total ?? s.total,
          });
        }
      } else {
        sessions.push({ ...base, shots: 0, gross_score: '', to_par: '' });
      }
    }
    return { sessions, shots, holes };
  }

  // ---------- 6. CSV og nedlasting ----------
  function toCsv(rows) {
    if (!rows.length) return '';
    const cols = [...rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set())];
    const cell = (v) => {
      if (v === null || v === undefined) return '';
      let s = typeof v === 'number' && DECIMAL_COMMA ? String(v).replace('.', ',') : String(v);
      return /["\n\r]/.test(s) || s.includes(CSV_SEPARATOR) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(CSV_SEPARATOR), ...rows.map((r) => cols.map((c) => cell(r[c])).join(CSV_SEPARATOR))].join('\r\n');
  }
  function download(name, content, type) {
    const blob = new Blob([type.startsWith('text/csv') ? '' + content : content], { type });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  // ---------- 7. Panel i portalen ----------
  document.getElementById('tm-export-panel')?.remove();
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate = (t) => (t ? new Date(t).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const kinds = [...new Set(activities.map((a) => a.kind))].sort();

  const panel = document.createElement('div');
  panel.id = 'tm-export-panel';
  panel.innerHTML = `
    <style>
      #tm-export-panel{position:fixed;top:16px;right:16px;width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 32px);
        display:flex;flex-direction:column;background:#16181d;color:#e8e8ea;border:1px solid #33363d;border-radius:12px;
        box-shadow:0 20px 60px rgba(0,0,0,.5);font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;z-index:2147483647}
      #tm-export-panel header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #33363d}
      #tm-export-panel h2{margin:0;font-size:15px;flex:1}
      #tm-export-panel .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #33363d}
      #tm-export-panel .list{overflow:auto;flex:1}
      #tm-export-panel table{width:100%;border-collapse:collapse}
      #tm-export-panel td,#tm-export-panel th{padding:6px 10px;text-align:left;border-bottom:1px solid #26292f;white-space:nowrap}
      #tm-export-panel th{position:sticky;top:0;background:#1d2026;font-weight:600}
      #tm-export-panel tr:hover td{background:#1d2026}
      #tm-export-panel button,#tm-export-panel select{background:#262a31;color:#e8e8ea;border:1px solid #3a3e46;border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}
      #tm-export-panel button.primary{background:#e8662a;border-color:#e8662a;color:#fff}
      #tm-export-panel button:disabled{opacity:.5;cursor:default}
      #tm-export-panel footer{padding:10px 16px;border-top:1px solid #33363d;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      #tm-export-panel .status{flex-basis:100%;color:#a0a3aa}
    </style>
    <header><h2>Trackman-eksport · ${activities.length} aktiviteter</h2><button data-close>Lukk</button></header>
    <div class="bar">
      <select data-kind><option value="">Alle typer</option>${kinds.map((k) => `<option>${esc(k)}</option>`).join('')}</select>
      <button data-all>Velg alle synlige</button><button data-none>Fjern valg</button>
      <span data-count></span>
    </div>
    <div class="list"><table>
      <thead><tr><th></th><th>Dato</th><th>Type</th><th>Sted / bane</th><th>Slag</th></tr></thead>
      <tbody>${activities.map((a) => `
        <tr data-kindrow="${esc(a.kind)}"><td><input type="checkbox" value="${esc(a.id)}"></td>
        <td>${esc(fmtDate(a.time))}</td><td>${esc(a.kind)}</td><td>${esc(place(a))}</td><td>${esc(shotCount(a))}</td></tr>`).join('')}
      </tbody></table></div>
    <footer>
      <button class="primary" data-dl="shots">Slag (CSV)</button>
      <button data-dl="sessions">Økter (CSV)</button>
      <button data-dl="holes">Hull for hull (CSV)</button>
      <button data-dl="json">Rådata (JSON)</button>
      <div class="status" data-status>Velg økter og trykk på en nedlastingsknapp.</div>
    </footer>`;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const boxes = () => [...panel.querySelectorAll('tbody input[type=checkbox]')];
  const visible = (cb) => cb.closest('tr').style.display !== 'none';
  const status = (msg) => { $('[data-status]').textContent = msg; };
  const updateCount = () => { $('[data-count]').textContent = `${boxes().filter((b) => b.checked).length} valgt`; };

  $('[data-close]').onclick = () => panel.remove();
  $('[data-kind]').onchange = (e) => {
    panel.querySelectorAll('tbody tr').forEach((tr) => { tr.style.display = !e.target.value || tr.dataset.kindrow === e.target.value ? '' : 'none'; });
  };
  $('[data-all]').onclick = () => { boxes().forEach((b) => { if (visible(b)) b.checked = true; }); updateCount(); };
  $('[data-none]').onclick = () => { boxes().forEach((b) => { b.checked = false; }); updateCount(); };
  panel.querySelector('tbody').onchange = updateCount;
  updateCount();

  panel.querySelectorAll('[data-dl]').forEach((btn) => {
    btn.onclick = async () => {
      const ids = boxes().filter((b) => b.checked).map((b) => b.value);
      if (!ids.length) return status('Velg minst én økt først.');
      const buttons = [...panel.querySelectorAll('button')];
      buttons.forEach((b) => { b.disabled = true; });
      try {
        const details = await fetchDetails(ids, (n, total) => status(`Henter økter... ${n}/${total}`));
        const kind = btn.dataset.dl;
        if (kind === 'json') {
          download(`trackman-raadata-${stamp()}.json`, JSON.stringify(details, null, 2), 'application/json');
          status(`Lastet ned rådata for ${details.length} økter.`);
        } else {
          const rows = buildTables(details)[kind];
          if (!rows.length) { status(kind === 'holes' ? 'Ingen baneruter blant de valgte øktene.' : 'Fant ingen slagdata i de valgte øktene.'); return; }
          const name = { shots: 'slag', sessions: 'okter', holes: 'hull' }[kind];
          download(`trackman-${name}-${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
          status(`Lastet ned ${rows.length} rader fra ${details.length} økter.`);
        }
      } catch (e) {
        console.error(e);
        status('Feil: ' + e.message);
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    };
  });

  log('Panelet er åpent øverst til høyre i portalen.');
})();
