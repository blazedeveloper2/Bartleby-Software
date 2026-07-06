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

export const todayStr = () => new Date().toISOString().slice(0, 10);
