/* ═══════════════════════════════════════════════════════════
   WORKOUT — program definition + muscle-map lookup table.
   ═══════════════════════════════════════════════════════════ */

/* Exercises with an `alt` swap to that version when "No Bar" mode is on
   (for anyone using the program without a pull-up bar). */
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
    {tag:null,ex:[
      {n:'Bulgarian Split Squats',m:'Quads, Glutes, Adductors',s:'2×F /leg',b:'Flat 0°',bc:'bench-flat'},
      {n:'Heel-Elevated Goblet Squats',m:'Quads, Glutes, Core',s:'2×F'},
      {n:'Romanian Deadlifts',m:'Hamstrings, Glutes, Erectors',s:'2×F'},
      {n:'Standing Calf Raises',m:'Gastrocnemius, Soleus',s:'2×F'},
    ]},
    {tag:'Core',ex:[
      {n:'Hanging Knee Raises',m:'Rectus Abdominis, Hip Flexors, Obliques',s:'2×F',
       alt:{n:'Reverse Crunches',m:'Rectus Abdominis, Hip Flexors, Obliques',s:'2×F',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Side Plank w/ Reach-Through',m:'Obliques, TVA, Core',s:'2×F /side'},
      {n:'Dead Bugs',m:'Rectus Abdominis, TVA',s:'2×F /side'},
    ]},
  ]},
  {day:'thu',label:'Upper · Pull Focus',sections:[
    {tag:null,ex:[
      {n:'Pull-Ups',m:'Lats, Biceps, Rhomboids, Forearms',s:'2×F',b:'Pronated Grip',bc:'grip',
       alt:{n:'Single-Arm Rows',m:'Lats, Rhomboids, Rear Delts, Biceps',s:'2×F /arm',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Chest-Supported Rows',m:'Lats, Rhomboids, Traps, Rear Delts, Biceps',s:'2×F',b:'30-45°',bc:'bench-30'},
      {n:'Dumbbell Pullovers',m:'Lats, Chest, Serratus Anterior',s:'2×F',b:'Cross-bench',bc:'bench-flat'},
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
    ]},
    {tag:'Core',ex:[
      {n:'Hanging Knee Raises',m:'Rectus Abdominis, Hip Flexors, Obliques',s:'2×F',
       alt:{n:'Reverse Crunches',m:'Rectus Abdominis, Hip Flexors, Obliques',s:'2×F',b:'Flat 0°',bc:'bench-flat'}},
      {n:'Side Plank w/ Reach-Through',m:'Obliques, TVA, Core',s:'2×F /side'},
      {n:"Farmer's Carries",m:'Traps, Forearms, Core',s:'2×F'},
    ]},
  ]},
];

/* Muscle name → SVG region id(s) on the body map. */
export const MMAP = {
  'chest':['f-chest-l','f-chest-r'],
  'upper chest':['f-chest-l','f-chest-r'],
  'front delts':['f-delt-l','f-delt-r'],
  'side delts':['f-delt-l','f-delt-r'],
  'rear delts':['b-rdelt-l','b-rdelt-r'],
  'triceps':['b-tri-l','b-tri-r'],
  'triceps long head':['b-tri-l','b-tri-r'],
  'lateral head':['b-tri-l','b-tri-r'],
  'biceps':['f-bi-l','f-bi-r'],
  'biceps long head':['f-bi-l','f-bi-r'],
  'biceps short head':['f-bi-l','f-bi-r'],
  'short head':['f-bi-l','f-bi-r'],
  'brachialis':['f-bi-l','f-bi-r'],
  'brachioradialis':['f-fore-l','f-fore-r'],
  'forearms':['f-fore-l','f-fore-r'],
  'lats':['b-lat-l','b-lat-r'],
  'rhomboids':['b-rhom'],
  'traps':['f-trap-l','f-trap-r','b-trap-l','b-trap-r','b-trap-m'],
  'mid traps':['b-trap-l','b-trap-r','b-trap-m'],
  'erectors':['b-erec-l','b-erec-r'],
  'quads':['f-quad-l','f-quad-r'],
  'hamstrings':['b-ham-l','b-ham-r'],
  'glutes':['b-glute-l','b-glute-r'],
  'adductors':['f-addu-l','f-addu-r'],
  'gastrocnemius':['b-calf-l','b-calf-r'],
  'soleus':['b-calf-l','b-calf-r'],
  'rectus abdominis':['f-abs'],
  'tva':['f-abs'],
  'obliques':['f-obli-l','f-obli-r'],
  'core':['f-abs','f-obli-l','f-obli-r'],
  'serratus anterior':['f-serra-l','f-serra-r'],
  'hip flexors':['f-quad-l','f-quad-r'],
};
