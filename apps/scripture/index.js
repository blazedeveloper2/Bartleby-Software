/* ═══════════════════════════════════════════════════════════
   SCRIPTURE APP
   A memorisation trainer: a library of verses, a spaced-repetition
   review session, and a progress view.

   The review card asks for the verse from memory and only then
   shows it — hints are a ladder you climb deliberately, because a
   verse you read off the screen is a verse you have not learned.
   Scheduling lives in srs.js.
   ═══════════════════════════════════════════════════════════ */

import { PACKS, PACK_INDEX } from './data.js';
import { todayStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';
import {
  vAll, vSave, newVerse, grade, logReview, dueQueue, stats,
  maturity, MATURITY, GRADES, previewInterval, firstLetters, halfHidden,
  addDaysStr, daysBetween, isDue,
} from './srs.js';

/* ── module state ── */
let root = null;
let activeTab = 'review';

/* review session */
let queue = [];            // verse ids, in the order they'll be asked
let qi = 0;                // how far through the queue we are
let revealed = false;
let hint = 0;              // 0 nothing · 1 first letters · 2 half the words
let practice = false;      // drilling ahead of schedule: no rescheduling
let sessionDone = 0;

/* library */
let libFilter = 'all';
let libQuery = '';
let addOpen = false;
let packOpen = null;
let viewId = null, editId = null;

const q = sel => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const byId = id => vAll().find(v => v.id === id);

/* ═══════════════════ REVIEW TAB ═══════════════════ */
function startSession(asPractice = false) {
  const list = vAll();
  practice = asPractice;
  queue = asPractice
    ? list.map(v => v.id)
    : dueQueue(list);
  qi = 0; revealed = false; hint = 0; sessionDone = 0;
  renderReview();
}

const currentId = () => queue[qi];

function reveal() { revealed = true; renderReview(); }
function setHint(n) { hint = n; renderReview(); }

function answer(gi) {
  const list = vAll();
  const i = list.findIndex(v => v.id === currentId());
  if (i < 0) { next(); return; }

  /* Practice runs ahead of schedule, so it drills without touching the
     interval — otherwise an eager evening would push every verse weeks
     out and quietly stop the app asking for them. */
  if (!practice) { grade(list[i], gi); vSave(list); }
  logReview();
  sessionDone++;

  /* "Again" means ask me once more before we're done here */
  if (gi === 0) queue.push(currentId());
  next();
}

function next() {
  qi++; revealed = false; hint = 0;
  renderReview();
}

function cardHTML(v) {
  const m = MATURITY[maturity(v)];
  const body = !revealed
    ? (hint === 0
        ? `<div class="sc-prompt">Say it from memory.</div>`
        : `<div class="sc-verse hint">${esc(hint === 1 ? firstLetters(v.text) : halfHidden(v.text))}</div>`)
    : `<div class="sc-verse">${esc(v.text)}</div>`;

  const hints = revealed ? '' : `<div class="sc-hints">
      <button class="sc-hint ${hint === 1 ? 'on' : ''}" data-act="hint" data-n="${hint === 1 ? 0 : 1}">First letters</button>
      <button class="sc-hint ${hint === 2 ? 'on' : ''}" data-act="hint" data-n="${hint === 2 ? 0 : 2}">Half the words</button>
    </div>`;

  const foot = revealed
    ? `<div class="sc-grades">${GRADES.map(g => `
        <button class="sc-grade" data-act="grade" data-g="${g.g}" style="--gc:var(${g.c})">
          <span class="sc-grade-l">${g.lbl}</span>
          <span class="sc-grade-s">${g.sub}</span>
          <span class="sc-grade-i">${practice ? 'drill' : previewInterval(v, g.g)}</span>
        </button>`).join('')}</div>`
    : `<button class="sc-reveal" data-act="reveal">Reveal</button>`;

  return `<div class="sc-card">
    <div class="sc-card-top">
      <span class="sc-ref">${esc(v.ref)}</span>
      <span class="sc-card-meta"><span class="sc-chip" style="color:var(${m.c})">${m.lbl}</span><span class="sc-tr">${esc(v.tr)}</span></span>
    </div>
    ${body}
    ${hints}
    ${foot}
  </div>`;
}

function renderReview() {
  const p = q('#sp-review'), list = vAll(), s = stats(list);

  if (!list.length) {
    p.innerHTML = `<div class="sc-empty-card">
      <div class="sc-empty-t">Nothing to learn yet</div>
      <div class="sc-empty-b">Add a verse of your own, or start from one of the packs — Foundations is ten verses and a good week's work.</div>
      <button class="sc-btn pri" data-act="go-lib">Open the library</button>
    </div>`;
    return;
  }

  /* mid-session */
  if (qi < queue.length) {
    const v = byId(currentId());
    if (!v) { next(); return; }                       // deleted mid-session
    const pct = Math.round((qi / queue.length) * 100);
    p.innerHTML = `<div class="sc-sess">
        <div class="sc-sess-top">
          <span>${practice ? 'Practice' : 'Review'} · ${qi + 1} of ${queue.length}</span>
          <button class="sc-sess-x" data-act="end">End</button>
        </div>
        <div class="sc-sess-bar"><i style="width:${pct}%"></i></div>
      </div>
      ${cardHTML(v)}`;
    return;
  }

  /* finished, or nothing was due to begin with */
  const done = sessionDone > 0;
  const dueNow = s.due;
  p.innerHTML = `<div class="sc-empty-card">
      <div class="sc-done-mark">${done ? '✓' : '·'}</div>
      <div class="sc-empty-t">${done ? 'Session complete' : dueNow ? `${dueNow} verse${dueNow === 1 ? '' : 's'} ready` : 'Nothing due today'}</div>
      <div class="sc-empty-b">${
        done ? `${sessionDone} review${sessionDone === 1 ? '' : 's'} logged.${dueNow ? ` ${dueNow} still due.` : ' The rest come back on their own schedule.'}`
             : dueNow ? 'Ready when you are.'
             : s.nextDue ? `Next up ${s.nextDueIn <= 1 ? 'tomorrow' : `in ${s.nextDueIn} days`}, ${fmtDay(s.nextDue)}. Reviewing early does not help you remember longer — but you can drill anyway.`
             : 'Add a verse to get started.'}</div>
      <div class="sc-empty-btns">
        ${dueNow ? `<button class="sc-btn pri" data-act="start">${done ? 'Keep going' : 'Start review'}</button>` : ''}
        <button class="sc-btn" data-act="practice">Practice all ${list.length}</button>
      </div>
    </div>
    ${statTiles(s)}`;
}

const fmtDay = ds => new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

function statTiles(s) {
  const tile = (v, l, sub) => `<div class="sc-stat"><div class="sc-stat-v">${v}</div><div class="sc-stat-l">${l}</div><div class="sc-stat-s">${sub || '·'}</div></div>`;
  return `<div class="sc-stats">
    ${tile(s.due, 'Due', s.due ? 'ready now' : 'clear')}
    ${tile(s.total, 'Verses', `${s.known} known`)}
    ${tile(s.streak, s.streak === 1 ? 'Day' : 'Days', s.reviewedToday ? `${s.reviewedToday} today` : 'streak')}
  </div>`;
}

/* ═══════════════════ LIBRARY TAB ═══════════════════ */
const FILTERS = [
  { k:'all',      lbl:'All'      },
  { k:'due',      lbl:'Due'      },
  { k:'new',      lbl:'New'      },
  { k:'learning', lbl:'Learning' },
  { k:'known',    lbl:'Known'    },
];

function libList() {
  const query = libQuery.trim().toLowerCase();
  return vAll().filter(v => {
    if (libFilter === 'due' && !isDue(v)) return false;
    if (['new','learning','known'].includes(libFilter) && maturity(v) !== libFilter) return false;
    if (query && !(v.ref.toLowerCase().includes(query) || v.text.toLowerCase().includes(query))) return false;
    return true;
  }).sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

function dueLabel(v) {
  if (isDue(v)) return { t:'due now', c:'due' };
  const d = daysBetween(todayStr(), v.due);
  return { t: d === 1 ? 'tomorrow' : `in ${d < 30 ? d + 'd' : Math.round(d / 30) + 'mo'}`, c:'' };
}

function renderLib() {
  const p = q('#sp-library'), all = vAll(), rows = libList();

  let h = `<div class="sc-lib-head">
      <input class="sc-search" id="sc-q" placeholder="Search reference or text" value="${esc(libQuery)}" autocomplete="off">
      <button class="sc-btn pri sm" data-act="add-open">${addOpen ? 'Close' : '＋ Verse'}</button>
    </div>`;

  if (addOpen) h += addFormHTML();

  h += `<div class="sc-filters">${FILTERS.map(f => {
    const n = f.k === 'all' ? all.length
            : f.k === 'due' ? all.filter(isDue).length
            : all.filter(v => maturity(v) === f.k).length;
    return `<button class="sc-fil ${f.k === libFilter ? 'on' : ''}" data-act="filter" data-k="${f.k}">${f.lbl}<span>${n}</span></button>`;
  }).join('')}</div>`;

  if (!all.length) {
    h += `<div class="sc-empty">Your library is empty. Add a verse above, or take one of the packs below.</div>`;
  } else if (!rows.length) {
    h += `<div class="sc-empty">Nothing matches that.</div>`;
  } else {
    h += `<div class="sc-card-plain"><div class="sc-list">${rows.map(v => {
      const m = MATURITY[maturity(v)], d = dueLabel(v);
      return `<div class="sc-row" data-act="view" data-id="${v.id}">
        <span class="sc-row-dot" style="background:var(${m.c})"></span>
        <div class="sc-row-b">
          <div class="sc-row-r">${esc(v.ref)}</div>
          <div class="sc-row-t">${esc(v.text.slice(0, 90))}${v.text.length > 90 ? '…' : ''}</div>
        </div>
        <div class="sc-row-m"><span class="sc-row-due ${d.c}">${d.t}</span><span class="sc-row-tr">${esc(v.tr)}</span></div>
      </div>`;
    }).join('')}</div></div>`;
  }

  h += packsHTML();
  p.innerHTML = h;
}

function addFormHTML() {
  const v = editId ? byId(editId) : null;
  return `<div class="sc-form">
    <div class="sc-form-t">${v ? 'Edit verse' : 'New verse'}</div>
    <div class="sc-fld"><label>Reference</label>
      <input class="sc-in" id="sc-ref" placeholder="John 3:16" value="${v ? esc(v.ref) : ''}" autocomplete="off"></div>
    <div class="sc-fld"><label>Text</label>
      <textarea class="sc-in sc-ta" id="sc-text" rows="4" placeholder="Paste or type the verse in whichever translation you are learning.">${v ? esc(v.text) : ''}</textarea></div>
    <div class="sc-fld"><label>Translation</label>
      <input class="sc-in short" id="sc-tr" placeholder="KJV" value="${v ? esc(v.tr) : 'KJV'}" autocomplete="off"></div>
    <div class="sc-form-btns">
      <button class="sc-btn pri" data-act="save-verse">${v ? 'Save changes' : 'Add to library'}</button>
      <button class="sc-btn" data-act="add-close">Cancel</button>
    </div>
  </div>`;
}

function packsHTML() {
  const have = new Set(vAll().map(v => v.ref));
  return `<div class="sc-packs">
    <div class="sc-packs-t">Starter packs <span>King James · public domain</span></div>
    ${PACKS.map(p => {
      const missing = p.v.filter(([ref]) => !have.has(ref)).length;
      const open = packOpen === p.id;
      return `<div class="sc-pack ${open ? 'open' : ''}">
        <div class="sc-pack-top" data-act="pack" data-id="${p.id}">
          <div><div class="sc-pack-n">${p.name}</div><div class="sc-pack-b">${p.blurb}</div></div>
          <div class="sc-pack-r">${missing ? `<span class="sc-pack-c">${missing} new</span>` : `<span class="sc-pack-c done">added</span>`}<span class="sc-pack-x">${open ? '−' : '+'}</span></div>
        </div>
        ${open ? `<div class="sc-pack-body">
          ${p.v.map(([ref, text]) => `<div class="sc-pack-v ${have.has(ref) ? 'have' : ''}">
              <div><div class="sc-pack-vr">${esc(ref)}</div><div class="sc-pack-vt">${esc(text.slice(0, 70))}${text.length > 70 ? '…' : ''}</div></div>
              ${have.has(ref) ? `<span class="sc-pack-tick">✓</span>`
                              : `<button class="sc-pack-add" data-act="add-one" data-ref="${esc(ref)}">Add</button>`}
            </div>`).join('')}
          ${missing ? `<button class="sc-btn pri sm wide" data-act="add-pack" data-id="${p.id}">Add all ${missing}</button>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* ── library actions ── */
function saveVerse() {
  const ref = q('#sc-ref').value.trim();
  const text = q('#sc-text').value.trim();
  const tr = q('#sc-tr').value.trim() || 'KJV';
  if (!ref)  { toast('Give it a reference'); return; }
  if (!text) { toast('Paste the verse text'); return; }

  const list = vAll();
  if (editId) {
    const i = list.findIndex(v => v.id === editId);
    if (i >= 0) list[i] = { ...list[i], ref, text, tr };
    vSave(list);
    editId = null; addOpen = false;
    renderAll(); toast('Saved');
    return;
  }
  if (list.some(v => v.ref.toLowerCase() === ref.toLowerCase())) { toast(`${ref} is already in your library`); return; }
  list.push(newVerse(ref, text, tr));
  vSave(list);
  addOpen = false;
  renderAll(); toast(`Added ${ref}`);
}

function addOne(ref) {
  const entry = PACK_INDEX[ref]; if (!entry) return;
  const list = vAll();
  if (list.some(v => v.ref === ref)) return;
  list.push(newVerse(ref, entry.text, 'KJV', entry.pack));
  vSave(list);
  renderAll(); toast(`Added ${ref}`);
}

function addPack(id) {
  const pack = PACKS.find(p => p.id === id); if (!pack) return;
  const list = vAll(), have = new Set(list.map(v => v.ref));
  let n = 0;
  pack.v.forEach(([ref, text]) => { if (!have.has(ref)) { list.push(newVerse(ref, text, 'KJV', id)); n++; } });
  if (!n) return;
  vSave(list);
  renderAll(); toast(`Added ${n} from ${pack.name}`);
}

function delVerse(id) {
  const v = byId(id); if (!v) return;
  if (!confirm(`Remove ${v.ref} from your library?\n\nIts review history goes with it.`)) return;
  vSave(vAll().filter(x => x.id !== id));
  closeView();
  renderAll(); toast('Removed');
}

function resetVerse(id) {
  const list = vAll(), i = list.findIndex(v => v.id === id);
  if (i < 0) return;
  if (!confirm(`Reset ${list[i].ref} to new?\n\nIt goes back to the start of the schedule.`)) return;
  list[i] = { ...list[i], due: todayStr(), ease: 2.5, interval: 0, reps: 0, lapses: 0, last: null };
  vSave(list);
  renderAll(); paintView(); toast('Reset to new');
}

function editVerse(id) {
  editId = id; addOpen = true; closeView();
  switchTab('library'); renderLib();
  setTimeout(() => q('#sc-ref')?.focus(), 40);
}

/* ═══════════════════ VERSE MODAL ═══════════════════ */
function openView(id) { viewId = id; paintView(); q('#sc-ol').classList.add('on'); }
function closeView() { q('#sc-ol')?.classList.remove('on'); viewId = null; }

function paintView() {
  if (!viewId) return;
  const v = byId(viewId); if (!v) { closeView(); return; }
  const m = MATURITY[maturity(v)], d = dueLabel(v);
  const stat = (l, val) => `<div class="sc-vs"><span>${l}</span><b>${val}</b></div>`;
  q('#sc-ol-body').innerHTML = `
    <div class="sc-modal-head">
      <div><div class="sc-modal-r">${esc(v.ref)}</div>
        <div class="sc-modal-sub"><span class="sc-chip" style="color:var(${m.c})">${m.lbl}</span> · ${esc(v.tr)} · ${d.t}</div></div>
      <button class="sc-x" data-act="close-view">&times;</button>
    </div>
    <div class="sc-modal-text">${esc(v.text)}</div>
    <div class="sc-vstats">
      ${stat('Reviews', v.reps)}
      ${stat('Lapses', v.lapses)}
      ${stat('Interval', v.interval ? (v.interval < 30 ? v.interval + 'd' : Math.round(v.interval / 30) + 'mo') : '—')}
      ${stat('Ease', v.ease.toFixed(2))}
      ${stat('Added', fmtDay(v.added))}
      ${stat('Last seen', v.last ? fmtDay(v.last) : 'never')}
    </div>
    <div class="sc-modal-btns">
      <button class="sc-btn" data-act="edit" data-id="${v.id}">Edit</button>
      <button class="sc-btn" data-act="reset" data-id="${v.id}">Reset</button>
      <button class="sc-btn dang" data-act="del" data-id="${v.id}">Delete</button>
    </div>`;
}

/* ═══════════════════ PROGRESS TAB ═══════════════════ */
const HM_WEEKS = 16;

function heatmapHTML(s) {
  const today = todayStr();
  /* start on the Monday 15 weeks back, so the grid ends on this week */
  const d0 = new Date(today + 'T00:00:00');
  d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7) - 7 * (HM_WEEKS - 1));
  let cells = '';
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < HM_WEEKS; c++) {
      const d = new Date(d0); d.setDate(d.getDate() + c * 7 + r);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const n = s.log[ds] || 0;
      const lvl = !n ? 0 : n < 3 ? 1 : n < 8 ? 2 : n < 15 ? 3 : 4;
      const cls = ds > today ? 'future' : `l${lvl}`;
      cells += `<div class="sc-hm-c ${cls}${ds === today ? ' today' : ''}" title="${fmtDay(ds)}${ds <= today ? ` · ${n} review${n === 1 ? '' : 's'}` : ''}"></div>`;
    }
  }
  return `<div class="sc-card-plain">
    <div class="sc-sec"><span>Consistency</span><span class="sc-sec-n">Last ${HM_WEEKS} weeks</span></div>
    <div class="sc-hm">${cells}</div>
    <div class="sc-hm-key"><span>less</span><i class="sc-hm-c l0"></i><i class="sc-hm-c l1"></i><i class="sc-hm-c l2"></i><i class="sc-hm-c l3"></i><i class="sc-hm-c l4"></i><span>more</span></div>
  </div>`;
}

function upcomingHTML(list) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDaysStr(todayStr(), i);
    days.push({ ds, n: list.filter(v => v.due === ds || (i === 0 && v.due < ds)).length });
  }
  const max = Math.max(1, ...days.map(d => d.n));
  return `<div class="sc-card-plain">
    <div class="sc-sec"><span>Coming up</span><span class="sc-sec-n">Next 7 days</span></div>
    <div class="sc-up">${days.map((d, i) => `
      <div class="sc-up-c">
        <div class="sc-up-bar"><i style="height:${d.n ? Math.max(6, (d.n / max) * 100) : 0}%"></i></div>
        <div class="sc-up-n">${d.n || '·'}</div>
        <div class="sc-up-d">${i === 0 ? 'Today' : new Date(d.ds + 'T00:00:00').toLocaleDateString('en-US', { weekday:'narrow' })}</div>
      </div>`).join('')}</div>
  </div>`;
}

function renderProgress() {
  const p = q('#sp-progress'), list = vAll(), s = stats(list);
  if (!list.length) { p.innerHTML = `<div class="sc-empty">Nothing tracked yet.</div>`; return; }

  const bar = ['known','learning','new'].map(k => {
    const n = s[k]; if (!n) return '';
    return `<i style="flex:${n};background:var(${MATURITY[k].c})" title="${n} ${MATURITY[k].lbl}"></i>`;
  }).join('');

  p.innerHTML = `${statTiles(s)}
    <div class="sc-card-plain">
      <div class="sc-sec"><span>Library</span><span class="sc-sec-n">${s.total} verse${s.total === 1 ? '' : 's'}</span></div>
      <div class="sc-mix">${bar}</div>
      <div class="sc-mix-key">
        ${['known','learning','new'].map(k => `<span><i style="background:var(${MATURITY[k].c})"></i>${MATURITY[k].lbl} ${s[k]}</span>`).join('')}
      </div>
      <div class="sc-note">A verse counts as known once its interval passes three weeks. That is the scheduler's judgement, not a claim about your soul.</div>
    </div>
    ${upcomingHTML(list)}
    ${heatmapHTML(s)}
    <div class="sc-card-plain">
      <div class="sc-sec"><span>Totals</span></div>
      <div class="sc-vstats">
        <div class="sc-vs"><span>Reviews logged</span><b>${s.reviews.toLocaleString('en-US')}</b></div>
        <div class="sc-vs"><span>Current streak</span><b>${s.streak} day${s.streak === 1 ? '' : 's'}</b></div>
        <div class="sc-vs"><span>Reviewed today</span><b>${s.reviewedToday}</b></div>
        <div class="sc-vs"><span>Due right now</span><b>${s.due}</b></div>
      </div>
    </div>`;
}

/* ═══════════════════ TABS + EVENTS ═══════════════════ */
function switchTab(tab) {
  activeTab = tab;
  root.querySelectorAll('.sc .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  root.querySelectorAll('.sc .panel').forEach(p => p.classList.remove('active'));
  q('#sp-' + tab).classList.add('active');
  if (tab === 'review') renderReview();
  if (tab === 'progress') renderProgress();
}

function renderAll() { renderReview(); renderLib(); renderProgress(); }

function onClick(e) {
  if (e.target.classList?.contains('sc-overlay')) { closeView(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const a = el.dataset;
  switch (a.act) {
    case 'tab':        switchTab(a.tab); break;
    case 'start':      startSession(false); break;
    case 'practice':   startSession(true); break;
    case 'end':        queue = []; qi = 0; renderReview(); break;
    case 'reveal':     reveal(); break;
    case 'hint':       setHint(+a.n); break;
    case 'grade':      answer(+a.g); break;
    case 'go-lib':     switchTab('library'); break;
    case 'filter':     libFilter = a.k; renderLib(); break;
    case 'add-open':   addOpen = !addOpen; editId = null; renderLib();
                       if (addOpen) setTimeout(() => q('#sc-ref')?.focus(), 40); break;
    case 'add-close':  addOpen = false; editId = null; renderLib(); break;
    case 'save-verse': saveVerse(); break;
    case 'pack':       packOpen = packOpen === a.id ? null : a.id; renderLib(); break;
    case 'add-one':    addOne(a.ref); break;
    case 'add-pack':   addPack(a.id); break;
    case 'view':       openView(a.id); break;
    case 'close-view': closeView(); break;
    case 'edit':       editVerse(a.id); break;
    case 'del':        delVerse(a.id); break;
    case 'reset':      resetVerse(a.id); break;
  }
}

function onInput(e) {
  if (e.target.id === 'sc-q') {
    libQuery = e.target.value;
    /* repaint only the list, so the field keeps focus and the caret */
    const p = q('#sp-library'), pos = e.target.selectionStart;
    renderLib();
    const again = q('#sc-q'); if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && viewId) { closeView(); return; }
  if (e.key === 'Enter' && e.target.id === 'sc-ref') { e.preventDefault(); q('#sc-text')?.focus(); }
}

/* Settings can wipe or import data underneath us. Drop the session
   entirely rather than leaving it reporting on verses that may no
   longer exist. */
function onExternalChange() {
  if (!root) return;
  queue = []; qi = 0; revealed = false; hint = 0; sessionDone = 0; practice = false;
  viewId = null; closeView();
  renderAll();
}

/* ═══════════════════ TEMPLATE + LIFECYCLE ═══════════════════ */
function template() {
  return `<div class="sc">
    <div class="app-head"><h1>Scripture</h1><p>Memorize · Review · Keep</p></div>
    <nav class="nav"><div class="nav-inner">
      <button class="tab active" data-act="tab" data-tab="review">Review</button>
      <button class="tab" data-act="tab" data-tab="library">Library</button>
      <button class="tab" data-act="tab" data-tab="progress">Progress</button>
    </div></nav>
    <div class="app-wrap">
      <div class="panel active" id="sp-review"></div>
      <div class="panel" id="sp-library"></div>
      <div class="panel" id="sp-progress"></div>
    </div>
    <div class="sc-overlay" id="sc-ol"><div class="sc-modal" id="sc-ol-body"></div></div>
  </div>`;
}

export default {
  id: 'scripture',
  name: 'Scripture',
  styles: 'apps/scripture/scripture.css',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M12 6v7"/><path d="M9.5 8.5h5"/></svg>',
  mount(el) {
    root = el;
    activeTab = 'review'; queue = []; qi = 0; revealed = false; hint = 0;
    practice = false; sessionDone = 0;
    libFilter = 'all'; libQuery = ''; addOpen = false; packOpen = null;
    viewId = null; editId = null;

    root.innerHTML = template();
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeydown);
    window.addEventListener('bs:datachange', onExternalChange);

    renderAll();
    switchTab(activeTab);
  },
  unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('keydown', onKeydown);
    }
    window.removeEventListener('bs:datachange', onExternalChange);
    root = null;
  },
};
