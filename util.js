// Convert an America/New_York wall-clock time to a UTC epoch (ms).
function etToEpoch(y, mo, d, h, mi, s) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
  });
  const p = Object.fromEntries(f.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return guess - (asUTC - guess);
}
// Standby opens 10:00 ET on the Thursday before the Saturday show (show date minus 2 days).
function standbyOpenEpoch(showDateStr) {
  const [y, m, d] = showDateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 2));
  return etToEpoch(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), 10, 0, 0);
}
