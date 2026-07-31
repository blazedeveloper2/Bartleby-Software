/* ═══════════════════════════════════════════════════════════
   SCRIPTURE — canon metadata + on-demand text and commentary.

   The text is King James, which is public domain, stored one JSON
   file per book under assets/data/kjv/. Books are fetched the first
   time you open them and kept in memory after that: the whole Bible
   is a few megabytes, and nobody reads all 66 books in one sitting.

   Commentary comes from the Church Fathers, keyed by book/chapter/
   verse, under assets/data/commentary/. Same lazy-load, same cache.
   A book with no commentary file simply has none — that is a normal
   state, not an error.
   ═══════════════════════════════════════════════════════════ */

/* name, chapter count, testament. Stable data; hard-coded on purpose so
   the book list renders instantly without touching the network. */
const B = (n, c, t) => ({ n, c, t });
export const BOOKS = [
  B('Genesis',50,'ot'), B('Exodus',40,'ot'), B('Leviticus',27,'ot'), B('Numbers',36,'ot'),
  B('Deuteronomy',34,'ot'), B('Joshua',24,'ot'), B('Judges',21,'ot'), B('Ruth',4,'ot'),
  B('1 Samuel',31,'ot'), B('2 Samuel',24,'ot'), B('1 Kings',22,'ot'), B('2 Kings',25,'ot'),
  B('1 Chronicles',29,'ot'), B('2 Chronicles',36,'ot'), B('Ezra',10,'ot'), B('Nehemiah',13,'ot'),
  B('Esther',10,'ot'), B('Job',42,'ot'), B('Psalms',150,'ot'), B('Proverbs',31,'ot'),
  B('Ecclesiastes',12,'ot'), B('Song of Solomon',8,'ot'), B('Isaiah',66,'ot'), B('Jeremiah',52,'ot'),
  B('Lamentations',5,'ot'), B('Ezekiel',48,'ot'), B('Daniel',12,'ot'), B('Hosea',14,'ot'),
  B('Joel',3,'ot'), B('Amos',9,'ot'), B('Obadiah',1,'ot'), B('Jonah',4,'ot'),
  B('Micah',7,'ot'), B('Nahum',3,'ot'), B('Habakkuk',3,'ot'), B('Zephaniah',3,'ot'),
  B('Haggai',2,'ot'), B('Zechariah',14,'ot'), B('Malachi',4,'ot'),

  B('Matthew',28,'nt'), B('Mark',16,'nt'), B('Luke',24,'nt'), B('John',21,'nt'),
  B('Acts',28,'nt'), B('Romans',16,'nt'), B('1 Corinthians',16,'nt'), B('2 Corinthians',13,'nt'),
  B('Galatians',6,'nt'), B('Ephesians',6,'nt'), B('Philippians',4,'nt'), B('Colossians',4,'nt'),
  B('1 Thessalonians',5,'nt'), B('2 Thessalonians',3,'nt'), B('1 Timothy',6,'nt'), B('2 Timothy',4,'nt'),
  B('Titus',3,'nt'), B('Philemon',1,'nt'), B('Hebrews',13,'nt'), B('James',5,'nt'),
  B('1 Peter',5,'nt'), B('2 Peter',3,'nt'), B('1 John',5,'nt'), B('2 John',1,'nt'),
  B('3 John',1,'nt'), B('Jude',1,'nt'), B('Revelation',22,'nt'),
];

export const bookByName = n =>
  BOOKS.find(b => b.n.toLowerCase() === String(n).toLowerCase()) || null;

/* Common shorthands, so "ps 23", "1cor 13" and "song 2" all land. */
const ALIAS = {
  gen:'Genesis', ex:'Exodus', exod:'Exodus', lev:'Leviticus', num:'Numbers', deut:'Deuteronomy',
  dt:'Deuteronomy', josh:'Joshua', judg:'Judges', sam1:'1 Samuel', sam2:'2 Samuel',
  chron1:'1 Chronicles', chron2:'2 Chronicles', neh:'Nehemiah', est:'Esther',
  ps:'Psalms', psa:'Psalms', psalm:'Psalms', prov:'Proverbs', prv:'Proverbs',
  eccl:'Ecclesiastes', ecc:'Ecclesiastes', song:'Song of Solomon', sos:'Song of Solomon',
  isa:'Isaiah', jer:'Jeremiah', lam:'Lamentations', ezek:'Ezekiel', dan:'Daniel',
  hos:'Hosea', obad:'Obadiah', jon:'Jonah', mic:'Micah', nah:'Nahum', hab:'Habakkuk',
  zeph:'Zephaniah', hag:'Haggai', zech:'Zechariah', mal:'Malachi',
  mt:'Matthew', matt:'Matthew', mk:'Mark', lk:'Luke', jn:'John',
  rom:'Romans', cor1:'1 Corinthians', cor2:'2 Corinthians', gal:'Galatians',
  eph:'Ephesians', phil:'Philippians', php:'Philippians', col:'Colossians',
  thess1:'1 Thessalonians', thess2:'2 Thessalonians', tim1:'1 Timothy', tim2:'2 Timothy',
  tit:'Titus', philem:'Philemon', heb:'Hebrews', jas:'James',
  pet1:'1 Peter', pet2:'2 Peter', jn1:'1 John', jn2:'2 John', jn3:'3 John',
  rev:'Revelation', apoc:'Revelation',
};

/* "matthew 25", "mt 25:31", "1 cor 13", "ps23" → {book, ch, v}
   Deliberately forgiving: this is the box you type into in a hurry. */
export function parseRef(input) {
  const s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const m = s.match(/^((?:[1-3]\s*)?[a-z][a-z ]*?)\s*(\d+)?\s*(?::\s*(\d+))?$/);
  if (!m) return null;

  let [, rawBook, ch, v] = m;
  rawBook = rawBook.trim();
  /* leading ordinal: "1 cor" / "1cor" / "i john" */
  const ord = rawBook.match(/^([1-3])\s*(.+)$/);
  const stem = (ord ? ord[2] : rawBook).replace(/\s+/g, '');
  const key = ord ? stem + ord[1] : stem;

  let name = null;
  const full = BOOKS.find(b => b.n.toLowerCase() === rawBook);
  if (full) name = full.n;
  else if (ALIAS[key]) name = ALIAS[key];
  else if (ALIAS[stem] && !ord) name = ALIAS[stem];
  else {
    /* prefix match on the real names, ordinal respected */
    const want = ord ? `${ord[1]} ${stem}` : stem;
    const hit = BOOKS.filter(b => b.n.toLowerCase().replace(/\s+/g, '').startsWith(want.replace(/\s+/g, '')));
    if (hit.length) name = hit[0].n;
  }
  if (!name) return null;

  const book = bookByName(name);
  const chapter = Math.min(Math.max(1, +ch || 1), book.c);
  return { book: book.n, ch: chapter, v: v ? +v : null };
}

/* ── lazy stores ── */
const textCache = new Map();
const comCache = new Map();
const slug = n => n.replace(/\s+/g, '-');

export const DATA_ROOT = '../../assets/data';

async function getJSON(url) {
  const res = await fetch(new URL(url, import.meta.url));
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

/* → { '1': ['In the beginning…', …], '2': [...] }  chapter → verses */
export async function loadBook(name) {
  if (textCache.has(name)) return textCache.get(name);
  const data = await getJSON(`${DATA_ROOT}/kjv/${slug(name)}.json`);
  textCache.set(name, data);
  return data;
}
export const bookLoaded = name => textCache.has(name);

/* → { '3:16': [{author, time, source, text}, …] } */
export async function loadCommentary(name) {
  if (comCache.has(name)) return comCache.get(name);
  let data = {};
  try { data = await getJSON(`${DATA_ROOT}/commentary/${slug(name)}.json`); }
  catch { data = {}; }                  // no file for this book is normal
  comCache.set(name, data);
  return data;
}

export const refOf = (book, ch, v) => `${book} ${ch}:${v}`;
