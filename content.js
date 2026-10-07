(async () => {
  if (window.__snlHelper) return;
  window.__snlHelper = true;

  const s = await chrome.storage.local.get(['first', 'last', 'email', 'party', 'showDate', 'session']);
  if (!s.showDate) return;
  const openAt = standbyOpenEpoch(s.showDate);

  // Sync to the server clock (Date header, ~1s resolution)
  let off = 0;
  try {
    const t0 = Date.now();
    const r = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
    const h = r.headers.get('date');
    if (h) off = new Date(h).getTime() - (t0 + Date.now()) / 2;
  } catch {}
  const now = () => Date.now() + off;

  // Banner
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#fff;font:600 16px system-ui;padding:10px;text-align:center';
  document.documentElement.appendChild(bar);

  const visible = el => el.offsetParent !== null || el.type === 'hidden' ? el.offsetParent !== null : false;
  const labelOf = el => [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete,
    el.labels && el.labels[0] ? el.labels[0].innerText : '', el.closest('label') ? el.closest('label').innerText : ''
  ].join(' ').toLowerCase();

  function setVal(el, v) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function pickOption(sel, test) {
    const o = [...sel.options].find(o => test((o.text + ' ' + o.value).toLowerCase()));
    if (o) { setVal(sel, o.value); return true; }
    return false;
  }

  const wantDress = s.session === 'dress' || s.session === 'both';
  const wantLive = s.session === 'live' || s.session === 'both';
  const isDress = t => /dress|8\s?:?(00)?\s?pm/.test(t);
  const isLive = t => /live|11\s?:?30/.test(t);

  function formPresent() {
    return [...document.querySelectorAll('input')].some(i => (i.type === 'email' || /e-?mail/.test(labelOf(i))) && i.offsetParent !== null);
  }

  function fill() {
    const fields = [...document.querySelectorAll('input,select,textarea')].filter(e => e.offsetParent !== null);
    for (const el of fields) {
      const L = labelOf(el), type = (el.type || '').toLowerCase();
      if (['radio', 'checkbox'].includes(type)) {
        const t = L;
        if ((isDress(t) && wantDress) || (isLive(t) && wantLive)) { if (!el.checked) el.click(); }
        continue;
      }
      if (el.tagName === 'SELECT') {
        if (/party|guest|ticket|how many|number|size/.test(L)) pickOption(el, t => t.trim().startsWith(String(s.party)) || t.includes(`${s.party} `));
        else if (el.options.length < 8 && (s.session !== 'both')) pickOption(el, t => (s.session === 'dress' ? isDress(t) : isLive(t)));
        continue;
      }
      if (type === 'email' || /e-?mail/.test(L)) setVal(el, s.email);
      else if (/first|given/.test(L)) setVal(el, s.first);
      else if (/last|sur ?name|family/.test(L)) setVal(el, s.last);
      else if (/party|guest|ticket|how many|size/.test(L) && ['number', 'text', 'tel'].includes(type)) setVal(el, String(s.party));
    }
    const btn = [...document.querySelectorAll('button,input[type=submit],a[role=button]')]
      .find(b => /register|reserve|request|submit|join/i.test(b.innerText || b.value || ''));
    if (btn) { btn.style.outline = '4px solid #ff2d55'; btn.scrollIntoView({ block: 'center' }); btn.focus(); }
    try { // beep
      const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25);
    } catch {}
  }

  let tries = +(sessionStorage.getItem('snlTries') || 0);
  let filled = false, reloadScheduled = false;

  setInterval(() => {
    const ms = openAt - now();
    if (filled) return;
    if (formPresent()) {
      fill(); filled = true;
      bar.style.background = '#0a7d36';
      bar.textContent = 'Autofilled ✔ — check details, then press REGISTER once (duplicates push you to the back).';
      return;
    }
    if (ms > 0) {
      const t = Math.ceil(ms / 1000);
      bar.textContent = `Standby opens in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} — page will auto-refresh at 10:00:00 ET`;
      if (ms < 400 && !reloadScheduled) { reloadScheduled = true; setTimeout(() => location.reload(), Math.max(0, ms)); }
    } else if (tries < 60 && !reloadScheduled) {
      reloadScheduled = true; tries++; sessionStorage.setItem('snlTries', tries);
      bar.textContent = `Open time reached — refreshing (attempt ${tries}/60)…`;
      setTimeout(() => location.reload(), 1500 + Math.random() * 1000);
    } else if (tries >= 60) {
      bar.style.background = '#a00'; bar.textContent = 'Stopped after 60 refreshes. Reload manually or check the link.';
    }
  }, 50);
})();
