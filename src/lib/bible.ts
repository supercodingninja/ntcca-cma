// ==========================================================================
// This Area Of Code Is: On-The-Fly Scripture (KJV).
// Explanation: ProPresenter's killer feature is typing "John 3:16" mid-
// service and getting a verse slide in seconds. Ours does the same: ask
// for a passage, and the King James text comes down from the free public
// bible-api service, then is cached ON THE DEVICE — so a passage you used
// once works forever, even offline. KJV only, as commissioned.
// In Other Words: "The Word, at the speed of worship."
// ==========================================================================

export interface BibleVerse { verse: number; text: string }

export interface BiblePassage {
  reference: string;
  verses: BibleVerse[];
  cachedAt: number;
}

const CACHE_KEY = 'ntcc.bible.kjv.cache';

function loadCache(): Record<string, BiblePassage> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, BiblePassage>;
  } catch { /* fall through */ }
  return {};
}

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Fetch a KJV passage ("John 3:16", "Psalm 23", "1 Corinthians 13:4-8").
 *  Online: pulls from bible-api.com and caches. Offline: serves the cache. */
export async function getPassage(query: string): Promise<BiblePassage> {
  const key = normalize(query);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  const url = `https://bible-api.com/${encodeURIComponent(query.trim())}?translation=kjv`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Passage not found — check the reference (e.g. "John 3:16").');
  const data = await r.json() as {
    reference?: string;
    verses?: Array<{ verse: number; text: string }>;
    error?: string;
  };
  if (!data.verses?.length) throw new Error(data.error ?? 'No verses returned.');

  const passage: BiblePassage = {
    reference: data.reference ?? query.trim(),
    verses: data.verses.map((v) => ({ verse: v.verse, text: v.text.trim() })),
    cachedAt: Date.now(),
  };
  cache[key] = passage;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  return passage;
}

/** Split a passage into slides of at most `per` verses each. */
export function passageToSlides(passage: BiblePassage, per = 3): Array<{ title: string; lines: string[] }> {
  const slides: Array<{ title: string; lines: string[] }> = [];
  for (let i = 0; i < passage.verses.length; i += per) {
    const chunk = passage.verses.slice(i, i + per);
    slides.push({
      title: `${passage.reference}${chunk.length === per || i + per < passage.verses.length ? ` (${i + 1}–${i + chunk.length})` : ''}`,
      lines: chunk.map((v) => `${v.verse} ${v.text}`),
    });
  }
  return slides;
}

