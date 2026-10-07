importScripts('util.js');
const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const KNOWN = ['https://snlstandby.nbcuni.com/*', 'https://pro.vow.app/*', 'https://*.qudini.com/*'];

async function registerScripts() {
  const { url } = await chrome.storage.local.get('url');
  const patterns = [...KNOWN];
  try { const u = new URL(url); patterns.push(`${u.protocol}//${u.hostname}/*`); } catch {}
  const ok = [];
  for (const p of [...new Set(patterns)]) {
    if (await chrome.permissions.contains({ origins: [p] })) ok.push(p);
  }
  try { await chrome.scripting.unregisterContentScripts({ ids: ['snl'] }); } catch {}
  if (!ok.length) return;
  try {
    await chrome.scripting.registerContentScripts([{
      id: 'snl', matches: ok, js: ['util.js', 'content.js'],
      allFrames: true, runAt: 'document_idle', persistAcrossSessions: true
    }]);
  } catch (e) { console.warn('register failed', e); }
}

async function schedule() {
  const { showDate } = await chrome.storage.local.get('showDate');
  await chrome.alarms.clearAll();
  await registerScripts();
  if (!showDate) return;
  const open = standbyOpenEpoch(showDate);
  const now = Date.now();
  if (open - 5 * 60e3 > now) chrome.alarms.create('pre', { when: open - 5 * 60e3 });
  if (open - 2 * 60e3 > now) chrome.alarms.create('go', { when: open - 2 * 60e3 });
  else if (open + 10 * 60e3 > now) openStandbyTab();
}

async function openStandbyTab() {
  const { url } = await chrome.storage.local.get('url');
  if (url) chrome.tabs.create({ url, active: true });
}

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'pre') {
    chrome.notifications.create({ type: 'basic', iconUrl: ICON, title: 'SNL standby opens in 5 min',
      message: 'Opening the page in ~3 minutes. Get ready!', priority: 2 });
  }
  if (a.name === 'go') openStandbyTab();
});

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'schedule') schedule();
  if (msg.type === 'injectHere') {            // manual mode: run on the current tab now
    await registerScripts();                  // so later page loads / redirects are covered
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['util.js', 'content.js'] }).catch(() => {});
  }
});
