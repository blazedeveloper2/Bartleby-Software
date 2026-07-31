/* ═══════════════════════════════════════════════════════════
   STRENGTH STANDARDS + DAILY SCRIPTURE

   LIFTS holds one entry per weighted exercise in the program:

     r     five bodyweight-ratio anchors, in order
             [Beginner, Novice, Intermediate, Advanced, Elite]
           which sit at roughly the 5th / 20th / 50th / 80th / 95th
           percentile of everyone logging that lift at your bodyweight.
     src   how much to trust it:
             'exact'  published standard for this exact movement
             'proxy'  scored on the closest published movement
             'est'    no published data; converted from a related
                      barbell lift with the stated rule
     mult  logged weight × this = the weight the standard refers to
           (default 1 = one dumbbell, which is how the source measures)
     mode  'added' → the logged number is weight ADDED to bodyweight
     base  which published movement the numbers came from

   Source: https://strengthlevel.com/strength-standards (per-lift
   pages, lb, male, "Bodyweight Ratio" table). Retrieved Jul 2026
   from datasets of ~0.2–5M logged lifts per exercise.

   Core work never appears here, for two different reasons. Dead bugs
   take no load at all, so there is nothing to score. The weighted core
   movements — dumbbell crunch, weighted reverse crunch / hanging leg
   raise, weighted side plank — do take load, but no usable standard
   exists for them: Strength Level scores crunches and leg raises in
   REPS at bodyweight, not in weight, and its one weighted-flexion
   entry (standing cable crunch, ~0.99× bodyweight at Intermediate)
   loads through a rope overhead rather than a dumbbell at the chest,
   so it is nowhere near comparable. Rather than invent a number,
   these log their weight and read as unscored — which still gives the
   progressive-overload trail, which is the point of loading them.
   ═══════════════════════════════════════════════════════════ */

export const LIFTS = {
  /* ── published standard for the exact movement ── */
  'Incline Dumbbell Press':      { r:[0.25,0.35,0.50,0.65,0.85], src:'exact', base:'Incline dumbbell bench press' },
  'Dumbbell Bench Press':        { r:[0.20,0.35,0.50,0.70,0.90], src:'exact', base:'Dumbbell bench press' },
  'Dumbbell Shoulder Press':     { r:[0.15,0.25,0.40,0.55,0.70], src:'exact', base:'Dumbbell shoulder press' },
  'Dumbbell Flyes':              { r:[0.10,0.20,0.30,0.45,0.60], src:'exact', base:'Dumbbell fly' },
  'Overhead Tricep Extensions':  { r:[0.05,0.15,0.25,0.45,0.60], src:'exact', base:'Dumbbell tricep extension' },
  'Lateral Raises':              { r:[0.05,0.10,0.20,0.30,0.45], src:'exact', base:'Dumbbell lateral raise' },
  'Reverse Flyes':               { r:[0.05,0.10,0.20,0.35,0.55], src:'exact', base:'Dumbbell reverse fly' },
  'Hammer Curls':                { r:[0.10,0.20,0.30,0.40,0.55], src:'exact', base:'Hammer curl' },
  'Incline Curls':               { r:[0.10,0.15,0.25,0.35,0.45], src:'exact', base:'Incline dumbbell curl' },
  'Dumbbell Pullovers':          { r:[0.15,0.30,0.45,0.65,0.85], src:'exact', base:'Dumbbell pullover' },
  'Single-Arm Rows':             { r:[0.20,0.35,0.55,0.75,1.00], src:'exact', base:'Dumbbell row' },
  'Romanian Deadlifts':          { r:[0.20,0.35,0.55,0.80,1.05], src:'exact', base:'Dumbbell Romanian deadlift' },
  'Bulgarian Split Squats':      { r:[0.15,0.25,0.40,0.60,0.85], src:'exact', base:'Dumbbell Bulgarian split squat' },
  'Standing Calf Raises':        { r:[0.10,0.25,0.45,0.75,1.10], src:'exact', base:'Dumbbell calf raise' },

  /* ── weighted pull-up: the standard is ADDED weight ÷ bodyweight,
        and its Beginner anchor is negative (assisted) ── */
  'Pull-Ups':                    { r:[-0.20,0.18,0.59,1.06,1.55], src:'exact', mode:'added', base:'Weighted pull-up',
                                   note:'Logged weight is read as weight ADDED on a belt. Beginner is negative because that tier is still using assistance.' },

  /* ── closest published movement ── */
  'Chest-Supported Rows':        { r:[0.20,0.35,0.55,0.75,1.00], src:'proxy', base:'Dumbbell row',
                                   note:'Chest-supported is the stricter variation, so this reads a little harsh.' },
  'Heel-Elevated Goblet Squats': { r:[0.20,0.35,0.55,0.75,1.05], src:'proxy', base:'Goblet squat',
                                   note:'Heel elevation makes the movement slightly easier than the published version.' },
  'Preacher Curls':              { r:[0.10,0.15,0.25,0.35,0.45], src:'proxy', base:'Incline dumbbell curl',
                                   note:'No dumbbell preacher-curl data exists. Incline curl is the closest published match — both are strict curls from a stretched position.' },

  /* ── no published dumbbell data; converted from a barbell lift ── */
  'B-Stance RDLs':               { r:[0.25,0.50,0.75,1.25,1.50], src:'est', mult:2, base:'Single-leg Romanian deadlift (barbell, total load)',
                                   note:'Your two dumbbells are summed and compared with the single-leg barbell standard. A B-stance rear foot takes some of the load, so this reads generous.' },
  'B-Stance Hip Thrusts':        { r:[0.25,0.63,0.88,1.38,1.88], src:'est', base:'Barbell hip thrust, halved for one-leg-dominant work',
                                   note:'Barbell hip-thrust standards (0.50/1.25/1.75/2.75/3.75× bodyweight) halved, since a B-stance thrust loads roughly one leg. A rough estimate, not published data.' },
  "Farmer's Carries":            { r:[0.20,0.35,0.50,0.70,0.95], src:'est', base:'None published',
                                   note:'No strength standard exists for loaded carries — they are normally measured by distance or time, not a 1RM. These thresholds are a reasonable-effort estimate and the least trustworthy number on this page.' },
};

/* Back-compat alias: the ratio-only view of LIFTS. */
export const RATIOS = Object.fromEntries(Object.entries(LIFTS).map(([k, v]) => [k, v.r]));

export const SRC_LABEL = { exact:'', proxy:'Proxy', est:'Estimate' };

/* Percentile anchors for the five tiers, used to interpolate a score. */
export const TIER_PCT = [5, 20, 50, 80, 95];

/* Letter ranks. `min` is the percentile floor. Blunt on purpose. */
export const RANKS = [
  { l:'F',  min:0,    name:'Untrained',    c:'--rk-f', blurb:'Below the weakest bracket that gets logged. Nothing here yet.' },
  { l:'D',  min:5,    name:'Beginner',     c:'--rk-d',    blurb:'You have started. That is the entire compliment.' },
  { l:'C',  min:20,   name:'Novice',       c:'--rk-c',  blurb:'Stronger than a beginner, weaker than the average gym-goer.' },
  { l:'B',  min:50,   name:'Intermediate', c:'--rk-b',   blurb:'Average. Years of consistent work separate this from strong.' },
  { l:'A',  min:80,   name:'Advanced',     c:'--rk-a', blurb:'Genuinely strong. Top fifth of people who log lifts.' },
  { l:'S',  min:95,   name:'Elite',        c:'--rk-s',  blurb:'Top 5%. Very few get here without years of hard training.' },
  { l:'SS', min:99.5, name:'Freak',        c:'--rk-ss',   blurb:'Beyond the published standards entirely.' },
];

export function rankFor(pct) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (pct >= RANKS[k].min) i = k;
  return { ...RANKS[i], i, next: i + 1 < RANKS.length ? RANKS[i + 1] : null };
}

/* Percentile → colour, red through amber to green, for reading "low end"
   vs "high end" at a glance without looking up the letter. Interpolated in
   HSL rather than stepped by rank, so a lift creeping up its band shifts
   colour continuously — that drift is the signal that it's ready to go up.
   Hard-coded endpoints: both themes put --red and --green in the same
   corners of the wheel, so one scale reads correctly in each. */
/* 1st / 2nd / 3rd / 11th / 21st — percentiles are read out loud often
   enough that "51th" is jarring. */
export function ord(n) {
  const v = Math.round(n), t = v % 100;
  if (t >= 11 && t <= 13) return `${v}th`;
  return `${v}${['th','st','nd','rd'][v % 10] || 'th'}`;
}

export function pctColor(pct) {
  const t = Math.max(0, Math.min(100, pct || 0)) / 100;
  const h = 2 + t * 140;      /* 2° red → 142° green, passing through amber */
  const s = 92 - t * 24;      /* saturation eases off so green isn't neon */
  const l = 62 - t * 4;
  return `hsl(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/* ═══════════════════ DAILY SCRIPTURE ═══════════════════
   King James Version (public domain). Rotates by day-of-year so it
   changes at midnight and is the same all day.
   ═══════════════════════════════════════════════════════════ */
export const VERSES = [
  { t:'I can do all things through Christ which strengtheneth me.', r:'Philippians 4:13' },
  { t:'They that wait upon the LORD shall renew their strength; they shall run, and not be weary.', r:'Isaiah 40:31' },
  { t:'Know ye not that they which run in a race run all, but one receiveth the prize? So run, that ye may obtain.', r:'1 Corinthians 9:24' },
  { t:'I therefore so run, not as uncertainly; I keep under my body, and bring it into subjection.', r:'1 Corinthians 9:26-27' },
  { t:'Let us run with patience the race that is set before us.', r:'Hebrews 12:1' },
  { t:'Let us not be weary in well doing: for in due season we shall reap, if we faint not.', r:'Galatians 6:9' },
  { t:'The soul of the diligent shall be made fat.', r:'Proverbs 13:4' },
  { t:'Whatsoever thy hand findeth to do, do it with thy might.', r:'Ecclesiastes 9:10' },
  { t:'Whatsoever ye do, do it heartily, as to the Lord, and not unto men.', r:'Colossians 3:23' },
  { t:'Be strong and of a good courage; be not afraid, neither be thou dismayed.', r:'Joshua 1:9' },
  { t:'It is God that girdeth me with strength, and maketh my way perfect.', r:'Psalm 18:32' },
  { t:'A just man falleth seven times, and riseth up again.', r:'Proverbs 24:16' },
  { t:'I press toward the mark for the prize of the high calling of God in Christ Jesus.', r:'Philippians 3:14' },
  { t:'I have fought a good fight, I have finished my course, I have kept the faith.', r:'2 Timothy 4:7' },
  { t:'Fear thou not; for I am with thee: I will strengthen thee; yea, I will help thee.', r:'Isaiah 41:10' },
  { t:'The LORD is my light and my salvation; the LORD is the strength of my life.', r:'Psalm 27:1' },
  { t:'The hand of the diligent shall bear rule: but the slothful shall be under tribute.', r:'Proverbs 12:24' },
  { t:'Blessed is the man that endureth temptation.', r:'James 1:12' },
  { t:'Tribulation worketh patience; and patience, experience; and experience, hope.', r:'Romans 5:3-4' },
  { t:'The joy of the LORD is your strength.', r:'Nehemiah 8:10' },
  { t:'My flesh and my heart faileth: but God is the strength of my heart.', r:'Psalm 73:26' },
  { t:'Seek the LORD, and his strength: seek his face continually.', r:'1 Chronicles 16:11' },
  { t:'The sluggard will not plow by reason of the cold; therefore shall he beg in harvest.', r:'Proverbs 20:4' },
  { t:'The spirit indeed is willing, but the flesh is weak.', r:'Matthew 26:41' },
  { t:'If any man will come after me, let him deny himself, and take up his cross daily.', r:'Luke 9:23' },
  { t:'No chastening seemeth joyous, but grievous: nevertheless afterward it yieldeth the peaceable fruit of righteousness.', r:'Hebrews 12:11' },
  { t:'The God of all grace make you perfect, stablish, strengthen, settle you.', r:'1 Peter 5:10' },
  { t:'He giveth power to the faint; and to them that have no might he increaseth strength.', r:'Isaiah 40:29' },
  { t:'In the day when I cried thou answeredst me, and strengthenedst me in my soul.', r:'Psalm 138:3' },
  { t:'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.', r:'Proverbs 27:17' },
  { t:'Not by might, nor by power, but by my spirit, saith the LORD of hosts.', r:'Zechariah 4:6' },
  { t:'My strength is made perfect in weakness.', r:'2 Corinthians 12:9' },
  { t:'He which hath begun a good work in you will perform it until the day of Jesus Christ.', r:'Philippians 1:6' },
  { t:'I will run the way of thy commandments, when thou shalt enlarge my heart.', r:'Psalm 119:32' },
  { t:'Let thine eyes look right on, and let thine eyelids look straight before thee.', r:'Proverbs 4:25' },
  { t:'Be strong in the Lord, and in the power of his might.', r:'Ephesians 6:10' },
  { t:'Be ye steadfast, unmoveable, always abounding in the work of the Lord.', r:'1 Corinthians 15:58' },
  { t:'God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', r:'2 Timothy 1:7' },
  { t:'Bodily exercise profiteth little: but godliness is profitable unto all things.', r:'1 Timothy 4:8' },
  { t:'Ye are not your own: for ye are bought with a price: therefore glorify God in your body.', r:'1 Corinthians 6:19-20' },
  { t:'Be strong and of a good courage, fear not, nor be afraid of them.', r:'Deuteronomy 31:6' },
  { t:'Wait on the LORD: be of good courage, and he shall strengthen thine heart.', r:'Psalm 27:14' },
  { t:'Watch ye, stand fast in the faith, quit you like men, be strong.', r:'1 Corinthians 16:13' },
  { t:'The LORD is my strength and my shield; my heart trusted in him, and I am helped.', r:'Psalm 28:7' },
];

/* Same verse all day, different verse tomorrow. */
export function verseFor(dateStrYMD) {
  const d = new Date(dateStrYMD + 'T00:00:00');
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return VERSES[doy % VERSES.length];
}
