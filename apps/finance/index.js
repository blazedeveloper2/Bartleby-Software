/* ═══════════════════════════════════════════════════════════
   FINANCE APP — expense tracker
   Add (amount · category · custom calendar · note), a filterable
   History with tap-to-view details, and Insights (interactive
   category donut + jump-to-any-month/year + 12-month trend).
   Local-first; event-delegated; mount/unmount.
   ═══════════════════════════════════════════════════════════ */

import { DEFAULT_CATS, PALETTE } from './data.js';
import { load, save, todayStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';

/* ── storage ── */
const txAll    = () => load('fin_tx', []);
const txSave   = l => save('fin_tx', l);
const getCats  = () => [...load('fin_cats', DEFAULT_CATS)].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
const catsSave = l => save('fin_cats', l);

/* ── state ── */
let root = null;
let activeTab = 'add';
let editId = null, viewId = null;
let addingCat = false, managingCats = false, editCat = null;
let selCat = null, newCatColor = PALETTE[0];
let draft = { amt: '', date: '', note: '' };
let calOpen = false, calView = '';
let histMonth = 'all', histCat = 'all';
let insMode = 'month', insMonth = '', insYear = '';
let insPickOpen = false, insPickYear = '';

const q = s => root.querySelector(s);
const curMonth = () => todayStr().slice(0, 7);
const curYear  = () => todayStr().slice(0, 4);

/* ── helpers ── */
const uid = () => (crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(16).slice(2)));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtMoney  = n => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoneyC = n => '$' + Math.round(n || 0).toLocaleString('en-US');
const catColor = name => (getCats().find(c => c.name === name) || {}).color || '#8b92a8';

function fmtDateShort(d) {
  const o = { month: 'short', day: 'numeric' };
  if (d.slice(0, 4) !== curYear()) o.year = 'numeric';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', o);
}
function fmtDateFull(d) {
  const o = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.slice(0, 4) !== curYear()) o.year = 'numeric';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', o);
}
const fmtDateBtn  = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateLong = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function shiftMonth(ym, delta) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
const sum = l => l.reduce((a, t) => a + t.amt, 0);
function byCategory(list) {
  const map = {};
  list.forEach(t => { map[t.cat] = (map[t.cat] || 0) + t.amt; });
  return Object.entries(map).map(([name, amount]) => ({ name, amount, color: catColor(name) })).sort((a, b) => b.amount - a.amount);
}

const CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

/* ═══════════════════ tx row (note primary, category secondary) ═══════════════════ */
function txRow(t) {
  const color = catColor(t.cat);
  const primary = t.note ? esc(t.note) : esc(t.cat);
  const secondary = t.note ? `<div class="tx-sub">${esc(t.cat)}</div>` : '';
  return `<div class="tx-row" data-act="view-tx" data-id="${t.id}">
    <span class="tx-dot" style="background:${color}"></span>
    <div class="tx-body"><div class="tx-cat">${primary}</div>${secondary}</div>
    <div class="tx-meta"><div class="tx-amt">${fmtMoney(t.amt)}</div><div class="tx-date">${fmtDateShort(t.d)}</div></div>
  </div>`;
}

/* ═══════════════════ ADD TAB ═══════════════════ */
function captureDraft() {
  const a = q('#fx-amount'), n = q('#fx-note');
  if (a) draft.amt = a.value;
  if (n) draft.note = n.value;
}
const reRender = () => { captureDraft(); renderAdd(); };

function calGrid(view) {
  const [y, m] = view.split('-').map(Number);
  const startDow = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const sel = draft.date, today = todayStr();
  const head = `<div class="cal-head">
    <button class="cal-nav" data-act="cal-shift" data-d="-12" title="Prev year">«</button>
    <button class="cal-nav" data-act="cal-shift" data-d="-1" title="Prev month">‹</button>
    <div class="cal-title">${monthLabel(view)}</div>
    <button class="cal-nav" data-act="cal-shift" data-d="1" title="Next month">›</button>
    <button class="cal-nav" data-act="cal-shift" data-d="12" title="Next year">»</button>
  </div>`;
  const dows = ['S','M','T','W','T','F','S'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div></div>';
  for (let day = 1; day <= days; day++) {
    const ds = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cls = ['cal-day']; if (ds === sel) cls.push('sel'); if (ds === today) cls.push('today');
    cells += `<button class="${cls.join(' ')}" data-act="cal-pick" data-d="${ds}">${day}</button>`;
  }
  return `<div class="fx-cal">${head}<div class="cal-grid">${dows}</div><div class="cal-grid">${cells}</div><div class="cal-foot"><button class="fx-btn gho" data-act="cal-today">Jump to Today</button></div></div>`;
}

function renderAdd() {
  const cats = getCats();
  const all = txAll();
  const editing = editId !== null;
  const date = draft.date || todayStr();

  const chips = cats.map(c => {
    if (managingCats) {
      const ed = c.name === editCat;
      const st = ed ? `border-color:${c.color};box-shadow:0 0 0 1px ${c.color}` : '';
      return `<button class="fx-cat manage ${ed ? 'sel' : ''}" data-act="edit-cat" data-cat="${esc(c.name)}" style="${st}"><span class="fx-dot" style="background:${c.color}"></span>${esc(c.name)}</button>`;
    }
    const on = c.name === selCat;
    const style = on ? `background:${c.color}26;border-color:${c.color};box-shadow:0 0 0 1px ${c.color}` : '';
    return `<button class="fx-cat ${on ? 'sel' : ''}" data-act="pick-cat" data-cat="${esc(c.name)}" data-color="${c.color}" style="${style}"><span class="fx-dot" style="background:${c.color}"></span>${esc(c.name)}${on ? '<span class="fx-check">✓</span>' : ''}</button>`;
  }).join('');

  const catExtra = managingCats
    ? ''
    : `<button class="fx-cat fx-cat-new" data-act="new-cat-open">＋ New</button>`;

  const newCatBlock = addingCat ? `
    <div class="fx-newcat">
      <input class="fx-newcat-in" id="fx-newcat-in" placeholder="New category name" maxlength="24" autocomplete="off">
      <div class="fx-sw-lbl">Color <span class="fx-opt">— tap the wheel for any color</span></div>
      <div class="fx-sw-row">
        ${PALETTE.map(c => `<button class="fx-sw ${c.toLowerCase() === newCatColor.toLowerCase() ? 'sel' : ''}" data-act="new-cat-color" data-c="${c}" style="background:${c}"></button>`).join('')}
        <span class="fx-color-wrap"><input type="color" class="fx-color" id="fx-color" value="${newCatColor}" title="Pick any color"></span>
      </div>
      <div class="fx-newcat-btns"><button class="fx-btn pri" data-act="new-cat-save">Add Category</button><button class="fx-btn gho" data-act="new-cat-cancel">Cancel</button></div>
    </div>` : '';

  const editCatBlock = (managingCats && editCat && cats.some(c => c.name === editCat)) ? `
    <div class="fx-newcat">
      <input class="fx-newcat-in" id="fx-editcat-in" value="${esc(editCat)}" maxlength="24" autocomplete="off">
      <div class="fx-sw-lbl">Color <span class="fx-opt">— tap the wheel for any color</span></div>
      <div class="fx-sw-row">
        ${PALETTE.map(c => `<button class="fx-sw ${c.toLowerCase() === newCatColor.toLowerCase() ? 'sel' : ''}" data-act="new-cat-color" data-c="${c}" style="background:${c}"></button>`).join('')}
        <span class="fx-color-wrap"><input type="color" class="fx-color" id="fx-color" value="${newCatColor}" title="Pick any color"></span>
      </div>
      <div class="fx-newcat-btns"><button class="fx-btn pri" data-act="editcat-save">Save</button><button class="fx-btn danger" data-act="editcat-del">Delete</button><button class="fx-btn gho" data-act="editcat-cancel">Cancel</button></div>
    </div>` : '';

  const manageHint = (managingCats && !editCat) ? '<div class="fx-manage-hint">Tap a category to rename, recolor, or delete it.</div>' : '';

  const today = all.filter(t => t.d === todayStr());
  const month = all.filter(t => t.d.startsWith(curMonth()));

  let h = `
    <div class="fx-form ${editing ? 'editing' : ''}">
      <div class="fx-form-title"><span>${editing ? 'Edit Expense' : 'New Expense'}</span>${editing ? '<span class="fx-editing-tag">Editing</span>' : ''}</div>
      <div class="fx-amount-wrap"><span class="fx-cur">$</span><input class="fx-amount" id="fx-amount" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${draft.amt}"></div>

      <div class="fx-lbl fx-lbl-row"><span>Category</span><button class="fx-manage" data-act="cat-manage">${managingCats ? 'Done' : 'Manage'}</button></div>
      <div class="fx-cats">${chips}${catExtra}</div>
      ${manageHint}${newCatBlock}${editCatBlock}

      <div class="fx-field fx-field-b"><div class="fx-lbl">Date</div><button class="fx-datebtn ${calOpen ? 'open' : ''}" data-act="cal-toggle"><span>${fmtDateBtn(date)}</span>${CAL_SVG}</button></div>
      ${calOpen ? calGrid(calView) : ''}
      <div class="fx-field fx-field-b"><div class="fx-lbl">Note <span class="fx-opt">(optional)</span></div><textarea class="fx-in fx-note" id="fx-note" rows="1" placeholder="e.g. lunch with Sam — split the bill three ways" maxlength="200">${esc(draft.note)}</textarea></div>

      <div class="fx-actions">
        <button class="fx-btn pri" data-act="save-tx">${editing ? 'Update Expense' : 'Add Expense'}</button>
        ${editing ? '<button class="fx-btn gho" data-act="cancel-edit">Cancel</button>' : ''}
      </div>
    </div>`;

  if (!editing) {
    h += `<div class="fx-stats">
      <div class="fx-stat"><div class="fx-stat-v">${fmtMoneyC(sum(today))}</div><div class="fx-stat-l">Today</div></div>
      <div class="fx-stat accent"><div class="fx-stat-v">${fmtMoneyC(sum(month))}</div><div class="fx-stat-l">This Month</div></div>
      <div class="fx-stat"><div class="fx-stat-v">${month.length}</div><div class="fx-stat-l">Entries</div></div>
    </div>`;

    // Today's expenses
    const todayList = today.slice().reverse();
    h += `<div class="day-card"><div class="day-top"><div class="day-top-l"><span class="day-badge" style="background:var(--green)">Today</span><span class="day-title">${todayList.length} ${todayList.length===1?'Expense':'Expenses'}</span></div>${todayList.length?`<span class="day-prog">${fmtMoneyC(sum(todayList))}</span>`:''}</div>`;
    h += todayList.length ? `<div class="tx-list">${todayList.map(txRow).join('')}</div>` : `<div class="fx-empty" style="padding:26px 16px">Nothing logged today yet.</div>`;
    h += `</div>`;
  }

  q('#fp-add').innerHTML = h;
  sizeNote();
}

function sizeNote() {
  const el = q('#fx-note');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
}

function pickCat(name) {
  selCat = name;
  root.querySelectorAll('.fx-cat[data-cat]').forEach(c => {
    const on = c.dataset.cat === name;
    c.classList.toggle('sel', on);
    c.style.background = on ? c.dataset.color + '26' : '';
    c.style.borderColor = on ? c.dataset.color : '';
    c.style.boxShadow = on ? `0 0 0 1px ${c.dataset.color}` : '';
    const chk = c.querySelector('.fx-check');
    if (on && !chk) c.insertAdjacentHTML('beforeend', '<span class="fx-check">✓</span>');
    if (!on && chk) chk.remove();
  });
}
function openNewCat() { managingCats = false; editCat = null; addingCat = true; reRender(); setTimeout(() => q('#fx-newcat-in')?.focus(), 40); }
function cancelNewCat() { addingCat = false; reRender(); }
function updateNewColor(val) {
  newCatColor = val;
  const w = q('#fx-color'); if (w && w.value.toLowerCase() !== val.toLowerCase()) w.value = val;
  root.querySelectorAll('.fx-sw').forEach(s => s.classList.toggle('sel', (s.dataset.c || '').toLowerCase() === val.toLowerCase()));
}
function saveNewCat() {
  const name = (q('#fx-newcat-in')?.value || '').trim();
  if (!name) { toast('Name the category'); return; }
  const cats = getCats();
  if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('That category exists'); return; }
  cats.push({ name, color: newCatColor });
  catsSave(cats);
  selCat = name; addingCat = false;
  newCatColor = PALETTE[cats.length % PALETTE.length];
  reRender();
  toast(`Added “${name}”`);
}
function openEditCat(name) {
  const c = getCats().find(x => x.name === name); if (!c) return;
  editCat = name; addingCat = false; newCatColor = c.color;
  reRender();
  setTimeout(() => { const el = q('#fx-editcat-in'); if (el) { el.focus(); el.select?.(); } }, 40);
}
function saveEditCat() {
  const oldName = editCat; if (!oldName) return;
  const newName = (q('#fx-editcat-in')?.value || '').trim();
  if (!newName) { toast('Name cannot be empty'); return; }
  const cats = getCats();
  if (newName.toLowerCase() !== oldName.toLowerCase() && cats.some(c => c.name.toLowerCase() === newName.toLowerCase())) { toast('That name already exists'); return; }
  catsSave(cats.map(c => c.name === oldName ? { name: newName, color: newCatColor } : c));
  if (newName !== oldName) {
    txSave(txAll().map(t => t.cat === oldName ? { ...t, cat: newName } : t));  // migrate existing expenses
    if (selCat === oldName) selCat = newName;
    if (histCat === oldName) histCat = newName;
  }
  editCat = null;
  renderAll();
  toast('Category updated');
}
function editCatDelete() {
  const name = editCat; if (!name) return;
  const used = txAll().filter(t => t.cat === name).length;
  const msg = used ? `Delete “${name}”?\n\n${used} expense${used>1?'s':''} use it — those entries keep the label but lose the color.` : `Delete “${name}”?`;
  if (!confirm(msg)) return;
  catsSave(getCats().filter(c => c.name !== name));
  if (selCat === name) selCat = null;
  editCat = null;
  renderAll();
  toast(`Deleted “${name}”`);
}

function saveTx() {
  const val = parseFloat(q('#fx-amount').value);
  if (!selCat) { toast('Pick a category'); return; }
  if (isNaN(val) || val <= 0) { toast('Enter an amount'); return; }
  const date = draft.date || todayStr();
  const note = (q('#fx-note').value || '').trim();

  const list = txAll();
  if (editId) {
    const i = list.findIndex(t => t.id === editId);
    if (i >= 0) list[i] = { ...list[i], d: date, cat: selCat, amt: val, note };
    txSave(list);
    editId = null; calOpen = false; draft = { amt: '', date: todayStr(), note: '' };
    renderAll(); switchTab('history');
    toast('Updated');
  } else {
    list.push({ id: uid(), d: date, cat: selCat, amt: val, note });
    txSave(list);
    calOpen = false; draft = { amt: '', date: todayStr(), note: '' };  // reset to today; keep category for fast repeat
    renderAll();
    toast(`Logged ${fmtMoney(val)}`);
    q('#fx-amount')?.focus();
  }
}

function editTx(id) {
  const t = txAll().find(x => x.id === id); if (!t) return;
  editId = id; selCat = t.cat; addingCat = false; managingCats = false; calOpen = false;
  draft = { amt: String(t.amt), date: t.d, note: t.note || '' };
  switchTab('add'); renderAdd();
  setTimeout(() => q('#fx-amount')?.focus(), 40);
}
function cancelEdit() { editId = null; selCat = null; calOpen = false; draft = { amt: '', date: todayStr(), note: '' }; renderAdd(); }
function delTx(id) {
  const t = txAll().find(x => x.id === id); if (!t) return;
  if (!confirm(`Delete ${fmtMoney(t.amt)} — ${t.cat}?`)) return;
  txSave(txAll().filter(x => x.id !== id));
  if (editId === id) { editId = null; draft = { amt: '', date: todayStr(), note: '' }; }
  renderAll();
  toast('Deleted');
}

/* ═══════════════════ DETAIL MODAL ═══════════════════ */
function viewTx(id) {
  const t = txAll().find(x => x.id === id); if (!t) return;
  viewId = id;
  const color = catColor(t.cat);
  q('#fx-modal-body').innerHTML = `
    <div class="fx-ov-head"><div class="fx-ov-amt">${fmtMoney(t.amt)}</div><button class="mm-close" data-act="modal-close">&times;</button></div>
    <div class="fx-ov-cat"><span class="tx-dot" style="background:${color}"></span>${esc(t.cat)}</div>
    <div class="fx-ov-rows">
      <div class="fx-ov-row"><span>Date</span><b>${fmtDateLong(t.d)}</b></div>
      <div class="fx-ov-row"><span>Note</span><b>${t.note ? esc(t.note) : '—'}</b></div>
    </div>
    <div class="fx-ov-actions">
      <button class="fx-btn gho" data-act="modal-edit" data-id="${t.id}">Edit</button>
      <button class="fx-btn danger" data-act="modal-del" data-id="${t.id}">Delete</button>
    </div>`;
  q('#fx-modal').classList.add('on');
}
function closeModal() { q('#fx-modal').classList.remove('on'); viewId = null; }

/* ═══════════════════ HISTORY TAB ═══════════════════ */
function renderHistory() {
  const all = txAll();
  const months = [...new Set(all.map(t => t.d.slice(0, 7)))].sort().reverse();
  const cats = getCats().filter(c => all.some(t => t.cat === c.name));

  const monthOpts = ['<option value="all">All time</option>']
    .concat(months.map(m => `<option value="${m}" ${m === histMonth ? 'selected' : ''}>${monthLabel(m)}</option>`)).join('');
  const catOpts = ['<option value="all">All categories</option>']
    .concat(cats.map(c => `<option value="${esc(c.name)}" ${c.name === histCat ? 'selected' : ''}>${esc(c.name)}</option>`)).join('');

  let filtered = all.slice();
  if (histMonth !== 'all') filtered = filtered.filter(t => t.d.startsWith(histMonth));
  if (histCat !== 'all')   filtered = filtered.filter(t => t.cat === histCat);
  filtered.sort((a, b) => b.d.localeCompare(a.d));

  let h = `<div class="fx-filters"><select class="fx-select" id="hist-month">${monthOpts}</select><select class="fx-select" id="hist-cat">${catOpts}</select></div>`;
  h += `<div class="fx-stats">
    <div class="fx-stat accent"><div class="fx-stat-v">${fmtMoneyC(sum(filtered))}</div><div class="fx-stat-l">Total</div></div>
    <div class="fx-stat"><div class="fx-stat-v">${filtered.length}</div><div class="fx-stat-l">Purchases</div></div>
    <div class="fx-stat"><div class="fx-stat-v">${filtered.length ? fmtMoneyC(sum(filtered) / filtered.length) : '$0'}</div><div class="fx-stat-l">Avg / Buy</div></div>
  </div>`;

  if (!filtered.length) {
    h += `<div class="fx-empty">${all.length ? 'Nothing matches these filters.' : 'No expenses logged yet.<br>Add your first on the Add tab.'}</div>`;
    q('#fp-history').innerHTML = h;
    return;
  }

  h += `<div class="day-card"><div class="tx-list">`;
  let lastDate = null;
  filtered.forEach(t => {
    if (t.d !== lastDate) { h += `<div class="tx-group">${fmtDateFull(t.d)}</div>`; lastDate = t.d; }
    h += txRow(t);
  });
  h += `</div></div>`;
  q('#fp-history').innerHTML = h;
}

/* ═══════════════════ INSIGHTS TAB ═══════════════════ */
function donutSVG(segs, total) {
  const r = 58, cx = 80, cy = 80, sw = 20, C = 2 * Math.PI * r;
  let acc = 0;
  const arcs = segs.map(s => {
    const f = s.amount / total, len = Math.max(f * C - 2, 0.001), off = -acc * C, pct = (f * 100).toFixed(0);
    acc += f;
    return `<circle class="fx-arc" data-act="arc" data-name="${esc(s.name)}" data-amt="${fmtMoneyC(s.amount)}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"><title>${esc(s.name)}: ${fmtMoney(s.amount)} (${pct}%)</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 160 160"><g transform="rotate(-90 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>${arcs}</g></svg>`;
}
function trendSVG(months) {
  const max = Math.max(...months.map(m => m.total), 1);
  const W = 600, H = 200, PADL = 6, PADR = 6, PADT = 12, PADB = 26;
  const innerW = W - PADL - PADR, innerH = H - PADT - PADB, n = months.length, slot = innerW / n, bw = slot * 0.58;
  let bars = '';
  months.forEach((m, i) => {
    const x = PADL + slot * i + (slot - bw) / 2, hgt = (m.total / max) * innerH, y = PADT + innerH - hgt;
    const hot = insMode === 'month' && m.ym === insMonth;
    const fill = hot ? '#22c55e' : (m.total ? '#22c55e88' : '#1c2030');
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hgt,1).toFixed(1)}" rx="3" fill="${fill}" style="cursor:pointer" data-act="ins-bar" data-ym="${m.ym}"><title>${monthLabel(m.ym)}: ${fmtMoney(m.total)}</title></rect>`;
    bars += `<text x="${(x + bw/2).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#4a5068" font-family="JetBrains Mono, monospace" font-size="9">${m.short}</text>`;
  });
  return `<svg class="fx-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>`;
}
function last12() {
  const all = txAll(), out = [];
  let ym = curMonth();
  for (let i = 0; i < 12; i++) { out.unshift(ym); ym = shiftMonth(ym, -1); }
  return out.map(ym => {
    const [y, m] = ym.split('-').map(Number);
    return { ym, short: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })[0] + (m === 1 ? " '" + String(y).slice(2) : ''), total: sum(all.filter(t => t.d.startsWith(ym))) };
  });
}
function insPicker() {
  if (insMode === 'month') {
    const yr = insPickYear;
    const grid = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mn, i) => {
      const ym = `${yr}-${String(i+1).padStart(2,'0')}`, dis = ym > curMonth(), on = ym === insMonth;
      return `<button class="ins-mo ${on ? 'sel' : ''}" data-act="ins-pick-month" data-ym="${ym}" ${dis ? 'disabled' : ''}>${mn}</button>`;
    }).join('');
    return `<div class="fx-picker"><div class="cal-head"><button class="cal-nav" data-act="ins-pick-year" data-d="-1">‹</button><div class="cal-title">${yr}</div><button class="cal-nav" data-act="ins-pick-year" data-d="1" ${+yr >= +curYear() ? 'disabled' : ''}>›</button></div><div class="ins-mo-grid">${grid}</div></div>`;
  }
  const years = []; for (let y = +curYear(); y >= +curYear() - 9; y--) years.push(y);
  return `<div class="fx-picker"><div class="ins-mo-grid">${years.map(y => `<button class="ins-mo ${String(y) === insYear ? 'sel' : ''}" data-act="ins-pick-yr" data-y="${y}">${y}</button>`).join('')}</div></div>`;
}
function renderInsights() {
  const all = txAll();
  let list, label, showNav = true, canNext;
  if (insMode === 'month')      { list = all.filter(t => t.d.startsWith(insMonth)); label = monthLabel(insMonth); canNext = insMonth < curMonth(); }
  else if (insMode === 'year')  { list = all.filter(t => t.d.startsWith(insYear));  label = insYear;             canNext = insYear < curYear(); }
  else                          { list = all; showNav = false; }

  const segs = byCategory(list), total = sum(list);

  let h = `<div class="fx-seg">${['month','year','all'].map(m => `<button class="fx-seg-btn ${m===insMode?'sel':''}" data-act="ins-mode" data-m="${m}">${m==='all'?'All Time':m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>`;

  if (showNav) {
    h += `<div class="fx-navbar">
      <button class="fx-nav-btn" data-act="ins-prev">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'}</button>
      <button class="fx-nav-lbl ${insPickOpen ? 'open' : ''}" data-act="ins-pick-toggle">${label}</button>
      <button class="fx-nav-btn" data-act="ins-next" ${!canNext ? 'disabled' : ''}>${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'}</button>
    </div>`;
    if (insPickOpen) h += insPicker();
  }

  h += `<div class="fx-stats">
    <div class="fx-stat accent"><div class="fx-stat-v">${fmtMoneyC(total)}</div><div class="fx-stat-l">Total</div></div>
    <div class="fx-stat"><div class="fx-stat-v">${list.length}</div><div class="fx-stat-l">Purchases</div></div>
    <div class="fx-stat"><div class="fx-stat-v">${segs.length}</div><div class="fx-stat-l">Categories</div></div>
  </div>`;

  if (total > 0) {
    const legend = segs.map(s => {
      const pct = (s.amount / total * 100).toFixed(0);
      return `<div class="fx-leg-row" data-act="arc-leg" data-name="${esc(s.name)}"><span class="fx-leg-dot" style="background:${s.color}"></span><span class="fx-leg-name">${esc(s.name)}</span><span class="fx-leg-pct">${pct}%</span><span class="fx-leg-amt">${fmtMoney(s.amount)}</span></div>`;
    }).join('');
    h += `<div class="fx-donut-card"><div class="fx-donut-wrap">
      <div class="fx-donut">${donutSVG(segs, total)}<div class="fx-donut-mid" id="fx-donut-mid" data-total="${fmtMoneyC(total)}"><div class="fx-donut-total" id="fx-donut-total">${fmtMoneyC(total)}</div><div class="fx-donut-sub" id="fx-donut-sub">Spent</div></div></div>
      <div class="fx-legend">${legend}</div>
    </div></div>`;
  } else {
    h += `<div class="fx-donut-card"><div class="fx-empty">No spending in this period.</div></div>`;
  }

  h += `<div class="fx-chart-card"><div class="fx-chart-title">Last 12 Months</div>${trendSVG(last12())}</div>`;
  q('#fp-insights').innerHTML = h;
}

/* donut hover/tap */
function donutHover(name) {
  const tot = q('#fx-donut-total'), sub = q('#fx-donut-sub'); if (!tot) return;
  const arc = root.querySelector(`.fx-arc[data-name="${CSS.escape(name)}"]`);
  if (arc) tot.textContent = arc.dataset.amt;
  sub.textContent = name;
  root.querySelectorAll('.fx-arc').forEach(a => a.classList.toggle('hot', a.dataset.name === name));
}
function donutReset() {
  const mid = q('#fx-donut-mid'); if (!mid) return;
  q('#fx-donut-total').textContent = mid.dataset.total;
  q('#fx-donut-sub').textContent = 'Spent';
  root.querySelectorAll('.fx-arc').forEach(a => a.classList.remove('hot'));
}

/* ═══════════════════ TABS + EVENTS ═══════════════════ */
function switchTab(tab) {
  activeTab = tab;
  root.querySelectorAll('.fin .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  root.querySelectorAll('.fin .panel').forEach(p => p.classList.remove('active'));
  q('#fp-' + tab).classList.add('active');
}
function renderAll() { renderAdd(); renderHistory(); renderInsights(); }

function onClick(e) {
  if (e.target.id === 'fx-modal') { closeModal(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const a = el.dataset;
  switch (a.act) {
    case 'tab':           switchTab(a.tab); break;
    case 'pick-cat':      pickCat(a.cat); break;
    case 'cat-manage':    managingCats = !managingCats; addingCat = false; editCat = null; reRender(); break;
    case 'edit-cat':      openEditCat(a.cat); break;
    case 'editcat-save':  saveEditCat(); break;
    case 'editcat-del':   editCatDelete(); break;
    case 'editcat-cancel':editCat = null; reRender(); break;
    case 'new-cat-open':  openNewCat(); break;
    case 'new-cat-color': updateNewColor(a.c); break;
    case 'new-cat-save':  saveNewCat(); break;
    case 'new-cat-cancel':cancelNewCat(); break;
    case 'cal-toggle':    captureDraft(); calOpen = !calOpen; if (calOpen) calView = (draft.date || todayStr()).slice(0,7); renderAdd(); break;
    case 'cal-shift':     captureDraft(); calView = shiftMonth(calView, +a.d); renderAdd(); break;
    case 'cal-pick':      captureDraft(); draft.date = a.d; calOpen = false; renderAdd(); break;
    case 'cal-today':     captureDraft(); draft.date = todayStr(); calView = curMonth(); calOpen = false; renderAdd(); break;
    case 'save-tx':       saveTx(); break;
    case 'cancel-edit':   cancelEdit(); break;
    case 'view-tx':       viewTx(a.id); break;
    case 'modal-close':   closeModal(); break;
    case 'modal-edit':    closeModal(); editTx(a.id); break;
    case 'modal-del':     closeModal(); delTx(a.id); break;
    case 'ins-mode':      insMode = a.m; insPickOpen = false; renderInsights(); break;
    case 'ins-prev':      insShift(-1); break;
    case 'ins-next':      insShift(1); break;
    case 'ins-bar':       insMode = 'month'; insMonth = a.ym; insPickOpen = false; renderInsights(); break;
    case 'ins-pick-toggle': insPickOpen = !insPickOpen; insPickYear = insMode === 'month' ? insMonth.slice(0,4) : insYear; renderInsights(); break;
    case 'ins-pick-year': insPickYear = String(+insPickYear + (+a.d)); renderInsights(); break;
    case 'ins-pick-month':insMonth = a.ym; insPickOpen = false; renderInsights(); break;
    case 'ins-pick-yr':   insYear = a.y; insPickOpen = false; renderInsights(); break;
    case 'arc':           donutHover(el.dataset.name); break;
    case 'arc-leg':       donutHover(a.name); break;
  }
}
function insShift(delta) {
  if (insMode === 'month') { const nx = shiftMonth(insMonth, delta); if (delta > 0 && nx > curMonth()) return; insMonth = nx; }
  else if (insMode === 'year') { const nx = String(+insYear + delta); if (delta > 0 && nx > curYear()) return; insYear = nx; }
  insPickOpen = false; renderInsights();
}
function onChange(e) {
  if (e.target.id === 'hist-month') { histMonth = e.target.value; renderHistory(); }
  else if (e.target.id === 'hist-cat') { histCat = e.target.value; renderHistory(); }
  else if (e.target.id === 'fx-color') updateNewColor(e.target.value);
}
function onKeydown(e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'fx-amount') { e.preventDefault(); saveTx(); }
  else if (e.target.id === 'fx-newcat-in') { e.preventDefault(); saveNewCat(); }
  else if (e.target.id === 'fx-editcat-in') { e.preventDefault(); saveEditCat(); }
  // #fx-note is a textarea — let Enter add a new line
}
function onInput(e) {
  if (e.target.id === 'fx-note') sizeNote();
  else if (e.target.id === 'fx-color') updateNewColor(e.target.value);
}
function onOver(e) { const arc = e.target.closest?.('.fx-arc'); if (arc && root.contains(arc)) donutHover(arc.dataset.name); }
function onOut(e) { const arc = e.target.closest?.('.fx-arc'); if (!arc) return; const to = e.relatedTarget; if (to && to.closest?.('.fx-arc')) return; donutReset(); }

/* ═══════════════════ TEMPLATE + LIFECYCLE ═══════════════════ */
function template() {
  return `<div class="fin">
    <div class="app-head"><h1>Expenses</h1><p>Spending Tracker</p></div>
    <nav class="nav"><div class="nav-inner">
      <button class="tab active" data-act="tab" data-tab="add">Add</button>
      <button class="tab" data-act="tab" data-tab="history">History</button>
      <button class="tab" data-act="tab" data-tab="insights">Insights</button>
    </div></nav>
    <div class="app-wrap">
      <div class="panel active" id="fp-add"></div>
      <div class="panel" id="fp-history"></div>
      <div class="panel" id="fp-insights"></div>
    </div>
    <div class="fx-ov" id="fx-modal"><div class="fx-ov-card" id="fx-modal-body"></div></div>
  </div>`;
}

export default {
  id: 'finance',
  name: 'Expenses',
  styles: 'apps/finance/finance.css',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  mount(el) {
    root = el;
    activeTab = 'add'; editId = null; viewId = null; addingCat = false; managingCats = false; editCat = null;
    selCat = null; newCatColor = PALETTE[0]; calOpen = false; calView = curMonth();
    draft = { amt: '', date: todayStr(), note: '' };
    histMonth = 'all'; histCat = 'all';
    insMode = 'month'; insMonth = curMonth(); insYear = curYear(); insPickOpen = false;

    root.innerHTML = template();
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('input', onInput);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    renderAll();
    switchTab(activeTab);
  },
  unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('input', onInput);
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseout', onOut);
    }
    root = null;
  },
};
