/* ═══════════════════════════════════════════════════════════
   STUDY — the reference half of the app.

   Four sections: what food does, what the muscles are, what makes
   them grow, and what recovery actually requires. Everything with a
   number attached names where the number came from, because the whole
   point is to be able to check it later rather than trust it.

   The figures are the same ones the exercise modal uses, with their ids
   prefixed so the two copies can share a page without colliding.

   Photographs: drop a file into assets/img/study/ and any slot whose
   name matches will show it. Missing files hide themselves, so the
   section reads fine with none of them present.
   ═══════════════════════════════════════════════════════════ */

import { load, save } from '../../assets/js/storage.js';
import { FRONT_SVG, BACK_SVG } from './bodymap.js';
import { PROGRAM, MMAP } from './data.js';
import { resEx } from './rank.js';

const SECS = [
  { k:'nutrition', lbl:'Nutrition' },
  { k:'anatomy',   lbl:'Anatomy'   },
  { k:'training',  lbl:'Training'  },
  { k:'recovery',  lbl:'Recovery'  },
];

const sec     = () => load('bp_study', 'nutrition');
const setSec  = k => save('bp_study', k);
const goal    = () => load('bp_goal', 'bulk');
const kcalOvr = () => load('bp_kcal', null);        // null → use the estimate
const bw      = () => { const a = load('bp_bw', []); return a.length ? a[a.length-1].w : null; };

const LB_KG = 0.45359237;

/* ═══════════════════ SHARED BITS ═══════════════════ */

/* A photo slot. Drop a matching file into assets/img/study/ and it appears;
   with no file the whole <figure> is pulled after render by dropPhotos(), so
   an empty folder costs nothing and leaves no broken-image boxes.

   Deliberately NOT loading="lazy" — a lazy image that never enters the
   viewport never requests, never errors, and so never gets cleaned up,
   leaving an empty caption sitting on the page. */
const photo = (name, cap) =>
  `<figure class="st-photo">
     <img src="assets/img/study/${name}" alt="${cap}">
     <figcaption>${cap}</figcaption>
   </figure>`;

/* Images that failed are removed with their caption. An image can finish
   loading before this runs, so check the already-settled case as well as
   subscribing to the event. */
function dropPhotos(panel) {
  panel.querySelectorAll('.st-photo img').forEach(img => {
    const kill = () => img.closest('figure')?.remove();
    if (img.complete) { if (!img.naturalWidth) kill(); return; }
    img.addEventListener('error', kill, { once: true });
  });
}

const card = (title, body, sub) =>
  `<section class="st-card">
     <h3 class="st-h">${title}</h3>
     ${sub ? `<p class="st-sub">${sub}</p>` : ''}
     ${body}
   </section>`;

const note = (label, body) => `<div class="st-note"><b>${label}</b> ${body}</div>`;

const srcs = list => `<div class="st-srcs"><span>Sources</span><ul>${
  list.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ul></div>`;

const dl = rows => `<dl class="st-dl">${
  rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;

/* ═══════════════════ NUTRITION ═══════════════════ */

const GOALS = {
  cut:     { lbl:'Cut',       pct:-0.20, rate:'lose 0.5–1% of bodyweight a week' },
  maintain:{ lbl:'Maintain',  pct: 0,    rate:'hold weight steady' },
  bulk:    { lbl:'Lean Bulk', pct: 0.12, rate:'gain 0.25–0.5 lb a week' },
};

/* Everything here is derived from ONE measured input — the bodyweight in
   the Weight tab. Maintenance calories are the one number that can't be
   derived, only estimated then corrected from the scale. */
function macros() {
  const w = bw();
  if (!w) return null;
  const kg = w * LB_KG;
  const est = Math.round(w * 15);                    // rough starting point only
  const maint = kcalOvr() || est;
  const g = GOALS[goal()] || GOALS.bulk;
  const kcal = Math.round(maint * (1 + g.pct));

  const proLo = Math.round(kg * 1.6), proHi = Math.round(kg * 2.2);
  /* Middle of the plateau normally, top of it in a deficit — protein is what
     protects muscle when calories are short, so the number has to move when
     the goal does or the card contradicts itself. */
  const proRate = goal() === 'cut' ? 2.2 : 1.8;
  const pro   = Math.round(kg * proRate);
  const perMeal = Math.round(kg * 0.4);
  /* The card states the floor as 20% of calories, so the number it prints has
     to BE that. 0.5 g/kg alone lands under 20% at any reasonable calorie
     intake, which had the page contradicting itself — whichever of the two is
     higher is the honest floor. */
  const fatFloor = Math.max(Math.round(kg * 0.5), Math.round(kcal * 0.20 / 9));
  const fat   = Math.max(fatFloor, Math.round(kcal * 0.25 / 9));
  const carb  = Math.max(0, Math.round((kcal - pro * 4 - fat * 9) / 4));
  const fibre = Math.round(kcal / 1000 * 14);
  return { w, kg, est, maint, usingOverride: !!kcalOvr(), kcal, g,
           pro, proLo, proHi, perMeal, fat, fatFloor, carb, fibre };
}

/* Stacked bar of where the calories come from. Drawn rather than listed
   because the point is the relative size, not the exact grams. */
function macroBar(m) {
  const kc = [m.pro * 4, m.fat * 9, m.carb * 4];
  const tot = kc.reduce((a, b) => a + b, 0) || 1;
  const seg = [['Protein','p'],['Fat','f'],['Carbs','c']].map((s, i) => {
    const pct = kc[i] / tot * 100;
    return `<div class="st-bar-seg ${s[1]}" style="width:${pct.toFixed(1)}%">
      <span>${s[0]}</span><b>${Math.round(pct)}%</b></div>`;
  }).join('');
  return `<div class="st-bar">${seg}</div>`;
}

function calcHTML() {
  const m = macros();
  const btns = Object.entries(GOALS).map(([k, g]) =>
    `<button class="st-goal ${k === goal() ? 'sel' : ''}" data-act="st-goal" data-k="${k}">${g.lbl}</button>`).join('');

  if (!m) return card('Your Numbers',
    `<div class="st-empty">Log your bodyweight in the <b>Weight</b> tab and every target on this
     page fills itself in from it.</div>`);

  return card('Your Numbers', `
    <div class="st-goals">${btns}</div>
    <div class="st-figs">
      ${figBox('Calories', m.kcal, 'kcal/day')}
      ${figBox('Protein', m.pro, 'g/day')}
      ${figBox('Fat', m.fat, 'g/day')}
      ${figBox('Carbs', m.carb, 'g/day')}
    </div>
    ${macroBar(m)}
    ${dl([
      ['Protein range', `<b>${m.proLo}–${m.proHi} g</b> a day. ${m.pro} g is ${
        goal() === 'cut' ? 'the top of it, because protein is what protects muscle in a deficit'
                         : 'the middle of it — anywhere in the band is fine'}.`],
      ['Per meal', `About <b>${m.perMeal} g</b> across four or more meals to clear the daily total comfortably.`],
      ['Fat floor', `Do not go under <b>${m.fatFloor} g</b> — that is 20% of the calories above, and below roughly 20% is where the hormone data turns bad.`],
      ['Fibre', `<b>${m.fibre} g</b> a day at this calorie level.`],
      ['Goal', `${m.g.lbl} — ${m.g.rate}.`],
    ])}
    ${note('About the calorie number.',
      `${m.usingOverride ? `You've set maintenance to <b>${m.maint}</b>.`
        : `Maintenance is <i>estimated</i> at <b>${m.est}</b> from bodyweight × 15.`}
       That estimate is a starting guess, not a measurement — activity and metabolism vary far too much
       between people for a formula to land it. The real number comes from the scale: hold these
       calories for two to three weeks, watch the trend in the <b>Weight</b> tab, and adjust by 100–200
       until it moves at the rate you want.
       <label class="st-kcal">Override maintenance
         <input type="number" id="st-kcal" inputmode="numeric" min="1000" max="6000" step="50"
                value="${m.usingOverride ? m.maint : ''}" placeholder="${m.est}"></label>`)}
  `, `Built from the ${m.w} lb in your Weight tab.`);
}

const figBox = (lbl, v, u) =>
  `<div class="st-fig"><span class="st-fig-l">${lbl}</span><b>${v}</b><span class="st-fig-u">${u}</span></div>`;

function nutritionHTML() {
  return calcHTML() + `

  ${card('Energy Balance', `
    <p>Bodyweight is decided by calories in against calories out. Nothing else in this section
    overrides that — you can hit every protein target perfectly and still not grow if the total
    is too low, or grow mostly fat if it's far too high.</p>
    <p>The important and counter-intuitive part: <b>a bigger surplus does not build more muscle.</b>
    The rate at which you can add muscle tissue is capped by training, recovery and training age — not
    by how much food is available. Everything past that cap is stored as fat. The muscle-to-fat ratio a
    given person gets varies too much to quote a figure for, but the direction is consistent across
    trials: a controlled surplus and an aggressive one add similar lean mass, and the aggressive one
    adds substantially more fat on top.</p>
    ${dl([
      ['Surplus', 'Roughly 10–20% over maintenance, which is usually 200–500 kcal. A 2019 review argues the low end, 200–300, gets the same muscle with less fat.'],
      ['Rate', 'About 0.25–0.5 lb a week once you are past beginner. Faster than that is mostly fat.'],
      ['Deficit', 'For fat loss, 0.5–1% of bodyweight a week. Protein goes up, not down, when calories come down.'],
    ])}
    ${note('Why the scale beats the calculator.',
      `Every maintenance formula, including the one above, is a population average applied to one
       person. Two people the same weight can differ by several hundred calories a day. Tracking
       bodyweight for a few weeks measures your actual number instead of guessing it.`)}
    ${photo('energy-balance.jpg', 'Energy balance')}
    ${srcs([['Lean bulk surplus and gain rate — evidence guide','https://www.micron-app.com/en/caloric-surplus']])}
  `, 'The one that outranks everything else here.')}

  ${card('Protein', `
    <p><b>What it is.</b> Chains of amino acids. There are twenty; nine are <i>essential</i>, meaning
    your body cannot make them and they have to arrive in food. Protein is the only macronutrient that
    supplies them, which is why it's the one you can't simply swap calories for.</p>
    <p><b>What it does.</b> Muscle is not a fixed structure. It's constantly being built
    (<i>muscle protein synthesis</i>) and broken down (<i>muscle protein breakdown</i>) at the same
    time. Training raises both. You gain tissue when synthesis outruns breakdown across days and
    weeks — not within any single session. Eating protein is what pushes that balance positive, and
    the amino acid <b>leucine</b> is the main trigger for it.</p>
    <p><b>How much.</b> The 2018 Morton meta-analysis pooled 49 studies and 1,863 people. Gains in
    fat-free mass stopped improving past about <b>1.62 g per kg of bodyweight per day</b>, with the
    confidence interval reaching 2.2. That's where the familiar 1.6–2.2 g/kg band comes from. It's a
    plateau, not a cliff — more than 2.2 isn't harmful, it just stops buying anything.</p>
    ${dl([
      ['Per meal', 'Schoenfeld and Aragon put it at about 0.4 g/kg per meal over at least four meals — which is simply the arithmetic of reaching 1.6 g/kg without one enormous sitting.'],
      ['Before sleep', 'Around 40 g before bed measurably raises overnight synthesis rates.'],
      ['Quality', 'Complete proteins carry all nine essentials — meat, fish, eggs, dairy, soy. Most plant sources are short on one or more, which is why they get combined.'],
      ['In a deficit', 'Push toward the top of the band. Protein is what protects muscle when calories are scarce.'],
    ])}
    ${note('The one caveat on the 1.6 figure.',
      `It's a population estimate. Individual variation around it is large and poorly characterised,
       and the same analysis found the effect grows with training experience. Treat the band as a
       sensible place to sit, not a threshold you either clear or fail.`)}
    ${photo('protein-sources.jpg', 'Protein sources')}
    ${srcs([
      ['Morton et al. 2018 — protein supplementation meta-analysis','https://pubmed.ncbi.nlm.nih.gov/28698222/'],
      ['Schoenfeld & Aragon 2018 — protein per meal','https://www.tandfonline.com/doi/full/10.1186/s12970-018-0215-1'],
      ['Stronger by Science — protein science updated','https://www.strongerbyscience.com/protein-science/'],
    ])}
  `, 'The macronutrient you can least afford to get wrong.')}

  ${card('Fat', `
    <p><b>What it is.</b> The densest fuel at 9 kcal per gram, against 4 for protein and carbs.
    Comes as saturated, monounsaturated and polyunsaturated; the polyunsaturated group contains the
    omega-3 and omega-6 fats, which like the essential amino acids must come from food.</p>
    <p><b>What it does.</b> Builds every cell membrane you own, carries the fat-soluble vitamins
    A, D, E and K into you, and supplies the raw material for steroid hormone production — which is
    the reason cutting fat too hard backfires on a lifter specifically.</p>
    ${dl([
      ['Floor', 'Around 20% of calories. Intakes at or below that are associated with lower testosterone in male athletes. Roughly 0.5–1 g/kg is the practical way to hold that line.'],
      ['Ceiling', 'Anywhere from 20% to 40% of calories shows no difference in strength performance. Once the floor is met this is a preference dial, not a performance one.'],
      ['Omega-3', 'EPA and DHA, from oily fish. One of the most commonly under-eaten nutrients in athletes.'],
    ])}
    ${note('Read the hormone finding carefully.',
      `Low-fat diets lowering testosterone is a real and repeated observation, but much of the effect
       may travel with the low calorie intake that usually accompanies it rather than the fat itself.
       Either way the practical advice is the same: don't drive fat into the floor.`)}
    ${photo('fats.jpg', 'Dietary fats')}
    ${srcs([
      ['Stronger by Science — do low-fat diets decrease testosterone?','https://www.strongerbyscience.com/low-fat-diets-testosterone/'],
      ['Optimal fat loss phase in resistance-trained athletes','https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8471721/'],
    ])}
  `, 'Has a floor, and the floor is the part that matters.')}

  ${card('Carbohydrate', `
    <p><b>What it is.</b> Sugars and starches, broken down to glucose. What isn't used immediately is
    stored as <b>glycogen</b> in muscle and liver. Fibre is carbohydrate your body cannot digest,
    which is exactly why it's useful.</p>
    <p><b>What it does.</b> Fuels hard sets. Strictly speaking carbohydrate isn't essential — the body
    can manufacture glucose from other sources — but glycogen is what a heavy set of ten actually runs
    on, and training low on it means training worse. It's also the macro that fills the calories left
    after protein and fat are set, which makes it the practical lever on your total.</p>
    ${dl([
      ['How much', 'Whatever remains once protein is at target and fat is above its floor. For lifting there is no separate number to hit.'],
      ['The 8–12 g/kg figure', 'That is the ISSN nutrient-timing stand for <i>maximising glycogen</i> in endurance athletes. It is not a lifting target and you should not read it as one.'],
      ['Fibre', 'About 14 g per 1,000 calories — roughly 38 g a day for men under 50, 25 for women. Most people fall short.'],
      ['Around training', 'Matters far less than the daily total. Get the day right before touching timing.'],
    ])}
    ${photo('carbs.jpg', 'Carbohydrate sources')}
    ${srcs([['ISSN position stand — nutrient timing','https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5596471/']])}
  `, 'The flexible one — it fills whatever is left.')}

  ${card('Micronutrients, Water and Creatine', `
    <p><b>Micronutrients.</b> Vitamins and minerals don't supply energy but every process that does
    depends on them. Surveys of athletes repeatedly find the same shortfalls: vitamin D, vitamin E,
    magnesium, folate, calcium and zinc, plus iron in women. Food first; supplement the specific gap
    if you have reason to think you have one.</p>
    <p><b>Water.</b> Muscle is roughly three-quarters water. Dehydration costs strength and endurance
    before you feel thirsty. Pale urine is a cruder but more reliable guide than any daily litre target.</p>
    <p><b>Creatine.</b> The single most evidence-backed supplement available, and one of very few
    worth the money.</p>
    ${dl([
      ['Dose', '3–5 g a day, every day, timing irrelevant.'],
      ['Loading', 'Optional. 0.3 g/kg for 5–7 days saturates you in a week instead of three to four. The endpoint is identical.'],
      ['Safety', 'No detrimental effect found at up to 30 g/day for five years in healthy people. No cycling needed.'],
      ['What it does', 'Raises high-intensity work capacity and lean mass. It is not a hormone and not a steroid — it lets you do slightly more work, and the work is what grows the muscle.'],
    ])}
    ${srcs([['ISSN position stand — creatine safety and efficacy','https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/']])}
  `, 'The small stuff that is not actually small.')}

  <p class="st-disclaimer">General nutrition education, not medical or dietary advice. If you have a
  health condition, take medication, or are managing something specific, talk to a doctor or a
  registered dietitian before making changes.</p>`;
}

/* ═══════════════════ ANATOMY ═══════════════════ */

/* The figures again, ids namespaced so this copy can coexist with the one
   living in the exercise modal. */
const nsFig = svg => svg
  .replace(/id="([fb]-)/g, 'id="s-$1')
  .replace(/aria-label="/g, 'aria-label="Study: ');

/* One entry per MMAP key worth explaining. Keyed to the same names the
   program uses, so the "trained by" list below is computed, not typed. */
const MUSCLES = [
  ['Chest', 'chest', 'Pectoralis major. Fans from the breastbone and collarbone out to the upper arm.',
    'Brings the upper arm across and in front of the body, and presses it away from you. The clavicular head up top responds to pressing on an incline; the sternal head does more on a flat press.'],
  ['Front Delts', 'front delts', 'Anterior head of the deltoid, the front of the shoulder cap.',
    'Raises the arm forward and assists every press. It gets a great deal of indirect work from chest pressing, which is why it rarely needs much of its own.'],
  ['Side Delts', 'side delts', 'Lateral head of the deltoid, the outer cap.',
    'Raises the arm out to the side. This is the head that actually widens a shoulder, and almost nothing trains it except deliberate lateral work.'],
  ['Rear Delts', 'rear delts', 'Posterior head of the deltoid, behind the shoulder.',
    'Pulls the upper arm backward and outward. Trained by rowing and by reverse flyes; the most commonly neglected of the three heads.'],
  ['Biceps', 'biceps', 'Biceps brachii — two heads on the front of the upper arm.',
    'Bends the elbow and turns the palm up. It also crosses the shoulder, which is why curling from behind the body feels different from curling in front of it.'],
  ['Brachialis', 'brachialis', 'Sits underneath and outside the biceps.',
    'A pure elbow flexor, and a stronger one than the biceps. Because it lies under the biceps, building it pushes the biceps up and makes the arm look thicker. Hammer and neutral-grip work bias it.'],
  ['Triceps', 'triceps', 'Triceps brachii — three heads on the back of the upper arm.',
    'Straightens the elbow, and makes up about two thirds of the upper arm. The long head also crosses the shoulder, so it only reaches full stretch with the elbow overhead — which is what overhead extensions are for.'],
  ['Forearms', 'forearms', 'Flexor mass on the palm side, extensor mass on the back.',
    'Grip. Rarely the limiting factor on a press, frequently the limiting factor on a heavy row, carry or deadlift.'],
  ['Lats', 'lats', 'Latissimus dorsi — the largest muscle on the back, armpit to lower spine.',
    'Pulls the upper arm down and back. This is the muscle that produces a wide back, and it responds to vertical pulling and to pullovers.'],
  ['Traps', 'traps', 'Trapezius — a broad sheet from the skull down the middle of the back.',
    'Three functional regions: the upper fibres shrug, the middle retract the shoulder blades, and the lower pull them down. Carries and rows hit all three.'],
  ['Rhomboids', 'rhomboids', 'Beneath the traps, between the shoulder blades.',
    'Squeezes the shoulder blades together. Trained by every row you do, and difficult to isolate deliberately.'],
  ['Erectors', 'erectors', 'Erector spinae — the columns running either side of the spine.',
    'Holds the spine extended under load. Trained isometrically by anything heavy in your hands and directly by hinging.'],
  ['Rectus Abdominis', 'rectus abdominis', 'The visible six-pack sheet, ribcage to pelvis.',
    'Pulls the ribcage toward the pelvis. Crunching biases the upper portion; raising the legs biases the lower. Both train the whole muscle — the difference is emphasis, not division.'],
  ['Obliques', 'obliques', 'Internal and external, flanking the abdomen.',
    'Bend and rotate the trunk, and resist it bending and rotating. Anti-rotation work such as a side plank with a reach-through hits them hard.'],
  ['TVA', 'tva', 'Transverse abdominis, the deepest abdominal layer.',
    'Wraps the waist like a corset and creates intra-abdominal pressure. You cannot see it. It stabilises rather than moves.'],
  ['Hip Flexors', 'hip flexors', 'Psoas and iliacus, running from the lumbar spine and inner pelvis to the femur.',
    'Lifts the thigh toward the torso. Worth knowing because they take over ab exercises — the higher a sit-up goes, the more of it is hip flexor and the less is abs.'],
  ['Serratus Anterior', 'serratus anterior', 'Finger-like slips along the ribs beneath the armpit.',
    'Pulls the shoulder blade forward and around the ribcage. Pullovers and overhead pressing train it.'],
  ['Glutes', 'glutes', 'Gluteus maximus, medius and minimus.',
    'The strongest hip extensor you own. Drives you out of a squat, up from a hinge, and forward when you walk. Thrusts and split squats load it directly.'],
  ['Quads', 'quads', 'Four heads on the front of the thigh.',
    'Straighten the knee. Rectus femoris also crosses the hip, so it alone is affected by hip position. Vastus medialis is the teardrop above the inner knee.'],
  ['Hamstrings', 'hamstrings', 'Three muscles on the back of the thigh.',
    'Bend the knee and extend the hip. Because they cross both joints they need training in both patterns — hinging for the hip, curling for the knee.'],
  ['Adductors', 'adductors', 'Inner thigh.',
    'Pulls the leg toward the midline and contributes far more to a squat than most people expect, particularly out of the bottom.'],
  ['Calves', 'gastrocnemius', 'Gastrocnemius on top, soleus underneath.',
    'Point the foot down. Gastrocnemius crosses the knee so it works best with the leg straight; soleus takes over when the knee is bent.'],
];

/* Which of YOUR exercises train a given muscle, primary first. */
function trainedBy(muscleKey) {
  const hits = [];
  PROGRAM.forEach(d => d.sections.forEach(s => s.ex.forEach(raw => {
    const ex = resEx(raw);
    const parts = ex.m.toLowerCase().replace(/\(.*?\)/g,'').split(',').map(x => x.trim());
    const i = parts.indexOf(muscleKey);
    if (i >= 0 && !hits.some(h => h.n === ex.n)) hits.push({ n: ex.n, lvl: Math.min(i + 1, 3), day: d.day });
  })));
  return hits.sort((a, b) => a.lvl - b.lvl);
}

function anatomyHTML() {
  const list = MUSCLES.map(([name, key]) =>
    `<button class="st-m ${key === selMuscle ? 'sel' : ''}" data-act="st-muscle" data-k="${key}">${name}</button>`).join('');
  const cur = MUSCLES.find(m => m[1] === selMuscle) || MUSCLES[0];
  const [name, key, what, does] = cur;
  const hits = trainedBy(key);
  const lvlName = { 1:'Primary', 2:'Secondary', 3:'Stabiliser' };

  return `
  ${card('The Map', `
    <div class="st-map">
      <figure class="m-side"><figcaption class="m-label">Front</figcaption>${nsFig(FRONT_SVG)}</figure>
      <figure class="m-side"><figcaption class="m-label">Back</figcaption>${nsFig(BACK_SVG)}</figure>
    </div>
    <div class="st-mlist">${list}</div>
    <div class="st-mdetail">
      <h4>${name}</h4>
      <p class="st-what">${what}</p>
      <p>${does}</p>
      ${hits.length ? `<div class="st-trained"><span>In your program</span>${
        hits.map(h => `<span class="st-tr l${h.lvl}" title="${lvlName[h.lvl]} on ${h.day.toUpperCase()}">${h.n}</span>`).join('')
      }</div>` : `<div class="st-trained none">Nothing in your current program trains this directly.</div>`}
    </div>
  `, 'Pick a muscle to light it up and read what it does.')}

  ${card('How a Muscle Is Built', `
    <p>A muscle is a bundle of bundles. Working inward: the whole muscle is made of
    <b>fascicles</b>, each fascicle is a bundle of <b>fibres</b>, each fibre is packed with
    <b>myofibrils</b>, and each myofibril is a chain of <b>sarcomeres</b> — the smallest unit that
    can contract. Sarcomeres shorten by dragging two protein filaments, actin and myosin, past each
    other. Every rep you have ever done is that, several trillion times over.</p>
    ${fibreDiagram()}
    <p>Growth is mostly the muscle adding contractile protein <i>alongside</i> what's there, making
    each fibre thicker. Fibres do not meaningfully split into new ones in humans.</p>
    ${dl([
      ['Type I fibres', 'Slow, fatigue-resistant, built for sustained work. Postural muscles are rich in them.'],
      ['Type II fibres', 'Fast and powerful, fatigue quickly, and have the greater growth potential. Heavy and near-failure work recruits them.'],
      ['Recruitment order', 'Small slow motor units fire first and larger fast ones join as force demand rises. This is why a set only becomes productive as it gets hard — the fibres with the most to gain are the last ones invited.'],
    ])}
    ${photo('muscle-fibre.jpg', 'Skeletal muscle structure')}
  `, 'From the whole muscle down to the part that actually pulls.')}

  ${card('What Actually Makes It Grow', `
    <p><b>Mechanical tension</b> is the primary driver, and the evidence for it is far stronger than
    for anything else. Force through a muscle across a meaningful range, close enough to failure that
    the high-threshold fibres get involved, repeated often enough, with the load creeping up over
    time. That is essentially the whole mechanism.</p>
    <p>Two other candidates get talked about a great deal and deserve more scepticism than they
    usually get. <b>Metabolic stress</b> — the burn — correlates with growth but may simply be a
    by-product of the tension that caused it. <b>Muscle damage</b> is probably not a driver at all:
    soreness is a poor predictor of growth, and a great deal of growth happens without it.</p>
    ${note('The practical consequence.',
      `If tension is the driver, then chasing soreness or the pump is chasing a symptom. Chase load
       and reps at a given form standard instead. That is what the Weight tab is for.`)}
  `, 'One mechanism does most of the work.')}`;
}

/* Zoom cascade: whole muscle → fascicle → fibre → myofibril → sarcomere. */
function fibreDiagram() {
  return `<svg class="st-diagram" viewBox="0 0 660 190" role="img"
    aria-label="Muscle structure from whole muscle down to sarcomere">
    <defs><marker id="stArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,1 L7,4 L0,7 z" class="st-dg-arrow"/></marker></defs>

    <g class="st-dg-g">
      <ellipse class="st-dg-fill" cx="62" cy="70" rx="42" ry="30"/>
      <path class="st-dg-line" d="M24,58 C50,52 78,52 100,58 M22,70 C50,64 80,64 102,70 M24,82 C50,76 78,76 100,82"/>
      <text class="st-dg-t" x="62" y="126">Muscle</text>
      <text class="st-dg-s" x="62" y="140">the whole thing</text>
    </g>
    <line class="st-dg-ar" x1="110" y1="70" x2="140" y2="70" marker-end="url(#stArrow)"/>

    <g class="st-dg-g">
      <rect class="st-dg-fill" x="152" y="44" width="84" height="52" rx="10"/>
      <path class="st-dg-line" d="M158,56 H230 M158,70 H230 M158,84 H230"/>
      <text class="st-dg-t" x="194" y="126">Fascicle</text>
      <text class="st-dg-s" x="194" y="140">a bundle of fibres</text>
    </g>
    <line class="st-dg-ar" x1="244" y1="70" x2="274" y2="70" marker-end="url(#stArrow)"/>

    <g class="st-dg-g">
      <rect class="st-dg-fill" x="286" y="52" width="84" height="36" rx="16"/>
      <path class="st-dg-line" d="M292,62 H364 M292,70 H364 M292,78 H364"/>
      <text class="st-dg-t" x="328" y="126">Fibre</text>
      <text class="st-dg-s" x="328" y="140">one muscle cell</text>
    </g>
    <line class="st-dg-ar" x1="378" y1="70" x2="408" y2="70" marker-end="url(#stArrow)"/>

    <g class="st-dg-g">
      <rect class="st-dg-fill" x="420" y="56" width="84" height="28" rx="12"/>
      <path class="st-dg-line" d="M428,56 V84 M446,56 V84 M464,56 V84 M482,56 V84 M496,56 V84"/>
      <text class="st-dg-t" x="462" y="126">Myofibril</text>
      <text class="st-dg-s" x="462" y="140">chain of sarcomeres</text>
    </g>
    <line class="st-dg-ar" x1="512" y1="70" x2="540" y2="70" marker-end="url(#stArrow)"/>

    <g class="st-dg-g">
      <rect class="st-dg-fill" x="552" y="56" width="92" height="28" rx="4"/>
      <line class="st-dg-z" x1="556" y1="52" x2="556" y2="88"/>
      <line class="st-dg-z" x1="640" y1="52" x2="640" y2="88"/>
      <path class="st-dg-actin" d="M556,63 H592 M556,77 H592 M640,63 H604 M640,77 H604"/>
      <rect class="st-dg-myosin" x="580" y="66" width="36" height="8" rx="4"/>
      <text class="st-dg-t" x="598" y="126">Sarcomere</text>
      <text class="st-dg-s" x="598" y="140">actin slides over myosin</text>
    </g>
    <text class="st-dg-cap" x="330" y="176">Each step is a bundle of the next one in. Contraction happens only at the far right.</text>
  </svg>`;
}

/* ═══════════════════ TRAINING ═══════════════════ */

function trainingHTML() {
  return `
  ${card('Progressive Overload', `
    <p>The muscle adapts to what you keep asking of it. Ask the same thing forever and it has no
    reason to change. Overload is simply making the demand creep upward, and it is the one principle
    the others exist to serve.</p>
    ${dl([
      ['Add weight', 'The cleanest lever, and the reason every movement in your program has a weight field.'],
      ['Add reps', 'Usually what happens first. Take the same weight from 8 to 12, then add weight and drop back.'],
      ['Add sets', 'Increases weekly volume. The slowest-acting lever and the easiest one to overdo.'],
      ['Improve form', 'A deeper range or a controlled eccentric at the same load is a genuine increase in demand, even though nothing on the dumbbell changed.'],
    ])}
    ${note('An increment only counts relative to the load.',
      `2.5 lb onto a 20 lb curl is a 12% jump and plainly real; the same 2.5 lb onto a 100 lb hinge is
       inside the noise of how you slept. This is why the reliable method is <b>double progression</b>:
       hold the weight until you clear the top of your rep range on every set, then add the smallest
       jump you own and let the reps fall back. Reps carry the progress between weight increases —
       waiting for the weight to move is what makes progress look stalled when it isn't.`)}
  `, 'If nothing gets harder, nothing changes.')}

  ${card('Volume', `
    <p>Counted as <b>hard sets per muscle per week</b> — sets taken close enough to failure to matter.
    This is the dose, and it has the most direct relationship with growth of any variable you control.</p>
    ${dl([
      ['The band', 'Roughly 10–20 hard sets per muscle per week. Schoenfeld\'s dose-response meta-analysis graded it: under 5 sets, 5–9, and 10+, with 10+ producing close to double the growth of the lowest group.'],
      ['More is not linear', 'Returns flatten and eventually reverse, because volume you cannot recover from is volume that costs you.'],
      ['Count indirect work', 'Rows train biceps, presses train triceps. Counting only isolation work badly undercounts what the arms are actually getting.'],
      ['Build up, do not jump', 'Add sets over weeks. Landing on twenty from eight in one go tends to produce fatigue rather than growth.'],
    ])}
    ${srcs([['Schoenfeld, Ogborn & Krieger 2017 — weekly volume dose-response meta-analysis','https://pubmed.ncbi.nlm.nih.gov/27433992/']])}
  `, 'The dose. The single most useful number to track.')}

  ${card('Load and Reps', `
    <p>This is where most training arguments happen, and the evidence is far less dramatic than the
    arguments. Schoenfeld's 2017 meta-analysis pooled 21 studies and found <b>no significant difference
    in hypertrophy</b> between low-load (≤60% 1RM) and high-load training when sets were taken to
    failure. The same analysis found gains in <i>1RM strength</i> clearly favoured the heavy work — so
    load is close to irrelevant for size and very relevant for strength.</p>
    <p>Growth is roughly equivalent anywhere from about <b>5 to 35 reps</b>, provided two conditions
    hold: the set goes close to failure, and the load is at least about 30% of your one-rep maximum.
    Below that threshold the set stops being a strength stimulus and becomes an endurance one.</p>
    ${dl([
      ['5–8 reps', 'Best for building maximal strength. Highest joint stress and longest rests.'],
      ['8–15 reps', 'The pragmatic middle. Enough load to matter, not so much that setup dominates the session.'],
      ['15–30 reps', 'Grows muscle just as well when genuinely taken to failure. The catch is that failure at 30 reps is deeply unpleasant and easy to stop short of.'],
      ['The 30% floor', 'This is exactly why bodyweight core work stalls: once you can do forty reps, the load is below the threshold and the set no longer qualifies.'],
    ])}
    ${srcs([
      ['Schoenfeld et al. 2017 — low- vs high-load meta-analysis','https://pubmed.ncbi.nlm.nih.gov/28834797/'],
      ['Stronger by Science — the hypertrophy rep range, fact or fiction','https://www.strongerbyscience.com/hypertrophy-range-fact-fiction/'],
    ])}
  `, 'Wider than the internet thinks.')}

  ${card('Proximity to Failure', `
    <p><b>Reps in reserve</b> is how many more you could have done. RIR 0 is failure, RIR 2 means two
    left. It's the variable that decides whether a set counts, and the one most often overestimated —
    people routinely stop three or four reps earlier than they believe.</p>
    ${dl([
      ['0–2 RIR', 'Where most working sets belong. Close enough to recruit the fibres that matter.'],
      ['3+ RIR', 'Useful for warm-ups and for technique on heavy compounds, but weak as a growth stimulus.'],
      ['True failure', 'Fine on isolation and machine-like movements. Expensive on heavy compounds, where it costs far more recovery than the extra rep returns.'],
      ['Isolation vs compound', 'A set of lateral raises to failure is cheap. A set of split squats to failure is not.'],
    ])}
  `, 'The variable people are worst at judging.')}

  ${card('Frequency, Range and Rest', `
    ${dl([
      ['Frequency', 'Twice a week per muscle is a sensible default, but the meta-analytic finding is that frequency does not meaningfully change hypertrophy once weekly volume is equated. It is a scheduling tool, not a growth lever.'],
      ['Range of motion', 'Train the full range you can control. Partial reps in the shortened position are the least useful thing you can do.'],
      ['Long muscle lengths', 'Emphasising the stretched portion is promising and popular, but it is not the free win it gets sold as — a 2025 within-participant trial in trained lifters found lengthened partials produced adaptations similar to full range, not better. Where partials do clearly win is against partials in the shortened position. Full range remains the safe default.'],
      ['Rest between sets', 'Two to three minutes on compounds, and at least a minute on isolation — the trials that compared one minute against three found three better for growth. Short rests cost you reps, and reps are the thing you are trying to accumulate.'],
      ['Tempo', 'Control the lowering phase, roughly two seconds. Beyond that, deliberately slow tempos mostly reduce the load you can use.'],
    ])}
    ${srcs([
      ['Wolf et al. 2025 — lengthened partials vs full range in trained lifters','https://pubmed.ncbi.nlm.nih.gov/39959841/'],
      ['Schoenfeld et al. — training frequency meta-analysis','https://pubmed.ncbi.nlm.nih.gov/30558493/'],
      ['Stronger by Science — lengthened partials and stretch-mediated hypertrophy','https://www.strongerbyscience.com/stretch-mediated-hypertrophy/'],
    ])}
  `, 'The dials that matter less than you would guess.')}`;
}

/* ═══════════════════ RECOVERY ═══════════════════ */

function recoveryHTML() {
  return `
  ${card('Sleep', `
    <p>The highest-leverage recovery variable by a wide margin, and the one most often traded away.
    The numbers here are unusually blunt for exercise science.</p>
    ${dl([
      ['One night, none', 'A single night of total deprivation cut muscle protein synthesis by about 18%, dropped testosterone around 24% and raised cortisol about 21% the following morning.'],
      ['Restriction', 'Five nights at four hours in bed cut myofibrillar synthesis by roughly 18% — and, usefully, high-intensity interval work during those days partly held it up.'],
      ['Injury', 'Adolescent athletes sleeping under 8 hours were about 1.7 times more likely to be injured.'],
      ['Target', '7–9 hours for adults, 8–10 while training hard.'],
    ])}
    ${note('Put this in proportion.',
      `Losing a fifth of your protein synthesis to poor sleep is a larger effect than almost any
       supplement or programming tweak will ever give you. Sleep is not the boring answer, it is the
       big one.`)}
    ${srcs([
      ['Lamon et al. 2021 — acute sleep deprivation, protein synthesis and hormones','https://researchexperts.utmb.edu/en/publications/the-effect-of-acute-sleep-deprivation-on-skeletal-muscle-protein-/'],
      ['Saner et al. 2020 — five nights of sleep restriction and myofibrillar synthesis','https://pubmed.ncbi.nlm.nih.gov/32078168/'],
    ])}
  `, 'The one that beats every supplement on this page.')}

  ${card('Soreness Is Not the Scoreboard', `
    <p>Delayed onset muscle soreness peaks a day or two after training and feels like evidence that
    something worked. It isn't. Soreness tracks how <i>unaccustomed</i> a movement was far more
    closely than how much growth it caused — which is why a new exercise wrecks you and the one you've
    done for six months doesn't, even as the second is the one actually adding tissue.</p>
    <p>Muscle damage is probably not a growth driver in its own right. Plenty of growth happens without
    soreness, and plenty of soreness happens without growth. If you need a signal that training is
    working, use the weight going up over weeks, not how you feel on Tuesday.</p>
  `, 'A poor proxy that feels like a good one.')}

  ${card('Fatigue and Deloads', `
    <p>Fatigue accumulates across weeks in a way that a single night's sleep will not clear.
    Eventually performance stalls or slides even though effort hasn't changed. A <b>deload</b> — a
    planned easy week — lets the accumulated fatigue drain so the adaptation underneath shows up.</p>
    ${dl([
      ['When', 'Every 4–8 weeks, or sooner if the signs arrive early.'],
      ['Signs', 'Weights that were comfortable feel heavy, joints ache, sleep gets worse, motivation drops off.'],
      ['How', 'Keep the exercises, cut the sets roughly in half, and stop each set well short of failure. Do not simply skip the week — moving keeps the pattern.'],
      ['Life counts', 'Fatigue does not care whether it came from training, work or stress. A bad month at work is a reason to reduce training load, not to push through it.'],
    ])}
  `, 'Planned easy weeks are part of the program, not a break from it.')}

  ${card('The Recovery Window', `
    <p>Training tilts the balance toward breakdown. Over the following <b>24 to 72 hours</b> the job
    is to tilt it back — which is why a muscle trained hard on Monday is generally ready again by
    Thursday, and why the four-day split you're running has the spacing it does.</p>
    ${dl([
      ['Protein', 'Spread across the day, roughly 0.4 g/kg per meal. Total matters more than timing.'],
      ['Calories', 'A deficit slows recovery. It is entirely possible to under-recover by under-eating alone.'],
      ['Movement', 'Light activity on off days helps more than complete rest.'],
      ['The anabolic window', 'The idea that protein must land within an hour of training is long dead. The window is measured in hours, and the daily total is what matters.'],
    ])}
  `, 'What is happening between sessions.')}`;
}

/* ═══════════════════ SHELL ═══════════════════ */

let selMuscle = 'chest';

export function renderStudy(root) {
  const p = root.querySelector('#p-study');
  if (!p) return;
  const cur = sec();
  const nav = SECS.map(s =>
    `<button class="st-tab ${s.k === cur ? 'sel' : ''}" data-act="st-sec" data-k="${s.k}">${s.lbl}</button>`).join('');
  const body = cur === 'nutrition' ? nutritionHTML()
             : cur === 'anatomy'   ? anatomyHTML()
             : cur === 'training'  ? trainingHTML()
             :                       recoveryHTML();
  p.innerHTML = `<div class="st-nav">${nav}</div><div class="st-body">${body}</div>`;
  dropPhotos(p);
  if (cur === 'anatomy') paintMuscle(root);
}

/* Light the selected muscle on the study figures, using the same tier
   colours the exercise modal uses so the two read as one language. */
function paintMuscle(root) {
  const ids = MMAP[selMuscle] || [];
  root.querySelectorAll('#p-study .m-region').forEach(el => el.classList.remove('lvl-1'));
  ids.forEach(id => root.querySelector(`#p-study [id="s-${id}"]`)?.classList.add('lvl-1'));
}

export function studySetSec(k, root) { setSec(k); renderStudy(root); }
export function studySetGoal(g, root) { save('bp_goal', g); renderStudy(root); }
export function studySetMuscle(k, root) {
  selMuscle = k;
  root.querySelectorAll('#p-study .st-m').forEach(b => b.classList.toggle('sel', b.dataset.k === k));
  const holder = root.querySelector('#p-study .st-mdetail');
  const cur = MUSCLES.find(m => m[1] === k);
  if (cur && holder) {
    const [name, key, what, does] = cur;
    const hits = trainedBy(key);
    const lvlName = { 1:'Primary', 2:'Secondary', 3:'Stabiliser' };
    holder.innerHTML = `<h4>${name}</h4><p class="st-what">${what}</p><p>${does}</p>
      ${hits.length ? `<div class="st-trained"><span>In your program</span>${
        hits.map(h => `<span class="st-tr l${h.lvl}" title="${lvlName[h.lvl]} on ${h.day.toUpperCase()}">${h.n}</span>`).join('')
      }</div>` : `<div class="st-trained none">Nothing in your current program trains this directly.</div>`}`;
  }
  paintMuscle(root);
}
export function studySetKcal(v, root) {
  const n = parseInt(v, 10);
  save('bp_kcal', Number.isFinite(n) && n >= 1000 ? n : null);
  renderStudy(root);
}
