/* ═══════════════════════════════════════════════════════════
   SCRIPTURE — storage + spaced repetition.

   The scheduler is SM-2, the algorithm behind most flashcard
   software, trimmed to what memorising a verse actually needs.
   The idea it rests on: you remember something longest if you
   are asked for it just as you are about to forget it. So each
   verse carries its own interval, and the interval grows every
   time you recall it and collapses when you don't.

   Nothing here rewards mere attendance. Reviewing a verse you
   already know does not move it faster than the schedule says,
   and grading yourself generously only means seeing it sooner.

     sc_v    [{...verse}]        the library
     sc_log  {'YYYY-MM-DD': n}   reviews per day, for streak + heatmap
   ═══════════════════════════════════════════════════════════ */

import { load, save, todayStr, dateStr } from '../../assets/js/storage.js';

export const vAll = () => load('sc_v', []);
export const vSave = l => save('sc_v', l);
const logAll = () => load('sc_log', {});
const logSave = o => save('sc_log', o);

/* ── dates ── */
const dOf = ds => new Date(ds + 'T00:00:00');
export function addDaysStr(ds, n) {
  const d = dOf(ds); d.setDate(d.getDate() + n); return dateStr(d);
}
export const daysBetween = (a, b) => Math.round((dOf(b) - dOf(a)) / 86400000);

/* ── the four answers ──
   Deliberately self-graded. No typing test can tell the difference
   between "I knew it" and "I knew it but hesitated", and that
   difference is the entire signal the scheduler runs on. */
export const GRADES = [
  { g:0, lbl:'Again', sub:'Blank',      c:'--red'   },
  { g:1, lbl:'Hard',  sub:'Struggled',  c:'--amber' },
  { g:2, lbl:'Good',  sub:'Recalled',   c:'--blue'  },
  { g:3, lbl:'Easy',  sub:'Instant',    c:'--green' },
];

const MIN_EASE = 1.3;
const MATURE_AT = 21;            // days; the usual line between learning and known

export function newVerse(ref, text, tr = 'KJV', pack = null) {
  return {
    id: (crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(16).slice(2)),
    ref: ref.trim(), text: text.trim(), tr: tr.trim() || 'KJV', pack,
    added: todayStr(), due: todayStr(),
    ease: 2.5, interval: 0, reps: 0, lapses: 0, last: null,
  };
}

/* SM-2. `grade` is an index into GRADES, mapped onto SM-2's 0-5 quality
   scale — there is no point offering six buttons when four are already
   more precision than honest self-assessment provides. */
export function grade(v, gi) {
  const q = [2, 3, 4, 5][gi];
  if (gi === 0) {
    v.lapses++; v.reps = 0; v.interval = 0;      // due again this session
  } else {
    v.reps++;
    /* Textbook SM-2 sends the first two successes to a fixed 1 and 6 days
       whatever you pressed, which makes three of the four buttons promise
       the same thing and turns an honest self-grade into a coin flip.
       Easy jumps the queue instead, and Hard advances grudgingly. */
    if (v.reps === 1)      v.interval = gi === 3 ? 4 : 1;
    else if (v.reps === 2) v.interval = gi === 3 ? 10 : gi === 1 ? 3 : 6;
    else {
      const mult = gi === 1 ? 1.2 : gi === 3 ? v.ease * 1.3 : v.ease;
      v.interval = Math.max(v.interval + 1, Math.round(v.interval * mult));
    }
  }
  v.ease = Math.max(MIN_EASE, +(v.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(3));
  v.last = todayStr();
  v.due = addDaysStr(todayStr(), v.interval);
  return v;
}

/* Count the review the moment it happens, not at session end — a session
   abandoned halfway still did the work. */
export function logReview() {
  const l = logAll(), d = todayStr();
  l[d] = (l[d] || 0) + 1;
  logSave(l);
}

/* ── state of a single verse ── */
export const isDue = (v, on = todayStr()) => v.due <= on;
export function maturity(v) {
  if (!v.reps && !v.lapses) return 'new';
  if (v.interval >= MATURE_AT) return 'known';
  return 'learning';
}
export const MATURITY = {
  new:      { lbl:'New',      c:'--text-3' },
  learning: { lbl:'Learning', c:'--amber'  },
  known:    { lbl:'Known',    c:'--green'  },
};

/* How the next interval would read on a button, so the four grades can
   show their consequence instead of asking you to trust them. */
export function previewInterval(v, gi) {
  const copy = grade({ ...v }, gi);
  const d = copy.interval;
  if (d === 0) return 'now';
  if (d === 1) return '1d';
  if (d < 30)  return d + 'd';
  if (d < 365) return Math.round(d / 30) + 'mo';
  return (d / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}

/* ── the session queue ──
   Due verses, oldest due first so nothing rots at the bottom. A verse
   graded Again goes back on the end of the queue rather than vanishing
   until tomorrow, which is the whole point of "again". */
export function dueQueue(list = vAll()) {
  return list.filter(v => isDue(v)).sort((a, b) => a.due.localeCompare(b.due)).map(v => v.id);
}

/* ── aggregate stats ── */
export function stats(list = vAll()) {
  const log = logAll();
  const today = todayStr();
  const counts = { new: 0, learning: 0, known: 0 };
  list.forEach(v => counts[maturity(v)]++);

  /* streak: consecutive days ending today (or yesterday, so a day still
     in progress doesn't read as broken) with at least one review */
  let streak = 0;
  let cur = log[today] ? today : addDaysStr(today, -1);
  while (log[cur]) { streak++; cur = addDaysStr(cur, -1); }

  const reviews = Object.values(log).reduce((a, n) => a + n, 0);
  const due = list.filter(v => isDue(v)).length;

  /* the next date anything comes up, for the all-caught-up screen */
  const future = list.filter(v => !isDue(v)).map(v => v.due).sort();
  const nextDue = future.length ? future[0] : null;

  return {
    total: list.length, due, ...counts, reviews, streak, log,
    nextDue, nextDueIn: nextDue ? daysBetween(today, nextDue) : null,
    reviewedToday: log[today] || 0,
  };
}

/* ── memorisation aid ──
   First letters only. The oldest trick there is for learning a passage:
   enough shape to walk the sentence, not enough to read it. */
export function firstLetters(text) {
  return text.replace(/([A-Za-z])[A-Za-z']*/g, '$1');
}

/* Half the words hidden, deterministically by position so the same verse
   blanks the same way twice — a hint that reshuffles teaches nothing. */
export function halfHidden(text) {
  let i = 0;
  return text.replace(/([A-Za-z])[A-Za-z']*/g, (w, first) =>
    (i++ % 2 === 0) ? w : first + '—');
}
