// ==========================================================================
// This Area Of Code Is: The Music Core — types, ChordPro-lite parsing,
// chromatic transposition, capo math, and the seed song library.
// Explanation: Every music feature (library, viewer, setlists, lighting,
// director push) reads these types and functions. Transposition is
// enharmonic-aware (sharps up, flats down) and supports Nashville Numbers.
// In Other Words: The sheet-music brain of the app.
// ==========================================================================

export type SectionKind = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tag';

export interface SongLine {
  /** Segments of a lyric line; chord may be '' for chordless words */
  segments: { chord: string; lyric: string }[];
}

export interface SongSection {
  kind: SectionKind;
  label: string;
  lines: SongLine[];
}

// This Area Of Code Is: The song attachment — any file, kept safe.
// Explanation: A song can carry ANY file: a PDF of the sheet music, the
// original .sib or .mscz session file, a Word doc, a rehearsal recording.
// If we can read it today we read it; if not, it still lives safely in the
// device's vault attached to its song — never rejected, never lost.
export interface SongAttachment {
  id: string;          // uuid
  name: string;        // original filename
  kind: 'audio' | 'video' | 'pdf' | 'score' | 'other';
  ref: string;         // idb://… or external URL
  part?: string;       // instrument/vocal part: "Alto Sax", "Tenor 1", "Solo"…
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  language: string;
  // 17-point MVP metadata (spec items 5,6,9,10,13,14,15)
  duration?: string;        // e.g. "4:32"
  leadSinger?: string;
  keyChanges?: string;      // e.g. "A → B at bridge"
  tags?: string[];          // theme tags: worship, praise, communion…
  ccliNumber?: string;
  copyrightInfo?: string;
  audioUrl?: string;        // backing track / reference audio
  youtubeUrl?: string;      // YouTube link (embedded in title block)
  videoUrl?: string;        // uploaded video file (idb://…) or external MP4 URL
  attachments?: SongAttachment[]; // any file: PDF scores, Sibelius files, docs — stored readable or not
  scriptureKJV?: string;
  credit: string;
  // Federal-compliance credits — always honor the original.
  originalArtist?: string;   // "Originally performed by …"
  label?: string;            // recording label
  publisher?: string;        // music publisher
  year?: string;             // copyright year
  sections: SongSection[];
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// THE note table lives in omniscore/pitch — one copy app-wide.
import { NOTE_INDEX_FROM_NAME as NOTE_INDEX } from '../omniscore/pitch';
const NASHVILLE = ['1', '2', '3', '4', '5', '6', '7'];

/** True when the token looks like a chord (A–G root, optional quality/bass). */
export function isChordToken(token: string): boolean {
  return /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|°|ø)?[0-9]*(?:\/[A-G][#b]?)?$/.test(token)
      || NASHVILLE.includes(token);
}

function transposeNote(note: string, semitones: number, preferFlats: boolean): string {
  const idx = NOTE_INDEX[note];
  if (idx === undefined) return note;
  const table = preferFlats ? FLATS : SHARPS;
  return table[(idx + semitones + 120) % 12];
}

/** Transpose a single chord token, preserving quality and slash bass. */
export function transposeChord(chord: string, semitones: number, preferFlats = false): string {
  if (!chord) return chord;
  if (NASHVILLE.includes(chord)) return chord; // Nashville numbers are key-relative
  const m = chord.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const [, root, quality, bass] = m;
  const out = transposeNote(root, semitones, preferFlats) + (quality ?? '');
  return bass ? `${out}/${transposeNote(bass, semitones, preferFlats)}` : out;
}

/** Semitone distance between two keys, e.g. keyDiff('A','C') === 3 */
export function keyDiff(from: string, to: string): number {
  const a = NOTE_INDEX[from] ?? 0;
  const b = NOTE_INDEX[to] ?? 0;
  return (b - a + 12) % 12;
}

/** Capo position to sound in `targetKey` while fingering `shapeKey`. */
export function capoFor(shapeKey: string, targetKey: string): number {
  return keyDiff(shapeKey, targetKey);
}

// ==========================================================================
// This Area Of Code Is: The instrument transposition table — the sax
// family chart, built into every song.
// Explanation: Instruments speak three pitch languages. C instruments
// (piano, guitar) play what they read. B♭ instruments (soprano & tenor sax)
// read a WHOLE TONE above concert — concert C is written D. E♭ instruments
// (alto & baritone sax) read a MAJOR SIXTH above concert — concert C is
// written A. So a written chart for a horn is the concert chart raised by
// the instrument's offset. The octave displacement (major 9th, major 13th)
// doesn't change chord NAMES, only register — so tenor = soprano and
// baritone = alto for chart purposes.
// In Other Words: The pianist sees C, the tenor player sees D, the alto
// player sees A — same song, same moment, three correct charts.
// ==========================================================================
export interface TransposingInstrument {
  id: string;
  label: string;
  family: 'C' | 'Bb' | 'Eb' | 'F' | 'G';
  offset: number;      // semitones above concert for the written chart
  interval: string;    // human description
}

/** Canonical written-above-concert offsets — THE one copy for the whole
    app (the arranger in arrange.ts builds its table from this). */
export const TRANSPOSITION_UP: Record<'C' | 'Bb' | 'Eb' | 'F' | 'G', number> = {
  C: 0, Bb: 2, Eb: 9, F: 7, G: 5,
};

export const INSTRUMENTS: TransposingInstrument[] = [
  { id: 'concert', label: 'Concert — Piano / Guitar', family: 'C', offset: TRANSPOSITION_UP.C, interval: 'as written' },
  { id: 'soprano', label: 'Soprano Sax (B♭)', family: 'Bb', offset: TRANSPOSITION_UP.Bb, interval: 'up a whole tone' },
  { id: 'tenor', label: 'Tenor Sax (B♭)', family: 'Bb', offset: TRANSPOSITION_UP.Bb, interval: 'up a major 9th' },
  { id: 'alto', label: 'Alto Sax (E♭)', family: 'Eb', offset: TRANSPOSITION_UP.Eb, interval: 'up a major 6th' },
  { id: 'baritone', label: 'Baritone Sax (E♭)', family: 'Eb', offset: TRANSPOSITION_UP.Eb, interval: 'up a major 13th' },
  { id: 'horn', label: 'French Horn (F)', family: 'F', offset: TRANSPOSITION_UP.F, interval: 'up a perfect 5th' },
];

/** The full 12-note transposition chart: concert → B♭ written → E♭ written. */
export const TRANSPOSITION_TABLE: Array<{ concert: string; bb: string; eb: string }> = [
  { concert: 'C', bb: 'D', eb: 'A' },
  { concert: 'C#/D♭', bb: 'D#/E♭', eb: 'A#/B♭' },
  { concert: 'D', bb: 'E', eb: 'B' },
  { concert: 'D#/E♭', bb: 'F', eb: 'C' },
  { concert: 'E', bb: 'F#/G♭', eb: 'C#/D♭' },
  { concert: 'F', bb: 'G', eb: 'D' },
  { concert: 'F#/G♭', bb: 'G#/A♭', eb: 'D#/E♭' },
  { concert: 'G', bb: 'A', eb: 'E' },
  { concert: 'G#/A♭', bb: 'A#/B♭', eb: 'F' },
  { concert: 'A', bb: 'B', eb: 'F#/G♭' },
  { concert: 'A#/B♭', bb: 'C', eb: 'G' },
  { concert: 'B', bb: 'C#/D♭', eb: 'G#/A♭' },
];

// This Area Of Code Is: The ChordPro-lite parser.
// Explanation: Accepts lines in "[A]Te doy [E]gracias" bracket form and
// returns chord/lyric segments the viewer renders chord-over-word.
// In Other Words: Turns text chord charts into performance view data.
export function parseChordLine(text: string): SongLine {
  const segments: { chord: string; lyric: string }[] = [];
  const re = /\[([^\]]+)\]|([^\[\]]+)/g;
  let match: RegExpExecArray | null;
  let pendingChord = '';
  while ((match = re.exec(text)) !== null) {
    if (match[1] !== undefined) {
      pendingChord = match[1].trim();
    } else {
      const lyric = match[2];
      // Attach the pending chord to the first word of this lyric run.
      const parts = lyric.split(/(\s+)/).filter((p) => p.length > 0);
      parts.forEach((p, i) => {
        segments.push({ chord: i === 0 ? pendingChord : '', lyric: p });
        pendingChord = '';
      });
    }
  }
  if (pendingChord) segments.push({ chord: pendingChord, lyric: '' });
  return { segments };
}

function section(kind: SectionKind, label: string, raw: string[]): SongSection {
  return { kind, label, lines: raw.map(parseChordLine) };
}

// This Area Of Code Is: The seed library — NTCC repertoire.
// Explanation: Ships with Te Doy Gracias (arr. NTCC Graham Spanish Worship
// Team) and two KJV-tagged hymn placeholders so the app is fully usable
// offline on day one. Real charts load through the same Song shape.
export const SEED_SONGS: Song[] = [
  {
    id: 'te-doy-gracias',
    title: 'Te Doy Gracias',
    artist: 'NTCC Graham Spanish Worship Team',
    key: 'A',
    bpm: 72,
    timeSignature: '4/4',
    language: 'es',
    scriptureKJV: 'Psalm 107:1 — O give thanks unto the LORD, for he is good: for his mercy endureth for ever.',
    credit: 'arr. NTCC Graham Spanish Worship Team',
    duration: '4:32', leadSinger: 'Spanish Worship Team',
    tags: ['worship', 'gratitude', 'spanish'],
    copyrightInfo: '© 2026 NTCCA Music App™ — arr. NTCC Graham Spanish Worship Team',
    sections: [
      section('intro', 'Intro', ['[A]  [E]  [F#m]  [D]']),
      section('verse', 'Verse 1', [
        '[A]Te doy gracias, [E]Señor',
        '[F#m]Por tu sangre [D]redentora',
        '[A]Me salvaste, [E]me libraste',
        '[F#m]Soy libre en [D]Ti, Jes[A]ús',
      ]),
      section('chorus', 'Chorus', [
        '[A]Gracias, [E]gracias, Se[F#m]ñor[D]',
        '[A]Gracias, [E]gracias, Se[F#m]ñor[D]',
        '[A]Por tu amo[E]r y tu [F#m]gracia[D]',
        '[A]Te doy [E]gracias, Se[F#m]ñor[D]  [A]',
      ]),
      section('bridge', 'Bridge', [
        '[F#m]Soy libre, [D]soy libre',
        '[A]En Tu nom[E]bre, Jesús',
        '[F#m]Soy libre, [D]soy libre',
        '[A]Gracias, [E]gracias',
      ]),
    ],
  },
  {
    id: 'im-ready-to-go',
    title: "I'm Ready to Go",
    artist: 'Frederick Thomas',
    key: 'G',
    bpm: 96,
    timeSignature: '4/4',
    language: 'en',
    scriptureKJV: 'Isaiah 6:8 — Here am I; send me.',
    credit: 'Words & music direction: Frederick Thomas',
    duration: '3:48', leadSinger: 'Frederick Thomas',
    tags: ['victory', 'commission', 'praise'],
    copyrightInfo: '© 2026 Frederick Thomas — songwriter (lyrics + music direction)',
    sections: [
      section('verse', 'Verse 1', [
        '[G]I hear the call, [C]I will not fear',
        '[G]My heart is fixed, [D]my path is clear',
      ]),
      section('chorus', 'Chorus', [
        "[G]I'm ready to go, [C]I'm ready to go",
        '[G]For the Lord I [D]trust, I [G]know',
      ]),
    ],
  },
  {
    id: 'his-left-hand',
    title: 'His Left Hand (Under My Head)',
    artist: 'Frederick Thomas',
    key: 'D',
    bpm: 64,
    timeSignature: '6/8',
    language: 'en',
    scriptureKJV: 'Song of Solomon 2:6 — His left hand is under my head, and his right hand doth embrace me.',
    credit: 'Words & music direction: Frederick Thomas · audio generated with Suno AI',
    duration: '5:05', leadSinger: 'Frederick Thomas',
    tags: ['worship', 'love', 'intimacy'],
    copyrightInfo: '© 2026 Frederick Thomas — songwriter (lyrics + music direction)',
    sections: [
      section('verse', 'Verse 1', [
        '[D]His left hand [A]under my [Bm]head[G]',
        '[D]His right hand [A]holds me [D]near',
      ]),
    ],
  },
  // This Area Of Code Is: The band-parts library — the director's own
  // uploaded parts, one song each, part labeled, ready for musicians to
  // open THEIR chart from the "Your part" picker.
  {
    id: 'seed-allpower',
    title: 'All Power',
    artist: 'Freddy Washington',
    key: 'C', bpm: 96, timeSignature: '4/4', language: 'en',
    credit: '© 2015 Carol Joy Music / FreeWah Music / Jason Nene Music (ASCAP)',
    originalArtist: 'Freddy Washington',
    label: 'FreeWah Music',
    publisher: 'Carol Joy Music / Jason Nene Music (ASCAP)',
    year: '2015',
    tags: ['praise', 'power'],
    copyrightInfo: '© 2015 Carol Joy Music (Admin by Clearbox Rights, LLC / ASCAP), FreeWah Music, Jason Nene Music (Admin by BMG Chrysalis) / ASCAP',
    sections: [],
    attachments: [
      { id: 'att-allpower-t1', name: 'All_Power_T1.pdf', kind: 'pdf', ref: '/files/All_Power_T1.pdf', part: 'Tenor Sax 1' },
    ],
  },
  {
    id: 'seed-available',
    title: 'Available',
    artist: 'Shara McKee',
    key: 'C', bpm: 110, timeSignature: '4/4', language: 'en',
    credit: '© 2013 Shara McKee',
    originalArtist: 'Shara McKee',
    publisher: 'Shara McKee',
    year: '2013',
    tags: ['worship', 'surrender'],
    copyrightInfo: '© 2013 Shara McKee',
    sections: [],
    attachments: [
      { id: 'att-available-solo', name: 'Available_SOLO.pdf', kind: 'pdf', ref: '/files/Available_SOLO.pdf', part: 'Alto Sax (Solo)' },
    ],
  },
  {
    id: 'seed-because',
    title: 'Because of Who You Are',
    artist: 'Unknown',
    key: 'C', bpm: 98, timeSignature: '4/4', language: 'en',
    credit: '© 1997 Songs of Doxology Music (admin. by EMI Christian Music Publishing)',
    originalArtist: 'The Judds (popularized); traditional hymn',
    publisher: 'Songs of Doxology Music (admin. EMI Christian Music Publishing)',
    year: '1997',
    tags: ['worship'],
    copyrightInfo: '© 1997 Songs of Doxology Music (admin. by EMI Christian Music Publishing)',
    sections: [],
    attachments: [
      { id: 'att-because-alto', name: 'Because_of_Who_You_Are_A.pdf', kind: 'pdf', ref: '/files/Because_of_Who_You_Are_A.pdf', part: 'Alto Sax' },
    ],
  },
  {
    id: 'seed-holyking',
    title: 'Holy King Medley',
    artist: 'Unknown',
    key: 'C', bpm: 90, timeSignature: '4/4', language: 'en',
    credit: 'Holy King Medley — sax part',
    tags: ['worship', 'medley'],
    sections: [],
    attachments: [
      { id: 'att-holyking-sax', name: 'Holy_King_Medley_Sax.pdf', kind: 'pdf', ref: '/files/Holy_King_Medley_Sax.pdf', part: 'Sax' },
    ],
  },
  {
    id: 'seed-blueslicks',
    title: 'Five Blues Licks (#243)',
    artist: 'Practice Material',
    key: 'C', bpm: 120, timeSignature: '4/4', language: 'en',
    credit: '#243 Five Blues Licks — Learn Them!',
    tags: ['practice', 'licks', 'sax'],
    sections: [],
    attachments: [
      { id: 'att-licks', name: '243_Five_Blues_Licks.pdf', kind: 'pdf', ref: '/files/243_Five_Blues_Licks.pdf', part: 'Sax' },
    ],
  },
];
