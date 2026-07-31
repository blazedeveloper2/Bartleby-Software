/* ═══════════════════════════════════════════════════════════
   SHELL — app registry + router + settings/backup.

   Each app is a self-contained module that default-exports:
     { id, name, icon, styles?, soon?, mount(root), unmount?() }

   To add a new app: import it and drop it into the APPS array.
   ═══════════════════════════════════════════════════════════ */

import workout from '../../apps/workout/index.js';
import finance from '../../apps/finance/index.js';
import scripture from '../../apps/scripture/index.js';
import { toast } from './ui.js';
import { THEMES, getTheme, setTheme, applyTheme } from './theme.js';

const APPS = [workout, finance, scripture];
const ACTIVE_KEY = 'bartleby_active_app';
// Prefixes included in a backup. bs_ carries suite-level settings (theme).
// Adding an app means adding its prefix here, or its data silently
// stops travelling with the backup.
const BACKUP_PREFIXES = ['bp_', 'fin_', 'sc_', 'bs_'];
const STORAGE_BUDGET = 5 * 1024 * 1024;       // ~5 MB typical localStorage cap

const root = document.getElementById('app-root');
const nav = document.getElementById('app-nav');
const loadedStyles = new Set();
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
  nav.innerHTML = APPS.map(app => `
    <button class="app-btn" data-app="${app.id}">
      <span class="app-ico">${app.icon || ''}</span>
      <span>${app.name}</span>
      ${app.soon ? '<span class="app-soon">Soon</span>' : ''}
    </button>`).join('');
  nav.querySelectorAll('.app-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTo(btn.dataset.app)));
}

function switchTo(id) {
  const app = APPS.find(a => a.id === id) || APPS[0];
  if (current && current.id === app.id) return;

  if (current && typeof current.unmount === 'function') {
    try { current.unmount(); } catch (e) { console.error(e); }
  }
  root.innerHTML = '';
  window.scrollTo(0, 0);

  loadStyles(app.styles);
  current = app;
  app.mount(root);

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

function usageBytes() {
  let b = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    b += k.length + (localStorage.getItem(k) || '').length;
  }
  return b;
}

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
        <div class="sx-row">
          <div class="sx-row-l">
            <div class="sx-row-t">Pull-Up Bar</div>
            <div class="sx-row-s" id="sx-eq-sub"></div>
          </div>
          <div class="sx-seg" id="sx-eq">
            <button class="sx-seg-btn" data-sx="bar" data-v="1">Have One</button>
            <button class="sx-seg-btn" data-sx="bar" data-v="0">No Bar</button>
          </div>
        </div>

        <div class="sx-sec-lbl mt">Data &amp; Backup</div>
        <div class="sx-usage">
          <div class="sx-usage-top"><span>On-device storage</span><span id="sx-usage-txt"></span></div>
          <div class="sx-bar"><div class="sx-bar-fill" id="sx-bar-fill"></div></div>
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
    else if (act === 'bar') pickBar(btn.dataset.v === '1');
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

const barOn = () => { try { return JSON.parse(localStorage.getItem('bp_bar')) ?? true; } catch { return true; } };
function pickBar(v) {
  if (v === barOn()) return;
  localStorage.setItem('bp_bar', JSON.stringify(v));
  syncSettings();
  broadcast();
  toast(v ? 'Pull-up bar exercises on' : 'Swapped to no-bar alternatives');
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

  const bar = barOn();
  el.querySelector('#sx-eq-sub').textContent = bar
    ? 'Pull-Ups & Hanging Knee Raises need one.'
    : 'Swapped to dumbbell & bench alternatives.';
  el.querySelectorAll('#sx-eq .sx-seg-btn').forEach(b =>
    b.classList.toggle('sel', (b.dataset.v === '1') === bar));
}

function openSettings() {
  const el = document.getElementById('sx-ol') || buildSettings();
  const bytes = usageBytes();
  const kb = bytes / 1024;
  const pct = Math.min(100, (bytes / STORAGE_BUDGET) * 100);
  el.querySelector('#sx-usage-txt').textContent =
    `${kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB'} of ~5 MB`;
  el.querySelector('#sx-bar-fill').style.width = Math.max(pct, 1.5) + '%';
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
