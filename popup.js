const ids = ['first', 'last', 'email', 'party', 'showDate', 'session', 'url'];
const $ = id => document.getElementById(id);

function nextSaturday() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
function info() {
  if (!$('showDate').value) return;
  const open = new Date(standbyOpenEpoch($('showDate').value));
  $('info').textContent = 'Standby opens: ' + open.toLocaleString([], { dateStyle: 'full', timeStyle: 'long' }) +
    '. Alerts at -5 min; page opens at -2 min.';
}
(async () => {
  const s = await chrome.storage.local.get(ids);
  ids.forEach(id => { if (s[id]) $(id).value = s[id]; });
  if (!$('showDate').value) $('showDate').value = nextSaturday();
  info();
})();
$('showDate').addEventListener('change', info);

$('save').onclick = async () => {
  const data = Object.fromEntries(ids.map(id => [id, $(id).value.trim()]));
  await chrome.storage.local.set(data);
  try { // permission to run on the standby page's origin
    await chrome.permissions.request({ origins: [new URL(data.url).origin + '/*'] });
  } catch { $('info').textContent = 'Enter a valid https URL.'; return; }
  chrome.runtime.sendMessage({ type: 'schedule' });
  info(); $('info').textContent += ' ✔ Armed.';
};
$('here').onclick = async () => {
  const data = Object.fromEntries(ids.map(id => [id, $(id).value.trim()]));
  await chrome.storage.local.set(data);
  chrome.runtime.sendMessage({ type: 'injectHere' });
  window.close();
};
