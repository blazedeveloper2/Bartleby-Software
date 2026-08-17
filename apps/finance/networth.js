/* ═══════════════════════════════════════════════════════════
   NET WORTH — one number, logged again and again.

   Add up everything you have, write the total down, come back
   later and do it again. The line between the snapshots is the
   whole feature; everything else here exists to make that line
   easy to keep feeding and honest to read.

   One snapshot per day, keyed by date, so re-logging a day edits
   it instead of stacking a second total on top of the first.

   Negative totals are allowed on purpose — owing more than you
   hold is a real position, and a tracker that refuses to record
   it is no use to the people who most need the line.
   ═══════════════════════════════════════════════════════════ */

import { load, save, todayStr, dateStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';

/* ── storage ── */
const sortByDate = l => [...l].sort((a, b) => a.d.localeCompare(b.d));
const nwAll  = () => sortByDate(load('fin_nw', []));
const nwSave = l => save('fin_nw', sortByDate(l));
/* Expenses live next door. Read them directly rather than threading them
   through every call — `fin_tx` is as much a fixed contract as the DOM ids. */
const txAll  = () => load('fin_tx', []);

/* ── state ── */
/* No `editing` flag: whether this is an edit is a question about the
   date in the draft, and asking the data is one fewer thing to keep in
   sync than remembering the answer. */
let draft = { amt: '', date: '', note: '' };
let calOpen = false, calView = '';
let range = 'all';

const RANGES = [
  { k: '3m',  lbl: '3M',  days: 90   },
  { k: '6m',  lbl: '6M',  days: 180  },
  { k: '1y',  lbl: '1Y',  days: 365  },
  { k: 'all', lbl: 'All', days: null },
];

/* ── helpers ── */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const abs2 = n => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money  = n => (n < 0 ? '-$' : '$') + abs2(n);
const signed = n => (n < 0 ? '-$' : '+$') + abs2(n);

/* Axis ticks and the small delta boxes need the magnitude, not the cents. */
function compact(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${s}$${Math.round(a / 1e3)}k`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${Math.round(a)}`;
}

const curYear   = () => todayStr().slice(0, 4);
const dayOf     = d => new Date(d + 'T00:00:00');
const fmtShort  = d => {
  const base = dayOf(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.slice(0, 4) === curYear() ? base : `${base} '${d.slice(2, 4)}`;
};
const fmtFull   = d => dayOf(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtRow    = d => dayOf(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const daysApart = (a, b) => Math.round((dayOf(b) - dayOf(a)) / 86400000);
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const shiftMonth = (ym, delta) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

const draftDate = () => draft.date || todayStr();
/* The snapshot the draft would land on, if there is one. */
const onDate = () => nwAll().find(e => e.d === draftDate()) || null;

/* ═══════════════════ CHART ═══════════════════ */
/* Two surfaces, deliberately: the paths live in an SVG stretched to fill
   the card, the labels and dots are HTML positioned by percentage over it.
   A single SVG can have crisp text or a plot that fills any width, not
   both — `preserveAspectRatio="none"` is what makes the line span the card
   on a phone, and it is also what would squash 9px axis text into
   unreadable slivers there. Keeping the text out of the transform sidesteps
   the trade entirely, and buys real tooltips on the dots on the way past. */
const PLOT_W = 600, PLOT_H = 200;

function chartHTML(entries) {
  const cs = getComputedStyle(document.documentElement);
  const C = k => cs.getPropertyValue(k).trim();
  const first = entries[0].amt, last = entries[entries.length - 1].amt;
  /* Up over the window reads green, down reads red — the direction should
     land before any number does. */
  const AC = last >= first ? C('--green') : C('--red');
  const GRID = C('--grid'), ZERO = C('--text-3');

  const ts = entries.map(e => dayOf(e.d).getTime());
  const t0 = ts[0], tSpan = Math.max(ts[ts.length - 1] - t0, 1);
  /* x follows the calendar, not the entry number. Snapshots come at
     whatever interval you happen to remember, and evenly spacing them
     would draw a steady climb over a gap you took six months to cross. */
  const xf = i => (ts[i] - t0) / tSpan;

  const vals = entries.map(e => e.amt);
  const lo = Math.min(...vals), hi = Math.max(...vals), spread = hi - lo;
  const pad = spread > 0 ? spread * 0.18 : Math.max(Math.abs(hi) * 0.08, 1);
  let yMin = lo - pad, yMax = hi + pad;
  /* Don't invent space the data never visits: an all-positive total gets a
     floor at zero rather than a phantom debt band under it, and vice versa. */
  if (lo >= 0 && yMin < 0) yMin = 0;
  if (hi <= 0 && yMax > 0) yMax = 0;
  if (yMax === yMin) yMax = yMin + 1;
  const yf = v => 1 - (v - yMin) / (yMax - yMin);

  const X = i => (xf(i) * PLOT_W).toFixed(2);
  const Y = v => (yf(v) * PLOT_H).toFixed(2);

  const line = 'M ' + entries.map((e, i) => `${X(i)} ${Y(e.amt)}`).join(' L ');
  /* Fill down to zero when zero is on screen, to the floor when it isn't,
     so a negative stretch hangs below the line rather than under the card. */
  const baseY = Y(Math.min(Math.max(0, yMin), yMax));
  const area = `${line} L ${X(entries.length - 1)} ${baseY} L ${X(0)} ${baseY} Z`;

  const TICKS = 4;
  let grid = '', yLabels = '';
  for (let i = 0; i <= TICKS; i++) {
    const v = yMin + (yMax - yMin) * (i / TICKS);
    const pct = 100 - (i / TICKS) * 100;
    grid += `<line x1="0" y1="${(pct / 100 * PLOT_H).toFixed(2)}" x2="${PLOT_W}" y2="${(pct / 100 * PLOT_H).toFixed(2)}" stroke="${GRID}" stroke-width="1" stroke-dasharray="2,4"/>`;
    yLabels += `<span class="nw-yl" style="top:${pct.toFixed(2)}%">${compact(v)}</span>`;
  }
  const zeroLine = (yMin < 0 && yMax > 0)
    ? `<line x1="0" y1="${Y(0)}" x2="${PLOT_W}" y2="${Y(0)}" stroke="${ZERO}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : '';

  /* Past a few dozen snapshots the dots stop marking anything and start
     being the line, so the line is left to speak for itself. */
  const dots = entries.length <= 40 ? entries.map((e, i) =>
    `<i class="nw-dot" style="left:${(xf(i) * 100).toFixed(2)}%;top:${(yf(e.amt) * 100).toFixed(2)}%;background:${AC}"
        title="${esc(fmtFull(e.d))} · ${money(e.amt)}"></i>`).join('') : '';

  const n = entries.length;
  const marks = [0];
  if (n >= 4) {
    const mid = Math.round((n - 1) / 2), p = xf(mid) * 100;
    /* Only when it has room — an irregular gap can park the middle
       snapshot on top of an end label. */
    if (p > 22 && p < 78) marks.push(mid);
  }
  marks.push(n - 1);
  const xLabels = marks.map(i => {
    const pos = i === 0 ? 'left:0'
              : i === n - 1 ? 'right:0'
              : `left:${(xf(i) * 100).toFixed(2)}%;transform:translateX(-50%)`;
    return `<span class="nw-xl" style="${pos}">${fmtShort(entries[i].d)}</span>`;
  }).join('');

  return `<div class="nw-plot">
    <div class="nw-plot-in">
      ${yLabels}
      <svg class="nw-svg" viewBox="0 0 ${PLOT_W} ${PLOT_H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${AC}" stop-opacity=".30"/>
          <stop offset="100%" stop-color="${AC}" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}${zeroLine}
        <path d="${area}" fill="url(#nw-grad)"/>
        <path d="${line}" fill="none" stroke="${AC}" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
      ${dots}
    </div>
    <div class="nw-xrow">${xLabels}</div>
  </div>`;
}

function inRange(all, k) {
  const r = RANGES.find(x => x.k === k);
  if (!r || r.days === null) return all;
  const cutoff = dateStr(new Date(Date.now() - r.days * 86400000));
  return all.filter(e => e.d >= cutoff);
}

function chartCard(all) {
  /* A range that can't draw a line is a button that does nothing, so the
     row only appears once some range would actually narrow the view. */
  const usable = RANGES.filter(r => r.days === null || inRange(all, r.k).length >= 2);
  const showRanges = usable.length > 1;
  if (!showRanges && range !== 'all') range = 'all';

  const shown = inRange(all, range);
  const body = shown.length >= 2
    ? chartHTML(shown)
    : `<div class="nw-empty">Just one snapshot so far — ${money(all[all.length - 1].amt)} on ${fmtShort(all[all.length - 1].d)}.<br>Log your total again later and the line starts here.</div>`;

  const btns = showRanges ? `<div class="nw-range">${RANGES.map(r =>
    `<button class="nw-r-btn ${r.k === range ? 'sel' : ''}" data-act="nw-range" data-k="${r.k}"
      ${usable.includes(r) ? '' : 'disabled'}>${r.lbl}</button>`).join('')}</div>` : '';

  return `<div class="nw-chart-card">
    <div class="nw-chart-head"><div class="fx-chart-title">Over Time</div>${btns}</div>
    ${body}
  </div>`;
}

/* ═══════════════════ HERO + STATS ═══════════════════ */
function heroHTML(all) {
  const cur = all[all.length - 1], prev = all[all.length - 2];
  let deltaHTML = '<div class="nw-hero-d flat">First snapshot — nothing to compare it to yet.</div>';
  if (prev) {
    const d = cur.amt - prev.amt;
    const cls = d > 0 ? 'up' : d < 0 ? 'dn' : 'flat';
    const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '·';
    const gap = daysApart(prev.d, cur.d);
    deltaHTML = `<div class="nw-hero-d ${cls}">${arrow} ${d === 0 ? 'no change' : signed(d)}
      <span>since ${fmtShort(prev.d)}${gap ? ` · ${gap} day${gap === 1 ? '' : 's'}` : ''}</span></div>`;
  }
  return `<div class="nw-hero">
    <div class="nw-hero-l">Net Worth</div>
    <div class="nw-hero-v">${money(cur.amt)}</div>
    <div class="nw-hero-sub">as of ${fmtFull(cur.d)}${cur.note ? ` · ${esc(cur.note)}` : ''}</div>
    ${deltaHTML}
  </div>`;
}

/* Change over a window, anchored on whichever snapshot sits nearest the
   far edge of it — on either side. Taking the last one strictly beyond the
   cutoff instead sounds safer and reads much worse: with totals logged 28
   and 63 days back, a “30 Days” box would quietly report the 63-day move
   and skip the snapshot that actually lands on the question. Nothing here
   can conjure a reading for a window you never logged across, so the box
   also carries the span it really covers rather than letting the label
   imply one that never happened. */
function windowDelta(all, days) {
  const cur = all[all.length - 1];
  const prior = all.slice(0, -1);
  if (!prior.length) return null;
  const target = dayOf(cur.d).getTime() - days * 86400000;
  let anchor = prior[0], best = Infinity;
  for (const e of prior) {
    const dist = Math.abs(dayOf(e.d).getTime() - target);
    if (dist < best) { best = dist; anchor = e; }
  }
  return { delta: cur.amt - anchor.amt, from: anchor.d, days: daysApart(anchor.d, cur.d) };
}

function statsHTML(all) {
  const total = all[all.length - 1].amt - all[0].amt;
  const boxes = [
    { lbl: '30 Days', w: windowDelta(all, 30) },
    { lbl: '90 Days', w: windowDelta(all, 90) },
    { lbl: 'All Time', w: all.length > 1 ? { delta: total, from: all[0].d, days: daysApart(all[0].d, all[all.length - 1].d) } : null },
  ];
  return `<div class="nw-stats">${boxes.map(b => {
    if (!b.w) return `<div class="nw-stat"><div class="nw-stat-v flat">—</div><div class="nw-stat-l">${b.lbl}</div></div>`;
    const cls = b.w.delta > 0 ? 'up' : b.w.delta < 0 ? 'dn' : 'flat';
    return `<div class="nw-stat" title="${signed(b.w.delta)} over ${b.w.days} day${b.w.days === 1 ? '' : 's'}, from ${fmtFull(b.w.from)}">
      <div class="nw-stat-v ${cls}">${b.w.delta === 0 ? '$0' : (b.w.delta < 0 ? '' : '+') + compact(b.w.delta)}</div>
      <div class="nw-stat-l">${b.lbl}</div>
      <div class="nw-stat-s">${b.w.days}d</div>
    </div>`;
  }).join('')}</div>`;
}

/* ═══════════════════ FORM ═══════════════════ */
function calGrid(view) {
  const [y, m] = view.split('-').map(Number);
  const startDow = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const sel = draftDate(), today = todayStr();
  const logged = new Set(nwAll().map(e => e.d));

  const head = `<div class="cal-head">
    <button class="cal-nav" data-act="nw-cal-shift" data-d="-12" title="Previous year">«</button>
    <button class="cal-nav" data-act="nw-cal-shift" data-d="-1" title="Previous month">‹</button>
    <div class="cal-title">${monthLabel(view)}</div>
    <button class="cal-nav" data-act="nw-cal-shift" data-d="1" title="Next month">›</button>
    <button class="cal-nav" data-act="nw-cal-shift" data-d="12" title="Next year">»</button>
  </div>`;
  const dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="cal-dow">${d}</div>`).join('');

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div></div>';
  for (let day = 1; day <= days; day++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cls = ['cal-day', 'nw-cd'];
    if (ds === sel) cls.push('sel');
    if (ds === today) cls.push('today');
    if (logged.has(ds)) cls.push('has');
    cells += `<button class="${cls.join(' ')}" data-act="nw-cal-pick" data-d="${ds}" ${ds > today ? 'disabled' : ''}
      title="${fmtFull(ds)}${logged.has(ds) ? ' · already logged' : ''}">${day}</button>`;
  }
  return `<div class="fx-cal">${head}<div class="cal-grid">${dows}</div><div class="cal-grid">${cells}</div>
    <div class="cal-foot"><button class="fx-btn gho" data-act="nw-cal-today">Jump to Today</button></div></div>`;
}

function formHTML(all) {
  const hit = onDate();
  const dirty = draft.amt !== '' || draft.note !== '';
  /* Saving over a day you already logged is an edit, not a collision — but
     it should never be a surprise, so the stored figure stays on screen
     next to the one about to replace it. */
  const clash = hit && String(hit.amt) !== draft.amt.trim();

  return `<div class="fx-form ${hit ? 'editing' : ''}">
    <div class="fx-form-title"><span>${hit ? 'Edit Snapshot' : all.length ? 'New Snapshot' : 'Your First Total'}</span>${hit ? '<span class="fx-editing-tag">Editing</span>' : ''}</div>
    <div class="fx-amount-wrap"><span class="fx-cur">$</span>
      <input class="fx-amount" id="nw-amount" type="number" inputmode="decimal" step="0.01"
             placeholder="0.00" value="${esc(draft.amt)}"></div>

    <div class="fx-field fx-field-b"><div class="fx-lbl">Date</div>
      <button class="fx-datebtn ${calOpen ? 'open' : ''}" data-act="nw-cal-toggle"><span>${fmtFull(draftDate())}</span>${CAL_SVG}</button></div>
    ${calOpen ? calGrid(calView || draftDate().slice(0, 7)) : ''}
    ${clash ? `<div class="nw-clash">${fmtShort(hit.d)} already holds <b>${money(hit.amt)}</b>. Saving replaces it.</div>` : ''}

    <div class="fx-field fx-field-b"><div class="fx-lbl">Note <span class="fx-opt">(optional)</span></div>
      <input class="fx-in" id="nw-note" placeholder="e.g. after the bonus landed" maxlength="80" value="${esc(draft.note)}"></div>

    <div class="fx-actions">
      <button class="fx-btn pri" data-act="nw-save">${hit ? 'Update Snapshot' : 'Save Snapshot'}</button>
      ${(hit || dirty) ? '<button class="fx-btn gho" data-act="nw-clear">Clear</button>' : ''}
    </div>
  </div>`;
}

/* ═══════════════════ HISTORY ═══════════════════ */
/* What the two datasets can say together and neither can alone: the total
   fell by 300 while you logged 900 of spending, so roughly 600 came in.
   Stated as an inference, because it is one — it can only ever be as
   complete as the expense log behind it. */
const spentBetween = (a, b) => txAll().filter(t => t.d > a && t.d <= b).reduce((s, t) => s + t.amt, 0);

function historyHTML(all) {
  const rows = [...all].reverse();
  let inferred = false;

  const body = rows.map((e, i) => {
    const prev = rows[i + 1];
    let deltaHTML = '<div class="nw-h-d flat">start</div>', flow = '', rel = 'Starting point';
    if (prev) {
      const d = e.amt - prev.amt;
      const cls = d > 0 ? 'up' : d < 0 ? 'dn' : 'flat';
      const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '·';
      const gap = daysApart(prev.d, e.d);
      deltaHTML = `<div class="nw-h-d ${cls}">${arrow} ${d === 0 ? '0' : signed(d)}</div>`;
      rel = `${gap} day${gap === 1 ? '' : 's'} after ${fmtShort(prev.d)}`;

      const spent = spentBetween(prev.d, e.d);
      if (spent > 0) {
        inferred = true;
        const inflow = d + spent;
        flow = inflow > 0
          ? `<div class="nw-h-flow">Logged ${money(spent)} spent, so about <b>${money(inflow)}</b> came in</div>`
          : `<div class="nw-h-flow">Logged ${money(spent)} spent, and <b>${money(-inflow)}</b> more left than that</div>`;
      }
    }
    return `<div class="nw-h-row" data-act="nw-edit" data-d="${e.d}" title="Tap to edit this snapshot">
      <div class="nw-h-main">
        <div class="nw-h-l"><div class="nw-h-date">${fmtRow(e.d)}</div><div class="nw-h-rel">${rel}</div></div>
        <div class="nw-h-r"><div class="nw-h-v">${money(e.amt)}</div>${deltaHTML}</div>
        <button class="nw-h-del" data-act="nw-del" data-d="${e.d}" title="Delete this snapshot">${TRASH_SVG}</button>
      </div>
      ${e.note ? `<div class="nw-h-note">${esc(e.note)}</div>` : ''}
      ${flow}
    </div>`;
  }).join('');

  return `<div class="day-card">
    <div class="day-top">
      <div class="day-top-l"><span class="day-badge" style="background:var(--blue)">History</span>
        <span class="day-title">${all.length} Snapshot${all.length === 1 ? '' : 's'}</span></div>
      <span class="day-prog">${fmtShort(all[0].d)} → ${fmtShort(all[all.length - 1].d)}</span>
    </div>
    <div class="nw-hist">${body}</div>
    ${inferred ? `<div class="nw-h-foot">“Came in” is inferred — the change in your total plus what you logged as spent over the same stretch. It is only ever as complete as the expense log behind it.</div>` : ''}
  </div>`;
}

/* ═══════════════════ RENDER ═══════════════════ */
function paint(root) {
  const panel = root?.querySelector('#fp-networth');
  if (!panel) return;
  const all = nwAll();

  let h = '';
  if (!all.length) {
    h += `<div class="nw-intro">
      <div class="nw-intro-t">Start with one number</div>
      <div class="nw-intro-p">Add up everything you hold — accounts, cash, investments — and subtract what you owe. Log that total. Come back whenever you like, do the sum again, and the line between the two is the part that matters.</div>
    </div>`;
    h += formHTML(all);
  } else {
    h += heroHTML(all);
    h += statsHTML(all);
    h += chartCard(all);
    h += formHTML(all);
    h += historyHTML(all);
  }
  panel.innerHTML = h;
}

/* The app-wide repaint — logging an expense moves the “came in” figures on
   this tab, so it has to redraw. Read the fields back first: something half
   typed here is not saved anywhere else, and an expense logged on another
   tab has no business taking it away. Actions inside this tab already know
   the draft is current and call paint() straight through, which is what
   keeps a save from reading its own cleared fields back in. */
export function renderNetWorth(root) { capture(root); paint(root); }

/* ═══════════════════ ACTIONS ═══════════════════ */
/* Whatever is typed but unsaved has to survive a re-render, or opening the
   calendar would quietly wipe the amount you just entered. */
function capture(root) {
  const a = root?.querySelector('#nw-amount'), n = root?.querySelector('#nw-note');
  if (a) draft.amt = a.value;
  if (n) draft.note = n.value;
}

function saveSnapshot(root) {
  capture(root);
  const val = parseFloat(draft.amt);
  if (!Number.isFinite(val)) { toast('Enter your total'); return; }
  const d = draftDate();
  const note = draft.note.trim();
  const list = nwAll();
  const i = list.findIndex(e => e.d === d);
  const existed = i >= 0;
  if (existed) list[i] = { ...list[i], amt: val, note };
  else list.push({ d, amt: val, note });
  nwSave(list);
  draft = { amt: '', date: todayStr(), note: '' };
  calOpen = false;
  paint(root);
  toast(existed ? `Updated ${fmtShort(d)} — ${money(val)}` : `Logged ${money(val)}`);
}

function editSnapshot(root, d) {
  const e = nwAll().find(x => x.d === d);
  if (!e) return;
  draft = { amt: String(e.amt), date: e.d, note: e.note || '' };
  calOpen = false;
  paint(root);
  const el = root?.querySelector('#nw-amount');
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => el?.focus(), 40);
}

function delSnapshot(root, d) {
  const e = nwAll().find(x => x.d === d);
  if (!e) return;
  if (!confirm(`Delete the ${fmtFull(e.d)} snapshot of ${money(e.amt)}?`)) return;
  nwSave(nwAll().filter(x => x.d !== d));
  if (draft.date === d) draft = { amt: '', date: todayStr(), note: '' };
  paint(root);
  toast('Snapshot deleted');
}

/* One entry point for every `nw-` action, so index.js keeps one line about
   this tab instead of a dozen. Returns whether it recognised the action. */
export function nwClick(a, root) {
  switch (a.act) {
    case 'nw-save':       saveSnapshot(root); break;
    case 'nw-clear':      capture(root); draft = { amt: '', date: todayStr(), note: '' }; calOpen = false; paint(root); break;
    case 'nw-edit':       editSnapshot(root, a.d); break;
    case 'nw-del':        delSnapshot(root, a.d); break;
    case 'nw-range':      range = a.k; paint(root); break;
    case 'nw-cal-toggle': capture(root); calOpen = !calOpen; if (calOpen) calView = draftDate().slice(0, 7); paint(root); break;
    case 'nw-cal-shift':  capture(root); calView = shiftMonth(calView || draftDate().slice(0, 7), +a.d); paint(root); break;
    case 'nw-cal-pick':   capture(root); pickDate(root, a.d); break;
    case 'nw-cal-today':  capture(root); pickDate(root, todayStr()); break;
    default: return false;
  }
  return true;
}

/* Landing on a day that already holds a snapshot turns the form into an
   edit of it. Only an untouched amount gets filled in — typing a number
   and then picking a date should not have the number taken away. */
function pickDate(root, d) {
  draft.date = d;
  const hit = nwAll().find(e => e.d === d);
  if (hit && draft.amt.trim() === '') { draft.amt = String(hit.amt); draft.note = hit.note || ''; }
  calOpen = false;
  paint(root);
}

export function nwKeydown(e, root) {
  if (e.key !== 'Enter') return false;
  if (e.target.id !== 'nw-amount' && e.target.id !== 'nw-note') return false;
  e.preventDefault();
  saveSnapshot(root);
  return true;
}

export function nwReset() {
  draft = { amt: '', date: todayStr(), note: '' };
  calOpen = false;
  calView = todayStr().slice(0, 7);
  range = 'all';
}
