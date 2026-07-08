/* ═══════════════════════════════════════════════════════════
   STORAGE — thin, safe wrappers around localStorage.
   Every app namespaces its own keys (e.g. "bp_wt", "fin_tx").
   ═══════════════════════════════════════════════════════════ */

export function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Local-date YYYY-MM-DD (NOT toISOString, which returns UTC and rolls a day
// ahead of local time in western timezones after ~4-5pm).
export const dateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayStr = () => dateStr();
