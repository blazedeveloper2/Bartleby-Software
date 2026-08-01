/* ═══════════════════════════════════════════════════════════
   WORKOUT APP
   Program tracker (tap an exercise → muscle map + set its weight),
   a bodyweight trend tab, and a progress/rank tab.
   Local-first, event-delegated.
   ═══════════════════════════════════════════════════════════ */

import { PROGRAM, MMAP } from './data.js';
import { load, save, todayStr, dateStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';
import { pctColor, ord } from './standards.js';
import {
  setsOf, syncDay, logPR, delSession, setReps, snapshot,
  isLoggedToday, celebrationHTML, renderRank, liftScores, standingOf, resEx,
} from './rank.js';

/* ── namespaced storage ── */
const chks = () => load('bp_chk', {});
const sChk = c => save('bp_chk', c);
const wts  = () => load('bp_wt', {});
const sWt  = w => save('bp_wt', w);
const ek   = (d, s, e) => `${d}.${s}.${e}`;

const bwAll = () => load('bp_bw', []);
const bwSv  = l => save('bp_bw', l);

/* ── module state ── */
let root = null;
let activeTab = 'program';
let bwRange = '30';
let bwEditDate = null;
let mmEx = null;             // exercise currently open in the muscle modal

const BW_RANGES = [
  {k:'7',  d:7,   lbl:'7D'},
  {k:'30', d:30,  lbl:'30D'},
  {k:'90', d:90,  lbl:'90D'},
  {k:'all',d:null,lbl:'All'},
];

const q = sel => root.querySelector(sel);

/* ═══════════════════ PROGRAM TAB ═══════════════════ */
function renderProg() {
  const p = q('#p-program'), ch = chks(), w = wts();
  /* Every exercise name is tinted red→green by where that lift stands.
     Unscored movements (bodyweight core work) and lifts with no weight
     set aren't in the map and stay the default text colour. */
  const sc = liftScores();
  let h = '';
  PROGRAM.forEach((day, di) => {
    let tot = 0, dn = 0;
    day.sections.forEach((sec, si) => sec.ex.forEach((_, ei) => { tot++; if (ch[ek(di,si,ei)]) dn++; }));
    const comp = dn === tot && tot > 0;
    const xpH = comp && isLoggedToday(di) ? `<span class="day-xp logged">Logged</span>` : '';
    h += `<div class="day-card" data-day="${di}">
      <div class="day-top">
        <div class="day-top-l">
          <span class="day-idx">${pad(di + 1)}</span><span class="day-sep">//</span>
          <span class="day-badge ${day.day}">${day.day}</span>
          <span class="day-title">${day.label}</span>
        </div>
        <div class="day-top-r">${xpH}<span class="day-prog ${comp?'done':''}">${dn}/${tot}</span></div>
      </div>
      <div class="day-meter">${meterHTML(dn, tot)}</div>
      <div class="day-body">`;
    let exN = 0;                                   // numbering runs across the whole day
    day.sections.forEach((sec, si) => {
      if (sec.tag) h += `<div class="sec-lbl">${sec.tag}</div>`;
      sec.ex.forEach((rawEx, ei) => {
        const ex = resEx(rawEx);
        const k = ek(di,si,ei), on = ch[k] || false;
        const wv = w[ex.n];
        const wtH = wv ? `<span class="ex-wt">${wv}</span>` : '';
        const bH  = ex.b ? `<span class="bench-tag ${ex.bc||''}">${ex.b}</span>` : '';
        const l   = sc.get(ex.n);
        const nA  = l ? ` style="color:${pctColor(l.pct)}" title="${l.rank.l} · ${ord(l.pct)} percentile at your bodyweight"` : '';
        h += `<div class="ex-row ${on?'off':''}" data-act="row" data-di="${di}" data-si="${si}" data-ei="${ei}"><span class="ex-rail"></span><div class="ex-chk ${on?'on':''}" data-act="chk" data-k="${k}"></div><span class="ex-idx">${pad(++exN)}</span><div class="ex-body"><div class="ex-name"${nA}>${ex.n}</div><div class="ex-detail"><span class="ex-musc">${ex.m}</span></div></div><div class="ex-right">${wtH}<span class="ex-sets">${ex.s}</span>${bH}</div></div>`;
      });
    });
    h += `</div></div>`;
  });
  if (Object.values(ch).some(Boolean)) h += `<div class="clear-bar"><button class="clear-btn" data-act="clear">Clear All Checkmarks</button></div>`;
  p.innerHTML = h;
}

const pad = n => String(n).padStart(2, '0');

/* Segmented completion meter — one notch per exercise, reads like a HUD bar. */
const meterHTML = (done, tot) =>
  Array.from({ length: tot }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');

/* Completed exercises + hard sets for one day, under the current bar setting. */
function dayTally(di, ch) {
  let tot = 0, done = 0, sets = 0;
  PROGRAM[di].sections.forEach((sec, si) => sec.ex.forEach((raw, ei) => {
    tot++;
    if (ch[ek(di,si,ei)]) { done++; sets += setsOf(resEx(raw)); }
  }));
  return { tot, done, sets };
}

/* Patch the row and its day header in place. A full renderProg() here
   would rebuild all four cards, which reads as a page-wide flicker and
   restarts every card's entrance animation. */
function toggleChk(k) {
  const c = chks(); c[k] = !c[k]; sChk(c);
  const on = !!c[k];
  const di = +k.split('.')[0];

  const box = q(`[data-act="chk"][data-k="${k}"]`);
  if (box) {
    box.classList.toggle('on', on);
    box.closest('.ex-row')?.classList.toggle('off', on);
  }
  const tally = dayTally(di, c);
  paintDayHead(di, tally);
  paintClearBar(c);

  const res = syncDay(di, tally);
  if (!res) return;
  paintDayHead(di, tally);            // the "Logged" pill may have appeared
  renderRank(root);
  if (res.logged && !showCelebration(res)) toast(`${res.label} logged`);
}

function paintDayHead(di, tally) {
  const card = q(`.day-card[data-day="${di}"]`);
  if (!card) return;
  const comp = tally.done === tally.tot && tally.tot > 0;
  /* toggle the existing notches rather than rebuilding them, so they
     transition instead of snapping */
  card.querySelectorAll('.day-meter i').forEach((el, i) => el.classList.toggle('on', i < tally.done));
  const prog = card.querySelector('.day-prog');
  if (prog) {
    const wasDone = prog.classList.contains('done');
    prog.textContent = `${tally.done}/${tally.tot}`;
    prog.classList.toggle('done', comp);
    /* finishing a day is a real moment — flash the card once for it */
    if (comp && !wasDone) {
      card.classList.remove('just-done');
      void card.offsetWidth;
      card.classList.add('just-done');
      card.addEventListener('animationend', () => card.classList.remove('just-done'), { once: true });
    }
  }
  const right = card.querySelector('.day-top-r');
  const pill = right?.querySelector('.day-xp');
  const want = comp && isLoggedToday(di);
  if (want && !pill) right.insertAdjacentHTML('afterbegin', '<span class="day-xp logged">Logged</span>');
  else if (!want && pill) pill.remove();
}

/* The "Clear All" bar only exists when something is checked. */
function paintClearBar(ch) {
  const any = Object.values(ch).some(Boolean);
  const bar = q('.clear-bar');
  if (any && !bar) q('#p-program').insertAdjacentHTML('beforeend',
    '<div class="clear-bar"><button class="clear-btn" data-act="clear">Clear All Checkmarks</button></div>');
  else if (!any && bar) bar.remove();
}
function clearChk() { sChk({}); renderProg(); toast('Checkmarks cleared'); }

/* ═══════════════════ MUSCLE MODAL (+ weight editor) ═══════════════════ */
/* The comma order in a muscle string already carries the intent — first is
   what the exercise is FOR, second comes along for the ride, the rest hold
   you together. The old version flattened all of that into one Set, so an
   overhead press and a lateral raise lit the identical two shapes. Reading
   the order back out is what makes the map worth looking at.

   Returns region id → 1 (primary) | 2 (secondary) | 3 (stabilizer). */
const mLevel = i => Math.min(i + 1, 3);

function parseMuscles(mStr) {
  const raw = mStr.toLowerCase().replace(/\(.*?\)/g,'').split(',').map(s=>s.trim()).filter(Boolean);
  const out = new Map();
  raw.forEach((m, i) => {
    let ids = MMAP[m];
    if (!ids) {                       /* fuzzy fallback — see the note in data.js */
      ids = [];
      for (const [k, v] of Object.entries(MMAP))
        if (m.includes(k) || k.includes(m)) ids.push(...v);
    }
    /* Strongest claim wins. 'Upper Abs, Rectus Abdominis' burns the top two
       rows and leaves the bottom row at the secondary tint, which is what a
       crunch actually does. */
    ids.forEach(id => out.set(id, Math.min(out.get(id) ?? 9, mLevel(i))));
  });
  return out;
}

/* Name of the muscle under the cursor, read off the <title> the region
   already carries for screen readers rather than a second lookup table. */
const regionName = el => el.querySelector('title')?.textContent || '';

function mmReadout(txt) {
  const el = q('#mm-readout');
  if (!el) return;
  el.textContent = txt || '';
  el.classList.toggle('on', !!txt);
}

/* Chip → shape. Hovering "Obliques" in the list should show you where the
   obliques are; that is the half of the learning the colour ramp can't do. */
function focusMuscle(name, on) {
  const ids = MMAP[name] || [];
  root.querySelectorAll('.m-region.focus').forEach(el => { if (!on) el.classList.remove('focus'); });
  if (on) ids.forEach(id => root.querySelector(`[id="${id}"]`)?.classList.add('focus'));
}

/* This modal is where you decide whether to add weight, so it carries the
   same standing the Rank tab does instead of making you go look it up. */
function mmRankHTML(st) {
  if (st.state === 'unscored')
    return `<div class="mm-rank none">No published standard for this movement, so it isn't scored. Track the weight anyway if it helps.</div>`;
  if (st.state === 'nobw')
    return `<div class="mm-rank none">Log your bodyweight in the <b>Weight</b> tab — every standard is relative to it.</div>`;
  if (st.state === 'noweight')
    return `<div class="mm-rank none">Set a working weight above and this lift starts scoring.</div>`;
  const l = st.lift;
  const src = l.srcLabel ? `<span class="rk-lift-src ${l.src}" title="${l.note || ''}">${l.srcLabel}</span>`
            : (l.note ? `<span class="rk-lift-src info" title="${l.note}">i</span>` : '');
  const next = l.rank.next && l.need !== null
    ? `<b>+${l.need < 1 ? l.need.toFixed(1) : Math.round(l.need)} lbs</b> → ${l.rank.next.l} · ${l.rank.next.name}`
    : 'Past the top of the published scale.';
  return `<div class="mm-rank">
    <div class="mm-rank-l" style="color:var(${l.rank.c})">${l.rank.l}</div>
    <div class="mm-rank-b">
      <div class="mm-rank-n">${l.rank.name} · ${ord(l.pct)} percentile${src}</div>
      <div class="mm-rank-s">${next}</div>
    </div>
  </div>`;
}

/* Derived from the weight in bp_wt, so it repaints on open and again after
   any save that leaves the editor on screen. */
function paintMMStanding() {
  if (!mmEx) return;
  const st = standingOf(mmEx.n);
  /* carry the row's tint through, so the modal reads as the same lift */
  q('#mm-name').style.color = st.state === 'scored' ? pctColor(st.lift.pct) : '';
  q('#mm-rank').innerHTML = mmRankHTML(st);
}

function openMM(ex) {
  mmEx = ex;
  q('#mm-name').textContent = ex.n;
  paintMMStanding();
  let info = `<span class="mm-tag">${ex.s}</span>`;
  if (ex.b) info += `<span class="mm-tag">${ex.b}</span>`;
  q('#mm-info').innerHTML = info;

  const wt = wts()[ex.n];
  q('#mm-wt').value = wt || '';

  /* Chips carry their own tier, so the list doubles as the legend for the
     three shades on the figure. */
  const muscles = ex.m.replace(/\(.*?\)/g,'').split(',').map(s=>s.trim()).filter(Boolean);
  q('#mm-mlist').innerHTML = muscles.map((m, i) =>
    `<span class="mm-muscle-chip lvl-${mLevel(i)}" data-act="mm-chip" data-m="${m.toLowerCase()}">${m}</span>`).join('');
  mmReadout('');

  /* Swap the highlight with transitions suppressed, otherwise the previous
     exercise's regions visibly fade out as the new ones fade in. */
  const map = q('.mm-map');
  map.classList.add('no-tx');
  const lit = parseMuscles(ex.m);
  root.querySelectorAll('.m-region').forEach(el => {
    el.classList.remove('lvl-1', 'lvl-2', 'lvl-3', 'focus');
    const lvl = lit.get(el.id);
    if (lvl) el.classList.add(`lvl-${lvl}`);
  });
  void map.offsetWidth;                 // commit it before transitions come back
  map.classList.remove('no-tx');

  q('#mm-ol').classList.add('on');
}
function closeMM() { q('#mm-ol').classList.remove('on'); mmEx = null; }

function setMMWeight(el) {
  if (!mmEx) return;
  const name = mmEx.n;
  const before = snapshot();               // must precede the bp_wt write
  const w = wts(), v = parseFloat(el.value), prev = w[name];
  if (isNaN(v) || v <= 0) delete w[name]; else w[name] = v;
  sWt(w);
  const res = logPR(name, prev, v, before);   // only fires on a genuine increase
  renderProg();
  if (res) {
    renderRank(root);
    closeMM();
    if (!showCelebration(res)) toast(`${name} ${prev} → ${v} lbs`);
    return;
  }
  renderRank(root);
  paintMMStanding();                  // the editor is still open on a changed lift
  toast(`${name}: ${v > 0 ? v + ' lbs' : 'cleared'}`);
}

/* ═══════════════════ BODYWEIGHT ═══════════════════ */
function bwSort(l) { return [...l].sort((a,b) => a.d.localeCompare(b.d)); }
function bwSet(d, w) { const l = bwAll(); const i = l.findIndex(e => e.d === d); if (i>=0) l[i].w = w; else l.push({d,w}); bwSv(bwSort(l)); }
function bwDel(d) { bwSv(bwAll().filter(e => e.d !== d)); }
function bwFmt(d) { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function bwDaysBetween(a,b) { return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000); }
function bwRelLabel(d) {
  const days = bwDaysBetween(d, todayStr());
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  if (days < 30)  return `${Math.round(days/7)}w ago`;
  if (days < 365) return `${Math.round(days/30)}mo ago`;
  return `${Math.round(days/365)}y ago`;
}
function bwFilteredForChart() {
  const l = bwAll(), r = BW_RANGES.find(x => x.k === bwRange);
  if (!r || r.d === null) return l;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - r.d);
  const cs = dateStr(cutoff);
  return l.filter(e => e.d >= cs);
}
function bwStats() {
  const all = bwAll(); if (all.length === 0) return null;
  const cur = all[all.length-1].w;
  const total = cur - all[0].w;
  function deltaWindow(days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cs = dateStr(cutoff);
    const recent = all.filter(e => e.d >= cs);
    if (recent.length < 2) return null;
    return recent[recent.length-1].w - recent[0].w;
  }
  return { cur, d7: deltaWindow(7), d30: deltaWindow(30), total };
}
function bwChartSVG(entries) {
  if (entries.length === 0) return '<div class="bw-empty">No entries in this range yet.</div>';
  if (entries.length === 1) {
    const e = entries[0];
    return `<div class="bw-empty">Just one entry: <b style="color:var(--text)">${e.w} lbs</b> on ${bwFmt(e.d)}.<br>Log more to see a trend.</div>`;
  }
  /* Pull the palette from the active theme so the chart re-colours with it. */
  const cs = getComputedStyle(document.documentElement);
  const C = k => cs.getPropertyValue(k).trim();
  const AC = C('--blue'), GRID = C('--grid'), AXIS = C('--text-3'), CARD = C('--bg-card');
  const W=600,H=200,PADL=36,PADR=12,PADT=14,PADB=22;
  const innerW=W-PADL-PADR, innerH=H-PADT-PADB;
  const ws=entries.map(e=>e.w);
  const minW=Math.min(...ws), maxW=Math.max(...ws);
  const range=Math.max(maxW-minW,1), pad=range*0.18;
  const yMin=minW-pad, yMax=maxW+pad, n=entries.length;
  const xOf=i=>PADL+(i/(n-1))*innerW;
  const yOf=w=>PADT+innerH-((w-yMin)/(yMax-yMin))*innerH;
  const points=entries.map((e,i)=>[xOf(i),yOf(e.w)]);
  const linePath='M '+points.map(p=>`${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
  const areaPath=linePath+` L ${points[n-1][0].toFixed(1)} ${PADT+innerH} L ${points[0][0].toFixed(1)} ${PADT+innerH} Z`;
  const gridCount=4; let gridHTML='';
  for (let i=0;i<=gridCount;i++) {
    const v=yMin+((yMax-yMin)*i/gridCount);
    const y=(PADT+innerH-(i/gridCount)*innerH).toFixed(1);
    gridHTML+=`<line x1="${PADL}" y1="${y}" x2="${W-PADR}" y2="${y}" stroke="${GRID}" stroke-width="1" stroke-dasharray="2,3"/><text x="${PADL-6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="${AXIS}" font-family="JetBrains Mono, monospace" font-size="9">${v.toFixed(0)}</text>`;
  }
  const xIdx=n>=4?[0,Math.floor(n/2),n-1]:[0,n-1];
  const xHTML=xIdx.map(i=>`<text x="${xOf(i).toFixed(1)}" y="${H-6}" text-anchor="middle" fill="${AXIS}" font-family="JetBrains Mono, monospace" font-size="9">${bwFmt(entries[i].d)}</text>`).join('');
  const dotsHTML=points.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${AC}" stroke="${CARD}" stroke-width="2"><title>${entries[i].w} lbs · ${bwFmt(entries[i].d)}</title></circle>`).join('');
  return `<svg class="bw-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="bw-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${AC}" stop-opacity="0.28"/><stop offset="100%" stop-color="${AC}" stop-opacity="0"/></linearGradient></defs>
    ${gridHTML}
    <path d="${areaPath}" fill="url(#bw-grad)"/>
    <path d="${linePath}" fill="none" stroke="${AC}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dotsHTML}
    ${xHTML}
  </svg>`;
}
function bwStatBox(label, value, unit, delta) {
  let dHTML = '<div class="bw-stat-d flat">·</div>';
  if (delta !== null && delta !== undefined) {
    const cls = delta > 0.05 ? 'up' : delta < -0.05 ? 'dn' : 'flat';
    const sign = delta > 0 ? '+' : '';
    dHTML = `<div class="bw-stat-d ${cls}">${sign}${delta.toFixed(1)} lbs</div>`;
  }
  return `<div class="bw-stat"><div class="bw-stat-v">${value}<span class="bw-stat-u">${unit}</span></div><div class="bw-stat-l">${label}</div>${dHTML}</div>`;
}
function renderBW() {
  const p = q('#p-bw'), all = bwAll(), s = bwStats();
  let h = '';
  if (s) {
    const fmtD = v => v === null ? null : v;
    h += `<div class="bw-stats">
      ${bwStatBox('Current', s.cur.toFixed(1), 'lbs', null)}
      ${bwStatBox('7 Day', s.d7!==null?s.d7.toFixed(1):'—', 'lbs', fmtD(s.d7))}
      ${bwStatBox('30 Day', s.d30!==null?s.d30.toFixed(1):'—', 'lbs', fmtD(s.d30))}
      ${bwStatBox('Total', s.total.toFixed(1), 'lbs', s.total)}
    </div>`;
  }
  const filtered = bwFilteredForChart();
  const rngBtns = BW_RANGES.map(r => `<button class="bw-r-btn ${r.k===bwRange?'sel':''}" data-act="bw-range" data-k="${r.k}">${r.lbl}</button>`).join('');
  h += `<div class="bw-chart-card"><div class="bw-chart-head"><div class="bw-chart-title">Trend</div><div class="bw-range">${rngBtns}</div></div>${bwChartSVG(filtered)}</div>`;

  const editing = bwEditDate !== null;
  const editEntry = editing ? all.find(e => e.d === bwEditDate) : null;
  h += `<div class="bw-add ${editing?'editing':''}">
    <div class="bw-add-fld"><div class="bw-add-lbl">${editing?'Editing':'Date'}</div><input class="bw-in" type="date" id="bw-date" value="${editing?bwEditDate:todayStr()}" max="${todayStr()}" ${editing?'readonly':''}></div>
    <div class="bw-add-fld"><div class="bw-add-lbl">Weight (lbs)</div><input class="bw-in" type="number" step="0.1" min="0" id="bw-weight" placeholder="—" value="${editEntry?editEntry.w:''}" inputmode="decimal"></div>
    <button class="bw-add-btn" data-act="bw-save">${editing?'Update':'Log'}</button>
    ${editing?`<button class="bw-add-btn ghost" data-act="bw-cancel">Cancel Edit</button>`:''}
  </div>`;

  if (all.length > 0) {
    h += `<div class="day-card"><div class="day-top"><div class="day-top-l"><span class="day-badge hist">History</span><span class="day-title">${all.length} ${all.length===1?'Entry':'Entries'}</span></div><span class="day-prog">${bwFmt(all[0].d)} → ${bwFmt(all[all.length-1].d)}</span></div><div class="bw-hist">`;
    const reversed = [...all].reverse();
    reversed.forEach((e, i) => {
      const prior = reversed[i+1];
      let dHTML;
      if (prior) {
        const d = e.w - prior.w;
        const cls = d > 0.05 ? 'up' : d < -0.05 ? 'dn' : 'flat';
        const arrow = d > 0.05 ? '↑' : d < -0.05 ? '↓' : '•';
        const sign = d > 0 ? '+' : '';
        dHTML = `<div class="bw-h-d ${cls}">${arrow} ${sign}${d.toFixed(1)}</div>`;
      } else dHTML = `<div class="bw-h-d flat">start</div>`;
      h += `<div class="bw-h-row">
        <div><div class="bw-h-date">${bwFmt(e.d)}</div><div class="bw-h-rel">${bwRelLabel(e.d)}</div></div>
        <div class="bw-h-w">${e.w.toFixed(1)}<span class="bw-h-w-u">lbs</span></div>
        ${dHTML}
        <div class="bw-h-act">
          <button class="bw-h-btn" data-act="bw-edit" data-d="${e.d}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="bw-h-btn del" data-act="bw-del" data-d="${e.d}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
        </div>
      </div>`;
    });
    h += `</div></div>`;
  }
  p.innerHTML = h;
}
function bwSetRange(k) { bwRange = k; renderBW(); }
function bwSave() {
  const d = q('#bw-date').value, w = parseFloat(q('#bw-weight').value);
  if (!d) { toast('Pick a date'); return; }
  if (isNaN(w) || w <= 0) { toast('Enter a valid weight'); return; }
  const editing = bwEditDate !== null;
  bwSet(d, w); bwEditDate = null; renderBW();
  renderProg();                       // every lift is scored against bodyweight
  toast(editing ? 'Updated' : `Logged ${w} lbs`);
}
function bwEdit(d) {
  bwEditDate = d; renderBW();
  setTimeout(() => { const el = q('#bw-weight'); if (el) { el.focus(); el.select?.(); } }, 50);
}
function bwCancelEdit() { bwEditDate = null; renderBW(); }
function bwDelete(d) {
  if (!confirm(`Delete entry for ${bwFmt(d)}?`)) return;
  bwDel(d); if (bwEditDate === d) bwEditDate = null; renderBW();
  renderProg();
  toast('Entry deleted');
}

/* ═══════════════════ CELEBRATION ═══════════════════ */
/* Rank-ups and milestone unlocks get a card, not a toast — the reward
   moment is the whole point of the progress tab. Returns false when
   there was nothing worth interrupting for (caller falls back to a toast). */
function showCelebration(res) {
  const html = celebrationHTML(res);
  if (!html) return false;
  q('#lv-body').innerHTML = html;
  q('#lv-ol').classList.add('on');
  return true;
}
function closeCelebration() { q('#lv-ol').classList.remove('on'); }

function progDelete(d, di) {
  delSession(d, di);
  renderRank(root); renderProg();
  toast('Session removed');
}
/* The rep assumption feeds the 1RM estimate, so it moves every score —
   and with them the Program tab's colours. */
function rkSetReps(r) { setReps(r); renderRank(root); renderProg(); }

/* ═══════════════════ TABS ═══════════════════ */
function switchTab(tab) {
  activeTab = tab;
  root.querySelectorAll('.wk .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  root.querySelectorAll('.wk .panel').forEach(pl => pl.classList.remove('active'));
  q('#p-' + tab).classList.add('active');
  if (tab === 'rank') renderRank(root);
}

/* ═══════════════════ EVENT DELEGATION ═══════════════════ */
function onClick(e) {
  if (e.target.classList && e.target.classList.contains('mm-overlay')) { closeMM(); return; }
  if (e.target.classList && e.target.classList.contains('lv-overlay')) { closeCelebration(); return; }
  /* Tapping a shape names it. On a touch screen this is the only way to ask
     "which one is that", since there is no hover to lean on. */
  const reg = e.target.closest && e.target.closest('.m-region');
  if (reg && root.contains(reg)) { mmReadout(regionName(reg)); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const a = el.dataset;
  switch (a.act) {
    case 'tab':       switchTab(a.tab); break;
    case 'row':       openMM(resEx(PROGRAM[+a.di].sections[+a.si].ex[+a.ei])); break;
    case 'chk':       toggleChk(a.k); break;
    case 'clear':     clearChk(); break;
    case 'mm-close':  closeMM(); break;
    case 'mm-chip':   mmReadout(el.textContent); break;
    case 'bw-range':  bwSetRange(a.k); break;
    case 'bw-save':   bwSave(); break;
    case 'bw-edit':   bwEdit(a.d); break;
    case 'bw-del':    bwDelete(a.d); break;
    case 'bw-cancel': bwCancelEdit(); break;
    case 'lv-close':  closeCelebration(); break;
    case 'pg-del':    progDelete(a.d, a.di); break;
    case 'rk-reps':   rkSetReps(+a.r); break;
  }
}
function onChange(e) { if (e.target.id === 'mm-wt') setMMWeight(e.target); }

/* Hover, for anyone on a mouse: over a shape names it, over a chip lights
   the shapes it belongs to. Touch gets the same answers through onClick. */
function onOver(e) {
  const chip = e.target.closest?.('.mm-muscle-chip');
  if (chip) { focusMuscle(chip.dataset.m, true); mmReadout(chip.textContent); return; }
  const reg = e.target.closest?.('.m-region');
  if (reg) mmReadout(regionName(reg));
}
function onOut(e) {
  if (e.target.closest?.('.mm-muscle-chip')) focusMuscle(null, false);
}

/* Settings changed the pull-up-bar flag or the theme. Re-render everything:
   the program swaps exercises, and the bodyweight chart bakes theme colours
   into its SVG at render time so it has to be redrawn too. */
function onExternalChange() {
  if (!root) return;
  renderProg(); renderBW();
  if (activeTab === 'rank') renderRank(root);
}
function onKeydown(e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'bw-weight') bwSave();
  else if (e.target.id === 'mm-wt') e.target.blur();
}

/* ═══════════════════ STATIC MARKUP ═══════════════════ */
/* ═══════════════════ THE BODY MAP ═══════════════════
   Two figures, each its own <svg> so they can sit side by side on a wide
   screen and stack on a narrow one without redrawing anything.

   Regions are <path> silhouettes rather than the ellipses this started as,
   because the map has to answer "which muscle" and not just "roughly where".
   Both figures share BASE — the same body, turned around — so the two stay
   in proportion when one of them is edited.

   Left and right are the VIEWER's left and right, mirrored about x = 75.
   Arms hang abducted a few degrees so the deltoid caps the joint instead of
   floating in a gap. Everything sits in a 150 × 340 box. */
const BASE = `
  <ellipse class="m-base" cx="75" cy="27" rx="13.5" ry="17.5"/>
  <path class="m-base" d="M68,41 h14 v15 h-14 z"/>
  <path class="m-base" d="M43,68 C52,57 62,54 75,54 C88,54 98,57 107,68 L104,94 C100,117 96,129 95,142 C94,154 96,160 98,169 L88,182 L75,178 L62,182 L52,169 C54,160 56,154 55,142 C54,129 50,117 46,94 Z"/>
  <path class="m-base" d="M46,64 L33,70 L29,120 L42,122 Z"/>
  <path class="m-base" d="M104,64 L117,70 L121,120 L108,122 Z"/>
  <path class="m-base" d="M29,120 L42,122 L39,167 L26,165 Z"/>
  <path class="m-base" d="M121,120 L108,122 L111,167 L124,165 Z"/>
  <ellipse class="m-base" cx="31" cy="176" rx="6" ry="10"/>
  <ellipse class="m-base" cx="119" cy="176" rx="6" ry="10"/>
  <path class="m-base" d="M53,169 L74,179 L73,251 L58,251 Z"/>
  <path class="m-base" d="M97,169 L76,179 L77,251 L92,251 Z"/>
  <path class="m-base" d="M58,251 L73,251 L72,317 L61,317 Z"/>
  <path class="m-base" d="M92,251 L77,251 L78,317 L89,317 Z"/>
  <path class="m-base" d="M61,317 L72,317 L73,331 L57,331 Z"/>
  <path class="m-base" d="M89,317 L78,317 L77,331 L93,331 Z"/>`;

const FRONT_SVG = `<svg viewBox="0 0 150 340" xmlns="http://www.w3.org/2000/svg" class="m-fig" role="img" aria-label="Front view of the body">
  ${BASE}
  <path id="f-trap-l" class="m-region" d="M68,45 C66,54 62,58 52,64 L46,62 C55,54 62,48 67,44 Z"><title>Traps</title></path>
  <path id="f-trap-r" class="m-region" d="M82,45 C84,54 88,58 98,64 L104,62 C95,54 88,48 83,44 Z"><title>Traps</title></path>
  <path id="f-delt-a-l" class="m-region" d="M48,63 C45,72 45,84 47,92 L54,89 C51,80 51,70 54,64 Z"><title>Front Delt</title></path>
  <path id="f-delt-a-r" class="m-region" d="M102,63 C105,72 105,84 103,92 L96,89 C99,80 99,70 96,64 Z"><title>Front Delt</title></path>
  <path id="f-delt-s-l" class="m-region" d="M49,61 C38,63 31,72 30,86 L44,90 C43,78 44,68 50,63 Z"><title>Side Delt</title></path>
  <path id="f-delt-s-r" class="m-region" d="M101,61 C112,63 119,72 120,86 L106,90 C107,78 106,68 100,63 Z"><title>Side Delt</title></path>
  <path id="f-pec-up-l" class="m-region" d="M56,65 C64,62 71,63 74,66 L74,77 C67,74 60,76 54,80 Z"><title>Upper Chest</title></path>
  <path id="f-pec-up-r" class="m-region" d="M94,65 C86,62 79,63 76,66 L76,77 C83,74 90,76 96,80 Z"><title>Upper Chest</title></path>
  <path id="f-pec-l" class="m-region" d="M54,81 C61,77 68,76 74,79 L74,99 C65,100 57,97 51,92 Z"><title>Chest</title></path>
  <path id="f-pec-r" class="m-region" d="M96,81 C89,77 82,76 76,79 L76,99 C85,100 93,97 99,92 Z"><title>Chest</title></path>
  <path id="f-serra-l" class="m-region" d="M53,96 L62,101 L61,112 L55,108 Z"><title>Serratus Anterior</title></path>
  <path id="f-serra-r" class="m-region" d="M97,96 L88,101 L89,112 L95,108 Z"><title>Serratus Anterior</title></path>
  <path id="f-tva" class="m-region" d="M58,124 C64,127 86,127 92,124 L91,148 C84,152 66,152 59,148 Z"><title>Transverse Abdominis</title></path>
  <path id="f-abs-1-l" class="m-region" d="M66,101 L74,101 L74,113 L65,113 Z"><title>Upper Abs</title></path>
  <path id="f-abs-1-r" class="m-region" d="M84,101 L76,101 L76,113 L85,113 Z"><title>Upper Abs</title></path>
  <path id="f-abs-2-l" class="m-region" d="M65,115 L74,115 L74,127 L65,127 Z"><title>Mid Abs</title></path>
  <path id="f-abs-2-r" class="m-region" d="M85,115 L76,115 L76,127 L85,127 Z"><title>Mid Abs</title></path>
  <path id="f-abs-3-l" class="m-region" d="M65,129 L74,129 L74,146 L67,145 Z"><title>Lower Abs</title></path>
  <path id="f-abs-3-r" class="m-region" d="M85,129 L76,129 L76,146 L83,145 Z"><title>Lower Abs</title></path>
  <path id="f-obli-l" class="m-region" d="M63,100 L56,105 L55,124 L58,140 L64,147 L64,128 Z"><title>Obliques</title></path>
  <path id="f-obli-r" class="m-region" d="M87,100 L94,105 L95,124 L92,140 L86,147 L86,128 Z"><title>Obliques</title></path>
  <path id="f-hipflex-l" class="m-region" d="M62,148 L74,152 L73,170 L59,163 Z"><title>Hip Flexors</title></path>
  <path id="f-hipflex-r" class="m-region" d="M88,148 L76,152 L77,170 L91,163 Z"><title>Hip Flexors</title></path>
  <path id="f-bi-l" class="m-region" d="M42,73 C36,79 35,94 37,106 L46,105 C44,93 45,80 48,75 Z"><title>Biceps</title></path>
  <path id="f-bi-r" class="m-region" d="M108,73 C114,79 115,94 113,106 L104,105 C106,93 105,80 102,75 Z"><title>Biceps</title></path>
  <path id="f-brach-l" class="m-region" d="M35,103 L45,102 L44,119 L33,118 Z"><title>Brachialis</title></path>
  <path id="f-brach-r" class="m-region" d="M115,103 L105,102 L106,119 L117,118 Z"><title>Brachialis</title></path>
  <path id="f-brad-l" class="m-region" d="M30,122 C34,130 34,142 32,150 L27,148 C28,138 28,130 27,122 Z"><title>Brachioradialis</title></path>
  <path id="f-brad-r" class="m-region" d="M120,122 C116,130 116,142 118,150 L123,148 C122,138 122,130 123,122 Z"><title>Brachioradialis</title></path>
  <path id="f-fore-l" class="m-region" d="M33,123 L41,124 L39,164 L30,162 L33,148 Z"><title>Forearms</title></path>
  <path id="f-fore-r" class="m-region" d="M117,123 L109,124 L111,164 L120,162 L117,148 Z"><title>Forearms</title></path>
  <path id="f-quad-vl-l" class="m-region" d="M54,174 C60,180 61,196 61,214 C61,222 60,226 58,228 L55,222 C54,206 53,190 53,178 Z"><title>Quads · Vastus Lateralis</title></path>
  <path id="f-quad-vl-r" class="m-region" d="M96,174 C90,180 89,196 89,214 C89,222 90,226 92,228 L95,222 C96,206 97,190 97,178 Z"><title>Quads · Vastus Lateralis</title></path>
  <path id="f-quad-rf-l" class="m-region" d="M62,180 C68,181 71,183 71,187 L70,231 C66,233 63,231 62,228 Z"><title>Quads · Rectus Femoris</title></path>
  <path id="f-quad-rf-r" class="m-region" d="M88,180 C82,181 79,183 79,187 L80,231 C84,233 87,231 88,228 Z"><title>Quads · Rectus Femoris</title></path>
  <path id="f-quad-vm-l" class="m-region" d="M71,212 C73,220 73,234 71,244 C66,243 62,236 62,227 C62,220 66,214 71,212 Z"><title>Quads · Vastus Medialis</title></path>
  <path id="f-quad-vm-r" class="m-region" d="M79,212 C77,220 77,234 79,244 C84,243 88,236 88,227 C88,220 84,214 79,212 Z"><title>Quads · Vastus Medialis</title></path>
  <path id="f-addu-l" class="m-region" d="M72,181 L74,182 L74,224 L68,218 C69,206 70,192 72,181 Z"><title>Adductors</title></path>
  <path id="f-addu-r" class="m-region" d="M78,181 L76,182 L76,224 L82,218 C81,206 80,192 78,181 Z"><title>Adductors</title></path>
</svg>`;

const BACK_SVG = `<svg viewBox="0 0 150 340" xmlns="http://www.w3.org/2000/svg" class="m-fig" role="img" aria-label="Back view of the body">
  ${BASE}
  <path id="b-trap-u-l" class="m-region" d="M68,45 C66,54 61,59 51,65 L45,62 C55,54 62,48 67,44 Z"><title>Traps</title></path>
  <path id="b-trap-u-r" class="m-region" d="M82,45 C84,54 89,59 99,65 L105,62 C95,54 88,48 83,44 Z"><title>Traps</title></path>
  <path id="b-trap-m" class="m-region" d="M67,58 L83,58 L89,76 L75,108 L61,76 Z"><title>Mid Traps</title></path>
  <path id="b-rdelt-l" class="m-region" d="M49,61 C38,64 31,73 30,87 L45,91 C44,79 45,68 51,63 Z"><title>Rear Delt</title></path>
  <path id="b-rdelt-r" class="m-region" d="M101,61 C112,64 119,73 120,87 L105,91 C106,79 105,68 99,63 Z"><title>Rear Delt</title></path>
  <path id="b-rhom" class="m-region" d="M69,64 L81,64 L83,82 L75,90 L67,82 Z"><title>Rhomboids</title></path>
  <path id="b-lat-l" class="m-region" d="M51,80 C57,90 63,96 73,101 L73,128 C64,124 57,113 52,99 Z"><title>Lats</title></path>
  <path id="b-lat-r" class="m-region" d="M99,80 C93,90 87,96 77,101 L77,128 C86,124 93,113 98,99 Z"><title>Lats</title></path>
  <path id="b-erec-l" class="m-region" d="M69,106 L74,110 L74,148 L68,146 Z"><title>Erectors</title></path>
  <path id="b-erec-r" class="m-region" d="M81,106 L76,110 L76,148 L82,146 Z"><title>Erectors</title></path>
  <path id="b-tri-lat-l" class="m-region" d="M44,70 L39,74 L34,106 L40,108 Z"><title>Triceps · Lateral Head</title></path>
  <path id="b-tri-lat-r" class="m-region" d="M106,70 L111,74 L116,106 L110,108 Z"><title>Triceps · Lateral Head</title></path>
  <path id="b-tri-long-l" class="m-region" d="M45,71 L50,76 L48,110 L41,109 Z"><title>Triceps · Long Head</title></path>
  <path id="b-tri-long-r" class="m-region" d="M105,71 L100,76 L102,110 L109,109 Z"><title>Triceps · Long Head</title></path>
  <path id="b-fore-l" class="m-region" d="M31,123 L41,124 L39,164 L29,162 Z"><title>Forearms</title></path>
  <path id="b-fore-r" class="m-region" d="M119,123 L109,124 L111,164 L121,162 Z"><title>Forearms</title></path>
  <path id="b-glute-l" class="m-region" d="M57,150 C50,158 51,174 61,180 L74,177 L74,152 Z"><title>Glutes</title></path>
  <path id="b-glute-r" class="m-region" d="M93,150 C100,158 99,174 89,180 L76,177 L76,152 Z"><title>Glutes</title></path>
  <path id="b-ham-l" class="m-region" d="M59,183 C64,184 70,184 73,183 L72,242 C66,243 61,242 60,240 Z"><title>Hamstrings</title></path>
  <path id="b-ham-r" class="m-region" d="M91,183 C86,184 80,184 77,183 L78,242 C84,243 89,242 90,240 Z"><title>Hamstrings</title></path>
  <path id="b-gastro-l" class="m-region" d="M60,260 C57,272 58,286 62,293 L71,291 C73,280 72,268 70,260 Z"><title>Gastrocnemius</title></path>
  <path id="b-gastro-r" class="m-region" d="M90,260 C93,272 92,286 88,293 L79,291 C77,280 78,268 80,260 Z"><title>Gastrocnemius</title></path>
  <path id="b-soleus-l" class="m-region" d="M61,293 L71,292 L70,314 L63,314 Z"><title>Soleus</title></path>
  <path id="b-soleus-r" class="m-region" d="M89,293 L79,292 L80,314 L87,314 Z"><title>Soleus</title></path>
</svg>`;

const MUSCLE_SVG = `<figure class="m-side"><figcaption class="m-label">Front</figcaption>${FRONT_SVG}</figure>
  <figure class="m-side"><figcaption class="m-label">Back</figcaption>${BACK_SVG}</figure>`;

function template() {
  return `<div class="wk">
    <div class="app-head"><h1>Build Program</h1><p>Dumbbells + Bench · 4 Day Upper/Lower · Rank Up</p></div>
    <nav class="nav"><div class="nav-inner">
      <button class="tab active" data-act="tab" data-tab="program">Program</button>
      <button class="tab" data-act="tab" data-tab="bw">Weight</button>
      <button class="tab" data-act="tab" data-tab="rank">Rank</button>
    </div></nav>
    <div class="app-wrap">
      <div class="panel active" id="p-program"></div>
      <div class="panel" id="p-bw"></div>
      <div class="panel" id="p-rank"></div>
    </div>

    <div class="mm-overlay" id="mm-ol">
      <div class="mm-card">
        <div class="mm-head"><div class="mm-title" id="mm-name"></div><button class="mm-close" data-act="mm-close">&times;</button></div>
        <div class="mm-info" id="mm-info"></div>
        <div class="mm-wt-row">
          <span class="mm-wt-lbl">Working Weight</span>
          <div class="mm-wt-box"><input class="mm-wt-in" id="mm-wt" type="number" step="2.5" min="0" inputmode="decimal" placeholder="—"><span class="mm-wt-u">lbs</span></div>
        </div>
        <div id="mm-rank"></div>
        <div class="mm-map">${MUSCLE_SVG}</div>
        <div class="m-readout" id="mm-readout"></div>
        <div class="mm-muscles"><div class="mm-muscles-title">Target Muscles</div><div class="mm-muscle-list" id="mm-mlist"></div></div>
      </div>
    </div>

    <div class="lv-overlay" id="lv-ol"><div id="lv-body"></div></div>
  </div>`;
}

/* ═══════════════════ LIFECYCLE ═══════════════════ */
export default {
  id: 'workout',
  name: 'Workout',
  storagePrefix: 'bp_',
  styles: 'apps/workout/workout.css',
  /* A dumbbell read left to right: outer collar, plate, bar, plate, collar. */
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="9.5" width="3" height="5" rx="1.2"/><rect x="4.5" y="6.5" width="3.5" height="11" rx="1.4"/><path d="M8 12h8"/><rect x="16" y="6.5" width="3.5" height="11" rx="1.4"/><rect x="19.5" y="9.5" width="3" height="5" rx="1.2"/></svg>',
  mount(el) {
    root = el;
    /* activeTab deliberately survives a remount — coming back to an app
       should return you to the tab you left, not to its front page. */
    bwRange = '30'; bwEditDate = null; mmEx = null;
    root.innerHTML = template();
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    window.addEventListener('bs:datachange', onExternalChange);
    renderProg(); renderBW();
    switchTab(activeTab);
  },
  unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
    }
    window.removeEventListener('bs:datachange', onExternalChange);
    root = null;
  },
};
