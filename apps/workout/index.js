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
   Two figures, each its own <svg> so they sit side by side on a wide screen
   and stack on a narrow one without redrawing anything.

   Drawn to standard 8-head proportions in a 160 × 340 box: head 10-50,
   nipple 90, navel 130, crotch 170, knee 250, sole 330. Each limb is ONE
   path from the shoulder or hip all the way to the wrist or ankle, because
   building them from separate upper and lower segments left a visible seam
   at every elbow and knee.

   Regions tile rather than float — they share borders and cover the body the
   way an anatomy plate does, so the figure still reads as musculature when
   nothing is lit. The only bare patch is over the scapula, which is
   infraspinatus and teres, and this app has no lift that tracks them.

   Left and right are the VIEWER's, mirrored about x = 80. The mirrors are
   generated, not hand-typed, so the halves cannot drift apart.

   The two figures share BASE. Whatever you change there changes both. */
const BASE = `
  <path class="m-base" d="M80,10 C89.5,10 95,18.5 95,29 C95,39 89,49 80,51 C71,49 65,39 65,29 C65,18.5 70.5,10 80,10 Z"/>
  <path class="m-base" d="M72,44 C72,54 70,58.5 66,62 C58,64 50.5,68 45,74 C47,86 48.5,94 50,102 C52.5,114 54.5,124 55.5,136 C55.5,148 54,158 53,168 C54,178 60,183.5 68,185.5 L80,187 L92,185.5 C100,183.5 106,178 107,168 C106,158 104.5,148 104.5,136 C105.5,124 107.5,114 110,102 C111.5,94 113,86 115,74 C109.5,68 102,64 94,62 C90,58.5 88,54 88,44 Z"/>
  <path class="m-base" d="M46,70 C37,74 32.5,84 31.5,95 C30.5,107 30.5,119 32,131 C30,141 29,152 28.5,163 C28,173 28.5,181 30,188 L40.5,187 C40,180 40,172 40.5,164 C41.5,152 43,141 44.5,131 C45.5,119 47,107 48.5,97 C49.5,87 51,77 53,71 Z"/>
  <path class="m-base" d="M114,70 C123,74 127.5,84 128.5,95 C129.5,107 129.5,119 128,131 C130,141 131,152 131.5,163 C132,173 131.5,181 130,188 L119.5,187 C120,180 120,172 119.5,164 C118.5,152 117,141 115.5,131 C114.5,119 113,107 111.5,97 C110.5,87 109,77 107,71 Z"/>
  <path class="m-base" d="M30,186 C27,192 26.5,201 28.5,208 C31,214 36,214 38.5,209 C40.5,202 41,193 40.5,186 Z"/>
  <path class="m-base" d="M130,186 C133,192 133.5,201 131.5,208 C129,214 124,214 121.5,209 C119.5,202 119,193 119.5,186 Z"/>
  <path class="m-base" d="M53,167 C50.5,181 49.5,197 50.5,212 C51.5,228 54,241 58.5,251 C56.5,260 56,270 57.5,280 C59,291 61.5,300 63.5,310 C64.5,317 65,322 65,326 L74,326 C74.5,320 75,313 75.5,305 C76,294 76,285 76.5,275 C77,264 77.5,257 77.5,251 C79,235 79.5,215 79.5,200 C79.8,192 79.8,175 78.5,169 Z"/>
  <path class="m-base" d="M107,167 C109.5,181 110.5,197 109.5,212 C108.5,228 106,241 101.5,251 C103.5,260 104,270 102.5,280 C101,291 98.5,300 96.5,310 C95.5,317 95,322 95,326 L86,326 C85.5,320 85,313 84.5,305 C84,294 84,285 83.5,275 C83,264 82.5,257 82.5,251 C81,235 80.5,215 80.5,200 C80.2,192 80.2,175 81.5,169 Z"/>
  <path class="m-base" d="M64.5,323 C62,326 60,329 60,332 C60,334.5 62,335.5 66,335.5 L76,335.5 C77,331 76.5,326 76,323 Z"/>
  <path class="m-base" d="M95.5,323 C98,326 100,329 100,332 C100,334.5 98,335.5 94,335.5 L84,335.5 C83,331 83.5,326 84,323 Z"/>`;

const FRONT_SVG = `<svg viewBox="0 0 160 340" xmlns="http://www.w3.org/2000/svg" class="m-fig" role="img" aria-label="Front view of the body">
  ${BASE}
  <path id="f-trap-l" class="m-region" d="M73,45 C73,54 71,59 67,62 C59,64 51,68.5 46,74.5 C49,81 56,83 63,80 C69,75 74,69 75,62 C75,55 74,49 73,45 Z"><title>Traps</title></path>
  <path id="f-trap-r" class="m-region" d="M87,45 C87,54 89,59 93,62 C101,64 109,68.5 114,74.5 C111,81 104,83 97,80 C91,75 86,69 85,62 C85,55 86,49 87,45 Z"><title>Traps</title></path>
  <path id="f-delt-s-l" class="m-region" d="M46,70 C37,74 32.5,84 31.5,95 C31.1,100 31,104 31.2,108 L41.5,106 C42.2,95 43.6,82 47,70 Z"><title>Side Delt</title></path>
  <path id="f-delt-s-r" class="m-region" d="M114,70 C123,74 127.5,84 128.5,95 C128.9,100 129,104 128.8,108 L118.5,106 C117.8,95 116.4,82 113,70 Z"><title>Side Delt</title></path>
  <path id="f-delt-a-l" class="m-region" d="M47,70 C51,67.5 54,69.5 55,73 C53,83 50.2,93 48.7,104 L41.5,106 C42.2,95 43.6,82 47,70 Z"><title>Front Delt</title></path>
  <path id="f-delt-a-r" class="m-region" d="M113,70 C109,67.5 106,69.5 105,73 C107,83 109.8,93 111.3,104 L118.5,106 C117.8,95 116.4,82 113,70 Z"><title>Front Delt</title></path>
  <path id="f-pec-up-l" class="m-region" d="M79.3,67 C72,64 64,64.5 57,69 C55,73 54,77 54,81.5 C61,79.5 70,79 79.3,81 Z"><title>Upper Chest</title></path>
  <path id="f-pec-up-r" class="m-region" d="M80.7,67 C88,64 96,64.5 103,69 C105,73 106,77 106,81.5 C99,79.5 90,79 80.7,81 Z"><title>Upper Chest</title></path>
  <path id="f-pec-l" class="m-region" d="M79.3,81 C70,79 61,79.5 54,81.5 C54.5,89 56.5,96.5 59.5,101.5 C66,104.5 73,104.5 79.3,103 Z"><title>Chest</title></path>
  <path id="f-pec-r" class="m-region" d="M80.7,81 C90,79 99,79.5 106,81.5 C105.5,89 103.5,96.5 100.5,101.5 C94,104.5 87,104.5 80.7,103 Z"><title>Chest</title></path>
  <path id="f-serra-l" class="m-region" d="M53.5,95 C55.5,101 57.5,106 59.5,110 L57.5,122 C54.5,117 52.5,108 51.8,100 Z"><title>Serratus Anterior</title></path>
  <path id="f-serra-r" class="m-region" d="M106.5,95 C104.5,101 102.5,106 100.5,110 L102.5,122 C105.5,117 107.5,108 108.2,100 Z"><title>Serratus Anterior</title></path>
  <path id="f-tva" class="m-region" d="M60,132 C68,136 92,136 100,132 C100,145 98,156 94,164 C86,168 74,168 66,164 C62,156 60,145 60,132 Z"><title>Transverse Abdominis</title></path>
  <path id="f-abs-1-l" class="m-region" d="M69,100 C73,99 76.5,99 79.3,100 L79.3,119 L68,119 C68,112 68.5,106 69,100 Z"><title>Upper Abs</title></path>
  <path id="f-abs-1-r" class="m-region" d="M91,100 C87,99 83.5,99 80.7,100 L80.7,119 L92,119 C92,112 91.5,106 91,100 Z"><title>Upper Abs</title></path>
  <path id="f-abs-2-l" class="m-region" d="M68,119 L79.3,119 L79.3,138 L68.2,138 Z"><title>Mid Abs</title></path>
  <path id="f-abs-2-r" class="m-region" d="M92,119 L80.7,119 L80.7,138 L91.8,138 Z"><title>Mid Abs</title></path>
  <path id="f-abs-3-l" class="m-region" d="M68.2,138 L79.3,138 L79.3,160.5 C76,162 73,161 71,159 C70,152 68.8,145 68.2,138 Z"><title>Lower Abs</title></path>
  <path id="f-abs-3-r" class="m-region" d="M91.8,138 L80.7,138 L80.7,160.5 C84,162 87,161 89,159 C90,152 91.2,145 91.8,138 Z"><title>Lower Abs</title></path>
  <path id="f-obli-l" class="m-region" d="M67.5,100 C63,101 60,104 58.5,109 C57.5,120 57.5,132 59,143 C61,152 64,159 68,163 C69,152 68.4,140 68,128 C67.6,118 67.5,109 67.5,100 Z"><title>Obliques</title></path>
  <path id="f-obli-r" class="m-region" d="M92.5,100 C97,101 100,104 101.5,109 C102.5,120 102.5,132 101,143 C99,152 96,159 92,163 C91,152 91.6,140 92,128 C92.4,118 92.5,109 92.5,100 Z"><title>Obliques</title></path>
  <path id="f-hipflex-l" class="m-region" d="M64,158 C70,163 75,166 79.3,167 L79.3,186 L69,184.5 C65,177 63,167 63,160 Z"><title>Hip Flexors</title></path>
  <path id="f-hipflex-r" class="m-region" d="M96,158 C90,163 85,166 80.7,167 L80.7,186 L91,184.5 C95,177 97,167 97,160 Z"><title>Hip Flexors</title></path>
  <path id="f-bi-l" class="m-region" d="M47,80 C44.5,88 43,98 42.5,108 C42.3,115 42.5,121 43,126 L34.8,126 C34.5,116 35.5,105 37,96 C38,88 39.5,83 41.5,79 Z"><title>Biceps</title></path>
  <path id="f-bi-r" class="m-region" d="M113,80 C115.5,88 117,98 117.5,108 C117.7,115 117.5,121 117,126 L125.2,126 C125.5,116 124.5,105 123,96 C122,88 120.5,83 118.5,79 Z"><title>Biceps</title></path>
  <path id="f-brach-l" class="m-region" d="M34.8,126 L43,126 C43.3,132 43.7,138 44,143 L32.5,143 C32.4,137 33.4,131 34.8,126 Z"><title>Brachialis</title></path>
  <path id="f-brach-r" class="m-region" d="M125.2,126 L117,126 C116.7,132 116.3,138 116,143 L127.5,143 C127.6,137 126.6,131 125.2,126 Z"><title>Brachialis</title></path>
  <path id="f-brad-l" class="m-region" d="M32.5,143 L38,143 C37,155 36,170 35.5,187 L30,187 C29.5,175 30.5,157 32.5,143 Z"><title>Brachioradialis</title></path>
  <path id="f-brad-r" class="m-region" d="M127.5,143 L122,143 C123,155 124,170 124.5,187 L130,187 C130.5,175 129.5,157 127.5,143 Z"><title>Brachioradialis</title></path>
  <path id="f-fore-l" class="m-region" d="M38,143 L44,143 C43,155 41.5,172 41,187 L35.5,187 C36,170 37,155 38,143 Z"><title>Forearms</title></path>
  <path id="f-fore-r" class="m-region" d="M122,143 L116,143 C117,155 118.5,172 119,187 L124.5,187 C124,170 123,155 122,143 Z"><title>Forearms</title></path>
  <path id="f-quad-vl-l" class="m-region" d="M53,172 C51,185 50.5,199 51.5,213 C52.3,226 54,236 57,245 L63,240 C61,229 60.5,215 61,200 C61.3,188 62,179 62.5,173 Z"><title>Quads · Vastus Lateralis</title></path>
  <path id="f-quad-vl-r" class="m-region" d="M107,172 C109,185 109.5,199 108.5,213 C107.7,226 106,236 103,245 L97,240 C99,229 99.5,215 99,200 C98.7,188 98,179 97.5,173 Z"><title>Quads · Vastus Lateralis</title></path>
  <path id="f-quad-rf-l" class="m-region" d="M62.5,173 C62,179 61.3,188 61,200 C60.5,215 61,229 63,240 L70,240 C70.5,228 71,213 71.5,199 C71.8,188 72,179 72,173 Z"><title>Quads · Rectus Femoris</title></path>
  <path id="f-quad-rf-r" class="m-region" d="M97.5,173 C98,179 98.7,188 99,200 C99.5,215 99,229 97,240 L90,240 C89.5,228 89,213 88.5,199 C88.2,188 88,179 88,173 Z"><title>Quads · Rectus Femoris</title></path>
  <path id="f-quad-vm-l" class="m-region" d="M71.5,214 C71,224 70.5,232 70,240 C70,245 71,248.5 73,249.5 C76,247.5 77.5,242 77.8,235 C78,227 77.5,220 77,214 Z"><title>Quads · Vastus Medialis</title></path>
  <path id="f-quad-vm-r" class="m-region" d="M88.5,214 C89,224 89.5,232 90,240 C90,245 89,248.5 87,249.5 C84,247.5 82.5,242 82.2,235 C82,227 82.5,220 83,214 Z"><title>Quads · Vastus Medialis</title></path>
  <path id="f-addu-l" class="m-region" d="M72,173 C72,179 71.8,188 71.5,199 C71.3,206 71,210 71.5,214 L77,214 C77.5,208 78,199 78.5,190 C78.8,182 79,176 79,171 Z"><title>Adductors</title></path>
  <path id="f-addu-r" class="m-region" d="M88,173 C88,179 88.2,188 88.5,199 C88.7,206 89,210 88.5,214 L83,214 C82.5,208 82,199 81.5,190 C81.2,182 81,176 81,171 Z"><title>Adductors</title></path>
</svg>`;

const BACK_SVG = `<svg viewBox="0 0 160 340" xmlns="http://www.w3.org/2000/svg" class="m-fig" role="img" aria-label="Back view of the body">
  ${BASE}
  <path id="b-trap-u-l" class="m-region" d="M73,45 C73,54 71,59 67,62 C59,64 51,68.5 46,74.5 C49,81 56,83 63,80 C69,75 74,69 75,62 C75,55 74,49 73,45 Z"><title>Traps</title></path>
  <path id="b-trap-u-r" class="m-region" d="M87,45 C87,54 89,59 93,62 C101,64 109,68.5 114,74.5 C111,81 104,83 97,80 C91,75 86,69 85,62 C85,55 86,49 87,45 Z"><title>Traps</title></path>
  <path id="b-lat-l" class="m-region" d="M50.5,84 C51,100 53,120 56,138 C60,146.5 68,151 79.3,152.5 L79.3,104 C71,101 62,94 55,84 C53.5,82 51.5,82 50.5,84 Z"><title>Lats</title></path>
  <path id="b-lat-r" class="m-region" d="M109.5,84 C109,100 107,120 104,138 C100,146.5 92,151 80.7,152.5 L80.7,104 C89,101 98,94 105,84 C106.5,82 108.5,82 109.5,84 Z"><title>Lats</title></path>
  <path id="b-trap-m" class="m-region" d="M72,62 L88,62 C91,72 93,82 94,92 C90,105 85,116 80,124 C75,116 70,105 66,92 C67,82 69,72 72,62 Z"><title>Mid Traps</title></path>
  <path id="b-rdelt-l" class="m-region" d="M47,69 C51,67 54,69 55,73 C53,83 50.2,93 48.7,104 L31.2,108 C31,103 31.2,97 32,91 C33.5,81 38.5,73 47,69 Z"><title>Rear Delt</title></path>
  <path id="b-rdelt-r" class="m-region" d="M113,69 C109,67 106,69 105,73 C107,83 109.8,93 111.3,104 L128.8,108 C129,103 128.8,97 128,91 C126.5,81 121.5,73 113,69 Z"><title>Rear Delt</title></path>
  <path id="b-rhom" class="m-region" d="M72,68 L88,68 L90,88 L80,98.5 L70,88 Z"><title>Rhomboids</title></path>
  <path id="b-erec-l" class="m-region" d="M72,126 L79.3,128 L79.3,180 C76,179 73,175 71.5,168 C70.5,155 71,140 72,126 Z"><title>Erectors</title></path>
  <path id="b-erec-r" class="m-region" d="M88,126 L80.7,128 L80.7,180 C84,179 87,175 88.5,168 C89.5,155 89,140 88,126 Z"><title>Erectors</title></path>
  <path id="b-tri-lat-l" class="m-region" d="M45,78 C40,81 36,88 34.5,97 C33.4,107 33,118 33.2,128 L38.5,128 C38.3,116 39,103 40.5,92 C41.5,85 43,81 45,78 Z"><title>Triceps · Lateral Head</title></path>
  <path id="b-tri-lat-r" class="m-region" d="M115,78 C120,81 124,88 125.5,97 C126.6,107 127,118 126.8,128 L121.5,128 C121.7,116 121,103 119.5,92 C118.5,85 117,81 115,78 Z"><title>Triceps · Lateral Head</title></path>
  <path id="b-tri-long-l" class="m-region" d="M45,78 C43,81 41.5,85 40.5,92 C39,103 38.3,116 38.5,128 L44.3,128 C44,124 43.8,120 44,114 C44.5,102 46,90 48.5,80 Z"><title>Triceps · Long Head</title></path>
  <path id="b-tri-long-r" class="m-region" d="M115,78 C117,81 118.5,85 119.5,92 C121,103 121.7,116 121.5,128 L115.7,128 C116,124 116.2,120 116,114 C115.5,102 114,90 111.5,80 Z"><title>Triceps · Long Head</title></path>
  <path id="b-fore-l" class="m-region" d="M33.2,130 L44.3,130 C43.4,146 42,166 41,187 L30,187 C29.6,168 31,147 33.2,130 Z"><title>Forearms</title></path>
  <path id="b-fore-r" class="m-region" d="M126.8,130 L115.7,130 C116.6,146 118,166 119,187 L130,187 C130.4,168 129,147 126.8,130 Z"><title>Forearms</title></path>
  <path id="b-glute-l" class="m-region" d="M54,152 C51,160 50.5,170 52,179 C55,187 62,192 70,192 C75,191 78,189 79.3,186 L79.3,151 C70,149.5 61,150 54,152 Z"><title>Glutes</title></path>
  <path id="b-glute-r" class="m-region" d="M106,152 C109,160 109.5,170 108,179 C105,187 98,192 90,192 C85,191 82,189 80.7,186 L80.7,151 C90,149.5 99,150 106,152 Z"><title>Glutes</title></path>
  <path id="b-ham-l" class="m-region" d="M53,192 C51.5,204 51.5,218 53,231 C54.5,240 56,246 58.5,251 L77.5,251 C78,238 78.5,220 79,203 C79.2,197 79.3,193 79.3,190 C70,190 60,190 53,192 Z"><title>Hamstrings</title></path>
  <path id="b-ham-r" class="m-region" d="M107,192 C108.5,204 108.5,218 107,231 C105.5,240 104,246 101.5,251 L82.5,251 C82,238 81.5,220 81,203 C80.8,197 80.7,193 80.7,190 C90,190 100,190 107,192 Z"><title>Hamstrings</title></path>
  <path id="b-gastro-l" class="m-region" d="M58,256 C56.3,266 56,275 57.3,285 C58.3,293 60,299 61.5,304 L74,301 C75,292 75.8,283 76.3,274 C76.7,266 77,260 77.3,254 C70,252 63,253 58,256 Z"><title>Gastrocnemius</title></path>
  <path id="b-gastro-r" class="m-region" d="M102,256 C103.7,266 104,275 102.7,285 C101.7,293 100,299 98.5,304 L86,301 C85,292 84.2,283 83.7,274 C83.3,266 83,260 82.7,254 C90,252 97,253 102,256 Z"><title>Gastrocnemius</title></path>
  <path id="b-soleus-l" class="m-region" d="M61.5,304 L74,301 C74.5,309 74.8,316 75,322 L64.5,322 C63.5,316 62.5,310 61.5,304 Z"><title>Soleus</title></path>
  <path id="b-soleus-r" class="m-region" d="M98.5,304 L86,301 C85.5,309 85.2,316 85,322 L95.5,322 C96.5,316 97.5,310 98.5,304 Z"><title>Soleus</title></path>
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
