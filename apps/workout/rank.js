/* ═══════════════════════════════════════════════════════════
   WORKOUT — RANK

   Two independent things live here, on purpose:

   1. STRENGTH RANK (the letter). Derived entirely from your working
      weights vs published population standards, relative to your
      bodyweight. It cannot be farmed by showing up — only by lifting
      more. See standards.js for the data and its source.

   2. CONSISTENCY (streak, heatmap, milestones). Derived from the
      logs this module maintains:

        bp_log  [{d,di,ex,sets}]     completed sessions
        bp_pr   [{d,ex,from,to,k,p}] every working-weight change
        bp_ach  {id:'YYYY-MM-DD'}    the date each milestone was earned

   3. PROOF, which is what keeps the other two honest. A working weight
      you have typed in is a claim; it becomes a fact when you finish a
      session that trains it (`p:1`). Until then that lift is PENDING —
      it moves the estimated letter on screen, but it earns nothing: no
      milestone, no rank-up, no lbs in the load total.

      That is what makes backing off read correctly. Set 100, find you
      can't do it, drop to 90: the 100 was never trained, so the increase
      is rolled back and everything it briefly implied goes with it.
      Train at 100 for a month and then drop to 90: that increase is
      history, so it stands, the drop is logged as a back-off which
      subtracts from the load total, and the milestones you earned stay
      earned — shown as no longer held rather than quietly deleted.

   There is deliberately no XP number. A second score that rises just
   for attendance would compete with the letter and let you feel
   stronger without being stronger.
   ═══════════════════════════════════════════════════════════ */

import { PROGRAM } from './data.js';
import { LIFTS, SRC_LABEL, TIER_PCT, rankFor, verseFor } from './standards.js';
import { load, save, remove, todayStr, dateStr } from '../../assets/js/storage.js';

/* ── storage ── */
const logAll = () => load('bp_log', []);
const logSv  = l => save('bp_log', sortByDate(l));
const prAll  = () => load('bp_pr', []);
const prSv   = l => save('bp_pr', sortByDate(l));
const achAll = () => load('bp_ach', {});
const achSv  = a => save('bp_ach', a);
const wts    = () => load('bp_wt', {});
const sortByDate = l => [...l].sort((a, b) => a.d.localeCompare(b.d));

/* Equipment flags, owned by Settings. An exercise names the kit it needs in
   `req` (see data.js); when that kit is off, it resolves to its `alt`. Every
   consumer goes through resEx(), so rendering, scoring and the badge counts
   all agree on which exercises are actually in play.

   An unknown or absent `req` resolves as owned — a new `alt` added without
   naming its equipment shows the main movement rather than silently hiding
   it behind a flag nothing can turn on. */
const OWNED = {
  bar:   () => load('bp_bar', true),
  wheel: () => load('bp_wheel', true),
};
export const owns = k => (OWNED[k] || (() => true))();
export const resEx = ex => (ex.alt && !owns(ex.req)) ? ex.alt : ex;

/* Reps-to-failure assumption behind the 1RM estimate. */
export const REP_OPTS = [5, 8, 10, 12, 15];
const reps  = () => { const r = load('bp_reps', 10); return REP_OPTS.includes(r) ? r : 10; };
const sReps = r => save('bp_reps', r);

/* ── schedule ── */
const DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
const DI_OF_DOW = {};
PROGRAM.forEach((d, i) => { DI_OF_DOW[DOW[d.day]] = i; });
const WEEK_TARGET = PROGRAM.length;

/* Whether a program day existed on a given date. A day added mid-history
   (its `since` in data.js) only exists from that date on — before it, the
   weekday was genuinely a rest day, and streaks, the heatmap and perfect
   weeks must all read it that way rather than rewriting the past. */
function schedOn(ds, dow) {
  const di = DI_OF_DOW[dow];
  if (di === undefined) return false;
  const s = PROGRAM[di].since;
  return !s || ds >= s;
}

/* How many days the program asked of the week starting `wkStart` (Monday).
   A day with a `since` counts only in weeks whose occurrence of that
   weekday falls on or after it. */
function weekTargetFor(wkStart) {
  return PROGRAM.filter(day => !day.since ||
    dateStr(addDays(dOf(wkStart), (DOW[day.day] + 6) % 7)) >= day.since).length;
}

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
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/>',
  crown:  '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
  scale:  '<path d="M12 4v16"/><path d="M5 8h14"/><circle cx="5" cy="8" r="2.5"/><circle cx="19" cy="8" r="2.5"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;

/* Achievement table. `t` receives a merged view of consistency stats and
   strength state (see earned()), so a badge can key off either. Locked ones
   display `req`, which is what makes them pull you forward. */
const CATS = ['Consistency', 'Strength', 'Volume', 'Progression'];
const BADGES = [
  /* -- Consistency -- */
  { id:'first',     cat:0, ico:'bolt',   n:'First Rep',        req:'Finish 1 session',               t:s => s.sessions >= 1 },
  { id:'ten',       cat:0, ico:'bolt',   n:'Double Digits',    req:'Finish 10 sessions',             t:s => s.sessions >= 10 },
  { id:'week',      cat:0, ico:'check',  n:'Perfect Week',     req:`All ${WEEK_TARGET} days in one week`, t:s => s.perfectWeeks >= 1 },
  { id:'streak8',   cat:0, ico:'flame',  n:'Unbroken',         req:'8 training days in a row',       t:s => s.best >= 8 },
  { id:'weeks4',    cat:0, ico:'cal',    n:'Full Month',       req:'4 perfect weeks',                t:s => s.perfectWeeks >= 4 },
  { id:'fifty',     cat:0, ico:'medal',  n:'Half Century',     req:'Finish 50 sessions',             t:s => s.sessions >= 50 },
  { id:'streak20',  cat:0, ico:'flame',  n:'Limiter Off',      req:'20 training days in a row',      t:s => s.best >= 20 },
  { id:'comeback',  cat:0, ico:'clock',  n:'No Excuses',       req:'Train again after 14+ days off', t:s => s.maxGap >= 14 },
  { id:'weeks10',   cat:0, ico:'cal',    n:'Ten Out Of Ten',   req:'10 perfect weeks',               t:s => s.perfectWeeks >= 10 },
  { id:'hundred',   cat:0, ico:'trophy', n:'Centurion',        req:'Finish 100 sessions',            t:s => s.sessions >= 100 },
  { id:'streak40',  cat:0, ico:'flame',  n:'Immovable',        req:'40 training days in a row',      t:s => s.best >= 40 },
  { id:'twoHundred',cat:0, ico:'trophy', n:'Double Century',   req:'Finish 200 sessions',            t:s => s.sessions >= 200 },

  /* -- Strength: the letter, never attendance -- */
  { id:'rankD',     cat:1, ico:'shield', n:'On The Board',     req:'Reach rank D overall',           t:s => s.rankIdx >= 1 },
  { id:'rankC',     cat:1, ico:'shield', n:'Off The Floor',    req:'Reach rank C overall',           t:s => s.rankIdx >= 2 },
  { id:'liftB',     cat:1, ico:'star',   n:'One Good Lift',    req:'Any single lift to B',           t:s => s.bestLift >= 3 },
  { id:'rankB',     cat:1, ico:'shield', n:'Perfectly Average',req:'Reach rank B overall',           t:s => s.rankIdx >= 3 },
  { id:'noWeak',    cat:1, ico:'target', n:'No Weak Links',    req:'Every scored lift at C or above', t:s => s.scored >= 8 && s.minPct >= 20 },
  { id:'balanced',  cat:1, ico:'target', n:'Symmetry',         req:'Under 15 points between your best and worst lift', t:s => s.scored >= 8 && s.spread <= 15 },
  { id:'liftA',     cat:1, ico:'star',   n:'Genuinely Strong', req:'Any single lift to A',           t:s => s.bestLift >= 4 },
  { id:'p4p',       cat:1, ico:'peak',   n:'Pound For Pound',  req:'Any lift at 1.0x your bodyweight', t:s => s.maxRatio >= 1 },
  { id:'rankA',     cat:1, ico:'shield', n:'Top Fifth',        req:'Reach rank A overall',           t:s => s.rankIdx >= 4 },
  { id:'liftS',     cat:1, ico:'crown',  n:'Specialist',       req:'Any single lift to S',           t:s => s.bestLift >= 5 },
  { id:'rankS',     cat:1, ico:'crown',  n:'Elite',            req:'Reach rank S overall',           t:s => s.rankIdx >= 5 },

  /* -- Volume -- */
  { id:'sets500',   cat:2, ico:'star',   n:'500 Hard Sets',    req:'Complete 500 hard sets',         t:s => s.sets >= 500 },
  { id:'sets1500',  cat:2, ico:'star',   n:'1,500 Hard Sets',  req:'Complete 1,500 hard sets',       t:s => s.sets >= 1500 },
  { id:'sets4000',  cat:2, ico:'trophy', n:'4,000 Hard Sets',  req:'Complete 4,000 hard sets',       t:s => s.sets >= 4000 },

  /* -- Progression -- */
  { id:'pr1',       cat:3, ico:'target', n:'Stronger',         req:'Raise a working weight',         t:s => s.prs >= 1 },
  { id:'fullSheet', cat:3, ico:'check',  n:'Full Sheet',       req:'A weight logged on every scored lift', t:s => s.allLogged },
  { id:'pr15',      cat:3, ico:'target', n:'Overloaded',       req:'15 working-weight increases',    t:s => s.prs >= 15 },
  { id:'load100',   cat:3, ico:'peak',   n:'Plus One Hundred', req:'+100 lbs of load added',         t:s => s.loadAdded >= 100 },
  { id:'weighIn',   cat:3, ico:'scale',  n:'Weigh In',         req:'Log your bodyweight 15 times',   t:s => s.bwCount >= 15 },
  { id:'recomp',    cat:3, ico:'scale',  n:'Recomposition',    req:'Drop 5 lbs of bodyweight while adding 50 lbs of load', t:s => s.bwDelta <= -5 && s.loadAdded >= 50 },
  { id:'pr50',      cat:3, ico:'target', n:'Never Satisfied',  req:'50 working-weight increases',    t:s => s.prs >= 50 },
  { id:'load500',   cat:3, ico:'peak',   n:'Plus Five Hundred',req:'+500 lbs of load added',         t:s => s.loadAdded >= 500 },
];

/* Flatten consistency + strength into the shape the tests above expect.
   `st` is always the PROVEN view — a weight you typed but have not trained
   unlocks nothing, which is what lets a back-off roll cleanly back. */
export function earned(cs, st) {
  const pcts = st.lifts.map(l => l.pct);
  const flat = {
    ...cs,
    rankIdx: st.scored ? st.rank.i : 0,
    scored: st.scored,
    bestLift: st.lifts.reduce((a, l) => Math.max(a, l.rank.i), 0),
    minPct: pcts.length ? Math.min(...pcts) : 0,
    spread: pcts.length ? Math.max(...pcts) - Math.min(...pcts) : 999,
    maxRatio: st.lifts.reduce((a, l) => Math.max(a, l.ratio), 0),
    allLogged: st.totalScorable > 0 && st.scoredReachable >= st.totalScorable,
  };
  return new Set(BADGES.filter(b => b.t(flat)).map(b => b.id));
}

/* Milestones latch. Reaching B is a thing that happened on a date, so a
   deload six months later shouldn't silently delete it — it stops being
   HELD, which the grid says out loud, and that is a different statement.

   Latching only ever reads proven state, which is what makes the rollback
   complete: a weight you set and backed off before training never unlocked
   anything, so there is nothing to take away afterwards. */
function latch(cs, pv) {
  const held = achAll(), d = todayStr();
  const now = earned(cs || stats(), pv || strength().proven);
  let dirty = false;
  now.forEach(id => { if (!held[id]) { held[id] = d; dirty = true; } });
  if (dirty) achSv(held);
  return held;
}

/* What the grid draws: everything ever earned, everything held right now,
   and the date each was earned. */
export function achievements(cs, st) {
  const now = earned(cs, st.proven);
  const held = latch(cs, st.proven);
  return { ids: new Set([...Object.keys(held), ...now]), now, at: held };
}

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

/* ═══════════════════ WEIGHT HISTORY ═══════════════════ */

/* Which movements each program day puts under load, resolved for the current
   pull-up-bar setting. Finishing that day is what proves the weights sitting
   on those movements. */
function dayLifts() {
  return PROGRAM.map(d => {
    const s = new Set();
    d.sections.forEach(sec => sec.ex.forEach(e => s.add(resEx(e).n)));
    return s;
  });
}

/* Entries written after this feature always carry a `p`, stamped at the
   moment a session closes — which is exact, so bumping a weight in the
   evening after training in the morning stays correctly unproven. Older
   entries carry none, and fall back to the question the flag stands in for:
   has a session that trains this lift happened since the weight was set? */
function provenTest() {
  const log = logAll(), days = dayLifts();
  return e => e.k === 'void' ? false
            : ('p' in e)     ? !!e.p
            : log.some(s => s.d >= e.d && days[s.di]?.has(e.ex));
}

/* The corrected reading of bp_pr, and the one asymmetry the whole thing
   rests on: an increase only counts once you have trained it, a decrease
   counts the moment you make it. Claims upward have to be earned; you can't
   quietly hide a drop. Voided entries contribute nothing in either
   direction, and baselines are a starting point rather than load added.

   netAdded therefore lands on exactly the same number as the proven
   strength model — it is what you can currently do, minus where you began,
   and no amount of typing moves it. */
function weightHistory() {
  const isProven = provenTest();
  const entries = prAll().map(e => ({ ...e, proven: isProven(e) }));
  const byLift = new Map();
  let grossAdded = 0, givenBack = 0, pendingLoad = 0, prs = 0, backoffs = 0, voids = 0;

  entries.forEach(e => {
    if (e.k === 'void') { voids++; return; }
    let L = byLift.get(e.ex);
    if (!L) byLift.set(e.ex, L = { name: e.ex, base: e.k === 'base' ? e.to : e.from, cur: 0, peak: 0, provenW: 0 });
    if      (e.k === 'base') { /* a starting point is not load you added */ }
    else if (e.k === 'down') { givenBack += e.from - e.to; backoffs++; }
    else if (e.proven) {
      grossAdded += e.to - e.from;
      /* only a NEW high is a record — regaining ground you deloaded from
         is progress, but it isn't a PR */
      if (e.to > L.peak) prs++;
    }
    else pendingLoad += e.to - e.from;              // claimed, not yet earned
    L.cur = e.to;
    if (e.to > L.peak) L.peak = e.to;
    if (e.proven) L.provenW = e.to;
  });
  return { entries, byLift, netAdded: grossAdded - givenBack,
           grossAdded, givenBack, pendingLoad, prs, backoffs, voids };
}

/* What you have actually trained at, per lift. Never above the current
   working weight — you can't be proven at 100 while set to 90. */
function provenMap(w, hist) {
  const pm = {};
  Object.keys(w).forEach(n => {
    const L = hist.byLift.get(n);
    /* No history at all means the weight predates the log and has never been
       edited since, so the honest reading is that it's what you already
       train at. Anything else would wipe a returning user's rank. */
    pm[n] = L ? Math.min(w[n], L.provenW || 0) : w[n];
  });
  return pm;
}

/* The weight the log currently implies for a lift, which is what a new
   entry has to hang off — using the raw bp_wt value instead would let the
   two drift apart and break the telescoping above. */
function recordedOf(l, name, fallback) {
  for (let i = l.length - 1; i >= 0; i--)
    if (l[i].ex === name && l[i].k !== 'void') return l[i].to;
  return fallback;
}

/* ═══════════════════ STRENGTH SCORING ═══════════════════ */

/* Epley: a working weight taken to failure at `reps` implies this 1RM. */
const est1RM = (w, r) => w * (1 + r / 30);

/* Where `ratio` sits on this lift's tier ladder, as a percentile.
   Linear between the published anchors; tapered above Elite so a huge
   number can't run away to 100. */
function pctFor(ratio, tiers) {
  if (ratio <= tiers[0]) {
    /* Below the Beginner anchor. Guard against anchors that are zero or
       negative — weighted pull-ups start out assisted, so theirs is -0.20. */
    if (tiers[0] <= 0) return 0;
    return Math.max(0, (ratio / tiers[0]) * TIER_PCT[0]);
  }
  for (let k = 0; k < tiers.length - 1; k++) {
    if (ratio < tiers[k + 1]) {
      const span = tiers[k + 1] - tiers[k];
      const t = span > 0 ? (ratio - tiers[k]) / span : 0;
      return TIER_PCT[k] + t * (TIER_PCT[k + 1] - TIER_PCT[k]);
    }
  }
  return Math.min(99.9, TIER_PCT[4] + (ratio / tiers[4] - 1) * 60);
}

/* The ratio a lift scores at, and the inverse: what working weight would
   be needed to hit a target ratio. Both branch on how the source measures
   the lift — per dumbbell, summed across two, or added onto bodyweight. */
function ratioOf(spec, wv, bw, r) {
  if (spec.mode === 'added') return (est1RM(bw + wv, r) - bw) / bw;
  return est1RM(wv * (spec.mult || 1), r) / bw;
}
function weightFor(spec, targetRatio, bw, r) {
  const e = 1 + r / 30;
  if (spec.mode === 'added') return (bw + targetRatio * bw) / e - bw;
  return (targetRatio * bw) / (e * (spec.mult || 1));
}

/* The scored lifts you can actually reach right now. Pull-Ups and Single-Arm
   Rows are alternates of one another, so exactly one of the two is ever on
   screen — counting the whole LIFTS table would leave "Full Sheet" one lift
   short of completable no matter what you log. */
function reachableLifts() {
  const out = new Set();
  PROGRAM.forEach(d => d.sections.forEach(s => s.ex.forEach(e => {
    const n = resEx(e).n;
    if (LIFTS[n]) out.add(n);
  })));
  return out;
}

/* Score one map of working weights. Called twice — once with what you have
   set, once with what you have proven — so the two views can never drift
   apart in their maths. */
function scoreAll(w, bodyweight, r, reach) {
  const out = { lifts: [], overall: 0, rank: rankFor(0),
                scored: 0, scoredReachable: 0, totalScorable: reach.size };
  if (!bodyweight) return out;

  Object.keys(LIFTS).forEach(name => {
    const wv = w[name];
    if (!(wv > 0)) return;
    const spec = LIFTS[name], tiers = spec.r;
    const ratio = ratioOf(spec, wv, bodyweight, r);
    const pct = pctFor(ratio, tiers);
    const rk = rankFor(pct);
    /* lbs of working weight still needed for the next letter */
    let need = null;
    if (rk.next) {
      const ti = TIER_PCT.indexOf(rk.next.min);
      const targetRatio = ti >= 0 ? tiers[ti] : tiers[tiers.length - 1] * 1.08;
      need = Math.max(0, weightFor(spec, targetRatio, bodyweight, r) - wv);
    }
    out.lifts.push({
      name, w: wv, ratio, pct, rank: rk, need,
      /* the 1RM the ratio was actually derived from */
      oneRM: spec.mode === 'added' ? ratio * bodyweight : est1RM(wv * (spec.mult || 1), r),
      oneRMLabel: spec.mode === 'added' ? 'est. 1RM added' : 'est. 1RM',
      src: spec.src, srcLabel: SRC_LABEL[spec.src],
      /* only worth a tooltip when the standard isn't a direct match or there's
         a genuine caveat — otherwise every row grows a badge and says nothing */
      note: spec.note ? `${spec.note}${spec.base && spec.base !== 'None published' ? ` (Standard: ${spec.base}.)` : ''}` : null,
    });
  });

  out.scored = out.lifts.length;
  /* A weight left over on the hidden alternate still scores, but it can't
     count toward finishing the sheet you can currently see. */
  out.scoredReachable = out.lifts.filter(l => reach.has(l.name)).length;
  if (out.scored) {
    out.lifts.sort((a, b) => b.pct - a.pct);
    out.overall = out.lifts.reduce((a, l) => a + l.pct, 0) / out.scored;
    out.rank = rankFor(out.overall);
    out.strongest = out.lifts[0];
    out.weakest = out.lifts[out.lifts.length - 1];
  }
  return out;
}

export function strength() {
  const bw = load('bp_bw', []);
  const bodyweight = bw.length ? bw[bw.length - 1].w : null;
  const r = reps(), w = wts(), reach = reachableLifts();
  const hist = weightHistory(), pw = provenMap(w, hist);

  const out = { bodyweight, reps: r, unscored: [], ...scoreAll(w, bodyweight, r, reach) };
  Object.keys(w).forEach(name => {
    if (!LIFTS[name]) out.unscored.push({ name, w: w[name] });
  });
  out.unscored.sort((a, b) => a.name.localeCompare(b.name));

  /* The same scoring run over proven weights only. This is the view that
     earns things; the live one above is what you see while you decide. */
  out.proven = scoreAll(pw, bodyweight, r, reach);
  out.lifts.forEach(l => { l.provenW = pw[l.name] || 0; l.pending = l.provenW < l.w; });
  out.pending = out.lifts.filter(l => l.pending);
  /* Untested weights including unscored movements and the no-bodyweight
     case, which the pending count on the Progression card still needs. */
  out.pendingAll = Object.keys(w).filter(n => w[n] > 0 && (pw[n] || 0) < w[n]);
  return out;
}

export function setReps(r) { if (REP_OPTS.includes(+r)) sReps(+r); }

/* Scored lifts keyed by exercise name, for callers outside the Rank tab
   that need a lift's standing — the Program tab colours each row with it.
   Empty until a bodyweight and a working weight both exist. */
export function liftScores() {
  return new Map(strength().lifts.map(l => [l.name, l]));
}

/* Where a single lift stands, including the reasons it might not have a
   score. The weight editor has to explain itself rather than just go blank. */
export function standingOf(name) {
  if (!LIFTS[name]) return { state: 'unscored' };
  const st = strength();
  if (!st.bodyweight) return { state: 'nobw' };
  const lift = st.lifts.find(l => l.name === name);
  return lift ? { state: 'scored', lift } : { state: 'noweight' };
}

/* ═══════════════════ CONSISTENCY STATS ═══════════════════ */

/* Where each scheduled day's work actually landed.

   Miss Monday, tick Monday's card and Tuesday's card on Tuesday, and the
   work was moved, not skipped — so Monday stops reading as a miss. The
   window is the Monday-start week, the same unit perfect weeks already
   use: this week's Monday can still be made up on Sunday, and a Monday
   from three weeks ago cannot be made up at all.

   Returns 'done' when the day's own card was finished on the day itself,
   otherwise the date its work landed on, otherwise null. */
function coverage(log) {
  const byWeek = new Map();
  log.forEach(e => {
    const k = dateStr(weekStart(dOf(e.d)));
    if (!byWeek.has(k)) byWeek.set(k, new Map());
    const m = byWeek.get(k);
    m.set(e.di, [...(m.get(e.di) || []), e.d]);
  });
  return (ds, dow) => {
    const di = DI_OF_DOW[dow];
    if (di === undefined) return null;
    const on = byWeek.get(dateStr(weekStart(dOf(ds))))?.get(di);
    if (!on) return null;
    return on.includes(ds) ? 'done' : [...on].sort()[0];
  };
}

/* A made-up day keeps the run alive without adding to it. The streak counts
   days you trained, and handing five days to one Sunday because five cards
   got ticked that afternoon is exactly the kind of number this file refuses
   to print — so a makeup bridges the gap and does nothing else. Miss Monday,
   double up Tuesday, and the streak reads 4 → 5, not 4 → 6 and not 0 → 1. */
function streaksFrom(hits, firstDate, cover) {
  const today = todayStr();
  if (!firstDate) return { streak:0, best:0 };
  let cur = 0, best = 0;
  eachDate(firstDate, today, (ds, d) => {
    if (!schedOn(ds, d.getDay())) return;
    if (hits.has(ds)) { cur++; best = Math.max(best, cur); return; }
    if (cover(ds, d.getDay())) return;        // made up later the same week
    if (ds !== today) cur = 0;
  });
  return { streak: cur, best };
}

export function stats() {
  const log = logAll(), h = weightHistory();
  const hits = new Set(log.map(e => e.d));
  const firstDate = log.length ? log[0].d : null;
  const cover = coverage(log);
  const { streak, best } = streaksFrom(hits, firstDate, cover);

  const weeks = new Map();
  log.forEach(e => {
    const k = dateStr(weekStart(dOf(e.d)));
    if (!weeks.has(k)) weeks.set(k, new Set());
    weeks.get(k).add(e.di);
  });
  let perfectWeeks = 0;
  weeks.forEach((set, k) => { if (set.size >= weekTargetFor(k)) perfectWeeks++; });

  /* longest layoff between two logged sessions */
  const days = [...new Set(log.map(e => e.d))].sort();
  let maxGap = 0;
  for (let i = 1; i < days.length; i++) {
    const g = Math.round((dOf(days[i]) - dOf(days[i - 1])) / 86400000);
    if (g > maxGap) maxGap = g;
  }
  const bwLog = load('bp_bw', []);

  const s = {
    log, prList: h.entries, hits, firstDate, cover,
    sessions: log.length,
    sets: log.reduce((a, e) => a + (e.sets || 0), 0),
    /* Records, not edits: an increase counts once it clears that lift's
       previous high AND you have trained it. Load added is net — every
       back-off comes back off it, every rolled-back increase was never in
       it, and a weight you have only typed is waiting in pendingLoad. */
    prs: h.prs,
    loadAdded: h.netAdded,
    grossAdded: h.grossAdded,
    givenBack: h.givenBack,
    pendingLoad: h.pendingLoad,
    backoffs: h.backoffs,
    voids: h.voids,
    streak, best,
    weekDone: weeks.get(dateStr(weekStart(new Date())))?.size || 0,
    weekTarget: weekTargetFor(dateStr(weekStart(new Date()))),
    perfectWeeks, maxGap,
    bwCount: bwLog.length,
    bwDelta: bwLog.length >= 2 ? bwLog[bwLog.length - 1].w - bwLog[0].w : 0,
  };
  return s;
}

export const isLoggedToday = di => logAll().some(e => e.d === todayStr() && e.di === di);

/* ═══════════════════ WRITES ═══════════════════ */
/* A point-in-time picture of everything that can "level up". Callers that
   mutate bp_wt must capture this BEFORE writing, since lift tiers are read
   back out of bp_wt — otherwise before and after are identical and the
   tier-up goes unnoticed. */
export function snapshot() {
  const st = strength(), cs = stats(), pv = st.proven;
  return {
    rankIdx: pv.rank.i,
    rank: pv.rank,
    lifts: new Map(pv.lifts.map(l => [l.name, { i: l.rank.i, rank: l.rank }])),
    badges: new Set([...Object.keys(achAll()), ...earned(cs, pv)]),
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
  proveDay(di);                       // finishing the work is what banks it
  const after = snapshot();
  latch();
  return { logged: true, label: PROGRAM[di].label, ...(diff(before, after, {}) || {}) };
}

/* Finishing a day turns the weights on that day's movements from a claim
   into a fact. Stamped here, at the moment the session closes, so it can't
   be back-dated by editing a weight later the same evening. */
function proveDay(di) {
  const names = dayLifts()[di], w = wts(), l = prAll();
  let dirty = false;
  l.forEach(e => {
    if (e.p || e.k === 'void' || !names?.has(e.ex)) return;
    if (!(w[e.ex] >= e.to)) return;   // you trained at least what it claims
    e.p = 1; dirty = true;
  });
  if (dirty) prSv(l);
}

/* Walk back from the newest entry undoing weight that was never trained.
   Stops dead at the first proven entry: history you actually lifted under
   does not get rewritten by one bad session. */
function retractTo(l, name, target, isProven, rolled) {
  for (let i = l.length - 1; i >= 0; i--) {
    const e = l[i];
    if (e.ex !== name || e.k === 'void') continue;
    if (e.to <= target || isProven(e)) return;
    e.hi = Math.max(e.hi || 0, e.to);              // what the attempt reached
    /* a baseline or an in-progress back-off just moves down with you; an
       increase you only partly gave back is trimmed to what's left */
    if (e.k === 'base' || e.k === 'down' || e.from < target) { e.to = target; rolled.push(e); return; }
    e.k = 'void'; rolled.push(e);                  // gone entirely, keep looking
  }
}

/* The mirror image. Coming back up from a back-off you never trained under
   cancels it, rather than logging a fresh "increase" for ground you had. */
function unBackoff(l, name, target, isProven, rolled) {
  for (let i = l.length - 1; i >= 0; i--) {
    const e = l[i];
    if (e.ex !== name || e.k === 'void') continue;
    if (e.k !== 'down' || isProven(e)) return;
    if (target < e.from) { e.to = target; rolled.push(e); return; }
    e.k = 'void'; rolled.push(e);
  }
}

/* Every working-weight change lands here, in both directions.

   Going up is provisional: the entry is written unproven, so a later drop
   that happens before you ever trained it voids the whole thing instead of
   leaving a phantom +20 sitting in your load total forever. Going down from
   a weight that WAS proven is a real back-off — logged, subtracted, kept,
   because a deload is information rather than an embarrassment. */
export function logWeight(name, prev, next, before) {
  if (!before) before = snapshot();
  const l = prAll(), d = todayStr(), isProven = provenTest();
  const rolled = [];
  const done = kind => {
    const after = snapshot();
    latch();
    return { ...(diff(before, after, {}) || {}),
             change: { name, from: prev || 0, to: next, kind, rolled } };
  };

  const has = l.some(e => e.ex === name && e.k !== 'void');
  const from0 = prev > 0 ? prev : 0;

  /* Clearing the field is untracking the movement, not lifting zero. What
     you proved stays on the record; what you only claimed does not. */
  if (!(next > 0)) {
    l.forEach(e => {
      if (e.ex !== name || e.k === 'void' || isProven(e)) return;
      e.hi = Math.max(e.hi || 0, e.to); e.k = 'void'; rolled.push(e);
    });
    prSv(l);
    return done('clear');
  }

  if (!has) {
    /* The first weight on a lift is a baseline, not an increase — there is
       nothing to have improved on. One already sitting in bp_wt predates the
       log, so it goes in proven: it isn't a claim this edit is making. */
    l.push({ d, ex: name, from: 0, to: from0 || next, k: 'base', p: from0 ? 1 : 0 });
    if (!from0) { prSv(l); return done('base'); }
  }

  const rec = recordedOf(l, name, from0);
  if (next < rec) retractTo(l, name, next, isProven, rolled);
  else if (next > rec) unBackoff(l, name, next, isProven, rolled);
  const now = recordedOf(l, name, from0);          // after any rollback

  if (now < next) {
    const same = l.filter(e => e.ex === name && e.d === d && !e.k && !isProven(e)).pop();
    if (same) same.to = next; else l.push({ d, ex: name, from: now, to: next, p: 0 });
  } else if (now > next) {
    const same = l.filter(e => e.ex === name && e.d === d && e.k === 'down' && !isProven(e)).pop();
    if (same) same.to = next; else l.push({ d, ex: name, from: now, to: next, k: 'down', p: 0 });
  }
  prSv(l);
  return done(now < next ? 'up' : now > next ? 'down' : rolled.length ? 'rollback' : 'none');
}

/* Proof isn't unwound here: nothing records WHICH session proved a given
   weight, and deleting one old entry out of months of training shouldn't be
   able to un-lift it anyway. */
export function delSession(d, di) {
  logSv(logAll().filter(e => !(e.d === d && e.di === +di)));
}

/* ═══════════════════ RESET ═══════════════════ */

/* Scoped rather than one button. "I want the streak to start again" and "I
   want my rank back to zero" are different requests, and collapsing them
   into a single Erase Everything makes the smaller one cost the larger one.
   Each record says what is computed from it, so the choice can be made on
   what you'd lose rather than on the name of a storage key. */
let resetOpen = false;
const resetSel = new Set();

const RESETS = [
  { id:'log', key:'bp_log', n:'Session log', u:'session',
    d:'Streaks, the heatmap, hard-set totals and every consistency milestone are counted out of this.' },
  { id:'pr',  key:'bp_pr',  n:'Weight-change history', u:'entry', p:'entries',
    d:'Personal records, net load added, back-offs — and the proof that separates a weight you typed from one you have trained. Clearing it makes every current weight read as a fresh starting point.' },
  { id:'wt',  key:'bp_wt',  n:'Working weights', u:'lift',
    d:'The letter is computed from these. Clearing them takes every lift back to unscored and the rank to none.' },
  { id:'bw',  key:'bp_bw',  n:'Bodyweight log', u:'entry', p:'entries',
    d:'Every standard is relative to bodyweight, so the rank disappears until you log one again. The nutrition targets in Study go with it.' },
  { id:'ach', key:'bp_ach', n:'Milestone dates', u:'unlocked', p:'unlocked',
    d:'Only the dates. Anything still true at your current numbers re-earns itself on the next render — to genuinely re-lock a milestone, clear what earned it as well.' },
  { id:'chk', key:'bp_chk', n:'Checkmarks', u:'ticked', p:'ticked',
    d:"Today's ticks on the Program tab. Nothing is scored from them, so this one costs you nothing." },
];

const resetCount = {
  log: () => logAll().length,
  pr:  () => prAll().length,
  wt:  () => Object.keys(wts()).length,
  bw:  () => load('bp_bw', []).length,
  ach: () => Object.keys(achAll()).length,
  chk: () => Object.values(load('bp_chk', {})).filter(Boolean).length,
};

const plural = (r, c) => c === 1 ? r.u : (r.p || r.u + 's');

export function resetTargets() {
  return RESETS.map(r => {
    const c = resetCount[r.id]();
    return { id:r.id, n:r.n, d:r.d, c, cl: c ? `${c} ${plural(r, c)}` : 'empty' };
  });
}

/* Only ever what was asked for. Settings the reset has no business touching
   — the equipment flag, the rep assumption, the theme — live in their own
   keys and are deliberately not in the table above. */
export function applyReset(ids) {
  const want = new Set(ids);
  RESETS.forEach(r => { if (want.has(r.id)) remove(r.key); });
  resetSel.clear();
  resetOpen = false;
}

/* ═══════════════════ CELEBRATION ═══════════════════ */
/* Twelve sparks on fixed angles — deterministic, so it looks composed
   rather than random, and it only ever fires on a rank-up or unlock. */
const BURST = Array.from({ length: 12 }, (_, i) =>
  `<i style="--a:${i * 30}deg;--d:${58 + (i % 3) * 22}px;--t:${(i % 4) * 40}ms"></i>`).join('');

export function celebrationHTML(r) {
  if (!r || (!r.rankUp && !r.tierUps?.length && !r.badges?.length)) return null;
  let h = '';
  if (r.rankUp) {
    h += `<div class="lv-rank" style="--rc:var(${r.rankUp.c})">
      <div class="lv-kicker">Rank Up</div>
      <div class="lv-letter"><span class="lv-burst">${BURST}</span><span class="lv-badge-hex"><b>${r.rankUp.l}</b></span></div>
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
    <div class="rk-marker" data-pos="${Math.max(0.4, Math.min(99.6, pct)).toFixed(2)}" style="left:0"></div>
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
      <div class="rk-hero-row"><div class="rk-badge"><span class="rk-letter">?</span></div>
        <div class="rk-hero-txt"><div class="rk-name">Bodyweight missing</div>
        <div class="rk-blurb">Strength standards are relative to bodyweight. Log yours in the <b>Weight</b> tab and this fills in immediately.</div></div></div>
    </div>`;
  }
  if (!st.scored) {
    return `<div class="rk-hero" style="--rc:var(--text-3)"><span class="rk-scan"></span>
      <div class="rk-kicker">No Rank</div>
      <div class="rk-hero-row"><div class="rk-badge"><span class="rk-letter">?</span></div>
        <div class="rk-hero-txt"><div class="rk-name">No weights logged</div>
        <div class="rk-blurb">Tap any exercise in the <b>Program</b> tab and set its working weight. Rank is computed from what you actually lift — nothing else moves it.</div></div></div>
    </div>`;
  }
  const rk = st.rank;
  const beat = Math.round(st.overall);
  const nx = rk.next;
  const pv = st.proven, pend = st.pending.length;
  return `<div class="rk-hero" style="--rc:var(${rk.c})"><span class="rk-scan"></span>
    <div class="rk-hero-top">
      <div class="rk-kicker">Strength Rank</div>
      <div class="rk-kicker">${st.scored} lift${st.scored === 1 ? '' : 's'} scored · ${st.bodyweight} lb bodyweight</div>
    </div>
    <div class="rk-hero-row">
      <div class="rk-badge"><span class="rk-letter">${rk.l}</span></div>
      <div class="rk-hero-txt">
        <div class="rk-name">${rk.name}</div>
        <div class="rk-pct">Stronger than <b>${beat}%</b> of lifters at your bodyweight</div>
        <div class="rk-blurb">${rk.blurb}</div>
      </div>
    </div>
    ${bandTrack(st.overall, true)}
    <div class="rk-hero-foot">
      <span>${nx ? `Next: <b>${nx.l} · ${nx.name}</b> at the ${nx.min}th percentile` : 'Off the top of the published data.'}</span>
      <span class="rk-foot-pct" data-cnt="${st.overall.toFixed(1)}" data-dec="1">0.0</span>
    </div>
    ${pend ? `<div class="rk-pending">
      <b>${pend} lift${pend === 1 ? '' : 's'}</b> sitting at a weight you haven't trained yet, so the letter above is
      an estimate of what you'd rank if ${pend === 1 ? 'it holds' : 'they hold'}.
      ${pv.scored ? `Confirmed right now: <b style="color:var(${pv.rank.c})">${pv.rank.l}</b> at the ${Math.round(pv.overall)}th percentile.`
                  : 'Nothing confirmed yet.'}
      Milestones and rank-ups land when you finish a session that uses ${pend === 1 ? 'it' : 'them'}.
    </div>` : ''}
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
        <div class="rk-lift-n">${l.name}${l.srcLabel
            ? `<span class="rk-lift-src ${l.src}" title="${l.note || ''}">${l.srcLabel}</span>`
            : (l.note ? `<span class="rk-lift-src info" title="${l.note}">i</span>` : '')}${l.pending
            ? `<span class="rk-lift-src pend" title="No completed session at ${l.w} lbs yet${l.provenW ? ` — last trained at ${l.provenW} lbs` : ''}. This row is an estimate until there is one.">Untested</span>` : ''}</div>
        <div class="rk-lift-r" style="color:var(${l.rank.c})">${l.rank.l}</div>
      </div>
      ${bandTrack(l.pct, false)}
      <div class="rk-lift-foot">
        <span><b>${l.w}</b> lbs · <b>${Math.round(l.oneRM)}</b> ${l.oneRMLabel} · ${l.ratio.toFixed(2)}× bw</span>
        <span class="rk-lift-need">${l.need !== null && l.rank.next
            ? `+${l.need < 1 ? l.need.toFixed(1) : Math.round(l.need)} lbs → ${l.rank.next.l}`
            : 'maxed'}</span>
      </div>
    </div>`).join('');

  const repBtns = REP_OPTS.map(r =>
    `<button class="rk-rep ${r === st.reps ? 'sel' : ''}" data-act="rk-reps" data-r="${r}">${r}</button>`).join('');

  const unscored = st.unscored.length ? `<div class="rk-unscored">
      <div class="rk-unscored-t">Not scored — no published standard to score these against</div>
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
      const sched = schedOn(ds, d.getDay());
      const label = PROGRAM[DI_OF_DOW[d.getDay()]]?.label || 'scheduled';
      /* 'done' never reaches the makeup branch — it implies a session that
         date, which is caught above. What is left over is work that moved. */
      const cov = sched ? s.cover(ds, d.getDay()) : null;
      const made = cov && cov !== 'done' ? cov : null;
      let cls, tip;
      if (ds > today)                            cls = 'future', tip = fmtD(ds);
      else if (s.hits.has(ds)) {
        cls = 'hit';
        tip = `${fmtD(ds)} · ${s.log.filter(e => e.d === ds).map(e => PROGRAM[e.di]?.label).join(', ') || 'session'}`;
      }
      else if (!sched)                           cls = 'rest',   tip = `${fmtD(ds)} · rest day`;
      else if (made)                             cls = 'make',   tip = `${fmtD(ds)} · ${label} · made up ${fmtD(made)}`;
      else if (ds === today)                     cls = 'open',   tip = `Today · ${label}`;
      else if (s.firstDate && ds >= s.firstDate) cls = 'miss',   tip = `${fmtD(ds)} · missed`;
      else                                       cls = 'pre',    tip = fmtD(ds);
      if (ds === today) cls += ' today';
      cells += `<div class="pg-hm-c ${cls}" style="grid-row:${r + 1};grid-column:${c + 1};--c:${c}" title="${tip}"></div>`;
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
      <span><i class="pg-hm-c make"></i>Made up</span>
      <span><i class="pg-hm-c miss"></i>Missed</span>
      <span><i class="pg-hm-c rest"></i>Rest day</span>
    </div>
  </div>`;
}

function tile(label, value, unit, sub, cnt) {
  const v = cnt ? `<span data-cnt="${cnt}" data-fmt="n">0</span>` : value;
  return `<div class="bw-stat">
    <div class="bw-stat-v">${v}${unit ? `<span class="bw-stat-u">${unit}</span>` : ''}</div>
    <div class="bw-stat-l">${label}</div>
    <div class="bw-stat-d ${sub ? 'up' : 'flat'}">${sub || '·'}</div>
  </div>`;
}

/* Days this week whose weekday has passed with their own card still
   unfinished. They can be made up until Sunday, so the card says how many
   are still on the table instead of letting them rot into misses quietly.
   A day you trained on but trained something else is owed like any other —
   its work has not happened yet. */
function owedThisWeek(s) {
  const today = todayStr(), out = [];
  eachDate(dateStr(weekStart(new Date())), today, (ds, d) => {
    if (ds >= today || !schedOn(ds, d.getDay()) || s.cover(ds, d.getDay())) return;
    out.push(PROGRAM[DI_OF_DOW[d.getDay()]].label);
  });
  return out;
}

function nextUpHTML(s) {
  const now = new Date();
  const owed = owedThisWeek(s);
  const tail = owed.length
    ? ` <span class="pg-next-owe" title="${owed.join(', ')}">+${owed.length} to make up</span>` : '';
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i), ds = dateStr(d);
    if (!schedOn(ds, d.getDay())) continue;
    if (i === 0 && s.hits.has(ds)) continue;
    const when = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dOf(ds).toLocaleDateString('en-US', { weekday:'long' });
    return `<span class="pg-next-w">${when}</span> · ${PROGRAM[DI_OF_DOW[d.getDay()]].label}${tail}`;
  }
  return `Rest up.${tail}`;
}

/* One row of the change feed. Three shapes, because three different things
   can happen to a working weight and flattening them into "+X%" is exactly
   the lie this card used to tell. */
function prRow(p, i) {
  const vd = p.k === 'void', dn = p.k === 'down';
  const to = vd ? (p.hi || p.to) : p.to;            // voids show what was attempted
  const pc = p.from > 0 ? Math.round(((to - p.from) / p.from) * 100) : 0;
  /* Only an increase can be waiting on proof. A back-off has already taken
     effect — saying "untested" there would read as "doesn't count yet". */
  const tag = vd ? 'never trained at it' : (!p.proven && !dn ? 'untested' : '');
  return `<div class="pg-pr ${vd ? 'void' : ''} ${dn ? 'down' : ''}" style="--i:${i}">
    <div class="pg-pr-ex">${p.ex}</div>
    <div class="pg-pr-w"><span class="pg-pr-from">${p.from}</span> → ${to} <span class="pg-pr-u">lbs</span></div>
    <div class="pg-pr-up">${vd ? 'rolled back' : `${pc > 0 ? '+' : ''}${pc}%`}</div>
    <div class="pg-pr-d">${fmtD(p.d)}${dn && !vd ? ' · back-off' : ''}${tag ? ` · <span class="pg-pr-tag">${tag}</span>` : ''}</div>
  </div>`;
}

function progressionHTML(s, st) {
  /* Baselines are where a lift started, not progress — they'd bury the feed
     the day you first fill the sheet in and say nothing. */
  const feed = s.prList.filter(p => p.k !== 'base').slice(-10).reverse()
    .map((p, i) => prRow(p, i)).join('');

  const net = Math.round(s.loadAdded * 10) / 10, down = net < 0;
  const pend = st.pendingAll.length;
  const notes = [];

  const bw = load('bp_bw', []);
  if (bw.length >= 2 && s.grossAdded > 0) {
    const delta = bw[bw.length - 1].w - bw[0].w;
    notes.push(Math.abs(delta) < 0.5
      ? `Bodyweight holding steady while adding ${fmtN(Math.round(net))} lbs of load.`
      : `${delta < 0 ? 'Down' : 'Up'} ${Math.abs(delta).toFixed(1)} lbs of bodyweight while adding ${fmtN(Math.round(net))} lbs of load.`);
  }
  if (s.givenBack > 0)
    notes.push(`Peaked at <b>+${fmtN(Math.round(s.grossAdded))} lbs</b> added, and ${fmtN(Math.round(s.givenBack))} of that has come back off across
      ${s.backoffs} back-off${s.backoffs === 1 ? '' : 's'} on weight you had already trained. Deloads are real, so they count.`);
  if (s.voids > 0)
    notes.push(`<b>${s.voids}</b> increase${s.voids === 1 ? '' : 's'} rolled back — set, then lowered again before a single
      session ever trained ${s.voids === 1 ? 'it' : 'them'}. ${s.voids === 1 ? 'It was' : 'They were'} never counted.`);
  if (pend)
    notes.push(`<b>${pend} weight${pend === 1 ? '' : 's'}</b> still untested${s.pendingLoad > 0
      ? `, holding <b>${fmtN(Math.round(s.pendingLoad))} lbs</b> out of the total above` : ''}. Finish the session that
      trains ${pend === 1 ? 'it' : 'them'} and ${pend === 1 ? 'it lands' : 'they land'}.`);

  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Progression</div>
      <div class="pg-card-note">${s.prs} personal record${s.prs === 1 ? '' : 's'}</div></div>
    <div class="pg-big">
      <div class="pg-big-v ${down ? 'down' : ''}">${down ? '−' : '+'}<span data-cnt="${Math.abs(net)}" data-fmt="n">0</span><span class="pg-big-u">lbs</span></div>
      <div class="pg-big-l">Net load added across every lift${s.givenBack > 0 ? ', after back-offs' : ''}</div>
      ${notes.length ? `<div class="pg-notes">${notes.map(n => `<div class="pg-big-note">${n}</div>`).join('')}</div>` : ''}
    </div>
    ${feed ? `<div class="pg-pr-list">${feed}</div>`
           : `<div class="pg-empty">Raise a working weight in any exercise and it lands here.</div>`}
  </div>`;
}

function badgesHTML(ach) {
  /* Three states, not two. "Earned" and "still true" stopped being the same
     thing the moment a back-off could move you back down a letter, and
     deleting the badge would be pretending the month you held it never
     happened. */
  const cell = (b, i) => {
    const on = ach.ids.has(b.id), held = ach.now.has(b.id);
    return `<div class="pg-b ${on ? 'on' : ''} ${on && !held ? 'lapsed' : ''}" style="--i:${i}">
      <div class="pg-b-ico ${on ? 'on' : ''}">${svg(b.ico)}</div>
      <div class="pg-b-n">${b.n}</div>
      <div class="pg-b-r">${!on ? b.req
        : held ? `Unlocked${ach.at[b.id] ? ` · ${fmtD(ach.at[b.id])}` : ''}`
        : 'Earned · not held now'}</div>
    </div>`;
  };

  let i = 0;
  const groups = CATS.map((title, ci) => {
    const all = BADGES.filter(b => b.cat === ci);
    const got = all.filter(b => ach.ids.has(b.id));
    /* earned first inside each group, so progress reads top-down */
    const ordered = [...got, ...all.filter(b => !ach.ids.has(b.id))];
    return `<div class="pg-b-group">
      <div class="pg-b-gt"><span>${title}</span><span class="pg-b-gc ${got.length === all.length ? 'full' : ''}">${got.length}/${all.length}</span></div>
      <div class="pg-b-grid">${ordered.map(b => cell(b, i++)).join('')}</div>
    </div>`;
  }).join('');

  const lapsed = [...ach.ids].filter(id => !ach.now.has(id)).length;
  return `<div class="pg-card">
    <div class="pg-card-head"><div class="pg-card-title">Achievements</div><div class="pg-card-note">${ach.ids.size}/${BADGES.length}</div></div>
    ${lapsed ? `<div class="pg-b-lapse">${lapsed} of these ${lapsed === 1 ? 'is' : 'are'} no longer true at your current weights.
      Earning something is a date on the calendar, so ${lapsed === 1 ? 'it stays' : 'they stay'} unlocked — but the card says so rather than pretending.</div>` : ''}
    ${groups}
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

/* ── reset card ── */
/* Closed it is one line and a button; open it is a checklist. Kept at the
   bottom of the tab because it is the one control here that destroys
   something, and it should take a scroll and two taps to reach. */
function resetHTML() {
  const tg = resetTargets();
  const held = tg.filter(t => t.c > 0);

  if (!resetOpen) {
    return `<div class="pg-card rk-reset">
      <div class="pg-card-head"><div class="pg-card-title">Reset</div>
        <div class="pg-card-note">${held.length}/${tg.length} hold data</div></div>
      <div class="rk-rs-intro">Start a section over — the streak, the rank, the milestones, or all of it.
        Nothing here can be undone, so export a backup from <b>Settings</b> first if there is any chance
        you want it back.</div>
      <button class="rk-rs-open" data-act="rk-reset-open">Reset Progress…</button>
    </div>`;
  }

  const rows = tg.map(t => `
    <button class="rk-rs ${resetSel.has(t.id) ? 'on' : ''}" data-act="rk-reset-tgl" data-k="${t.id}"
            ${t.c ? '' : 'disabled'}>
      <span class="rk-rs-box"></span>
      <span class="rk-rs-b">
        <span class="rk-rs-h"><span class="rk-rs-n">${t.n}</span><span class="rk-rs-c">${t.cl}</span></span>
        <span class="rk-rs-d">${t.d}</span>
      </span>
    </button>`).join('');

  const allOn = held.length > 0 && held.every(t => resetSel.has(t.id));
  return `<div class="pg-card rk-reset open">
    <div class="pg-card-head"><div class="pg-card-title">Reset</div>
      <button class="rk-rs-all" data-act="rk-reset-all">${allOn ? 'Select none' : 'Select everything'}</button></div>
    <div class="rk-rs-list">${rows}</div>
    <div class="rk-rs-warn">Whatever you tick is deleted from this device for good. A backup exported from
      <b>Settings</b> before this is the only way back.</div>
    <div class="rk-rs-btns">
      <button class="rk-rs-go" data-act="rk-reset-go" ${resetSel.size ? '' : 'disabled'}>${resetGoLabel()}</button>
      <button class="rk-rs-x" data-act="rk-reset-close">Cancel</button>
    </div>
  </div>`;
}

const resetGoLabel = () =>
  resetSel.size ? `Reset ${resetSel.size} Selected` : 'Nothing Selected';

/* Ticking a box repaints two elements. A full renderRank() here would rebuild
   the tab under your finger and restart every counter on it. */
export function resetToggle(id, root) {
  if (resetSel.has(id)) resetSel.delete(id); else resetSel.add(id);
  root.querySelector(`[data-act="rk-reset-tgl"][data-k="${id}"]`)?.classList.toggle('on', resetSel.has(id));
  const go = root.querySelector('.rk-rs-go');
  if (go) { go.textContent = resetGoLabel(); go.disabled = !resetSel.size; }
  const all = root.querySelector('.rk-rs-all');
  const held = resetTargets().filter(t => t.c > 0);
  if (all) all.textContent = held.length && held.every(t => resetSel.has(t.id)) ? 'Select none' : 'Select everything';
}

export function resetToggleAll(root) {
  const held = resetTargets().filter(t => t.c > 0);
  const allOn = held.length > 0 && held.every(t => resetSel.has(t.id));
  resetSel.clear();
  if (!allOn) held.forEach(t => resetSel.add(t.id));
  renderRank(root);
}

export function resetPanel(open, root) {
  resetOpen = open;
  if (!open) resetSel.clear();
  renderRank(root);
  if (open) root.querySelector('.rk-reset')?.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

/* The targets currently ticked, for the confirm dialog that names them. */
export const resetSelection = () => resetTargets().filter(t => resetSel.has(t.id));

/* Unlike the active tab, an open delete checklist should NOT survive leaving
   the app — coming back to boxes you ticked yesterday is how an accident
   happens. Called from mount(). */
export function resetDismiss() { resetOpen = false; resetSel.clear(); }

const CALM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Skip the animated path entirely when it can't be seen: a hidden tab never
   fires requestAnimationFrame, which would leave counters reading zero. */
const SKIP_FX = () => CALM() || document.hidden;

/* Count numbers up from zero. Cheap, once per render, and skipped entirely
   when the OS asks for reduced motion. */
function tickCounts(scope) {
  scope.querySelectorAll('[data-cnt]').forEach(el => {
    const to = parseFloat(el.dataset.cnt);
    const dec = +(el.dataset.dec || 0);
    const fmt = v => el.dataset.fmt === 'n' ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec);
    if (!isFinite(to) || to <= 0) { el.textContent = fmt(to || 0); return; }
    if (SKIP_FX()) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* Markers render at 0 and transition out to their real percentile, so the
   bars read as filling toward where you actually are. */
function slideMarkers(scope) {
  scope.querySelectorAll('.rk-marker[data-pos]').forEach(el => {
    const to = el.dataset.pos + '%';
    if (SKIP_FX()) { el.style.left = to; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = to; }));
  });
}

export function renderRank(root) {
  const p = root.querySelector('#p-rank');
  if (!p) return;
  const st = strength(), s = stats(), ach = achievements(s, st);

  let h = heroHTML(st);
  h += verseHTML();
  h += verdictHTML(st);
  h += `<div class="bw-stats pg-tiles">
    ${tile('Streak', s.streak, s.streak === 1 ? 'day' : 'days', s.streak && s.streak === s.best ? 'personal best' : '', s.streak)}
    ${tile('Best', s.best, s.best === 1 ? 'day' : 'days', '', s.best)}
    ${tile('This Week', `${s.weekDone}/${s.weekTarget}`, '', s.weekDone >= s.weekTarget ? 'perfect' : '')}
    ${tile('Sessions', fmtN(s.sessions), '', s.sets ? `${fmtN(s.sets)} sets` : '', s.sessions)}
  </div>`;
  h += `<div class="pg-card rk-next"><span class="pg-kicker">Next Session</span><div>${nextUpHTML(s)}</div></div>`;
  h += liftsHTML(st);
  h += heatmapHTML(s);
  h += progressionHTML(s, st);
  h += badgesHTML(ach);
  h += historyHTML(s);
  h += resetHTML();
  p.innerHTML = h;
  tickCounts(p);
  slideMarkers(p);
}
