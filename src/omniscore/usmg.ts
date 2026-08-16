// ==========================================================================
// This Area Of Code Is: The Unified Semantic Music Graph (USMG) — the open
// schema at the heart of the OmniScore engine.
// Explanation: Instead of parsing proprietary file formats (.sib, .mus,
// .dorico), OmniScore treats all music as pure multi-dimensional data. Every
// piece of music — however it arrives — becomes ONE document holding three
// dimensions at once:
//   VISUAL   — where every glyph sits on the page (engraving coordinates)
//   SONIC    — the actual sounds (MIDI-style events, time-locked audio refs)
//   SEMANTIC — what the music MEANS (harmony, sections, performance data)
// This is the "Rosetta Stone": inputs map to this single truth, and every
// output (screen, SVG, PDF, audio, UnityLED scenes) renders FROM it.
// In Other Words: One universal music language that every tool can speak.
// ==========================================================================

/** Schema version — bump on breaking changes; ingestors must check this. */
export const USMG_VERSION = 1;

// ------------------------------- VISUAL -----------------------------------
// Device-independent engraving units: 1 staff space = 1.0. Any renderer
// scales these to its viewport (phone → ultra-wide → printing press).
export interface Glyph {
  id: string;
  kind: 'note' | 'rest' | 'clef' | 'key-signature' | 'time-signature'
    | 'accidental' | 'lyric' | 'chord-symbol' | 'barline' | 'slur' | 'tie';
  x: number;          // staff-space units from staff origin
  y: number;          // staff-space units (0 = bottom line)
  staffIndex: number;
  /** Optional render hints (stem direction, beaming group, etc.) */
  hints?: Record<string, string | number | boolean>;
}

// -------------------------------- SONIC ------------------------------------
export interface SonicEvent {
  id: string;
  /** MIDI note number (69 = A4). Rest = -1. */
  pitch: number;
  /** Seconds from piece start — absolute, sample-accurate intent. */
  onset: number;
  duration: number;   // seconds
  velocity: number;   // 0–127
  voice: number;      // 0 = melody/soprano, 1..n inner/lower voices
  staffIndex: number;
  /** Confidence 0–1 from machine listening; 1 for human-authored. */
  confidence: number;
}

// ------------------------------- SEMANTIC ----------------------------------
export interface HarmonyNode {
  id: string;
  /** Roman numeral or chord symbol, e.g. "IV" or "F#m" */
  symbol: string;
  /** Harmonic function: tonic, predominant, dominant, passing… */
  fn: 'tonic' | 'predominant' | 'dominant' | 'passing' | 'unknown';
  onset: number;      // seconds
  duration: number;
}

export interface SemanticSection {
  id: string;
  kind: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tag';
  label: string;
  startOnset: number;
  endOnset: number;
  /** Why this section exists — the director's intent, free text. */
  intent?: string;
}

export interface PerformanceDatum {
  id: string;
  date: string;       // ISO
  serviceType: string;
  leadSinger?: string;
  /** Free-form feel notes: "congregation responded strongly at bridge" */
  notes?: string;
}

// ------------------------------- DOCUMENT ----------------------------------
export interface USMGMeta {
  title: string;
  artist: string;
  key: string;            // global key, e.g. "A"
  timeSignature: string;  // e.g. "4/4"
  bpm: number;
  language: string;
  ccliNumber?: string;
  copyrightInfo?: string;
  sourceKind: 'human' | 'omr' | 'acoustic' | 'midi' | 'chordpro' | 'unknown';
  /** Overall ingestion confidence 0–1 (1 = human-authored). */
  confidence: number;
}

export interface USMGDocument {
  version: number;
  meta: USMGMeta;
  glyphs: Glyph[];
  events: SonicEvent[];
  harmony: HarmonyNode[];
  sections: SemanticSection[];
  performances: PerformanceDatum[];
}

/** Create an empty, valid USMG document. */
export function createUSMG(meta: USMGMeta): USMGDocument {
  return { version: USMG_VERSION, meta, glyphs: [], events: [], harmony: [], sections: [], performances: [] };
}

// This Area Of Code Is: Schema validation.
// Explanation: Every ingestor output MUST pass this gate before entering the
// graph — a broken ingestor can never corrupt the single source of truth.
// In Other Words: The bouncer at the door of the universal language.
export function validateUSMG(doc: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const d = doc as USMGDocument;
  if (!d || typeof d !== 'object') return { ok: false, errors: ['Not an object'] };
  if (d.version !== USMG_VERSION) errors.push(`version must be ${USMG_VERSION}`);
  if (!d.meta?.title) errors.push('meta.title required');
  if (!Array.isArray(d.glyphs)) errors.push('glyphs must be an array');
  if (!Array.isArray(d.events)) errors.push('events must be an array');
  (d.events ?? []).forEach((e, i) => {
    if (typeof e.pitch !== 'number' || e.pitch < -1 || e.pitch > 127)
      errors.push(`events[${i}].pitch out of range`);
    if (e.onset < 0) errors.push(`events[${i}].onset negative`);
    if (e.confidence < 0 || e.confidence > 1)
      errors.push(`events[${i}].confidence out of 0–1`);
  });
  return { ok: errors.length === 0, errors };
}
