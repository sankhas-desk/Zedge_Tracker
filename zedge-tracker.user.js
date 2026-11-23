// ==UserScript==
// @name         Zedge 28-Day Upload Tracker
// @namespace    https://upload.zedge.net/
// @version      2.1
// @description  100 uploads per 28 days tracker + Zedge earnings since a fixed date (minimal UI)
// @match        https://upload.zedge.net/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const LIMIT = 100, WINDOW = 28, TZ = 'Asia/Colombo';   // Sri Lanka time (UTC+5:30)
  const BASE = Math.floor(LIMIT / WINDOW);                // 3 images per day pace
  const KEY = 'zedgeTracker_v1';                          // same key = your saved data is kept

  // earnings settings
  const EARN_START = '2026-10-18';                        // <- change this to move the earnings start date
  const API = 'https://api-gateway-v2.zedge.net';
  const EARN_REFRESH_MS = 5 * 60 * 1000;
  const EARN_QUERY = `
    query insightsTotalsAsUser($input: InsightInput!) {
      insightsTotalsAsUser(input: $input) {
        revenue { value }
      }
    }`;

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  /* ---------- day helpers (Sri Lanka calendar days) ---------- */
  const dayOf = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });   // YYYY-MM-DD
  const idx = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const strOf = i => new Date(i * 864e5).toISOString().slice(0, 10);

  /* =====================================================================
     EARNINGS: copy the dashboard's own request settings (memory only).
     ===================================================================== */
  let template = null, earnTimer, earnBusy = false;
  const _fetch = W.fetch;

  W.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url);
      if (url && url.startsWith(API)) {
        const src = (init && init.headers) || (input && typeof input !== 'string' && input.headers) || {};
        const h = new Headers(src);
        const headers = {};
        h.forEach((v, k) => { if (k !== 'content-length') headers[k] = v; });
        if (Object.keys(headers).length) {
          template = { headers };
          const cred = (init && init.credentials) || (input && input.credentials);
          const mode = (init && init.mode) || (input && input.mode);
          if (cred) template.credentials = cred;
          if (mode) template.mode = mode;
          scheduleEarn(500);
        }
      }
    } catch (e) {}
    return _fetch.apply(this, arguments);
  };

  function businessId() {
    const m = location.pathname.match(/\/business\/([0-9a-f-]{36})/i);
    return m ? m[1] : null;
  }
  function scheduleEarn(ms) { clearTimeout(earnTimer); earnTimer = setTimeout(updateEarn, ms); }

  let earnEl = null;
  function showEarn(main, sub) {
    if (!earnEl) return;
    earnEl.innerHTML = `
      <span class="zt-earn-val">${main}</span>
      <span class="zt-mut zt-earn-sub">${sub}</span>`;
  }

  async function updateEarn() {
    const id = businessId();
    if (!id) { showEarn('—', 'open your business dashboard'); return; }
    if (!template) { showEarn('…', 'waiting for the page to load'); return; }
    if (earnBusy) return;
    earnBusy = true;
    try {
      const end = dayOf(Date.now());
      const opts = {
        method: 'POST',
        headers: Object.assign({}, template.headers, { 'content-type': 'application/json' }),
        body: JSON.stringify({
          query: EARN_QUERY,
          variables: { input: { businessId: id, start: EARN_START, end } },
        }),
      };
      if (template.credentials) opts.credentials = template.credentials;
      if (template.mode) opts.mode = template.mode;

      const res = await _fetch.call(W, API, opts);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 120)); }
      if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
      const v = json.data && json.data.insightsTotalsAsUser && json.data.insightsTotalsAsUser.revenue.value;
      if (typeof v !== 'number') throw new Error('Unexpected reply: ' + text.slice(0, 120));
      showEarn('$' + v.toFixed(2), `since ${EARN_START}`);
    } catch (e) {
      showEarn('error', String(e.message || e).slice(0, 140));
      console.error('[Zedge earnings]', e);
    } finally {
      earnBusy = false;
    }
  }

  /* =====================================================================
     UPLOAD TRACKER (logic unchanged)
     ===================================================================== */
  const store = {
    get() {
      try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue(KEY, '{}') : (localStorage.getItem(KEY) || '{}');
        const o = JSON.parse(raw);
        return o && typeof o === 'object' ? o : {};
      } catch (e) { return {}; }
    },
    set(v) {
      const s = JSON.stringify(v);
      try { typeof GM_setValue === 'function' ? GM_setValue(KEY, s) : localStorage.setItem(KEY, s); } catch (e) {}
    }
  };
  let entries = store.get();

  function compute() {
    const days = Object.keys(entries).sort();
    if (!days.length) return { started: false };
    const todayS = dayOf(Date.now()), t = idx(todayS);
    const get = i => entries[strOf(i)] || 0;
    const s = idx(days[0]);
    const n = t - s + 1;                       // day number of the period
    const todayCount = get(t);

    if (n <= WINDOW) {
      const used = days.reduce((a, d) => a + entries[d], 0);
      const left = Math.max(0, LIMIT - used);
      const usedBefore = used - todayCount;
      const allowance = n === WINDOW
        ? Math.max(0, LIMIT - usedBefore)
        : Math.max(0, Math.min(LIMIT - usedBefore, BASE * n - usedBefore));
      return { started: true, mode: 'period', n, daysLeft: WINDOW - n, used, left, allowance, todayCount,
               canToday: Math.max(0, Math.min(left, allowance - todayCount)),
               rollingFrom: strOf(s + WINDOW) };
    }

    let used = 0;
    for (let i = t - WINDOW + 1; i <= t; i++) used += get(i);
    const left = Math.max(0, LIMIT - used);
    return { started: true, mode: 'rolling', n, used, left, todayCount,
             canToday: left, allowance: Math.min(LIMIT, left + todayCount),
             freedTomorrow: get(t - WINDOW + 1) };
  }

  /* ---------- UI ---------- */
  function init() {
    const css = document.createElement('style');
    css.textContent = `
      #zt{--bg:rgba(20,22,28,.92);--fg:#f2f3f5;--mut:#8b919e;--line:rgba(255,255,255,.08);--field:rgba(255,255,255,.06);
          --ok:#5eead4;--bad:#fb7185;--gold:#fcd34d;
          position:fixed;right:16px;bottom:16px;z-index:2147483647;width:264px;background:var(--bg);color:var(--fg);
          font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid var(--line);border-radius:16px;
          box-shadow:0 8px 30px rgba(0,0,0,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);overflow:hidden}
      #zt *{box-sizing:border-box;margin:0}
      #zt .zt-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;user-select:none}
      #zt .zt-title{font-weight:600;letter-spacing:.01em}
      #zt .zt-tog{color:var(--mut);font-size:16px;line-height:1}
      #zt .zt-bd{padding:2px 14px 14px}
      #zt .zt-mut{color:var(--mut);font-size:11.5px}
      #zt .zt-earn{display:flex;align-items:baseline;justify-content:space-between;gap:8px;cursor:pointer;padding-bottom:10px}
      #zt .zt-earn-val{font-size:18px;font-weight:600;color:var(--gold)}
      #zt .zt-earn-sub{text-align:right}
      #zt .zt-hero{display:flex;align-items:baseline;gap:8px;padding-top:10px;border-top:1px solid var(--line)}
      #zt .zt-big{font-size:44px;font-weight:700;line-height:1;color:var(--ok);letter-spacing:-.02em}
      #zt .zt-big.zero{color:var(--bad)}
      #zt .zt-bar{height:4px;border-radius:4px;background:var(--field);margin:12px 0 8px;overflow:hidden}
      #zt .zt-bar>i{display:block;height:100%;background:var(--ok);border-radius:4px;transition:width .3s}
      #zt .zt-stats{display:flex;justify-content:space-between}
      #zt .zt-stats b{font-weight:600}
      #zt .zt-form{display:flex;gap:6px;margin-top:12px}
      #zt input{background:var(--field);color:var(--fg);border:1px solid transparent;border-radius:8px;padding:6px 8px;font:inherit;min-width:0;color-scheme:dark}
      #zt input:focus{outline:none;border-color:var(--mut)}
      #zt #zt-n{width:56px}
      #zt #zt-d{flex:1}
      #zt button{background:var(--fg);color:#14161c;border:0;border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer}
      #zt button:hover{opacity:.85}
      #zt details{margin-top:10px}
      #zt summary{cursor:pointer;color:var(--mut);font-size:11.5px;list-style:none}
      #zt summary::-webkit-details-marker{display:none}
      #zt .zt-hist{max-height:110px;overflow:auto;margin-top:6px}
      #zt .zt-hist .r{display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:12px}
      #zt .zt-hist button{background:none;color:var(--mut);padding:0 4px;font-weight:400}
      #zt .zt-hist button:hover{color:var(--bad);opacity:1}
      #zt .zt-reset{background:none!important;color:var(--mut)!important;padding:6px 0!important;font-weight:400!important;font-size:11.5px;margin-top:6px}
      #zt .zt-reset:hover{color:var(--bad)!important}
    `;
    document.head.appendChild(css);

    const box = document.createElement('div');
    box.id = 'zt';
    box.innerHTML = `
      <div class="zt-hd"><span class="zt-title">Zedge Tracker</span><span class="zt-tog" id="zt-tog">–</span></div>
      <div class="zt-bd" id="zt-bd">
        <div class="zt-earn" id="zt-earn" title="Click to refresh earnings"></div>
        <div id="zt-info"></div>
        <div class="zt-form">
          <input id="zt-n" type="number" min="0" max="${LIMIT}" value="0" title="Images uploaded">
          <input id="zt-d" type="date" title="Day of the uploads">
          <button id="zt-go">Add</button>
        </div>
        <details>
          <summary>History</summary>
          <div class="zt-hist" id="zt-hist"></div>
          <button class="zt-reset" id="zt-reset">Reset everything</button>
        </details>
      </div>`;
    document.body.appendChild(box);

    const $ = id => box.querySelector('#' + id);
    const info = $('zt-info'), hist = $('zt-hist'), nIn = $('zt-n'), dIn = $('zt-d');
    earnEl = $('zt-earn');
    earnEl.addEventListener('click', () => updateEarn());
    let lastHtml = '', lastHist = '';

    function setToday() { const t = dayOf(Date.now()); dIn.value = t; dIn.max = t; }
    setToday();

    function render() {
      const c = compute();
      let h;
      if (!c.started) {
        h = `<div class="zt-hero"><span class="zt-big zero">0</span><span class="zt-mut">can upload today</span></div>
             <div class="zt-bar"><i style="width:0%"></i></div>
             <div class="zt-stats zt-mut"><span>0 / ${LIMIT} used</span><span>not started</span></div>
             <div class="zt-mut" style="margin-top:6px">Enter how many images you uploaded today (0 if none) and press Add to begin day 1.</div>`;
      } else {
        const pct = Math.min(100, Math.round(c.used / LIMIT * 100));
        const hero = `<div class="zt-hero"><span class="zt-big ${c.canToday ? '' : 'zero'}">${c.canToday}</span>
                        <span class="zt-mut">can upload today<br>allowance ${c.allowance} · done ${c.todayCount}</span></div>
                      <div class="zt-bar"><i style="width:${pct}%"></i></div>`;
        if (c.mode === 'period') {
          h = hero + `<div class="zt-stats"><span class="zt-mut">Used</span><b>${c.used} / ${LIMIT}</b></div>
             <div class="zt-stats"><span class="zt-mut">Day</span><b>${c.n} of ${WINDOW}</b></div>
             <div class="zt-stats"><span class="zt-mut">Days left</span><b>${c.daysLeft}</b></div>
             <div class="zt-mut" style="margin-top:6px">Unused images carry over. Rolling count starts ${c.rollingFrom}.</div>`;
        } else {
          h = hero + `<div class="zt-stats"><span class="zt-mut">Used (last ${WINDOW} days)</span><b>${c.used} / ${LIMIT}</b></div>
             <div class="zt-stats"><span class="zt-mut">Freed tomorrow</span><b>+${c.freedTomorrow}</b></div>`;
        }
      }
      if (h !== lastHtml) { info.innerHTML = h; lastHtml = h; }

      const hh = Object.keys(entries).sort().reverse().map(d =>
        `<div class="r"><span class="zt-mut">${d}</span><span>${entries[d]}<button data-del="${d}" title="Delete this day">✕</button></span></div>`
      ).join('') || '<div class="zt-mut">No entries yet.</div>';
      if (hh !== lastHist) { hist.innerHTML = hh; lastHist = hh; }
    }

    $('zt-go').onclick = () => {
      const n = parseInt(nIn.value, 10);
      const today = dayOf(Date.now());
      const d = dIn.value || today;
      if (!(n >= 0) || n > LIMIT) { alert('Enter a number between 0 and ' + LIMIT + '.'); return; }
      if (d > today) { alert('The date cannot be in the future.'); return; }
      const c = compute();
      const cap = c.started ? c.left : LIMIT;
      if (n > cap && !confirm('That is more than the ' + cap + ' images you have left. Add it anyway?')) return;
      entries[d] = (entries[d] || 0) + n;
      store.set(entries);
      nIn.value = 0; setToday();
      render();
    };
    hist.addEventListener('click', e => {
      const d = e.target && e.target.getAttribute && e.target.getAttribute('data-del');
      if (d && confirm('Delete the entry for ' + d + '?')) { delete entries[d]; store.set(entries); render(); }
    });
    $('zt-reset').onclick = () => {
      if (confirm('Delete ALL entries and start from zero?')) { entries = {}; store.set(entries); render(); }
    };
    box.querySelector('.zt-hd').onclick = () => {
      const bd = $('zt-bd'), hide = bd.style.display !== 'none';
      bd.style.display = hide ? 'none' : 'block';
      $('zt-tog').textContent = hide ? '+' : '–';
    };

    render();
    showEarn('…', 'loading');
    scheduleEarn(300);

    // refresh around midnight (Sri Lanka time) and re-attach if the site replaces the page body
    setInterval(() => {
      if (!document.body.contains(box)) { document.body.appendChild(box); earnEl = box.querySelector('#zt-earn'); }
      if (dIn.max !== dayOf(Date.now())) setToday();
      render();
    }, 30000);

    setInterval(updateEarn, EARN_REFRESH_MS);

    // the dashboard is a single-page app, so refresh earnings when the URL changes
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) { lastPath = location.pathname; scheduleEarn(500); }
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
