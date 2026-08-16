// ==========================================================================
// This Area Of Code Is: The parts librarian.
// Explanation: When anyone uploads a score file, I read the filename AND
// the PDF's own text layer to figure out two things: what SONG this is
// and what PART it belongs to (Alto Sax, Tenor 1, Solo…). The director
// uploads one song with every part attached — and each musician opens the
// song and picks THEIR part. One song, every instrument, no paperwork.
// In Other Words: "Holy King Medley_Sax.pdf" → song "Holy King Medley",
// part "Sax" — automatically.
// ==========================================================================

// Ordered part patterns — first match wins. Labels are what musicians say.
const PART_PATTERNS: Array<[RegExp, string]> = [
  [/soprano[\s_-]*sax/i, 'Soprano Sax'],
  [/alto[\s_-]*sax/i, 'Alto Sax'],
  [/tenor[\s_-]*sax/i, 'Tenor Sax'],
  [/bari(tone)?[\s_-]*sax/i, 'Baritone Sax'],
  [/\bsax\b/i, 'Sax'],
  [/\bt[\s_-]?1\b/i, 'Tenor 1'],
  [/\bt[\s_-]?2\b/i, 'Tenor 2'],
  [/\ba[\s_-]?1\b/i, 'Alto 1'],
  [/\ba[\s_-]?2\b/i, 'Alto 2'],
  [/\bs[\s_-]?1\b/i, 'Soprano 1'],
  [/\bs[\s_-]?2\b/i, 'Soprano 2'],
  [/\bsolo/i, 'Solo'],
  [/\blead\b/i, 'Lead'],
  [/trumpet/i, 'Trumpet'],
  [/trombone/i, 'Trombone'],
  [/\bflute/i, 'Flute'],
  [/clarinet/i, 'Clarinet'],
  [/\boboe/i, 'Oboe'],
  [/\bf[\s_-]?horn|french[\s_-]*horn/i, 'French Horn'],
  [/tuba/i, 'Tuba'],
  [/piano/i, 'Piano'],
  [/key(board)?s?/i, 'Keys'],
  [/organ/i, 'Organ'],
  [/bass[\s_-]*guitar|\bbass\b/i, 'Bass'],
  [/guitar/i, 'Guitar'],
  [/drum|perc/i, 'Drums'],
  [/violin/i, 'Violin'],
  [/cello/i, 'Cello'],
  [/vocal|voice|choir/i, 'Vocals'],
  [/rhythm/i, 'Rhythm'],
  [/conductor|full[\s_-]*score|\bscore\b/i, 'Full Score'],
];

/** Infer the instrument/vocal part from a filename, or '' if unclear. */
export function inferPart(filename: string): string {
  for (const [re, label] of PART_PATTERNS) if (re.test(filename)) return label;
  return '';
}

/** Infer a clean song title from a filename. */
export function inferTitle(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '');         // drop extension
  name = name.replace(/^#?\d+[\s_-]*/, '');            // drop leading numbers (#243, 01-)
  for (const [re] of PART_PATTERNS) name = name.replace(re, ''); // drop part words
  name = name.replace(/[\s_-]+$/, '').replace(/^[\s_-]+/, '');   // trim separators
  return name.replace(/[\s_-]{2,}/g, ' ').trim() || filename.replace(/\.[^.]+$/, '');
}

/** Pull the text layer out of a PDF's first page (title/composer/instrument). */
export async function extractPdfHints(file: File): Promise<{ title?: string; composer?: string; part?: string }> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = '';
    for (const item of content.items) {
      const s = 'str' in item ? item.str : '';
      if (s.trim()) current += (current ? ' ' : '') + s.trim();
      if ('hasEOL' in item && item.hasEOL && current) { lines.push(current); current = ''; }
    }
    if (current) lines.push(current);
    void pdf.destroy();

    const clean = lines.filter((l) => l.length >= 3 && l.length <= 90);
    const title = clean.find((l) => !/page|copyright|©|\d{4}/i.test(l));
    const composer = clean.find((l) => /\bby\b|words|music|arr(\.|anged)/i.test(l));
    // Church parts PDFs usually print the instrument on the page
    // ("Tenor Saxophone 1") — that beats any filename guess.
    const instLine = clean.find((l) => /saxophone|trumpet|trombone|flute|clarinet|oboe|piano|violin|cello|horn|tuba/i.test(l));
    let part: string | undefined;
    if (instLine) {
      for (const [re, label] of PART_PATTERNS) {
        if (re.test(instLine)) {
          const num = instLine.match(/\b([12])\b/);
          part = label + (num ? ` ${num[1]}` : '');
          break;
        }
      }
    }
    return {
      title: title && title.length <= 70 && !/saxophone|trumpet|trombone|flute|clarinet/i.test(title) ? title : undefined,
      composer: composer?.replace(/^(words|music|arr(\.|anged)?)\s*(by)?\s*:?\s*/i, '').slice(0, 80) || undefined,
      part,
    };
  } catch {
    return {}; // scanned PDF with no text layer — filename inference carries on
  }
}

/** One call: everything the app can learn about a score file. */
export async function learnFromScoreFile(file: File): Promise<{ title: string; part: string; composer?: string }> {
  let part = inferPart(file.name);
  let title = inferTitle(file.name);
  let composer: string | undefined;
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const hints = await extractPdfHints(file);
    if (hints.title && inferPart(hints.title) === '') title = hints.title;
    if (hints.part) part = hints.part; // the printed instrument wins
    composer = hints.composer;
  }
  return { title, part, composer };
}
