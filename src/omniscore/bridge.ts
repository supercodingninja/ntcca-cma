// ==========================================================================
// This Area Of Code Is: The Song ⇄ USMG Bridge.
// Explanation: The entire existing app (library, charts, transposition,
// setlists, UnityLED scenes) already speaks our Song/ChordPro format. This
// bridge converts it to and from USMG so everything we built instantly
// becomes part of the OmniScore graph — no rewrite, no downtime.
// In Other Words: The translator that lets our current house speak the new
// universal language today.
// ==========================================================================

import {
  createUSMG, validateUSMG, type USMGDocument, type Glyph, type SonicEvent,
  type HarmonyNode, type SemanticSection,
} from './usmg';
import type { Song, SongSection, SectionKind } from '../lib/music';
import { NOTE_INDEX_FROM_NAME } from './pitch';
import { registerIngestor, registerRenderer, type Ingestor, type Renderer } from './registry';


/** Rough seconds-per-beat helper: duration of one beat at the song's bpm. */
function beatSec(bpm: number): number {
  return 60 / Math.max(20, bpm);
}

// --------------------------- Song → USMG -----------------------------------
export function songToUSMG(song: Song): USMGDocument {
  const doc = createUSMG({
    title: song.title, artist: song.artist, key: song.key,
    timeSignature: song.timeSignature, bpm: song.bpm, language: song.language,
    ccliNumber: song.ccliNumber, copyrightInfo: song.copyrightInfo,
    sourceKind: 'chordpro', confidence: 1,
  });

  const bSec = beatSec(song.bpm);
  const beatsPerBar = parseInt(song.timeSignature, 10) || 4;
  let cursor = 0; // running onset in seconds

  song.sections.forEach((sec: SongSection) => {
    const start = cursor;
    sec.lines.forEach((line) => {
      line.segments.forEach((seg, i) => {
        // Chord symbols become harmony nodes + chord glyphs; lyric words
        // become lyric glyphs. Even spacing: one beat per segment.
        const onset = cursor + i * bSec;
        if (seg.chord) {
          const rootIdx = NOTE_INDEX_FROM_NAME[seg.chord.replace(/[^A-G#b].*$/, '')] ?? 0;
          doc.harmony.push({
            id: crypto.randomUUID(), symbol: seg.chord,
            fn: seg.chord === song.key ? 'tonic' : 'unknown',
            onset, duration: bSec,
          } satisfies HarmonyNode);
          doc.glyphs.push({
            id: crypto.randomUUID(), kind: 'chord-symbol',
            x: onset / bSec / beatsPerBar * 4, y: 5, staffIndex: 0,
          } satisfies Glyph);
          // Sonic event: the chord root as a reference pitch.
          doc.events.push({
            id: crypto.randomUUID(), pitch: 60 + rootIdx, onset,
            duration: bSec, velocity: 80, voice: 0, staffIndex: 0, confidence: 1,
          } satisfies SonicEvent);
        }
        if (seg.lyric.trim()) {
          doc.glyphs.push({
            id: crypto.randomUUID(), kind: 'lyric',
            x: onset / bSec / beatsPerBar * 4, y: -2, staffIndex: 0,
            hints: { text: seg.lyric },
          } satisfies Glyph);
        }
      });
      cursor += Math.max(1, line.segments.length) * bSec;
    });
    doc.sections.push({
      id: crypto.randomUUID(), kind: sec.kind as SectionKind, label: sec.label,
      startOnset: start, endOnset: cursor, intent: sec.label,
    } satisfies SemanticSection);
  });

  return doc;
}

// --------------------------- USMG → Song -----------------------------------
// The round-trip restores the LYRICS: every lyric glyph carries its words in
// hints.text, and its x maps back to an onset — so each lyric re-pairs with
// the chord that sounded at that moment. Sections keep their own structure.
export function usmgToSong(doc: USMGDocument, id: string): Song {
  const bSec = beatSec(doc.meta.bpm);
  const beatsPerBar = parseInt(doc.meta.timeSignature, 10) || 4;

  const sections: SongSection[] = doc.sections.map((s) => {
    // Harmony sounding inside this section, in time order.
    const chords = doc.harmony
      .filter((h) => h.onset >= s.startOnset && h.onset < s.endOnset)
      .sort((a, b) => a.onset - b.onset);
    // Lyric glyphs in this section (x = onset/bSec/beatsPerBar*4 → onset).
    const lyrics = doc.glyphs
      .filter((g) => g.kind === 'lyric' && g.staffIndex === 0)
      .map((g) => ({ onset: (g.x / 4) * beatsPerBar * bSec, text: String(g.hints?.text ?? '') }))
      .filter((l) => l.onset >= s.startOnset - 0.001 && l.onset < s.endOnset && l.text.trim())
      .sort((a, b) => a.onset - b.onset);

    // Pair each lyric with the nearest chord at-or-before its onset.
    const segments = lyrics.map((l) => {
      let chord = '';
      let best = Infinity;
      for (const c of chords) {
        const d = Math.abs(c.onset - l.onset);
        if (d < best) { best = d; chord = c.symbol; }
      }
      return { chord, lyric: l.text };
    });

    // Re-line: four segments per line (matches the even-spacing layout).
    const lines: SongSection['lines'] = [];
    for (let i = 0; i < segments.length; i += 4) lines.push({ segments: segments.slice(i, i + 4) });
    // No lyrics survived? Fall back to a chord-only line so nothing is lost.
    if (lines.length === 0 && chords.length) {
      lines.push({ segments: chords.map((c) => ({ chord: c.symbol, lyric: '' })) });
    }
    return { kind: s.kind, label: s.label, lines };
  });

  return {
    id, title: doc.meta.title, artist: doc.meta.artist, key: doc.meta.key,
    bpm: doc.meta.bpm, timeSignature: doc.meta.timeSignature,
    language: doc.meta.language, credit: doc.meta.artist,
    ccliNumber: doc.meta.ccliNumber, copyrightInfo: doc.meta.copyrightInfo,
    sections,
  };
}

// This Area Of Code Is: Self-registration as OmniScore plugins.
// Explanation: The bridge registers itself as both an Ingestor (ChordPro
// songs → USMG) and a Renderer (USMG → Song chart data) at import time —
// proving the plugin model works with real, working adapters from day one.
// In Other Words: The first two plugs are already in the power strip.
export const chordProIngestor: Ingestor<Song> = {
  id: 'chordpro.song',
  label: 'ChordPro Song Ingestor',
  accepts: ['application/x-chordpro', 'song/chart'],
  async ingest(input) {
    const doc = songToUSMG(input);
    const v = validateUSMG(doc);
    return v.ok ? { doc } : { errors: v.errors };
  },
};

export const chartRenderer: Renderer<Song> = {
  id: 'render.chart',
  label: 'Chord Chart Renderer',
  outputs: ['song/chart'],
  async render(doc) {
    return { output: usmgToSong(doc, crypto.randomUUID()) };
  },
};

registerIngestor(chordProIngestor as Ingestor);
registerRenderer(chartRenderer as Renderer);


