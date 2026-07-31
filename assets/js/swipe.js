/* ═══════════════════════════════════════════════════════════
   SWIPE — horizontal swipe-to-switch for tabbed panels.

   Deliberately narrow: it reports "swiped left" or "swiped right"
   and nothing else. No dragging, no rubber-banding, no state.

   Three rules keep it from fighting the page:

   1. VERTICAL BELONGS TO THE SCROLLER. The first few pixels of
      travel decide which axis owns the gesture, and that decision
      holds for the rest of the touch. Without the lock, a swipe
      and a scroll are indistinguishable and both feel broken.

   2. THE LISTENERS ARE PASSIVE. Nothing here ever calls
      preventDefault, so scrolling is never blocked or delayed —
      the gesture only ever reads the touch.

   3. THE SCREEN EDGES ARE NOT OURS. In Safari a horizontal drag
      starting near the left or right edge is the back/forward
      gesture, and a page cannot take that back. So swipes
      starting in the edge gutter are ignored rather than fought.
      Installed to the Home Screen there is no such gesture and
      the gutter costs nothing.

   Attach it to the panel container, not the whole app: the modal
   overlays sit outside that container, so an open modal swallows
   its own touches without needing a special case here.
   ═══════════════════════════════════════════════════════════ */

const EDGE  = 26;    /* px of screen edge left to the browser */
const LOCK  = 12;    /* px of travel before the axis is decided */
const DIST  = 60;    /* px of horizontal travel that counts as a swipe */
const RATIO = 1.6;   /* how much more horizontal than vertical it must be */
const TIME  = 700;   /* ms; slower than this is a drag, not a swipe */

/* Calls handler(+1) on a left swipe (go forward) and handler(-1) on a
   right swipe. Returns a function that removes the listeners. */
export function onSwipe(el, handler) {
  let x0 = 0, y0 = 0, t0 = 0, axis = null, live = false;

  const start = e => {
    /* a second finger means pinch/zoom, not a swipe */
    if (e.touches.length !== 1) { live = false; return; }
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) { live = false; return; }
    x0 = t.clientX; y0 = t.clientY; t0 = e.timeStamp; axis = null; live = true;
  };

  const move = e => {
    if (!live || axis || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - x0), dy = Math.abs(t.clientY - y0);
    if (Math.max(dx, dy) < LOCK) return;              // too early to tell
    axis = dx > dy * RATIO ? 'x' : 'y';
    if (axis === 'y') live = false;                   // hand it to the scroller
  };

  const end = e => {
    const ok = live && axis === 'x';
    live = false;
    if (!ok) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) < DIST || e.timeStamp - t0 > TIME) return;
    handler(dx < 0 ? 1 : -1);
  };

  const cancel = () => { live = false; };

  const on = [['touchstart', start], ['touchmove', move],
              ['touchend', end], ['touchcancel', cancel]];
  on.forEach(([n, f]) => el.addEventListener(n, f, { passive: true }));
  return () => on.forEach(([n, f]) => el.removeEventListener(n, f));
}

/* Wires a swipe to an ordered list of tab ids. Clamps at both ends
   rather than wrapping — running off the last tab back to the first
   loses your place, and there is no page-curl to explain it. */
export function swipeTabs(el, tabs, getActive, setActive) {
  return onSwipe(el, dir => {
    const i = tabs.indexOf(getActive()) + dir;
    if (i >= 0 && i < tabs.length) setActive(tabs[i]);
  });
}
