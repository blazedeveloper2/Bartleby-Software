/* ═══════════════════════════════════════════════════════════
   WORKOUT — RANK

   Two independent things live here, on purpose:

   1. STRENGTH RANK (the letter). Derived entirely from your working
      weights vs published population standards, relative to your
      bodyweight. It cannot be farmed by showing up — only by lifting
      more. See standards.js for the data and its source.

   2. CONSISTENCY (streak, heatmap, milestones). Derived from the two
      logs this module maintains:

        bp_log  [{d,di,ex,sets}]   completed sessions
        bp_pr   [{d,ex,from,to}]   working-weight increases

   There is deliberately no XP number. A second score that rises just
   for attendance would compete with the letter and let you feel
   stronger without being stronger.
   ═══════════════════════════════════════════════════════════ */

import { PROGRAM } from './data.js';
import { RATIOS, NOTES, TIER_PCT, rankFor, verseFor } from './standards.js';
import { load, save, todayStr, dateStr } from '../../assets/js/storage.js';

/* ── storage ── */
const logAll = () => load('bp_log', []);
const logSv  = l => save('bp_log', sortByDate(l));
const prAll  = () => load('bp_pr', []);
const prSv   = l => save('bp_pr', sortByDate(l));
const wts    = () => load('bp_wt', {});
const sortByDate = l => [...l].sort((a, b) => a.d.localeCompare(b.d));

/* Reps-to-failure assumption behind the 1RM estimate. */
export const REP_OPTS = [5, 8, 10, 12, 15];
const reps  = () => { const r = load('bp_reps', 10); return REP_OPTS.includes(r) ? r : 10; };
const sReps = r => save('bp_reps', r);

/* ── schedule ── */
const DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
const SCHED = PROGRAM.map(d => DOW[d.day]);
const DI_OF_DOW = {};
PROGRAM.forEach((d, i) => { DI_OF_DOW[DOW[d.day]] = i; });
const WEEK_TARGET = PROGRAM.length;

const ICO = {
  bolt:   '<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>',
  flame:  '<path d="M12 2c.8 4.5 4.5 5.8 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4 0 1.8.9 2.7 1.8 2.7 0-3.6.9-5.6.9-8.7z"/>',
  medal:  '<circle cx="12" cy="15" r="6"/><path d="M8 3h8l-2.5 6h-3z"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a4 4 0 0 0 3 3.8"/><path d="M17 6h3v1a4 4 0 0 1-3 3.8"/><path d="M9 20h6"/><path d="M12 14v6"/>',
  check:  '<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9.5"/>',
  cal:    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  peak:   '<path d="M2 20l6.5-13L13 15l3-4.5L22 20z"/>',
  star:   '<polygon points="12 3 14.6 9 21 9.7 16.2 14 17.5 20.5 12 17.2 6.5 20.5 7.8 14 3 9.7 9.4 9"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;

const BADGES = [
  { id:'first',    ico:'bolt',   n:'First Rep',        req:'Finish 1 session',            t:s => s.sessions >= 1 },
  { id:'ten',      ico:'bolt',   n:'Double Digits',    req:'Finish 10 sessions',          t:s => s.sessions >= 10 },
  { id:'pr1',      ico:'target', n:'Stronger',         req:'Raise a working weight',      t:s => s.prs >= 1 },
  { id:'week',     ico:'check',  n:'Perfect Week',     req:`All ${WEEK_TARGET} days in one week`, t:s => s.perfectWeeks >= 1 },
  { id:'streak8',  ico:'flame',  n:'Unbroken',         req:'8 training days in a row',    t:s => s.best >= 8 },
  { id:'fifty',    ico:'medal',  n:'Half Century',     req:'Finish 50 sessions',          t:s => s.sessions >= 50 },
  { id:'pr15',     ico:'target', n:'Overloaded',       req:'15 working-weight increases', t:s => s.prs >= 15 },
  { id:'weeks4',   ico:'cal',    n:'Full Month',       req:'4 perfect weeks',             t:s => s.perfectWeeks >= 4 },
  { id:'load100',  ico:'peak',   n:'Plus One Hundred', req:'+100 lbs of load added',      t:s => s.loadAdded >= 100 },
  { id:'sets500',  ico:'star',   n:'500 Hard Sets',    req:'Complete 500 hard sets',      t:s => s.sets >= 500 },
  { id:'streak20', ico:'flame',  n:'Limiter Off',      req:'20 training days in a row',   t:s => s.best >= 20 },
  { id:'hundred',  ico:'trophy', n:'Centurion',        req:'Finish 100 sessions',         t:s => s.sessions >= 100 },
];

/* ═══════════════════ DATES ═══════════════════ */
const dOf = ds => new Date(ds + 'T00:00:00');
function addDays(dt, n) { const d = new Date(dt); d.setDate(d.getDate() + n); return d; }
function weekStart(dt) { const d = new Date(dt); d.setHours(0,0,0,0); return addDays(d, -((d.getDay() + 6) % 7)); }
function eachDate(fromStr, toStr, fn) {
  const end = dOf(toStr);
  for (let d = dOf(fromStr), g = 0; d <= end && g < 4000; d = addDays(d, 1), g++) fn(dateStr(d), d);
}
const fmtD = ds => dOf(ds).toLocaleDateString('en-US', { month:'short', day:'numeric' });
const fmtN = n => n.toLocaleString('en-US');

export function setsOf(ex) {
  const m = /^(\d+)/.exec(ex.s || '');
  const n = m ? +m[1] : 2;
  return /\/\s*(leg|side|arm)/i.test(ex.s || '') ? n * 2 : n;
}

/* ═══════════════════ STRENGTH SCORING ═══════════════════ */

/* Epley: a working weight taken to failure at `reps` implies this 1RM. */
const est1RM = (w, r) => w * (1 + r / 30);

/* Where `ratio` sits on this lift's tier ladder, as a percentile.
   Linear between the published anchors; tapered above Elite so a huge
   number can't run away to 100. */
function pctFor(ratio, tiers) {
  if (ratio <= 0) return 0;
  if (ratio < tiers[0]) return (ratio / tiers[0]) * TIER_PCT[0];
  for (let k = 0; k < tiers.length - 1; k++) {
    if (ratio < tiers[k + 1]) {
      const span = tiers[k + 1] - tiers[k];
      const t = span > 0 ? (ratio - tiers[k]) / span : 0;
      return TIER_PCT[k] + t * (TIER_PCT[k + 1] - TIER_PCT[k]);
    }
  }
  return Math.min(99.9, TIER_PCT[4] + (ratio / tiers[4] - 1) * 60);
}

/* Working weight needed to reach `targetRatio` at this bodyweight. */
const weightFor = (targetRatio, bw, r) => (targetRatio * bw) / (1 + r / 30);

export function strength() {
  const bw = load('bp_bw', []);
  const bodyweight = bw.length ? bw[bw.length - 1].w : null;
  const r = reps(), w = wts();
  const out = { bodyweight, reps: r, lifts: [], unscored: [], overall: 0, rank: rankFor(0), scored: 0 };

  Object.keys(w).forEach(name => {
    if (!RATIOS[name]) out.unscored.push({ name, w: w[name] });
  });
  out.unscored.sort((a, b) => a.name.localeCompare(b.name));

  if (!bodyweight) return out;

  Object.keys(RATIOS).forEach(name => {
    const wv = w[name];
    if (!(wv > 0)) return;
    const tiers = RATIOS[name];
    const oneRM = est1RM(wv, r);
    const ratio = oneRM / bodyweight;
    const pct = pctFor(ratio, tiers);
    const rk = rankFor(pct);
    /* lbs of working weight still needed for the next letter */
    let need = null;
    if (rk.next) {
      const ti = TIER_PCT.indexOf(rk.next.min);
      const targetRatio = ti >= 0 ? tiers[ti] : tiers[tiers.length - 1] * 1.08;
      need = Math.max(0, weightFor(targetRatio, bodyweight, r) - wv);
    }
    out.lifts.push({ name, w: wv, oneRM, ratio, pct, rank: rk, need, note: NOTES[name] || null });
  });

  out.scored = out.lifts.length;
  if (out.scored) {
    out.lifts.sort((a, b) => b.pct - a.pct);
    out.overall = out.lifts.reduce((a, l) => a + l.pct, 0) / out.scored;
    out.rank = rankFor(out.overall);
    out.strongest = out.lifts[0];
    out.weakest = out.lifts[out.lifts.length - 1];
  }
  return out;
}

export function setReps(r) { if (REP_OPTS.includes(+r)) sReps(+r); }

/* ═══════════════════ CONSISTENCY STATS ═══════════════════ */
function streaksFrom(hits, firstDate) {
  const today = todayStr();
  if (!firstDate) return { streak:0, best:0 };
  let cur = 0, best = 0;
  eachDate(firstDate, today, (ds, d) => {
    if (!SCHED.includes(d.getDay())) return;
    if (hits.has(ds)) { cur++; best = Math.max(best, cur); }
    else if (ds !== today) cur = 0;
  });
  return { streak: cur, best };
}

export function stats() {
  const log = logAll(), prs = prAll();
  const hits = new Set(log.map(e => e.d));
  const firstDate = log.length ? log[0].d : null;
  const { streak, best } = streaksFrom(hits, firstDate);

  const weeks = new Map();
  log.forEach(e => {
    const k = dateStr(weekStart(dOf(e.d)));
    if (!weeks.has(k)) weeks.set(k, new Set());
    weeks.get(k).add(e.di);
  });
  let perfectWeeks = 0;
  weeks.forEach(set => { if (set.size >= WEEK_TARGET) perfectWeeks++; });

  const s = {
    log, prList: prs, hits, firstDate,
    sessions: log.length,
    sets: log.reduce((a, e) => a + (e.sets || 0), 0),
    prs: prs.length,
    loadAdded: prs.reduce((a, p) => a + Math.max(0, p.to - p.from), 0),
    streak, best,
    weekDone: weeks.get(dateStr(weekStart(new Date())))?.size || 0,
    weekTarget: WEEK_TARGET,
    perfectWeeks,
  };
  s.badges = new Set(BADGES.filter(b => b.t(s)).map(b => b.id));
  return s;
}

export const isLoggedToday = di => logAll().some(e => e.d === todayStr() && e.di === di);

/* ═══════════════════ WRITES ═══════════════════ */
/* A point-in-time picture of everything that can "level up". Callers that
   mutate bp_wt must capture this BEFORE writing, since lift tiers are read
   back out of bp_wt — otherwise before and after are identical and the
   tier-up goes unnoticed. */
export function snapshot() {
  const st = strength(), cs = stats();
  return {
    rankIdx: st.rank.i,
    rank: st.rank,
    lifts: new Map(st.lifts.map(l => [l.name, { i: l.rank.i, rank: l.rank }])),
    badges: cs.badges,
  };
}

function diff(before, after, ctx) {
  const rankUp = after.rankIdx > before.rankIdx ? after.rank : null;
  const tierUps = [];
  after.lifts.forEach((cur, name) => {
    const prev = before.lifts.get(name);
    if (prev && cur.i > prev.i) tierUps.push({ name, rank: cur.rank });
  });
  const badges = BADGES.filter(b => after.badges.has(b.id) && !before.badges.has(b.id));
  if (!rankUp && !tierUps.length && !badges.length) return null;
  return { rankUp, tierUps, badges, ...ctx };
}

/* A day logs itself the moment its last exercise is checked; unchecking on
   the same day removes it again, so a mis-tap is reversible. */
export function syncDay(di, tally) {
  const complete = tally.tot > 0 && tally.done === tally.tot;
  const d = todayStr(), l = logAll();
  const i = l.findIndex(e => e.d === d && e.di === di);
  if (!complete) {
    if (i >= 0) { l.splice(i, 1); logSv(l); return { unlogged: true }; }
    return null;
  }
  if (i >= 0) return null;
  const before = snapshot();
  l.push({ d, di, ex: tally.done, sets: tally.sets });
  logSv(l);
  return { logged: true, label: PROGRAM[di].label, ...(diff(before, snapshot(), {}) || {}) };
}

/* A working weight going UP is the only thing that can move the letter.
   A first-ever entry is a baseline, not an increase. */
export function logPR(name, from, to, before) {
  if (!(from > 0) || !(to > from)) return null;
  if (!before) before = snapshot();
  const l = prAll(), d = todayStr();
  const same = l.filter(p => p.ex === name && p.d === d).pop();
  if (same) same.to = to; else l.push({ d, ex: name, from, to });
  prSv(l);
  return diff(before, snapshot(), { pr: `${name} → ${to} lbs` });
}

export function delSession(d, di) {
  logSv(logAll().filter(e => !(e.d === d && e.di === +di)));
}

/* ═══════════════════ CELEBRATION ═══════════════════ */
export function celebrationHTML(r) {
  if (!r || (!r.rankUp && !r.tierUps?.length && !r.badges?.length)) return null;
  let h = '';
  if (r.rankUp) {
    h += `<div class="lv-rank" style="--rc:var(${r.rankUp.c})">
      <div class="lv-kicker">Rank Up</div>
      <div class="lv-letter">${r.rankUp.l}</div>
      <div class="lv-rank-n">${r.rankUp.name}</div>
      <div class="lv-rank-sub">${r.rankUp.blurb}</div>
    </div>`;
  }
  if (r.tierUps?.length) {
    h += `<div class="lv-kicker ${h ? 'mid' : ''}">Lift Tier Up</div>
      <div class="lv-tiers">${r.tierUps.map(t => t.rank ? `
        <div class="lv-tier"><span class="lv-tier-l" style="color:var(${t.rank.c})">${t.rank.l}</span>
        <span class="lv-tier-n">${t.name}</span></div>` : '').join('')}</div>`;
  }
  if (r.badges?.length) {
    h += `<div class="lv-kicker ${h ? 'mid' : ''}">${r.badges.length === 1 ? 'Milestone Unlocked' : `${r.badges.length} Milestones Unlocked`}</div>
      <div class="lv-badges">${r.badges.map(b => `
        <div class="lv-badge"><div class="pg-b-ico on">${svg(b.ico)}</div><div class="lv-badge-n">${b.n}</div></div>`).join('')}</div>`;
  }
  return `<div class="lv-card">${h}<button class="lv-btn" data-act="lv-close">Keep Going</button></div>`;
}

/* ═══════════════════ RENDER ═══════════════════ */

/* Percentile width of each letter band — deliberately to scale, so it's
   obvious how wide "Intermediate" is and how narrow "Elite" is. */
const BANDS = [
  { l:'F', from:0,  to:5,   c:'--rk-f' },
  { l:'D', from:5,  to:20,  c:'--rk-d' },
  { l:'C', from:20, to:50,  c:'--rk-c' },
  { l:'B', from:50, to:80,  c:'--rk-b' },
  { l:'A', from:80, to:95,  c:'--rk-a' },
  { l:'S', from:95, to:100, c:'--rk-s' },
];

function bandTrack(pct, showLabels) {
  const segs = BANDS.map(b =>
    `<div class="rk-seg" style="flex:${b.to - b.from};background:var(${b.c})">${showLabels ? `<span>${b.l}</span>` : ''}</div>`
  ).join('');
  return `<div class="rk-track">
    <div class="rk-segs">${segs}</div>
    <div class="rk-marker" style="left:${Math.max(0.4, Math.min(99.6, pct))}%"></div>
  </div>`;
}

function verseHTML() {
  const v = verseFor(todayStr());
  return `<div class="pg-card rk-verse">
    <div class="rk-verse-mark">&ldquo;</div>
    <div class="rk-verse-t">${v.t}</div>
    <div class="rk-verse-r">${v.r} <span>· KJV · changes daily</span></div>
  </div>`;
}

function heroHTML(st) {
  if (!st.bodyweight) {
    return `<div class="rk-hero" style="--rc:var(--text-3)"><span class="rk-scan"></span>
      <div class="rk-kicker">No Rank</div>
      <div class="rk-hero-row"><div class="rk-letter">?</div>
        <div class="rk-hero-txt"><div class="rk-name">Bodyweight missing</div>
        <div class="rk-blurb">Strength standards are relative to bodyweight. Log yours in the <b>Weight</b> tab and this fills in immediately.</div></div></div>
    </div>`;
  }
  if (!st.scored) {
    return `<div class="rk-hero" style="--rc:var(--text-3)"><span class="rk-scan"></span>
      <div class="rk-kicker">No Rank</div>
      <div class="rk-hero-row"><div class="rk-letter">?</div>
        <div class="rk-hero-txt"><div class="rk-name">No weights logged</div>
        <div class="rk-blurb">Tap any exercise in the <b>Program</b> tab and set its working weight. Rank is computed from what you actually lift — nothing else moves it.</div></div></div>
    </div>`;
  }
  const rk = st.rank;
  const beat = Math.round(st.overall);
  const nx = rk.next;
  return `<div class="rk-hero" style="--rc:var(${rk.c})"><span class="rk-scan"></span>
    <div class="rk-hero-top">
      <div class="rk-kicker">Strength Rank</div>
      <div class="rk-kicker">${st.scored} lift${st.scored === 1 ? '' : 's'} scored · ${st.bodyweight} lb bodyweight</div>
    </div>
    <div class="rk-hero-row">
      <div class="rk-letter">${rk.l}</div>
      <div class="rk-hero-txt">
        <div class="rk-name">${rk.name}</div>
        <div class="rk-pct">Stronger than <b>${beat}%</b> of lifters at your bodyweight</div>
        <div class="rk-blurb">${rk.blurb}</div>
      </div>
    </div>
    ${bandTrack(st.overall, true)}
    <div class="rk-hero-foot">
      <span>${nx ? `Next: <b>${nx.l} · ${nx.name}</b> at the ${nx.min}th percentile` : 'Off the top of the published data.'}</span>
      <span class="rk-foot-pct">${st.overall.toFixed(1)}</span>
    </div>
  </div>`;
}

function verdictHTML(st) {
  if (!st.scored) return '';
  const w = st.weakest, s = st.strongest;
  const gap = s.pct - w.pct;
  let line;
  if (st.overall < 5)       line = 'You are below the lowest bracket that gets logged. This is the starting line, not a rank.';
  else if (st.overall < 20) line = 'Beginner territory. Everything is a weak point right now, which also means everything responds fast.';
  else if (st.overall < 50) line = 'Below average. You are past novice on some lifts and nowhere near it on others.';
  else if (st.overall < 80) line = 'Average. Respectable, and also the level most people plateau at forever.';
  else if (st.overall < 95) line = 'Advanced. Progress from here is slow and has to be earned in small increments.';
  else                      line = 'Elite by the published standards. Verify your form and rep counts are honest.';
  const spread = gap > 35
    ? `Your lifts are badly uneven — <b>${w.name}</b> sits ${Math.round(gap)} percentile points behind <b>${s.name}</b>. That imbalance is what is dragging the letter down.`
    : `Your lifts are reasonably balanced, within ${Math.round(gap)} percentile points top to bottom.`;
  return `<div class="pg-card rk-verdict">
    <div class="pg-card-head"><div class="pg-card-title">Straight Answer</div></div>
    <div class="rk-verdict-t">${line}</div>
    <div class="rk-verdict-s">${spread}</div>
    <div class="rk-verdict-w">
      <div><span class="rk-vw-l">Weakest</span><span class="rk-vw-n">${w.name}</span><span class="rk-vw-p" style="color:var(${w.rank.c})">${w.rank.l} · ${Math.round(w.pct)}%</span></div>
      <div><span class="rk-vw-l">Strongest</span><span class="rk-vw-n">${s.name}</span><span class="rk-vw-p" style="color:var(${s.rank.c})">${s.rank.l} · ${Math.round(s.pct)}%</span></div>
    </div>
  </div>`;
}

function liftsHTML(st) {
  if (!st.bodyweight) return '';
  const rows = st.lifts.map(l => `
    <div class="rk-lift">
      <div class="rk-lift-top">
        <div class="rk-lift-n">${l.name}${l.note ? `<span class="rk-lift-note" title="${l.note}">?</span>` : ''}</div>
        <div class="rk-lift-r" style="color:var(${l.rank.c})">${l.rank.l}</div>
      </div>
      ${bandTrack(l.pct, false)}
      <div class="rk-lift-foot">
        <span><b>${l.w}</b> lbs working · <b>${Math.round(l.oneRM)}</b> lbs est. 1RM · ${l.ratio.toFixed(2)}× bw</span>
        <span class="rk-lift-need">${l.need !== null && l.rank.next
            ? `+${l.need < 1 ? l.need.toFixed(1) : Math.round(l.need)} lbs → ${l.rank.next.l}`
            : 'maxed'}</span>
      </div>
    </div>`).join('');

  const repBtns = REP_OPTS.map(r =>
    `<button class="rk-rep ${r === st.reps ? 'sel' : ''}" data-act="rk-reps" data-r="${r}">${r}</button>`).join('');

  const unscored = st.unscored.length ? `<div class="rk-unscored">
      <div class="rk-unscored-t">Not scored — no published standard for these</div>
      <div class="rk-unscored-l">${st.unscored.map(u => `<span>${u.name} <b>${u.w}</b></span>`).join('')}</div>
    </div>` : '';

  return `<div class="pg-card">
    <div class="pg-card-head">
      <div class="pg-card-title">Every Lift</div>
      <div class="pg-card-note">${st.scored} scored</div>
    </div>
    <div class="rk-reps">
      <span class="rk-reps-l">Reps to failure per set</span>
      <div class="rk-reps-seg">${repBtns}</div>
    </div>
    ${st.lifts.length ? `<div class="rk-lift-list">${rows}</div>`
      : `<div class="pg-empty">No weights set on any scored lift yet.</div>`}
    ${unscored}
    <div class="rk-method">
      Working weight → estimated 1RM (Epley, ${st.reps} reps), divided by bodyweight, compared with
      Strength Level's male standards for that lift. Dumbbell weights are read as <b>one</b> dumbbell.
      Percentiles are interpolated between the Beginner / Novice / Intermediate / Advanced / Elite anchors
      (5th / 20th / 50th / 80th / 95th).
    </div>
  </div>`;
}

/* ── consistency ── */
const HM_WEEKS = 16;
function heatmapHTML(s) {
  const start = addDays(weekStart(new Date()), -7 * (HM_WEEKS - 1));
  const today = todayStr();
  let cells = '';
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < HM_WEEKS; c++) {
      const d = addDays(start, c * 7 + r), ds = dateStr(d);
      const sched = SCHED.includes(d.getDay());
      const label = PROGRAM[DI_OF_DOW[d.getDay()]]?.label || 'scheduled';
      let cls, tip;
      if (ds > today)                            cls = 'future', tip = fmtD(ds);
      else if (s.hits.has(ds)) {
        cls = 'hit';
        tip = `${fmtD(ds)} · ${s.log.filter(e => e.d === ds).map(e => PROGRAM[e.di]?.label).join(', ') || 'session'}`;
      }
      else if (!sched)                           cls = 'rest',   tip = `${fmtD(ds)} · rest day`;
      else if (ds === today)                     cls = 'open',   tip = `Today · ${label}`;
      else if (s.firstDate && ds >= s.firstDate) cls = 'miss',   tip = `${fmtD(ds)} · missed`;
      else                                       cls = 'pre',    tip = fmtD(ds);
      if (ds === today) cls += ' today';
      cells += `<div class="pg-hm-c ${cls}" style="grid-row:${r + 1};grid-column:${c + 1}" title="${tip}"></div>`;
    }
  }
  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Consistency</div><div class="pg-card-note">Last ${HM_WEEKS} weeks</div></div>
    <div class="pg-hm-wrap">
      <div class="pg-hm-dow"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
      <div class="pg-hm">${cells}</div>
    </div>
    <div class="pg-legend">
      <span><i class="pg-hm-c hit"></i>Trained</span>
      <span><i class="pg-hm-c miss"></i>Missed</span>
      <span><i class="pg-hm-c rest"></i>Rest day</span>
    </div>
  </div>`;
}

function tile(label, value, unit, sub) {
  return `<div class="bw-stat">
    <div class="bw-stat-v">${value}${unit ? `<span class="bw-stat-u">${unit}</span>` : ''}</div>
    <div class="bw-stat-l">${label}</div>
    <div class="bw-stat-d ${sub ? 'up' : 'flat'}">${sub || '·'}</div>
  </div>`;
}

function nextUpHTML(s) {
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i), ds = dateStr(d);
    if (!SCHED.includes(d.getDay())) continue;
    if (i === 0 && s.hits.has(ds)) continue;
    const when = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dOf(ds).toLocaleDateString('en-US', { weekday:'long' });
    return `<span class="pg-next-w">${when}</span> · ${PROGRAM[DI_OF_DOW[d.getDay()]].label}`;
  }
  return 'Rest up.';
}

function progressionHTML(s) {
  const feed = [...s.prList].reverse().slice(0, 8).map(p => `
    <div class="pg-pr">
      <div class="pg-pr-ex">${p.ex}</div>
      <div class="pg-pr-w"><span class="pg-pr-from">${p.from}</span> → ${p.to} <span class="pg-pr-u">lbs</span></div>
      <div class="pg-pr-up">+${(((p.to - p.from) / p.from) * 100).toFixed(0)}%</div>
      <div class="pg-pr-d">${fmtD(p.d)}</div>
    </div>`).join('');
  const bw = load('bp_bw', []);
  let bwLine = null;
  if (bw.length >= 2 && s.loadAdded > 0) {
    const delta = bw[bw.length - 1].w - bw[0].w;
    bwLine = Math.abs(delta) < 0.5
      ? `Bodyweight holding steady while adding ${fmtN(s.loadAdded)} lbs of load.`
      : `${delta < 0 ? 'Down' : 'Up'} ${Math.abs(delta).toFixed(1)} lbs of bodyweight while adding ${fmtN(s.loadAdded)} lbs of load.`;
  }
  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Progression</div><div class="pg-card-note">${s.prs} weight ${s.prs === 1 ? 'increase' : 'increases'}</div></div>
    <div class="pg-big">
      <div class="pg-big-v">+${fmtN(s.loadAdded)}<span class="pg-big-u">lbs</span></div>
      <div class="pg-big-l">Total load added across every lift</div>
      ${bwLine ? `<div class="pg-big-note">${bwLine}</div>` : ''}
    </div>
    ${feed ? `<div class="pg-pr-list">${feed}</div>`
           : `<div class="pg-empty">Raise a working weight in any exercise and it lands here.</div>`}
  </div>`;
}

function badgesHTML(s) {
  const cell = (b, on) => `<div class="pg-b ${on ? 'on' : ''}">
    <div class="pg-b-ico ${on ? 'on' : ''}">${svg(b.ico)}</div>
    <div class="pg-b-n">${b.n}</div>
    <div class="pg-b-r">${on ? 'Unlocked' : b.req}</div>
  </div>`;
  const got = BADGES.filter(b => s.badges.has(b.id));
  const left = BADGES.filter(b => !s.badges.has(b.id));
  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Milestones</div><div class="pg-card-note">${got.length}/${BADGES.length}</div></div>
    <div class="pg-b-grid">${[...got.map(b => cell(b, true)), ...left.map(b => cell(b, false))].join('')}</div>
  </div>`;
}

function historyHTML(s) {
  if (!s.sessions) return '';
  const rows = [...s.log].reverse().slice(0, 12).map(e => {
    const day = PROGRAM[e.di];
    return `<div class="pg-s-row">
      <span class="day-badge ${day?.day || ''}">${day?.day || '—'}</span>
      <div class="pg-s-body"><div class="pg-s-n">${day?.label || 'Session'}</div><div class="pg-s-d">${fmtD(e.d)} · ${e.sets} sets</div></div>
      <button class="bw-h-btn del" data-act="pg-del" data-d="${e.d}" data-di="${e.di}" title="Delete session">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');
  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Session Log</div><div class="pg-card-note">${s.sessions > 12 ? `Last 12 of ${s.sessions}` : `${s.sessions} total`}</div></div>
    <div class="pg-s-list">${rows}</div>
  </div>`;
}

export function renderRank(root) {
  const p = root.querySelector('#p-rank');
  if (!p) return;
  const st = strength(), s = stats();

  let h = heroHTML(st);
  h += verseHTML();
  h += verdictHTML(st);
  h += `<div class="bw-stats pg-tiles">
    ${tile('Streak', s.streak, s.streak === 1 ? 'day' : 'days', s.streak && s.streak === s.best ? 'personal best' : '')}
    ${tile('Best', s.best, s.best === 1 ? 'day' : 'days', '')}
    ${tile('This Week', `${s.weekDone}/${s.weekTarget}`, '', s.weekDone >= s.weekTarget ? 'perfect' : '')}
    ${tile('Sessions', fmtN(s.sessions), '', s.sets ? `${fmtN(s.sets)} sets` : '')}
  </div>`;
  h += `<div class="pg-card rk-next"><span class="pg-kicker">Next Session</span><div>${nextUpHTML(s)}</div></div>`;
  h += liftsHTML(st);
  h += heatmapHTML(s);
  h += progressionHTML(s);
  h += badgesHTML(s);
  h += historyHTML(s);
  p.innerHTML = h;
}
