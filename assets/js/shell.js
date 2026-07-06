/* ═══════════════════════════════════════════════════════════
   SHELL — app registry + router.

   Each app is a self-contained module that default-exports:
     { id, name, icon, styles?, soon?, mount(root), unmount?() }

   To add a new app: import it and drop it into the APPS array.
   Nothing else in the shell needs to change.
   ═══════════════════════════════════════════════════════════ */

import workout from '../../apps/workout/index.js';
import finance from '../../apps/finance/index.js';

const APPS = [workout, finance];
const ACTIVE_KEY = 'bartleby_active_app';

const root = document.getElementById('app-root');
const nav = document.getElementById('app-nav');
const loadedStyles = new Set();
let current = null;

/* Inject an app's stylesheet once, on first use. */
function loadStyles(href) {
  if (!href || loadedStyles.has(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedStyles.add(href);
}

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

  // Tear down the outgoing app.
  if (current && typeof current.unmount === 'function') {
    try { current.unmount(); } catch (e) { console.error(e); }
  }
  root.innerHTML = '';
  window.scrollTo(0, 0);

  // Bring up the incoming app.
  loadStyles(app.styles);
  current = app;
  app.mount(root);

  // Reflect state in nav + URL + storage.
  nav.querySelectorAll('.app-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.app === app.id));
  save(ACTIVE_KEY, app.id);
  if (location.hash.slice(1) !== app.id) {
    history.replaceState(null, '', '#' + app.id);
  }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function loadActive() {
  const fromHash = location.hash.slice(1);
  if (APPS.some(a => a.id === fromHash)) return fromHash;
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_KEY));
    if (APPS.some(a => a.id === stored)) return stored;
  } catch {}
  return APPS[0].id;
}

renderNav();
switchTo(loadActive());

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (APPS.some(a => a.id === id)) switchTo(id);
});
