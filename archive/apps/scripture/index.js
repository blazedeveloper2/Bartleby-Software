/* ═══════════════════════════════════════════════════════════
   SCRIPTURE APP

   Library — walk the canon: book → chapter → verses, or type
   "matthew 25" into the jump box and go straight there.
   Tap a verse to read it with what the Church Fathers said about it.

   Saved — the verses you kept, grouped by book, with your own note.

   Text and commentary load one book at a time (see bible.js); the
   app holds no scripture itself.
   ═══════════════════════════════════════════════════════════ */

import { load, save, todayStr } from '../../assets/js/storage.js';
import { toast } from '../../assets/js/ui.js';
import {
  BOOKS, bookByName, parseRef, suggest, loadBook, loadCommentary, versesOf, refOf,
} from './bible.js';

/* ── storage ── */
const savedAll = () => load('sc_saved', []);
const savedSv  = l => save('sc_saved', l);

/* The memorisation app that used to live here left sc_v and sc_log behind.
   Nothing reads them now, but they still count against the storage budget
   and ride along in every backup, so retire them once on mount. */
const RETIRED = ['sc_v', 'sc_log'];
function dropRetiredKeys() {
  RETIRED.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

/* ── state ── */
let root = null;
let activeTab = 'library';
let book = null;              // book name, null = book list
let chapter = 1;
let jumpErr = '';
let focusVerse = null;        // verse number to highlight after a jump
let openRef = null;           // {book, ch, v} in the reader modal
let savedFilter = '';
let suggIndex = 0;            // highlighted book suggestion
let busy = false;

const q = s => root.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isSaved = ref => savedAll().some(s => s.ref === ref);

/* The database stores a bare year, negative for BC. */
const yearLabel = y => {
  const n = parseInt(y, 10);
  if (!isFinite(n)) return '';
  return n < 0 ? `${-n} BC` : `AD ${n}`;
};

/* ═══════════════════ LIBRARY ═══════════════════ */
function renderLibrary() {
  const p = q('#sp-library');
  p.innerHTML = `
    <div class="sc-jump">
      <input class="sc-jump-in" id="sc-jump" placeholder="Jump to — try “matthew 25”" autocomplete="off" spellcheck="false">
      <button class="sc-jump-go" data-act="jump">Go</button>
      <div class="sc-sugg" id="sc-sugg"></div>
    </div>
    ${jumpErr ? `<div class="sc-jump-err">${esc(jumpErr)}</div>` : ''}
    ${book ? chapterViewHTML() : bookListHTML()}`;
  if (!book) return;
  /* Centre the current chapter in the picker. Psalm 119 sits two thirds of
     the way down a 150-chapter scroller and would otherwise be off-screen
     with no sign it was selected. Set scrollTop rather than calling
     scrollIntoView, which would also drag the page. */
  const on = q('.sc-ch.on');
  if (on) {
    const box = on.parentElement;
    box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2;
  }
  paintChapter();
}

function bookListHTML() {
  const group = (t, label) => `
    <div class="sc-sec"><span>${label}</span><span class="sc-sec-n">${BOOKS.filter(b => b.t === t).length} books</span></div>
    <div class="sc-books">${BOOKS.filter(b => b.t === t).map(b =>
      `<button class="sc-book" data-act="book" data-b="${esc(b.n)}">
        <span class="sc-book-n">${esc(b.n)}</span><span class="sc-book-c">${b.c}</span>
      </button>`).join('')}</div>`;
  return `<div class="sc-card-plain">${group('ot', 'Old Testament')}</div>
          <div class="sc-card-plain">${group('nt', 'New Testament')}</div>`;
}

function chapterViewHTML() {
  const b = bookByName(book);
  const chips = Array.from({ length: b.c }, (_, i) => i + 1).map(n =>
    `<button class="sc-ch ${n === chapter ? 'on' : ''}" data-act="chapter" data-n="${n}">${n}</button>`).join('');
  return `
    <div class="sc-bookbar">
      <button class="sc-back" data-act="books">‹ All books</button>
      <div class="sc-bookbar-t">${esc(b.n)}</div>
    </div>
    <div class="sc-card-plain"><div class="sc-chs">${chips}</div></div>
    <div class="sc-readnav">
      <button class="sc-nav-b" data-act="ch-shift" data-d="-1" ${chapter <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span class="sc-readnav-t">${esc(b.n)} ${chapter}</span>
      <button class="sc-nav-b" data-act="ch-shift" data-d="1" ${chapter >= b.c ? 'disabled' : ''}>Next ›</button>
    </div>
    <div id="sc-chapter"><div class="sc-loading">Loading ${esc(b.n)} ${chapter}…</div></div>`;
}

/* The chapter body is painted separately because it waits on a fetch. */
async function paintChapter() {
  const target = q('#sc-chapter');
  if (!target) return;
  const want = `${book} ${chapter}`;
  let data;
  try {
    data = await loadBook(book);
  } catch {
    if (q('#sc-chapter') && `${book} ${chapter}` === want)
      q('#sc-chapter').innerHTML = missingTextHTML();
    return;
  }
  if (!q('#sc-chapter') || `${book} ${chapter}` !== want) return;   // moved on

  const verses = data[String(chapter)] || [];
  if (!verses.length) { q('#sc-chapter').innerHTML = `<div class="sc-empty">No verses found for ${esc(want)}.</div>`; return; }

  let com = { e: [], v: {} };
  try { com = await loadCommentary(book, chapter); } catch {}
  if (!q('#sc-chapter') || `${book} ${chapter}` !== want) return;

  q('#sc-chapter').innerHTML = `<div class="sc-card-plain sc-chapter">${verses.map((t, i) => {
    const n = i + 1, ref = refOf(book, chapter, n);
    const cn = versesOf(com, n).length;
    return `<div class="sc-v ${focusVerse === n ? 'focus' : ''}" data-act="verse" data-n="${n}">
      <span class="sc-v-n">${n}</span>
      <span class="sc-v-t">${esc(t)}</span>
      <span class="sc-v-m">${isSaved(ref) ? '<span class="sc-v-star">★</span>' : ''}${cn ? `<span class="sc-v-c">${cn}</span>` : ''}</span>
    </div>`;
  }).join('')}</div>`;

  if (focusVerse) {
    const el = q(`.sc-v[data-n="${focusVerse}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    focusVerse = null;
  }
}

function missingTextHTML() {
  return `<div class="sc-empty sc-missing">
    <b>Scripture text isn't installed yet.</b><br>
    The KJV lives in <code>assets/data/kjv/</code> as one file per book.
    Once those are in place this reads offline with no key and no network.
  </div>`;
}

/* ── navigation ── */
function openBook(name, ch = 1, v = null) {
  book = name; chapter = ch; focusVerse = v; jumpErr = '';
  renderLibrary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function backToBooks() { book = null; jumpErr = ''; renderLibrary(); }
function setChapter(n) {
  const b = bookByName(book); if (!b) return;
  chapter = Math.min(Math.max(1, n), b.c);
  renderLibrary();
}
/* Suggestions are painted straight into their own container rather than
   through renderLibrary, which would rebuild the input and drop the caret
   on every keystroke. */
function paintSuggestions() {
  const box = q('#sc-sugg'); if (!box) return;
  const raw = q('#sc-jump')?.value || '';
  const hits = suggest(raw);
  suggIndex = Math.min(suggIndex, hits.length - 1);
  if (!hits.length) { box.innerHTML = ''; box.classList.remove('on'); return; }
  box.innerHTML = hits.map((h, i) => `
    <button class="sc-sugg-i ${i === suggIndex ? 'on' : ''}" data-act="sugg"
            data-b="${esc(h.book)}" data-c="${h.ch || 1}" data-v="${h.v || ''}">
      <span class="sc-sugg-n">${esc(h.book)}${h.ch ? ` ${h.ch}` : ''}${h.v ? `:${h.v}` : ''}</span>
      <span class="sc-sugg-c">${h.ch ? `of ${h.chapters}` : `${h.chapters} chapter${h.chapters === 1 ? '' : 's'}`}</span>
    </button>`).join('');
  box.classList.add('on');
}
function hideSuggestions() {
  const box = q('#sc-sugg');
  if (box) { box.innerHTML = ''; box.classList.remove('on'); }
  suggIndex = 0;
}
function takeSuggestion(b, ch, v) {
  hideSuggestions();
  jumpErr = '';
  openBook(b, +ch || 1, v ? +v : null);
  if (v) openVerse(b, +ch || 1, +v);
}

function doJump() {
  const raw = q('#sc-jump')?.value || '';
  if (!raw.trim()) return;
  const hit = parseRef(raw);
  if (!hit) { jumpErr = `Couldn't find “${raw.trim()}”. Try a book and chapter, like “John 3” or “ps 23”.`; renderLibrary(); return; }
  openBook(hit.book, hit.ch, hit.v);
  if (hit.v) openVerse(hit.book, hit.ch, hit.v);
}

/* ═══════════════════ READER MODAL ═══════════════════ */
async function openVerse(b, ch, v) {
  openRef = { book: b, ch, v };
  q('#sc-ol').classList.add('on');
  q('#sc-ol-body').innerHTML = `<div class="sc-loading">Loading…</div>`;
  await paintVerse();
}
function closeVerse() { q('#sc-ol')?.classList.remove('on'); openRef = null; }

async function paintVerse() {
  if (!openRef) return;
  const { book: b, ch, v } = openRef;
  const ref = refOf(b, ch, v);
  let text = '', com = [];
  try { text = (await loadBook(b))[String(ch)]?.[v - 1] || ''; } catch {}
  try { com = versesOf(await loadCommentary(b, ch), v); } catch {}
  if (!openRef || refOf(openRef.book, openRef.ch, openRef.v) !== ref) return;

  const saved = isSaved(ref);
  const note = savedAll().find(s => s.ref === ref)?.note || '';

  q('#sc-ol-body').innerHTML = `
    <div class="sc-modal-head">
      <div class="sc-modal-r">${esc(ref)}<span class="sc-tr">KJV</span></div>
      <button class="sc-x" data-act="close-verse">&times;</button>
    </div>
    <div class="sc-modal-text">${text ? esc(text) : '<i>Text not installed.</i>'}</div>
    <div class="sc-modal-btns">
      <button class="sc-btn ${saved ? '' : 'pri'}" data-act="toggle-save">${saved ? '★ Saved — remove' : '☆ Save this verse'}</button>
    </div>
    ${saved ? `<div class="sc-fld sc-notefld">
        <label>Your note</label>
        <textarea class="sc-in sc-ta" id="sc-note" rows="2" placeholder="Why this one?">${esc(note)}</textarea>
        <button class="sc-btn sm" data-act="save-note">Save note</button>
      </div>` : ''}
    <div class="sc-com">
      <div class="sc-sec"><span>The Fathers</span><span class="sc-sec-n">${com.length || 'none'}</span></div>
      ${com.length ? com.map(c => `
        <div class="sc-com-e">
          <div class="sc-com-h"><span class="sc-com-a">${esc(c.a)}</span>${c.y ? `<span class="sc-com-t">${yearLabel(c.y)}</span>` : ''}</div>
          <div class="sc-com-x">${esc(c.t)}</div>
          ${c.s ? `<div class="sc-com-s">${esc(c.s)}</div>` : ''}
        </div>`).join('')
      : `<div class="sc-empty sc-missing">No commentary on this verse yet. Coverage is uneven by design — the Fathers wrote at length on some verses and passed over others.</div>`}
    </div>
    <button class="sc-done" data-act="close-verse">Done</button>`;
}

/* ═══════════════════ SAVED ═══════════════════ */
function toggleSave() {
  if (!openRef) return;
  const { book: b, ch, v } = openRef, ref = refOf(b, ch, v);
  const list = savedAll();
  const i = list.findIndex(s => s.ref === ref);
  if (i >= 0) { list.splice(i, 1); savedSv(list); toast('Removed'); }
  else {
    loadBook(b).then(d => {
      const text = d[String(ch)]?.[v - 1] || '';
      const l2 = savedAll();
      if (!l2.some(s => s.ref === ref)) {
        l2.push({ ref, book: b, ch, v, text, note: '', added: todayStr() });
        savedSv(l2); toast(`Saved ${ref}`);
        paintVerse(); renderSaved(); paintChapter();
      }
    }).catch(() => toast('Text not installed'));
    return;
  }
  paintVerse(); renderSaved(); paintChapter();
}

function saveNote() {
  if (!openRef) return;
  const ref = refOf(openRef.book, openRef.ch, openRef.v);
  const list = savedAll(), i = list.findIndex(s => s.ref === ref);
  if (i < 0) return;
  list[i].note = q('#sc-note').value.trim();
  savedSv(list); renderSaved(); toast('Note saved');
}

function removeSaved(ref) {
  savedSv(savedAll().filter(s => s.ref !== ref));
  renderSaved(); paintChapter();
  toast('Removed');
}

function renderSaved() {
  const p = q('#sp-saved'); if (!p) return;
  const all = savedAll();
  const query = savedFilter.trim().toLowerCase();
  const list = all.filter(s => !query || s.ref.toLowerCase().includes(query) ||
                               s.text.toLowerCase().includes(query) || (s.note || '').toLowerCase().includes(query));

  if (!all.length) {
    p.innerHTML = `<div class="sc-empty-card">
      <div class="sc-empty-t">Nothing saved yet</div>
      <div class="sc-empty-b">Open the Library, find a verse, and tap the star. Saved verses live here with whatever note you leave on them.</div>
      <button class="sc-btn pri" data-act="go-lib">Open the Library</button>
    </div>`;
    return;
  }

  /* grouped by book, in canon order rather than alphabetically */
  const order = Object.fromEntries(BOOKS.map((b, i) => [b.n, i]));
  const groups = {};
  list.forEach(s => { (groups[s.book] ||= []).push(s); });
  const names = Object.keys(groups).sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99));

  p.innerHTML = `
    <div class="sc-lib-head">
      <input class="sc-search" id="sc-sq" placeholder="Search saved verses" value="${esc(savedFilter)}" autocomplete="off">
      <span class="sc-count">${all.length}</span>
    </div>
    ${!list.length ? `<div class="sc-empty">Nothing matches that.</div>` : names.map(n => `
      <div class="sc-card-plain">
        <div class="sc-sec"><span>${esc(n)}</span><span class="sc-sec-n">${groups[n].length}</span></div>
        ${groups[n].sort((a, b) => a.ch - b.ch || a.v - b.v).map(s => `
          <div class="sc-srow">
            <div class="sc-srow-b" data-act="open-saved" data-b="${esc(s.book)}" data-c="${s.ch}" data-v="${s.v}">
              <div class="sc-srow-r">${esc(s.ref)}</div>
              <div class="sc-srow-t">${esc(s.text || '')}</div>
              ${s.note ? `<div class="sc-srow-note">${esc(s.note)}</div>` : ''}
            </div>
            <button class="sc-srow-x" data-act="unsave" data-ref="${esc(s.ref)}" title="Remove">×</button>
          </div>`).join('')}
      </div>`).join('')}`;
}

/* ═══════════════════ TABS + EVENTS ═══════════════════ */
function switchTab(tab) {
  activeTab = tab;
  root.querySelectorAll('.sc .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  root.querySelectorAll('.sc .panel').forEach(p => p.classList.remove('active'));
  q('#sp-' + tab).classList.add('active');
  if (tab === 'saved') renderSaved();
}

function onClick(e) {
  if (e.target.classList?.contains('sc-overlay')) { closeVerse(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const a = el.dataset;
  switch (a.act) {
    case 'tab':          switchTab(a.tab); break;
    case 'book':         openBook(a.b); break;
    case 'books':        backToBooks(); break;
    case 'chapter':      setChapter(+a.n); break;
    case 'ch-shift':     setChapter(chapter + (+a.d)); break;
    case 'jump':         doJump(); break;
    case 'sugg':         takeSuggestion(a.b, a.c, a.v); break;
    case 'verse':        openVerse(book, chapter, +a.n); break;
    case 'close-verse':  closeVerse(); break;
    case 'toggle-save':  toggleSave(); break;
    case 'save-note':    saveNote(); break;
    case 'unsave':       removeSaved(a.ref); break;
    case 'open-saved':   switchTab('library'); openBook(a.b, +a.c); openVerse(a.b, +a.c, +a.v); break;
    case 'go-lib':       switchTab('library'); break;
  }
}

function onInput(e) {
  if (e.target.id === 'sc-jump') { suggIndex = 0; paintSuggestions(); return; }
  if (e.target.id !== 'sc-sq') return;
  savedFilter = e.target.value;
  const pos = e.target.selectionStart;
  renderSaved();
  const again = q('#sc-sq');
  if (again) { again.focus(); again.setSelectionRange(pos, pos); }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    if (q('#sc-sugg')?.classList.contains('on')) { hideSuggestions(); return; }
    if (openRef) closeVerse();
    return;
  }
  if (e.target.id !== 'sc-jump') return;

  const items = [...root.querySelectorAll('.sc-sugg-i')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    suggIndex = (suggIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    paintSuggestions();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    /* Enter takes the highlighted suggestion when there is one, so half a
       book name plus Enter goes where you were obviously heading. */
    const pick = items[suggIndex];
    if (pick) takeSuggestion(pick.dataset.b, pick.dataset.c, pick.dataset.v);
    else doJump();
  }
}

/* Losing focus hides the list, but not before a tap on it registers. */
function onFocusOut(e) {
  if (e.target.id !== 'sc-jump') return;
  setTimeout(() => { if (document.activeElement?.id !== 'sc-jump') hideSuggestions(); }, 160);
}

function onExternalChange() {
  if (!root) return;
  closeVerse(); renderSaved(); paintChapter();
}

/* ═══════════════════ TEMPLATE + LIFECYCLE ═══════════════════ */
function template() {
  return `<div class="sc">
    <div class="app-head"><h1>Scripture</h1><p>Read · Keep · The Fathers</p></div>
    <nav class="nav"><div class="nav-inner">
      <button class="tab" data-act="tab" data-tab="saved">Saved</button>
      <button class="tab active" data-act="tab" data-tab="library">Library</button>
    </div></nav>
    <div class="app-wrap">
      <div class="panel" id="sp-saved"></div>
      <div class="panel active" id="sp-library"></div>
    </div>
    <div class="sc-overlay" id="sc-ol"><div class="sc-modal" id="sc-ol-body"></div></div>
  </div>`;
}

export default {
  id: 'scripture',
  name: 'Scripture',
  storagePrefix: 'sc_',
  styles: 'apps/scripture/scripture.css',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M12 6v7"/><path d="M9.5 8.5h5"/></svg>',
  mount(el) {
    root = el;
    dropRetiredKeys();
    jumpErr = ''; openRef = null; busy = false;
    root.innerHTML = template();
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusout', onFocusOut);
    window.addEventListener('bs:datachange', onExternalChange);
    renderLibrary(); renderSaved();
    switchTab(activeTab);
  },
  unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('focusout', onFocusOut);
    }
    window.removeEventListener('bs:datachange', onExternalChange);
    root = null;
  },
};
