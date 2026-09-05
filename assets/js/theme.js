/* ═══════════════════════════════════════════════════════════
   THEME — reads/writes the active theme and applies it to <html>.

   The palettes and per-theme animation sets live in
   assets/css/themes.css. Adding a theme means adding a block there
   and an entry to THEMES below.

   The key is `bs_theme`, which the shell's backup includes (see
   BACKUP_PREFIXES) so your theme travels with your data.
   ═══════════════════════════════════════════════════════════ */

export const THEMES = [
  { id:'arcade', name:'Arcade',    desc:'Orange game-HUD. Glow, sweeps, scanlines.', sw:['#ff7a18','#ffb43f','#150f0a'] },
  { id:'dark',   name:'Midnight',  desc:'The original blue-grey. Calm, no motion.',  sw:['#3b82f6','#8b5cf6','#10121a'] },
  { id:'light',  name:'Daylight',  desc:'Bright paper-white. Calm, no motion.',      sw:['#2563eb','#7c3aed','#ffffff'] },
];

const KEY = 'bs_theme';
export const DEFAULT_THEME = 'arcade';

export function getTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    if (THEMES.some(x => x.id === t)) return t;
  } catch {}
  return DEFAULT_THEME;
}

export function applyTheme(id) {
  const t = THEMES.some(x => x.id === id) ? id : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content',
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0705');
  }
  return t;
}

export function setTheme(id) {
  const t = applyTheme(id);
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {}
  return t;
}
