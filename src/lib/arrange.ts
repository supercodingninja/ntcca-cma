// ==========================================================================
// This Area Of Code Is: The Director's Arrangement Board.
// Explanation: The director presses the voice types he has — with COUNTS
// ("I have this many basses, this many altos") — picks his instruments,
// and the app assigns parts and AUTO-TRANSPOSES for every transposing
// instrument (B♭ clarinet/trumpet/tenor sax, E♭ alto/bari sax, F horn).
// Then the director can OVERRIDE anything: swap a part to a better
// instrument, move an alto line to a soprano solo — and the app
// re-transposes instantly. So easy you could do it.
// In Other Words: Say who showed up; get a finished chart. Don't like a
// choice? Tap it — it moves.
// ==========================================================================

import { transposeChord, TRANSPOSITION_UP } from './music';

// Transposing instruments: how many semitones the WRITTEN note sits above
// the concert note (a B♭ trumpet's written C sounds B♭ → written = +2).
// The offsets come from the ONE canonical table in music.ts — no drift.
export interface TransposingInstrument {
  name: string;
  transposition: 'concert' | 'Bb' | 'Eb' | 'F' | 'G';
  semitonesUp: number;      // add to concert pitch to get the written pitch
  family: string;
}

type TransKey = TransposingInstrument['transposition'];
const UP: Record<TransKey, number> = {
  concert: TRANSPOSITION_UP.C, Bb: TRANSPOSITION_UP.Bb, Eb: TRANSPOSITION_UP.Eb,
  F: TRANSPOSITION_UP.F, G: TRANSPOSITION_UP.G,
};
const row = (name: string, transposition: TransKey, family: string): TransposingInstrument =>
  ({ name, transposition, semitonesUp: UP[transposition], family });

export const ARRANGEMENT_INSTRUMENTS: TransposingInstrument[] = [
  row('Piano / Keys', 'concert', 'Keys'),
  row('Organ', 'concert', 'Keys'),
  row('Acoustic Guitar', 'concert', 'Strings'),
  row('Electric Guitar', 'concert', 'Strings'),
  row('Bass Guitar', 'concert', 'Strings'),
  row('Violin', 'concert', 'Strings'),
  row('Viola', 'concert', 'Strings'),
  row('Cello', 'concert', 'Strings'),
  row('Flute', 'concert', 'Wind'),
  row('Oboe', 'concert', 'Wind'),
  row('Bassoon', 'concert', 'Wind'),
  row('Trombone', 'concert', 'Wind'),
  row('Tuba / Sousaphone', 'concert', 'Wind'),
  row('Clarinet (B♭)', 'Bb', 'Wind'),
  row('Trumpet (B♭)', 'Bb', 'Wind'),
  row('Tenor Sax (B♭)', 'Bb', 'Wind'),
  row('Soprano Sax (B♭)', 'Bb', 'Wind'),
  row('Alto Sax (E♭)', 'Eb', 'Wind'),
  row('Baritone Sax (E♭)', 'Eb', 'Wind'),
  row('French Horn (F)', 'F', 'Wind'),
  row('Piccolo (G)', 'G', 'Wind'),
  row('Drum Kit', 'concert', 'Percussion'),
  row('Congas / Percussion', 'concert', 'Percussion'),
];

export const ARRANGEMENT_VOICES = ['Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'] as const;
export type ArrangementVoice = (typeof ARRANGEMENT_VOICES)[number];

// One assignment: a musical part, who plays/sings it, and the written key
// the app computes for them. The director may swap the assignee freely.
export interface ArrangementPart {
  id: string;
  part: string;                // 'Melody', 'Harmony', 'Bass line', 'Chords'…
  assignedTo: string;          // instrument name or voice type
  kind: 'voice' | 'instrument';
  solo: boolean;
}

export interface Arrangement {
  songId: string;
  concertKey: string;
  voiceCounts: Record<string, number>;
  parts: ArrangementPart[];
  ts: number;
}

const uid = () => `ar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const keyFor = (songId: string) => `ntcc.arrange.${songId}`;

export function loadArrangement(songId: string): Arrangement | null {
  try {
    const raw = localStorage.getItem(keyFor(songId));
    if (raw) return JSON.parse(raw) as Arrangement;
  } catch { /* fall through */ }
  return null;
}

export function saveArrangement(a: Arrangement): void {
  localStorage.setItem(keyFor(a.songId), JSON.stringify({ ...a, ts: Date.now() }));
}

/* ------------------------- The auto-arranger ---------------------------- */
// Given who showed up (voice counts + instruments) and the song's key,
// build a sensible starting arrangement. Every choice is just a suggestion
// — the director can override ANY of it.
export function autoArrange(
  songId: string,
  concertKey: string,
  voiceCounts: Record<string, number>,
  instruments: string[],
): Arrangement {
  const parts: ArrangementPart[] = [];

  // Voices: strongest section takes the melody; if a section is thin, the
  // app doubles the melody there instead of handing it a fragile harmony.
  const sorted = ARRANGEMENT_VOICES
    .filter((v) => (voiceCounts[v] ?? 0) > 0)
    .sort((a, b) => (voiceCounts[b] ?? 0) - (voiceCounts[a] ?? 0));
  sorted.forEach((v, i) => {
    const count = voiceCounts[v] ?? 0;
    const weak = count <= 2;
    parts.push({
      id: uid(),
      part: i === 0 ? 'Lead melody' : weak ? 'Double the melody (small section)' : `Harmony ${i}`,
      assignedTo: v, kind: 'voice', solo: false,
    });
  });

  // Instruments: keys carry chords, bass carries the bass line, wind takes
  // melody doubles / counter lines by family.
  instruments.forEach((name, i) => {
    const inst = ARRANGEMENT_INSTRUMENTS.find((x) => x.name === name);
    const fam = inst?.family ?? 'Wind';
    const part =
      fam === 'Keys' ? 'Chords & rhythm foundation' :
      name.includes('Bass') || name.includes('Tuba') || name.includes('Cello') ? 'Bass line' :
      fam === 'Percussion' ? 'Groove & time' :
      i % 2 === 0 ? 'Melody double' : 'Counter harmony';
    parts.push({ id: uid(), part, assignedTo: name, kind: 'instrument', solo: false });
  });

  return { songId, concertKey, voiceCounts, parts, ts: Date.now() };
}

// Swap a part to a different assignee (alto line → soprano solo, sousaphone
// line → a better instrument). The written key re-computes on render.
export function reassignPart(a: Arrangement, partId: string, newAssignee: string, solo = false): Arrangement {
  const inst = ARRANGEMENT_INSTRUMENTS.find((x) => x.name === newAssignee);
  const kind: 'voice' | 'instrument' = inst ? 'instrument' : 'voice';
  const out = {
    ...a,
    parts: a.parts.map((p) => (p.id === partId ? { ...p, assignedTo: newAssignee, kind, solo } : p)),
  };
  saveArrangement(out);
  return out;
}

// The written key for whoever holds a part: voices and concert instruments
// stay in concert pitch; transposing instruments get their own key.
export function writtenKeyFor(concertKey: string, assignee: string): { key: string; label: string } {
  const inst = ARRANGEMENT_INSTRUMENTS.find((x) => x.name === assignee);
  if (!inst || inst.semitonesUp === 0) return { key: concertKey, label: 'concert pitch' };
  return {
    key: transposeChord(concertKey, inst.semitonesUp, inst.transposition === 'Eb'),
    label: `${inst.transposition} transposition — written a ${inst.transposition === 'Bb' ? 'whole step' : inst.transposition === 'Eb' ? 'major 6th' : 'perfect 5th'} up`,
  };
}
