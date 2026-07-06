/* ═══════════════════════════════════════════════════════════
   WORKOUT APP
   Program tracker (tap an exercise → muscle map + set its weight)
   and a bodyweight trend tab. Local-first, event-delegated.
   ═══════════════════════════════════════════════════════════ */

import { PROGRAM, MMAP } from './data.js';
import { load, save, todayStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';

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
  let h = '';
  PROGRAM.forEach((day, di) => {
    let tot = 0, dn = 0;
    day.sections.forEach((sec, si) => sec.ex.forEach((_, ei) => { tot++; if (ch[ek(di,si,ei)]) dn++; }));
    const comp = dn === tot && tot > 0;
    h += `<div class="day-card"><div class="day-top"><div class="day-top-l"><span class="day-badge ${day.day}">${day.day}</span><span class="day-title">${day.label}</span></div><span class="day-prog ${comp?'done':''}">${dn}/${tot}</span></div><div class="day-body">`;
    day.sections.forEach((sec, si) => {
      if (sec.tag) h += `<div class="sec-lbl">${sec.tag}</div>`;
      sec.ex.forEach((ex, ei) => {
        const k = ek(di,si,ei), on = ch[k] || false;
        const wv = w[ex.n];
        const wtH = wv ? `<span class="ex-wt">${wv} lbs</span>` : '';
        const bH  = ex.b ? `<span class="bench-tag ${ex.bc||''}">${ex.b}</span>` : '';
        h += `<div class="ex-row ${on?'off':''}" data-act="row" data-di="${di}" data-si="${si}" data-ei="${ei}"><div class="ex-chk ${on?'on':''}" data-act="chk" data-k="${k}"></div><div class="ex-body"><div class="ex-name">${ex.n}</div><div class="ex-detail"><span class="ex-musc">${ex.m}</span></div></div><div class="ex-right">${wtH}<span class="ex-sets">${ex.s}</span>${bH}</div></div>`;
      });
    });
    h += `</div></div>`;
  });
  if (Object.values(ch).some(Boolean)) h += `<div class="clear-bar"><button class="clear-btn" data-act="clear">Clear All Checkmarks</button></div>`;
  p.innerHTML = h;
}

function toggleChk(k) { const c = chks(); c[k] = !c[k]; sChk(c); renderProg(); }
function clearChk() { sChk({}); renderProg(); toast('Checkmarks cleared'); }

/* ═══════════════════ MUSCLE MODAL (+ weight editor) ═══════════════════ */
function parseMuscles(mStr) {
  const raw = mStr.toLowerCase().replace(/\(.*?\)/g,'').split(',').map(s=>s.trim()).filter(Boolean);
  const ids = new Set();
  raw.forEach(m => {
    if (MMAP[m]) { MMAP[m].forEach(id => ids.add(id)); return; }
    for (const [k, v] of Object.entries(MMAP)) {
      if (m.includes(k) || k.includes(m)) v.forEach(id => ids.add(id));
    }
  });
  return ids;
}

function openMM(ex) {
  mmEx = ex;
  q('#mm-name').textContent = ex.n;
  let info = `<span class="mm-tag">${ex.s}</span>`;
  if (ex.b) info += `<span class="mm-tag">${ex.b}</span>`;
  q('#mm-info').innerHTML = info;

  const wt = wts()[ex.n];
  q('#mm-wt').value = wt || '';

  const muscles = ex.m.replace(/\(.*?\)/g,'').split(',').map(s=>s.trim()).filter(Boolean);
  q('#mm-mlist').innerHTML = muscles.map(m => `<span class="mm-muscle-chip">${m}</span>`).join('');

  root.querySelectorAll('.m-region').forEach(el => el.classList.remove('lit'));
  parseMuscles(ex.m).forEach(id => { const el = q('#' + id); if (el) el.classList.add('lit'); });

  q('#mm-ol').classList.add('on');
}
function closeMM() { q('#mm-ol').classList.remove('on'); mmEx = null; }

function setMMWeight(el) {
  if (!mmEx) return;
  const w = wts(), v = parseFloat(el.value);
  if (isNaN(v) || v <= 0) delete w[mmEx.n]; else w[mmEx.n] = v;
  sWt(w); renderProg();
  toast(`${mmEx.n}: ${v > 0 ? v + ' lbs' : 'cleared'}`);
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
  const cs = cutoff.toISOString().slice(0,10);
  return l.filter(e => e.d >= cs);
}
function bwStats() {
  const all = bwAll(); if (all.length === 0) return null;
  const cur = all[all.length-1].w;
  const total = cur - all[0].w;
  function deltaWindow(days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cs = cutoff.toISOString().slice(0,10);
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
    gridHTML+=`<line x1="${PADL}" y1="${y}" x2="${W-PADR}" y2="${y}" stroke="#1c2030" stroke-width="1" stroke-dasharray="2,3"/><text x="${PADL-6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#4a5068" font-family="JetBrains Mono, monospace" font-size="9">${v.toFixed(0)}</text>`;
  }
  const xIdx=n>=4?[0,Math.floor(n/2),n-1]:[0,n-1];
  const xHTML=xIdx.map(i=>`<text x="${xOf(i).toFixed(1)}" y="${H-6}" text-anchor="middle" fill="#4a5068" font-family="JetBrains Mono, monospace" font-size="9">${bwFmt(entries[i].d)}</text>`).join('');
  const dotsHTML=points.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#3b82f6" stroke="#10121a" stroke-width="2"><title>${entries[i].w} lbs · ${bwFmt(entries[i].d)}</title></circle>`).join('');
  return `<svg class="bw-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="bw-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>
    ${gridHTML}
    <path d="${areaPath}" fill="url(#bw-grad)"/>
    <path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
  toast('Entry deleted');
}

/* ═══════════════════ TABS ═══════════════════ */
function switchTab(tab) {
  activeTab = tab;
  root.querySelectorAll('.wk .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  root.querySelectorAll('.wk .panel').forEach(pl => pl.classList.remove('active'));
  q('#p-' + tab).classList.add('active');
}

/* ═══════════════════ EVENT DELEGATION ═══════════════════ */
function onClick(e) {
  if (e.target.classList && e.target.classList.contains('mm-overlay')) { closeMM(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const a = el.dataset;
  switch (a.act) {
    case 'tab':       switchTab(a.tab); break;
    case 'row':       openMM(PROGRAM[+a.di].sections[+a.si].ex[+a.ei]); break;
    case 'chk':       toggleChk(a.k); break;
    case 'clear':     clearChk(); break;
    case 'mm-close':  closeMM(); break;
    case 'bw-range':  bwSetRange(a.k); break;
    case 'bw-save':   bwSave(); break;
    case 'bw-edit':   bwEdit(a.d); break;
    case 'bw-del':    bwDelete(a.d); break;
    case 'bw-cancel': bwCancelEdit(); break;
  }
}
function onChange(e) { if (e.target.id === 'mm-wt') setMMWeight(e.target); }
function onKeydown(e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'bw-weight') bwSave();
  else if (e.target.id === 'mm-wt') e.target.blur();
}

/* ═══════════════════ STATIC MARKUP ═══════════════════ */
const MUSCLE_SVG = `<svg viewBox="0 0 320 290" xmlns="http://www.w3.org/2000/svg">
  <text x="82" y="12" text-anchor="middle" class="m-label">Front</text>
  <text x="238" y="12" text-anchor="middle" class="m-label">Back</text>
  <ellipse cx="82" cy="32" rx="11" ry="13" class="m-base"/><rect x="76" y="45" width="12" height="7" rx="3" class="m-base"/>
  <polygon id="f-trap-l" points="76,46 62,56 65,62 76,52" class="m-region"/><polygon id="f-trap-r" points="88,46 102,56 99,62 88,52" class="m-region"/>
  <ellipse id="f-delt-l" cx="57" cy="62" rx="9" ry="9" class="m-region"/><ellipse id="f-delt-r" cx="107" cy="62" rx="9" ry="9" class="m-region"/>
  <ellipse id="f-chest-l" cx="71" cy="72" rx="11" ry="8" class="m-region"/><ellipse id="f-chest-r" cx="93" cy="72" rx="11" ry="8" class="m-region"/>
  <polygon id="f-serra-l" points="60,82 68,82 68,92 62,90" class="m-region"/><polygon id="f-serra-r" points="104,82 96,82 96,92 102,90" class="m-region"/>
  <rect id="f-abs" x="74" y="82" width="16" height="32" rx="3" class="m-region"/>
  <polygon id="f-obli-l" points="68,92 73,92 73,114 68,108" class="m-region"/><polygon id="f-obli-r" points="96,92 91,92 91,114 96,108" class="m-region"/>
  <ellipse id="f-bi-l" cx="48" cy="80" rx="6" ry="11" class="m-region"/><ellipse id="f-bi-r" cx="116" cy="80" rx="6" ry="11" class="m-region"/>
  <ellipse id="f-fore-l" cx="42" cy="100" rx="6" ry="13" class="m-region"/><ellipse id="f-fore-r" cx="122" cy="100" rx="6" ry="13" class="m-region"/>
  <ellipse cx="38" cy="120" rx="5" ry="6" class="m-base"/><ellipse cx="126" cy="120" rx="5" ry="6" class="m-base"/>
  <ellipse id="f-quad-l" cx="72" cy="142" rx="11" ry="22" class="m-region"/><ellipse id="f-quad-r" cx="92" cy="142" rx="11" ry="22" class="m-region"/>
  <polygon id="f-addu-l" points="76,124 82,124 82,150 76,148" class="m-region"/><polygon id="f-addu-r" points="88,124 82,124 82,150 88,148" class="m-region"/>
  <ellipse cx="72" cy="178" rx="6" ry="5" class="m-base"/><ellipse cx="92" cy="178" rx="6" ry="5" class="m-base"/>
  <ellipse cx="72" cy="208" rx="7" ry="20" class="m-base"/><ellipse cx="92" cy="208" rx="7" ry="20" class="m-base"/>
  <ellipse cx="72" cy="245" rx="7" ry="6" class="m-base"/><ellipse cx="92" cy="245" rx="7" ry="6" class="m-base"/>
  <ellipse cx="238" cy="32" rx="11" ry="13" class="m-base"/><rect x="232" y="45" width="12" height="7" rx="3" class="m-base"/>
  <polygon id="b-trap-l" points="232,46 218,56 222,68 232,58" class="m-region"/><polygon id="b-trap-r" points="244,46 258,56 254,68 244,58" class="m-region"/>
  <polygon id="b-trap-m" points="225,62 251,62 248,75 228,75" class="m-region"/>
  <ellipse id="b-rdelt-l" cx="213" cy="62" rx="9" ry="9" class="m-region"/><ellipse id="b-rdelt-r" cx="263" cy="62" rx="9" ry="9" class="m-region"/>
  <polygon id="b-lat-l" points="222,74 232,74 232,108 218,98" class="m-region"/><polygon id="b-lat-r" points="254,74 244,74 244,108 258,98" class="m-region"/>
  <rect id="b-rhom" x="230" y="76" width="16" height="22" rx="2" class="m-region"/>
  <polygon id="b-erec-l" points="232,98 238,98 238,118 232,118" class="m-region"/><polygon id="b-erec-r" points="244,98 238,98 238,118 244,118" class="m-region"/>
  <ellipse id="b-tri-l" cx="204" cy="80" rx="6" ry="11" class="m-region"/><ellipse id="b-tri-r" cx="272" cy="80" rx="6" ry="11" class="m-region"/>
  <ellipse cx="198" cy="100" rx="6" ry="13" class="m-base"/><ellipse cx="278" cy="100" rx="6" ry="13" class="m-base"/>
  <ellipse cx="194" cy="120" rx="5" ry="6" class="m-base"/><ellipse cx="282" cy="120" rx="5" ry="6" class="m-base"/>
  <ellipse id="b-glute-l" cx="230" cy="125" rx="10" ry="10" class="m-region"/><ellipse id="b-glute-r" cx="246" cy="125" rx="10" ry="10" class="m-region"/>
  <ellipse id="b-ham-l" cx="228" cy="155" rx="10" ry="18" class="m-region"/><ellipse id="b-ham-r" cx="248" cy="155" rx="10" ry="18" class="m-region"/>
  <ellipse cx="228" cy="180" rx="6" ry="4" class="m-base"/><ellipse cx="248" cy="180" rx="6" ry="4" class="m-base"/>
  <ellipse id="b-calf-l" cx="228" cy="207" rx="8" ry="20" class="m-region"/><ellipse id="b-calf-r" cx="248" cy="207" rx="8" ry="20" class="m-region"/>
  <ellipse cx="202" cy="134" rx="5" ry="6" class="m-base"/><ellipse cx="274" cy="134" rx="5" ry="6" class="m-base"/>
  <line x1="160" y1="18" x2="160" y2="255" stroke="#1c2030" stroke-width="1" stroke-dasharray="4,4"/>
</svg>`;

function template() {
  return `<div class="wk">
    <div class="app-head"><h1>Build Program</h1><p>Dumbbells + Bench · 4 Day Upper/Lower · Weight</p></div>
    <nav class="nav"><div class="nav-inner">
      <button class="tab active" data-act="tab" data-tab="program">Program</button>
      <button class="tab" data-act="tab" data-tab="bw">Weight</button>
    </div></nav>
    <div class="app-wrap">
      <div class="panel active" id="p-program"></div>
      <div class="panel" id="p-bw"></div>
    </div>

    <div class="mm-overlay" id="mm-ol">
      <div class="mm-card">
        <div class="mm-head"><div class="mm-title" id="mm-name"></div><button class="mm-close" data-act="mm-close">&times;</button></div>
        <div class="mm-info" id="mm-info"></div>
        <div class="mm-wt-row">
          <span class="mm-wt-lbl">Working Weight</span>
          <div class="mm-wt-box"><input class="mm-wt-in" id="mm-wt" type="number" step="2.5" min="0" inputmode="decimal" placeholder="—"><span class="mm-wt-u">lbs</span></div>
        </div>
        <div class="mm-map">${MUSCLE_SVG}</div>
        <div class="mm-muscles"><div class="mm-muscles-title">Target Muscles</div><div class="mm-muscle-list" id="mm-mlist"></div></div>
      </div>
    </div>
  </div>`;
}

/* ═══════════════════ LIFECYCLE ═══════════════════ */
export default {
  id: 'workout',
  name: 'Workout',
  styles: 'apps/workout/workout.css',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11"/><path d="M4 8.5L2.5 10 4 11.5"/><path d="M8.5 4L10 2.5 11.5 4"/><path d="M20 8.5L21.5 10 20 11.5"/><path d="M15.5 20L14 21.5 12.5 20"/><rect x="4" y="7" width="4" height="10" rx="1"/><rect x="16" y="7" width="4" height="10" rx="1"/></svg>',
  mount(el) {
    root = el;
    activeTab = 'program'; bwRange = '30'; bwEditDate = null; mmEx = null;
    root.innerHTML = template();
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    renderProg(); renderBW();
    switchTab(activeTab);
  },
  unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('keydown', onKeydown);
    }
    root = null;
  },
};
