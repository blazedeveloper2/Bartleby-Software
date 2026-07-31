/* ═══════════════════════════════════════════════════════════
   SCRIPTURE — starter verse packs.

   King James Version, which is public domain, so it ships with
   the app rather than being fetched. Nothing here is required:
   these are a starting shelf, and every verse can be edited or
   deleted, and your own can be typed in any translation you like.

   Packs exist so a new library starts with something worth
   learning instead of an empty list.
   ═══════════════════════════════════════════════════════════ */

export const PACKS = [
  {
    id: 'found', name: 'Foundations', blurb: 'The verses most often learned first.',
    v: [
      ['John 3:16',        'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
      ['John 1:1',         'In the beginning was the Word, and the Word was with God, and the Word was God.'],
      ['Genesis 1:1',      'In the beginning God created the heaven and the earth.'],
      ['Romans 3:23',      'For all have sinned, and come short of the glory of God.'],
      ['Romans 6:23',      'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.'],
      ['Romans 5:8',       'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.'],
      ['Ephesians 2:8-9',  'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.'],
      ['John 14:6',        'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'],
      ['1 John 1:9',       'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.'],
      ['Hebrews 11:1',     'Now faith is the substance of things hoped for, the evidence of things not seen.'],
    ],
  },
  {
    id: 'psalms', name: 'Psalms', blurb: 'The prayer book of the Church.',
    v: [
      ['Psalm 23:1',       'The LORD is my shepherd; I shall not want.'],
      ['Psalm 23:4',       'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.'],
      ['Psalm 46:1',       'God is our refuge and strength, a very present help in trouble.'],
      ['Psalm 51:10',      'Create in me a clean heart, O God; and renew a right spirit within me.'],
      ['Psalm 119:105',    'Thy word is a lamp unto my feet, and a light unto my path.'],
      ['Psalm 27:1',       'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?'],
      ['Psalm 34:8',       'O taste and see that the LORD is good: blessed is the man that trusteth in him.'],
      ['Psalm 139:14',     'I will praise thee; for I am fearfully and wonderfully made.'],
      ['Psalm 1:1',        'Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.'],
    ],
  },
  {
    id: 'strength', name: 'Strength', blurb: 'For the days that ask more of you.',
    v: [
      ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
      ['Isaiah 40:31',     'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
      ['Joshua 1:9',       'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
      ['2 Timothy 1:7',    'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'],
      ['Galatians 6:9',    'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
      ['2 Corinthians 12:9','My grace is sufficient for thee: for my strength is made perfect in weakness.'],
      ['Isaiah 41:10',     'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
      ['Romans 8:28',      'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'],
    ],
  },
  {
    id: 'wisdom', name: 'Wisdom', blurb: 'How to carry an ordinary day.',
    v: [
      ['Proverbs 3:5-6',   'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'],
      ['Proverbs 4:23',    'Keep thy heart with all diligence; for out of it are the issues of life.'],
      ['Proverbs 27:17',   'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.'],
      ['Proverbs 16:3',    'Commit thy works unto the LORD, and thy thoughts shall be established.'],
      ['Ecclesiastes 9:10','Whatsoever thy hand findeth to do, do it with thy might.'],
      ['Matthew 6:33',     'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
      ['Matthew 11:28',    'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'],
      ['Philippians 4:6-7','Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.'],
      ['1 Peter 5:7',      'Casting all your care upon him; for he careth for you.'],
      ['James 1:2-3',      'My brethren, count it all joy when ye fall into divers temptations; Knowing this, that the trying of your faith worketh patience.'],
    ],
  },
];

/* Flat lookup: reference → text, for the "already in a pack?" check. */
export const PACK_INDEX = Object.fromEntries(
  PACKS.flatMap(p => p.v.map(([ref, text]) => [ref, { text, pack: p.id }]))
);
