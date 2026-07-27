/* ═══════════════════════════════════════════════════════════
   STRENGTH STANDARDS + DAILY SCRIPTURE

   RATIOS below are Strength Level's male standards, expressed as
   (1RM of a SINGLE dumbbell) ÷ bodyweight, for the five tiers:

     [Beginner, Novice, Intermediate, Advanced, Elite]

   Those tiers sit at roughly the 5th / 20th / 50th / 80th / 95th
   percentile of everyone who logs that lift at your bodyweight —
   that's what makes a percentile score possible at all.

   Source: https://strengthlevel.com/strength-standards (per-lift
   pages, lb, male, "Bodyweight Ratio" table). Retrieved Jul 2026
   from datasets of ~1–5M logged lifts per exercise.

   Only lifts with a published standard are listed. Anything absent
   is shown as unscored rather than guessed at — an invented
   standard would quietly corrupt the overall rank.
   ═══════════════════════════════════════════════════════════ */

export const RATIOS = {
  'Incline Dumbbell Press':      [0.25, 0.35, 0.50, 0.65, 0.85],
  'Dumbbell Bench Press':        [0.20, 0.35, 0.50, 0.70, 0.90],
  'Dumbbell Shoulder Press':     [0.15, 0.25, 0.40, 0.55, 0.70],
  'Dumbbell Flyes':              [0.10, 0.20, 0.30, 0.45, 0.60],
  'Overhead Tricep Extensions':  [0.05, 0.15, 0.25, 0.45, 0.60],
  'Lateral Raises':              [0.05, 0.10, 0.20, 0.30, 0.45],
  'Reverse Flyes':               [0.05, 0.10, 0.20, 0.35, 0.55],
  'Hammer Curls':                [0.10, 0.20, 0.30, 0.40, 0.55],
  'Dumbbell Pullovers':          [0.15, 0.30, 0.45, 0.65, 0.85],
  'Single-Arm Rows':             [0.20, 0.35, 0.55, 0.75, 1.00],
  'Chest-Supported Rows':        [0.20, 0.35, 0.55, 0.75, 1.00],
  'Romanian Deadlifts':          [0.20, 0.35, 0.55, 0.80, 1.05],
  'Heel-Elevated Goblet Squats': [0.20, 0.35, 0.55, 0.75, 1.05],
  'Bulgarian Split Squats':      [0.15, 0.25, 0.40, 0.60, 0.85],
};

/* Rows are scored against plain dumbbell-row standards; chest-supported
   is a stricter variation, so that score reads slightly harsh. Noted in
   the UI rather than silently fudged. */
export const NOTES = {
  'Chest-Supported Rows': 'Scored on dumbbell-row standards — the chest-supported version is stricter, so this reads a little harsh.',
  'Heel-Elevated Goblet Squats': 'Scored on goblet-squat standards.',
};

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
