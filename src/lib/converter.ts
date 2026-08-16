// ==========================================================================
// This Area Of Code Is: The Universal Music Reader bridge (.sib, .musicxml,
// .mus, MuseScore) — LEGAL by design, no reverse engineering.
// Explanation: We never crack proprietary binaries ourselves. Two legal
// paths:
//   1. MusicXML (.musicxml/.xml/.mxl) — an OPEN standard; parsed right here
//      in the browser with the built-in XML parser.
//   2. Proprietary files (.sib, .mus, .mscz) — sent to OUR OWN conversion
//      service (the Render converter), which uses licensed tools (MuseScore)
//      to produce MusicXML, then parsed by path 1.
// The parsed result becomes a Song in the library: title, composer, key,
// tempo, time signature — with a chord chart scaffold ready for the editor.
// In Other Words: Any sheet music file, from any program, becomes a song
// in our app — through the front door, never the window.
// ==========================================================================

import { type Song } from './music';
import { chartToSections } from './songs';

const CONVERTER_URL = 'https://ntcc-music-converter.onrender.com/convert';
const CONVERTER_BASE = 'https://ntcc-music-converter.onrender.com/';

export type ConvertStatus = (msg: string) => void;

// This Area Of Code Is: The converter wake-up protocol.
// Explanation: The free Render server sleeps when idle, and a sleeping
// server used to mean a failed import. Not anymore: I ping it, and if it
// doesn't answer I keep knocking — every 5 seconds, for up to a minute —
// while telling the user exactly what's happening ("Waking the converter…
// attempt 3"). Once it answers, the file converts immediately, and if the
// conversion itself hiccups I retry once more automatically. The user
// never has to guess or manually "try again in 30 seconds."
async function wakeConverter(status: ConvertStatus): Promise<boolean> {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      status(attempt === 1 ? '🔌 Contacting the converter…' : `⏳ Waking the converter… (attempt ${attempt})`);
      const res = await fetch(CONVERTER_BASE, { method: 'GET', mode: 'cors' });
      if (res.ok || res.status === 404) return true; // any HTTP answer means it's awake
    } catch {
      // still asleep — knock again
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

export interface ConvertResult {
  ok: boolean;
  song?: Song;
  error?: string;
  usedConverter?: boolean;
}

/** Parse MusicXML text into a Song (metadata + structure). */
export function parseMusicXML(xmlText: string, filename: string): Song {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid MusicXML file');

  const text = (sel: string, scope: ParentNode = doc): string =>
    scope.querySelector(sel)?.textContent?.trim() ?? '';

  const title = text('work-title') || text('movement-title')
    || filename.replace(/\.[^.]+$/, '');
  const composer = text('creator[type="composer"]') || 'Unknown';

  // First-part attributes: key (fifths), time signature, tempo.
  const fifths = parseInt(text('key fifths') || '0', 10);
  const KEYS_BY_FIFTHS = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
  const key = KEYS_BY_FIFTHS[Math.max(0, Math.min(14, fifths + 7))] ?? 'C';
  const beats = text('time beats') || '4';
  const beatType = text('time beat-type') || '4';
  const soundTempo = parseFloat(doc.querySelector('sound[tempo]')?.getAttribute('tempo') ?? '');
  const perMinute = parseFloat(text('per-minute'));
  const bpm = Math.round(Number.isFinite(soundTempo) ? soundTempo : (Number.isFinite(perMinute) ? perMinute : 90));

  // Build a chart scaffold: measure count per section, harmony from
  // <harmony> chord symbols when present.
  const measures = [...doc.querySelectorAll('measure')];
  const chords: string[] = [];
  measures.forEach((m) => {
    const h = m.querySelector('harmony root root-step');
    if (h) chords.push(`[${h.textContent?.trim() ?? ''}${text('harmony kind', m) === 'minor' ? 'm' : ''}]`);
  });
  const chart = chords.length > 0
    ? `{Verse 1}\n${chords.join(' ')}\n// ${measures.length} measures imported`
    : `{Verse 1}\n// ${measures.length} measures imported from ${filename}\n// Open the editor to add chord symbols.`;

  return {
    id: crypto.randomUUID(),
    title, artist: composer, key, bpm,
    timeSignature: `${beats}/${beatType}`,
    language: 'en', credit: `Imported from ${filename}`,
    sections: chartToSections(chart),
  };
}

/** Convert any supported file to a Song. Reports progress via `status`. */
export async function importMusicFile(file: File, status: ConvertStatus = () => {}): Promise<ConvertResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  // Path 1 — open standard, parsed in-browser.
  if (['musicxml', 'xml', 'mxl'].includes(ext)) {
    try {
      status('📖 Reading MusicXML…');
      const text = await file.text();
      return { ok: true, song: parseMusicXML(text, file.name) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // Path 2 — proprietary formats through OUR converter service,
  // with the full wake-up protocol and one automatic retry.
  if (['sib', 'mus', 'mscz', 'mscx'].includes(ext)) {
    const awake = await wakeConverter(status);
    if (!awake) {
      return {
        ok: false, usedConverter: true,
        error: 'The converter did not wake up after a minute of trying. Your file is still saved on this song — try the import again later.',
      };
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        status(attempt === 1 ? '🎼 Converting to MusicXML…' : '🎼 Retrying the conversion…');
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(CONVERTER_URL, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`converter answered ${res.status}`);
        const xml = await res.text();
        return { ok: true, song: parseMusicXML(xml, file.name), usedConverter: true };
      } catch (err) {
        if (attempt === 2) {
          return {
            ok: false, usedConverter: true,
            error: `Conversion failed twice (${err instanceof Error ? err.message : 'unknown'}). Your original file is still attached to the song — nothing is lost.`,
          };
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  return { ok: false, error: `".${ext}" can't be read as sheet music — but it has been attached to the song anyway.` };
}
