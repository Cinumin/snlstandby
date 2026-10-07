const ids = ['first', 'last', 'email', 'party', 'showDate', 'session', 'url'];
const $ = id => document.getElementById(id);
const ORIGINS = ['https://snlstandby.nbcuni.com/*', 'https://pro.vow.app/*', 'https://*.qudini.com/*'];

function nextSaturday() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
function info() {
  if (!$('showDate').value) return;
  const open = new Date(standbyOpenEpoch($('showDate').value));
  $('info').textContent = 'Standby opens: ' + open.toLocaleString([], { dateStyle: 'full', timeStyle: 'long' }) +
    '. Alert at -5 min; page opens at -2 min.';
}
function collect() {
  const d = Object.fromEntries(ids.map(id => [id, $(id).value.trim()]));
  d.autoAdvance = $('autoAdvance').checked;
  return d;
}
(async () => {
  const s = await chrome.storage.local.get([...ids, 'autoAdvance']);
  ids.forEach(id => { if (s[id]) $(id).value = s[id]; });
  if (s.session === 'both') $('session').value = 'dress';
  $('autoAdvance').checked = s.autoAdvance !== false;
  if (!$('showDate').value) $('showDate').value = nextSaturday();
  if (!$('url').value) $('url').value = 'https://snlstandby.nbcuni.com/';
  info();
})();
$('showDate').addEventListener('change', info);

$('save').onclick = async () => {
  const data = collect();
  data.armedUntil = standbyOpenEpoch(data.showDate) + 60 * 60e3;   // active until 1h after opening
  await chrome.storage.local.set(data);
  try {
    const u = new URL(data.url);
    await chrome.permissions.request({ origins: [...ORIGINS, `${u.protocol}//${u.hostname}/*`] });
  } catch { $('info').textContent = 'Enter a valid URL.'; return; }
  chrome.runtime.sendMessage({ type: 'schedule' });
  info(); $('info').textContent += ' ✔ Armed.';
};
$('here').onclick = async () => {
  const data = collect();
  data.armedUntil = Date.now() + 60 * 60e3;
  await chrome.storage.local.set(data);
  chrome.runtime.sendMessage({ type: 'injectHere' });
  window.close();
};
