/* ═══════════════════════════════════════════════════════════
   SHELL — app registry + router + settings/backup.

   Each app is a self-contained module that default-exports:
     { id, name, icon, styles?, soon?, mount(root), unmount?() }

   To add a new app: import it and drop it into the APPS array.
   ═══════════════════════════════════════════════════════════ */

import workout from '../../apps/workout/index.js';
import finance from '../../apps/finance/index.js';
import { toast } from './ui.js';
import { THEMES, getTheme, setTheme, applyTheme } from './theme.js';

// Scripture is parked in archive/ for now — to bring it back, move
// archive/apps/scripture and archive/assets/data back to their old paths,
// then import it here and add it to APPS.
const APPS = [workout, finance];
const ACTIVE_KEY = 'bartleby_active_app';
// Each app declares its own storage prefix, so a new app joins the backup
// and the storage breakdown by existing rather than by being listed twice.
// bs_ carries suite-level settings (theme) and belongs to no app.
const SUITE_PREFIX = 'bs_';
const OWNERS = [
  ...APPS.filter(a => a.storagePrefix).map(a => ({ p: a.storagePrefix, name: a.name })),
  { p: SUITE_PREFIX, name: 'Settings' },
];
const BACKUP_PREFIXES = OWNERS.map(o => o.p);
const STORAGE_BUDGET = 5 * 1024 * 1024;       // ~5 MB typical localStorage cap

const root = document.getElementById('app-root');
const nav = document.getElementById('app-nav');
const loadedStyles = new Set();
/* Where each app was scrolled to when you last left it. Switching away to
   check something else and coming back to the top of a long program list
   loses your place, so the shell holds the position instead. */
const scrollPos = new Map();
let current = null;

/* ── styles ── */
function loadStyles(href) {
  if (!href || loadedStyles.has(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedStyles.add(href);
}

/* ── nav ── */
function renderNav() {
  /* The label is hidden on the mobile top bar, so the title carries the
     name for a long-press and for screen readers. */
  nav.innerHTML = APPS.map(app => `
    <button class="app-btn" data-app="${app.id}" title="${app.name}" aria-label="${app.name}">
      <span class="app-ico">${app.icon || ''}</span>
      <span class="app-lbl">${app.name}</span>
      ${app.soon ? '<span class="app-soon">Soon</span>' : ''}
    </button>`).join('');
  nav.querySelectorAll('.app-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTo(btn.dataset.app)));
}

function switchTo(id) {
  const app = APPS.find(a => a.id === id) || APPS[0];
  if (current && current.id === app.id) return;

  if (current) {
    scrollPos.set(current.id, window.scrollY);
    if (typeof current.unmount === 'function') {
      try { current.unmount(); } catch (e) { console.error(e); }
    }
  }
  root.innerHTML = '';

  loadStyles(app.styles);
  current = app;
  app.mount(root);

  /* Restore twice on purpose. Reading scrollHeight forces layout, so the
     page has its real height back and the first jump lands correctly even
     in a hidden tab, where requestAnimationFrame never fires. The frame
     afterwards corrects for a stylesheet still arriving on a first visit.
     `instant` overrides the global scroll-behavior:smooth — returning to
     a position should look like you never left, not like a ride down. */
  const y = scrollPos.get(app.id) || 0;
  const jump = () => window.scrollTo({ top: y, behavior: 'instant' });
  void document.documentElement.scrollHeight;
  jump();
  requestAnimationFrame(jump);

  nav.querySelectorAll('.app-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.app === app.id));
  save(ACTIVE_KEY, app.id);
  if (location.hash.slice(1) !== app.id) history.replaceState(null, '', '#' + app.id);
}

function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function loadActive() {
  const fromHash = location.hash.slice(1);
  if (APPS.some(a => a.id === fromHash)) return fromHash;
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_KEY));
    if (APPS.some(a => a.id === stored)) return stored;
  } catch {}
  return APPS[0].id;
}

/* ═══════════════════ SETTINGS / BACKUP ═══════════════════ */
const isBackupKey = k => BACKUP_PREFIXES.some(p => k.startsWith(p));

/* Storage split by whoever owns it. "On-device storage: 2.9 KB" says you
   are fine but not what is costing you anything, which is the only useful
   thing to know when you are near the cap. Anything matching no prefix
   (the remembered active app, say) lands in Other. */
function usageBreakdown() {
  const groups = OWNERS.map(o => ({ ...o, bytes: 0, keys: [] }));
  const other = { p: null, name: 'Other', bytes: 0, keys: [] };
  let total = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const n = k.length + (localStorage.getItem(k) || '').length;
    total += n;
    (groups.find(g => k.startsWith(g.p)) || other).bytes += n;
    (groups.find(g => k.startsWith(g.p)) || other).keys.push({ k, n });
  }

  const rows = [...groups, other]
    .filter(g => g.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  rows.forEach(r => r.keys.sort((a, b) => b.n - a.n));
  return { rows, total };
}

const fmtBytes = n => n < 1024 ? `${n} B`
                  : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB`
                  : `${(n / 1024 / 1024).toFixed(2)} MB`;

/* Fixed hues rather than theme accents: these are labels, and a legend
   that changes meaning with the palette is not a legend. */
const OWNER_COLOR = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#f472b6', '#64748b'];

function buildSettings() {
  const el = document.createElement('div');
  el.className = 'sx-overlay';
  el.id = 'sx-ol';
  el.innerHTML = `
    <div class="sx-card">
      <div class="sx-head"><div class="sx-title">Settings</div><button class="sx-close" data-sx="close">&times;</button></div>
      <div class="sx-body">
        <div class="sx-sec-lbl">Theme</div>
        <div class="sx-themes" id="sx-themes"></div>

        <div class="sx-sec-lbl mt">Equipment</div>
        <div class="sx-eq" id="sx-eq"></div>

        <div class="sx-sec-lbl mt">Data &amp; Backup</div>
        <div class="sx-usage">
          <div class="sx-usage-top"><span>On-device storage</span><span id="sx-usage-txt"></span></div>
          <div class="sx-bar" id="sx-bar"></div>
          <div class="sx-legend" id="sx-legend"></div>
          <div class="sx-hint">All your data lives only in this browser. Export a backup file before switching phones or browsers, then import it on the new one to restore everything.</div>
        </div>
        <div class="sx-actions">
          <button class="sx-btn pri" data-sx="export">Export Backup</button>
          <button class="sx-btn" data-sx="import">Import Backup</button>
        </div>
        <input type="file" id="sx-file" accept="application/json,.json" hidden>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => {
    if (e.target === el) { closeSettings(); return; }
    const btn = e.target.closest('[data-sx]');
    const act = btn?.dataset.sx;
    if (act === 'close') closeSettings();
    else if (act === 'export') exportBackup();
    else if (act === 'import') el.querySelector('#sx-file').click();
    else if (act === 'theme') pickTheme(btn.dataset.t);
    else if (act === 'eq') pickEquip(btn.dataset.id, btn.dataset.v === '1');
  });
  el.querySelector('#sx-file').addEventListener('change', importBackup);
  return el;
}

/* ── theme + equipment settings ── */
function pickTheme(id) {
  if (id === getTheme()) return;
  setTheme(id);
  syncSettings();
  broadcast();                       // apps re-render: some bake colours into SVG
  toast(`${THEMES.find(t => t.id === id)?.name || id} theme`);
}

/* One entry per piece of optional kit the workout program can do without.
   The keys pair with `req` in apps/workout/data.js — an exercise naming a
   `req` that is off resolves to its `alt`. Read straight out of storage
   rather than imported from the app: the shell owns the setting, and it
   must not pull an app module in just to paint a toggle. Adding kit here
   plus a `req` there is the whole job.

   Both default ON, so the program reads as written for a first-time visitor
   and turning a toggle off is what changes it — not the other way round. */
const EQUIP = [
  { id:'bar', key:'bp_bar', name:'Pull-Up Bar', on:'Have One', off:'No Bar',
    subOn:'Pull-Ups, Chin-Ups, Scap Pulls & Leg Raises need one.',
    subOff:'Swapped to dumbbell & bench alternatives.',
    toastOn:'Pull-up bar exercises on', toastOff:'Swapped to no-bar alternatives' },
  { id:'wheel', key:'bp_wheel', name:'Ab Wheel', on:'Have One', off:'No Wheel',
    subOn:"Saturday's rollouts need one.",
    subOff:'Swapped back to the hollow body hold.',
    toastOn:'Ab wheel rollouts on', toastOff:'Swapped to the hollow body hold' },
];
const eqOn = k => { try { return JSON.parse(localStorage.getItem(k)) ?? true; } catch { return true; } };

function pickEquip(id, v) {
  const eq = EQUIP.find(e => e.id === id);
  if (!eq || v === eqOn(eq.key)) return;
  localStorage.setItem(eq.key, JSON.stringify(v));
  syncSettings();
  broadcast();
  toast(v ? eq.toastOn : eq.toastOff);
}

/* Tell the mounted app that shared state changed. */
const broadcast = () => window.dispatchEvent(new CustomEvent('bs:datachange'));

/* Paint the current values into an already-built settings modal. */
function syncSettings() {
  const el = document.getElementById('sx-ol');
  if (!el) return;
  const active = getTheme();
  el.querySelector('#sx-themes').innerHTML = THEMES.map(t => `
    <button class="sx-theme ${t.id === active ? 'sel' : ''}" data-sx="theme" data-t="${t.id}">
      <span class="sx-sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="sx-theme-txt"><b>${t.name}</b><em>${t.desc}</em></span>
      <span class="sx-tick"></span>
    </button>`).join('');

  el.querySelector('#sx-eq').innerHTML = EQUIP.map(eq => {
    const on = eqOn(eq.key);
    return `
    <div class="sx-row">
      <div class="sx-row-l">
        <div class="sx-row-t">${eq.name}</div>
        <div class="sx-row-s">${on ? eq.subOn : eq.subOff}</div>
      </div>
      <div class="sx-seg">
        <button class="sx-seg-btn ${on ? 'sel' : ''}" data-sx="eq" data-id="${eq.id}" data-v="1">${eq.on}</button>
        <button class="sx-seg-btn ${on ? '' : 'sel'}" data-sx="eq" data-id="${eq.id}" data-v="0">${eq.off}</button>
      </div>
    </div>`;
  }).join('');
}

function openSettings() {
  const el = document.getElementById('sx-ol') || buildSettings();
  const { rows, total } = usageBreakdown();

  el.querySelector('#sx-usage-txt').textContent = `${fmtBytes(total)} of ~5 MB`;

  /* One segment per owner, each scaled against the 5 MB cap so the bar
     keeps meaning what it meant before — the share of what's left. */
  el.querySelector('#sx-bar').innerHTML = rows.map((r, i) => {
    const pct = Math.min(100, (r.bytes / STORAGE_BUDGET) * 100);
    return `<div class="sx-bar-fill" style="width:${Math.max(pct, 0.4)}%;background:${OWNER_COLOR[i % OWNER_COLOR.length]}"
                 title="${r.name} · ${fmtBytes(r.bytes)}"></div>`;
  }).join('') || '<div class="sx-bar-fill" style="width:0"></div>';

  el.querySelector('#sx-legend').innerHTML = rows.length ? rows.map((r, i) => `
    <div class="sx-leg">
      <span class="sx-leg-d" style="background:${OWNER_COLOR[i % OWNER_COLOR.length]}"></span>
      <span class="sx-leg-n">${r.name}</span>
      <span class="sx-leg-k">${r.keys.length} key${r.keys.length === 1 ? '' : 's'}</span>
      <span class="sx-leg-v">${fmtBytes(r.bytes)}</span>
      <span class="sx-leg-p">${total ? Math.round((r.bytes / total) * 100) : 0}%</span>
    </div>`).join('') : '<div class="sx-leg empty">Nothing stored yet.</div>';

  syncSettings();
  el.classList.add('on');
}
function closeSettings() { document.getElementById('sx-ol')?.classList.remove('on'); }

function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isBackupKey(k)) data[k] = localStorage.getItem(k);
  }
  const payload = { app: 'bartleby-software', version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bartleby-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Backup exported');
}

function importBackup(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try { payload = JSON.parse(reader.result); } catch { toast('Not a valid backup file'); return; }
    if (!payload || typeof payload.data !== 'object') { toast('Not a Bartleby backup'); return; }
    const keys = Object.keys(payload.data).filter(isBackupKey);
    if (!keys.length) { toast('Backup has no data'); return; }
    const when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : 'unknown date';
    if (!confirm(`Import backup from ${when}?\n\nThis replaces all current workout and finance data on this device.`)) return;
    keys.forEach(k => localStorage.setItem(k, payload.data[k]));
    toast('Backup imported — reloading');
    setTimeout(() => location.reload(), 600);
  };
  reader.readAsText(file);
}

document.getElementById('settings-btn')?.addEventListener('click', openSettings);

/* ── boot ── */
applyTheme(getTheme());
renderNav();
// Preload every app's stylesheet up front so switching tabs never flashes
// unstyled markup (the CSS is already applied before mount() injects HTML).
APPS.forEach(app => loadStyles(app.styles));
switchTo(loadActive());

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (APPS.some(a => a.id === id)) switchTo(id);
});
