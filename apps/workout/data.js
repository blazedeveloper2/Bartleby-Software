/* ═══════════════════════════════════════════════════════════
   WORKOUT — program definition + muscle-map lookup table.
   ═══════════════════════════════════════════════════════════ */

/* An exercise with an `alt` names the kit it needs in `req` ('bar', 'wheel').
   Turn that piece of equipment off in Settings and the whole app — rendering,
   scoring, badge counts, the Study tab — reads the `alt` version instead, so
   the program still works for anyone without a pull-up bar or an ab wheel.
   An `alt` with no `req` never swaps; name the equipment.

   A day carrying a `since` date was added to the program on that date.
   Streaks, the heatmap and perfect weeks in rank.js honour it, so the
   weekday reads as what it actually was before then — a rest day — instead
   of a wall of retroactive misses. */
export const PROGRAM = [
  {day:'mon',label:'Upper · Push Focus',sections:[
    {tag:null,ex:[
      {n:'Incline Dumbbell Press',m:'Upper Chest, Front Delts, Triceps',s:'2×F',b:'30°',bc:'bench-30'},
      {n:'Dumbbell Bench Press',m:'Chest, Triceps, Front Delts',s:'2×F',b:'Flat 0°',bc:'bench-flat'},
      {n:'Dumbbell Shoulder Press',m:'Front Delts, Side Delts, Triceps',s:'2×F',b:'85°',bc:'bench-85'},
    ]},
    {tag:'Isolation',ex:[
      {n:'Dumbbell Flyes',m:'Chest (stretch focus), Front Delts',s:'2×F',b:'Flat 0°',bc:'bench-flat'},
      {n:'Overhead Tricep Extensions',m:'Triceps Long Head, Lateral Head',s:'2×F',b:'85°',bc:'bench-85'},
      {n:'Preacher Curls',m:'Biceps Short Head, Brachialis',s:'2×F',b:'45°',bc:'bench-30'},
      {n:'Lateral Raises',m:'Side Delts',s:'2×F'},
    ]},
  ]},
  {day:'tue',label:'Lower · Quad Focus',sections:[
    {tag:'Warm-Up',ex:[
      {n:'Dead Bugs',m:'Rectus Abdominis, TVA',s:'1× easy /side'},
    ]},
    {tag:null,ex:[
      {n:'Bulgarian Split Squats',m:'Quads, Glutes, Adductors',s:'2×F /leg',b:'Flat 0°',bc:'bench-flat'},
      {n:'Heel-Elevated Goblet Squats',m:'Quads, Glutes, Core',s:'2×F'},
      {n:'Romanian Deadlifts',m:'Hamstrings, Glutes, Erectors',s:'2×F'},
      {n:'Standing Calf Raises',m:'Gastrocnemius, Soleus',s:'2×F'},
    ]},
    {tag:'Core',ex:[
      {n:'Dumbbell Crunch',m:'Upper Abs, Rectus Abdominis, Obliques',s:'2×8-15',b:'Hips On Bench',bc:'bench-flat'},
      {n:'Weighted Hanging Leg Raises',m:'Lower Abs, Rectus Abdominis, Hip Flexors, Obliques',s:'2×10-20',b:'DB Between Feet',bc:'grip',
       req:'bar', alt:{n:'Weighted Reverse Crunches',m:'Lower Abs, Rectus Abdominis, Hip Flexors, Obliques',s:'2×10-20',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Weighted Side Plank w/ Reach-Through',m:'Obliques, TVA, Core',s:'2×F /side',b:'DB On Top Hip',bc:'grip'},
    ]},
  ]},
  {day:'thu',label:'Upper · Pull Focus',sections:[
    {tag:null,ex:[
      {n:'Pull-Ups',m:'Lats, Biceps, Rhomboids, Forearms',s:'2×F',b:'Pronated Grip',bc:'grip',
       req:'bar', alt:{n:'Single-Arm Rows',m:'Lats, Rhomboids, Rear Delts, Biceps',s:'2×F /arm',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Chest-Supported Rows',m:'Lats, Rhomboids, Traps, Rear Delts, Biceps',s:'2×F',b:'30-45°',bc:'bench-30'},
      {n:'Dumbbell Pullovers',m:'Lats, Chest, Serratus Anterior',s:'2×F',b:'Flat 0°',bc:'bench-flat'},
    ]},
    {tag:'Isolation',ex:[
      {n:'Reverse Flyes',m:'Rear Delts, Rhomboids, Mid Traps',s:'2×F',b:'30°',bc:'bench-30'},
      {n:'Hammer Curls',m:'Brachialis, Brachioradialis, Biceps',s:'2×F'},
      {n:'Incline Curls',m:'Biceps Long Head, Short Head',s:'2×F',b:'55°',bc:'bench-55'},
      {n:'Lateral Raises',m:'Side Delts',s:'2×F'},
    ]},
  ]},
  {day:'fri',label:'Lower · Ham & Glute Focus',sections:[
    {tag:null,ex:[
      {n:'Romanian Deadlifts',m:'Hamstrings, Glutes, Erectors',s:'2×F'},
      {n:'B-Stance Hip Thrusts',m:'Glutes, Hamstrings',s:'2×F /leg',b:'Flat 0°',bc:'bench-flat'},
      {n:'Bulgarian Split Squats',m:'Quads, Glutes, Adductors',s:'2×F /leg',b:'Flat 0°',bc:'bench-flat'},
      {n:'B-Stance RDLs',m:'Hamstrings, Glutes, Core',s:'2×F /leg'},
    ]},
    {tag:'Accessories',ex:[
      {n:'Standing Calf Raises',m:'Gastrocnemius, Soleus',s:'2×F'},
      {n:"Farmer's Carries",m:'Traps, Forearms, Core',s:'2×F'},
    ]},
    {tag:'Core',ex:[
      {n:'Dumbbell Crunch',m:'Upper Abs, Rectus Abdominis, Obliques',s:'2×8-15',b:'Hips On Bench',bc:'bench-flat'},
      {n:'Weighted Hanging Leg Raises',m:'Lower Abs, Rectus Abdominis, Hip Flexors, Obliques',s:'2×10-20',b:'DB Between Feet',bc:'grip',
       req:'bar', alt:{n:'Weighted Reverse Crunches',m:'Lower Abs, Rectus Abdominis, Hip Flexors, Obliques',s:'2×10-20',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Weighted Side Plank w/ Reach-Through',m:'Obliques, TVA, Core',s:'2×F /side',b:'DB On Top Hip',bc:'grip'},
    ]},
  ]},
  /* Upper-body + core only, on purpose: Friday's RDLs and thrusts are ~24h
     old on Saturday morning, while the push muscles have had five days and
     the pull muscles two. Structure follows the r/bodyweightfitness
     Recommended Routine — skill work fresh at the front, strength work at
     3×5-8 (progress to a harder variation at the top of the range), body-line
     holds at the end. The skill block is what eventually becomes a
     freestanding handstand; keep the holds honest rather than long. */
  {day:'sat',since:'2026-08-18',label:'Upper · Calisthenics',sections:[
    {tag:'Skill',ex:[
      {n:'Wrist Prep Rocks',m:'Forearms',s:'2× easy'},
      {n:'Wall Handstand Hold',m:'Front Delts, Side Delts, Traps, Triceps, Core',s:'3×15-30s',b:'Chest To Wall'},
      /* No-bar alts on this day stay bodyweight — a dumbbell row would keep
         the pull muscles fed but trains none of the straight-arm scapular
         control the skill work is for. Scapular push-ups need no kit at all:
         in a plank with arms locked, let the chest sink between the shoulder
         blades, then push the floor away until the upper back rounds —
         elbows never bend. Protraction instead of the pull's retraction,
         which is exactly the shape a handstand loads. */
      {n:'Scapular Pulls',m:'Lats, Mid Traps, Rhomboids, Forearms',s:'3×5-8',b:'Dead Hang',bc:'grip',
       req:'bar', alt:{n:'Scapular Push-Ups',m:'Serratus Anterior, Traps, Core',s:'3×8-12',b:'Plank, Arms Locked'}},
    ]},
    {tag:null,ex:[
      {n:'Chin-Ups',m:'Lats, Biceps, Rhomboids, Forearms',s:'3×5-8',b:'Supinated Grip',bc:'grip',
       req:'bar', alt:{n:'Inverted Rows',m:'Lats, Rhomboids, Rear Delts, Biceps, Forearms',s:'3×5-8',b:'Under Table'}},
      {n:'Push-Ups',m:'Chest, Triceps, Front Delts, Serratus Anterior, Core',s:'3×5-8'},
      {n:'Pike Push-Ups',m:'Front Delts, Side Delts, Triceps, Upper Chest',s:'3×5-8'},
      {n:'Bench Dips',m:'Triceps, Chest, Front Delts',s:'3×8-12',b:'Hands On Bench',bc:'bench-flat'},
    ]},
    /* The rollout takes the hollow hold's slot rather than adding to it —
       Tuesday and Friday already carry six loaded core sets each, and a
       fourth core day is past the point of useful. It is the same body line
       the hold trains, but moving and loaded, with the arms overhead: that
       shoulder position is what a handstand asks for, which is why this sits
       on the day that builds toward one. Progress by rolling further out,
       not by adding reps, and keep the pelvis tucked the whole way — a
       rollout that turns into lumbar extension is a low-back exercise, and
       Friday's RDLs left the erectors ~24h old. No wheel swaps it straight
       back to the hollow hold. */
    {tag:'Core',ex:[
      {n:'Ab Wheel Rollouts',m:'Rectus Abdominis, Obliques, TVA, Lats, Serratus Anterior',s:'3×5-8',b:'From Knees',
       req:'wheel', alt:{n:'Hollow Body Hold',m:'Rectus Abdominis, TVA, Hip Flexors',s:'3×15-30s'}},
      {n:'Arch Hold',m:'Erectors, Glutes, Rear Delts, Traps',s:'3×15-30s'},
    ]},
  ]},
];

/* Muscle name → SVG region id(s) on the body map.

   Every name here resolves EXACTLY — parseMuscles() only falls back to
   substring matching when a name is missing, and nothing in the program
   needs that fallback. Adding a muscle string to PROGRAM that isn't a key
   below is what turns the fallback on, and the fallback is fuzzy enough to
   light the wrong thing, so add the key instead.

   Names that resolve to overlapping-but-different region sets are the
   point, not an accident: 'chest' covers both pec heads while 'upper chest'
   covers only the clavicular one, so an incline press and a flat press draw
   different pictures. Same for the ab rows and the delt heads. */
export const MMAP = {
  'chest':['f-pec-up-l','f-pec-up-r','f-pec-l','f-pec-r'],
  'upper chest':['f-pec-up-l','f-pec-up-r'],
  'front delts':['f-delt-a-l','f-delt-a-r'],
  'side delts':['f-delt-s-l','f-delt-s-r'],
  'rear delts':['b-rdelt-l','b-rdelt-r'],
  'triceps':['b-tri-long-l','b-tri-long-r','b-tri-lat-l','b-tri-lat-r'],
  'triceps long head':['b-tri-long-l','b-tri-long-r'],
  'lateral head':['b-tri-lat-l','b-tri-lat-r'],
  'biceps':['f-bi-l','f-bi-r'],
  'biceps long head':['f-bi-l','f-bi-r'],
  'biceps short head':['f-bi-l','f-bi-r'],
  'short head':['f-bi-l','f-bi-r'],
  'brachialis':['f-brach-l','f-brach-r'],
  'brachioradialis':['f-brad-l','f-brad-r'],
  /* the flexor mass is on the front, the extensor mass on the back —
     a loaded grip works both, so 'forearms' lights all four */
  'forearms':['f-fore-l','f-fore-r','b-fore-l','b-fore-r'],
  'lats':['b-lat-l','b-lat-r'],
  'rhomboids':['b-rhom'],
  'traps':['f-trap-l','f-trap-r','b-trap-u-l','b-trap-u-r','b-trap-m'],
  'mid traps':['b-trap-m'],
  'erectors':['b-erec-l','b-erec-r'],
  'quads':['f-quad-rf-l','f-quad-rf-r','f-quad-vl-l','f-quad-vl-r','f-quad-vm-l','f-quad-vm-r'],
  'hamstrings':['b-ham-l','b-ham-r'],
  'glutes':['b-glute-l','b-glute-r'],
  'adductors':['f-addu-l','f-addu-r'],
  'gastrocnemius':['b-gastro-l','b-gastro-r'],
  'soleus':['b-soleus-l','b-soleus-r'],
  'rectus abdominis':['f-abs-1-l','f-abs-1-r','f-abs-2-l','f-abs-2-r','f-abs-3-l','f-abs-3-r'],
  /* The rows overlap on purpose. A crunch bites hardest up top and a leg
     raise down low, but neither is confined to its half — the middle row
     belongs to both. */
  'upper abs':['f-abs-1-l','f-abs-1-r','f-abs-2-l','f-abs-2-r'],
  'lower abs':['f-abs-2-l','f-abs-2-r','f-abs-3-l','f-abs-3-r'],
  'tva':['f-tva'],
  'obliques':['f-obli-l','f-obli-r'],
  'core':['f-abs-1-l','f-abs-1-r','f-abs-2-l','f-abs-2-r','f-abs-3-l','f-abs-3-r',
          'f-obli-l','f-obli-r','f-tva'],
  'serratus anterior':['f-serra-l','f-serra-r'],
  /* psoas and iliacus, NOT the quads — they run from the lumbar spine and
     the inner pelvis to the femur, and only rectus femoris crosses the hip */
  'hip flexors':['f-hipflex-l','f-hipflex-r'],
};
