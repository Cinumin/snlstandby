importScripts('util.js');
const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function schedule() {
  const { showDate } = await chrome.storage.local.get('showDate');
  await chrome.alarms.clearAll();
  if (!showDate) return;
  const open = standbyOpenEpoch(showDate);
  const now = Date.now();
  if (open - 5 * 60e3 > now) chrome.alarms.create('pre', { when: open - 5 * 60e3 });
  if (open - 2 * 60e3 > now) chrome.alarms.create('go', { when: open - 2 * 60e3 });
  else if (open + 10 * 60e3 > now) openStandbyTab(); // already inside the window
}

async function openStandbyTab() {
  const { url } = await chrome.storage.local.get('url');
  if (!url) return;
  const tab = await chrome.tabs.create({ url, active: true });
  await arm(tab.id);
}
async function arm(tabId) {
  const { armed = [] } = await chrome.storage.session.get('armed');
  await chrome.storage.session.set({ armed: [...new Set([...armed, tabId])] });
}
function inject(tabId) {
  return chrome.scripting.executeScript({ target: { tabId }, files: ['util.js', 'content.js'] });
}

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'pre') {
    chrome.notifications.create({ type: 'basic', iconUrl: ICON, title: 'SNL standby opens in 5 min',
      message: 'Opening the page in ~3 minutes. Get ready!', priority: 2 });
  }
  if (a.name === 'go') openStandbyTab();
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const { armed = [] } = await chrome.storage.session.get('armed');
  if (armed.includes(tabId)) inject(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'schedule') schedule();
  if (msg.type === 'injectHere') {            // manual mode: run on the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) { await arm(tab.id); inject(tab.id).catch(() => {}); }
  }
});
