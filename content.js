// Walks the SNL standby flow: [pick Dress/Live] -> [group size + Book Standby Reservation] -> [fill form].
// It NEVER presses the final submit button on the form; you do that.
(async () => {
  if (window.__snlHelper) return;
  window.__snlHelper = true;
  const isTop = window === window.top;

  const s = await chrome.storage.local.get(['first', 'last', 'email', 'party', 'showDate', 'session', 'autoAdvance', 'armedUntil']);
  if (!s.showDate || !(s.armedUntil > Date.now())) return;       // only active when armed
  const want = s.session === 'live' ? 'live' : 'dress';
  const auto = s.autoAdvance !== false;
  const testMeta = document.querySelector('meta[name="snl-test-open"]');
  const openAt = testMeta ? +testMeta.content : standbyOpenEpoch(s.showDate);

  let off = 0;
  if (isTop) {
    try {
      const t0 = Date.now();
      const r = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
      const h = r.headers.get('date');
      if (h) off = new Date(h).getTime() - (t0 + Date.now()) / 2;
    } catch {}
  }
  const now = () => Date.now() + off;

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#fff;font:600 15px system-ui;padding:8px;text-align:center';
  if (isTop) document.documentElement.appendChild(bar);
  const say = (t, color) => { bar.textContent = t; if (color) bar.style.background = color; };

  const vis = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const txt = el => (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
  const labelOf = el => [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete,
    el.labels && el.labels[0] ? el.labels[0].innerText : '', el.closest('label') ? el.closest('label').innerText : ''
  ].join(' ').toLowerCase();
  const INTERACTIVE = 'a,button,[role=button],input[type=button],input[type=submit]';

  function findClickable(re, { onlyInteractive = false, not = /^$/ } = {}) {
    const sel = onlyInteractive ? INTERACTIVE : INTERACTIVE + ',label,li,div,span,h1,h2,h3,h4,p';
    const all = [...document.querySelectorAll(sel)].filter(e => vis(e) && re.test(txt(e)) && !not.test(txt(e)) && txt(e).length < 160);
    const inter = all.filter(e => e.matches(INTERACTIVE));
    if (inter.length) return inter[0];
    return all.find(e => !all.some(o => o !== e && e.contains(o)));
  }
  function setVal(el, v) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function setGroupSize() {
    const party = String(s.party || 1);
    const sels = [...document.querySelectorAll('select')].filter(vis);
    const sel = sels.find(e => /group|party|size/.test(labelOf(e) + ' ' + ((e.closest('div') || {}).innerText || '').slice(0, 80).toLowerCase())) || sels[0];
    if (sel) {
      const o = [...sel.options].find(o => o.text.trim() === party || o.value === party);
      if (o) { setVal(sel, o.value); return true; }
    }
    const num = [...document.querySelectorAll('input[type=number]')].filter(vis)[0];
    if (num) { setVal(num, party); return true; }
    return false;
  }
  const emailInput = () => [...document.querySelectorAll('input')].find(i => vis(i) && (i.type === 'email' || /e-?mail/.test(labelOf(i))));

  function fillForm() {
    for (const el of [...document.querySelectorAll('input,select')].filter(vis)) {
      const L = labelOf(el), type = (el.type || '').toLowerCase();
      if (['radio', 'checkbox', 'hidden', 'submit', 'button'].includes(type)) continue;
      if (el.tagName === 'SELECT') continue;               // group size handled below
      if (type === 'email' || /e-?mail/.test(L)) setVal(el, s.email);
      else if (/first|given/.test(L)) setVal(el, s.first);
      else if (/last|sur ?name|family/.test(L)) setVal(el, s.last);
    }
    setGroupSize();
    const btn = findClickable(/^(book|confirm|submit|register|reserve|join|continue|next|complete)/i, { onlyInteractive: true, not: /back|cancel/i });
    if (btn) { btn.style.outline = '4px solid #ff2d55'; btn.scrollIntoView({ block: 'center' }); }
    try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25); } catch {}
  }

  const state = { chose: false, grouped: false, booked: false, filled: false };
  const announce = k => { if (!isTop) try { window.top.postMessage({ snlStep: k }, '*'); } catch {} };
  window.addEventListener('message', e => {
    if (!isTop || !e.data || !e.data.snlStep) return;
    if (e.data.snlStep === 'booked') state.booked = true;
    if (e.data.snlStep === 'form') { state.filled = true; say('Autofilled ✔ — check details, then press the final button ONCE.', '#0a7d36'); }
  });

  function step() {
    if (state.filled) return;
    // Page 3: the form
    if (emailInput()) {
      fillForm(); state.filled = true; state.booked = true; announce('form');
      say('Autofilled ✔ — check details, then press the final button ONCE (re-submitting sends you to the back).', '#0a7d36');
      return;
    }
    const body = document.body ? document.body.innerText : '';
    // Page 2: group size + Book Standby Reservation
    if (/group size/i.test(body)) {
      const book = findClickable(/book.*(standby|reservation)|^book$/i, { onlyInteractive: true });
      if (book) {
        const wrong = want === 'dress' ? (/live show/i.test(body) && !/dress/i.test(body)) : (/dress/i.test(body) && !/live show/i.test(body));
        if (wrong) { say(`This is the ${want === 'dress' ? 'LIVE' : 'DRESS'} page — press Back and pick the right one.`, '#a00'); return; }
        if (!state.grouped) state.grouped = setGroupSize();
        book.style.outline = '4px solid #ff2d55';
        if (auto && now() >= openAt - 300 && !state.booked) {
          state.booked = true; announce('booked'); book.click();
          say('Booking clicked — waiting for the form…', '#0a5');
        } else if (!auto) say('Group size set. Press BOOK STANDBY RESERVATION.', '#0a7d36');
        return;
      }
    }
    // Page 1: pick Dress Rehearsal or Live Show
    if (auto && !state.chose && !emailInput()) {
      const re = want === 'dress' ? /dress/i : /live show|^live/i;
      const card = findClickable(re, { not: /^back$/i });
      if (card) {
        state.chose = true; card.click();
        setTimeout(() => { state.chose = false; }, 3000);   // retry if nothing happened
      }
    }
  }

  let tries = +(sessionStorage.getItem('snlTries') || 0);
  let reloadScheduled = false;
  setInterval(() => {
    step();
    if (!isTop || state.booked || state.filled) return;
    const ms = openAt - now();
    if (ms > 0) {
      const t = Math.ceil(ms / 1000);
      say(`Standby opens in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} — auto-refresh at 10:00:00 ET`, '#111');
      if (ms < 400 && !reloadScheduled) { reloadScheduled = true; setTimeout(() => location.reload(), Math.max(0, ms)); }
    } else if (tries < 60 && !reloadScheduled) {
      reloadScheduled = true; tries++; sessionStorage.setItem('snlTries', tries);
      say(`Open time reached — refreshing (attempt ${tries}/60)…`, '#111');
      setTimeout(() => location.reload(), 3000 + Math.random() * 1000);
    } else if (tries >= 60) say('Stopped after 60 refreshes. Refresh manually.', '#a00');
  }, 100);
})();
