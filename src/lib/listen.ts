// ==========================================================================
// This Area Of Code Is: The Ear — on-device song recognition (Find-a-Way).
// Explanation: No Shazam, no licensed service, no server. The device IS the
// server: the mic feeds the Web Audio FFT; we fold the spectrum into a
// 12-bin chromagram, template-match chords (maj/min/7/m7/sus/dim/aug across
// all 12 roots), name the key with Krumhansl-Schmuckler profiles, estimate
// BPM from onset-energy autocorrelation, and IDENTIFY the song by matching
// the live chroma/chord trail against the chord charts in OUR library —
// then the credits ("Originally performed by…", label, publisher, CCLI)
// surface automatically. Nothing leaves the device. Ever.
// In Other Words: Your phone listens, figures out the song, the key, the
// chords and the tempo — by itself — and honors the people who made it.
// ==========================================================================

export type ChordQuality = 'maj' | 'min' | '7' | 'm7' | 'maj7' | 'sus4' | 'sus2' | 'dim' | 'aug';

import { getMicStream, runningAudioContext } from './mic';
import { estimateKeyFromChroma } from './keyProfile';

export interface ParsedChord {
  root: number;            // 0=C … 11=B
  quality: ChordQuality;
  pitchClasses: number[];  // pitch classes sounding in this chord
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS: Record<string, number> = { 'C': 0, 'D♭': 1, 'D': 2, 'E♭': 3, 'E': 4, 'F': 5, 'G♭': 6, 'G': 7, 'A♭': 8, 'A': 9, 'B♭': 10, 'B': 11 };
const SHARPS: Record<string, number> = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

export function noteName(pc: number, preferFlats = false): string {
  const flats = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  return preferFlats ? flats[pc % 12] : NOTE_NAMES[pc % 12];
}

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};

/** Parse a chord symbol like "Bbmaj7", "F#m7", "Gsus4", "C/E" → pitch classes. */
export function parseChordSymbol(sym: string): ParsedChord | null {
  const s = sym.trim().split('/')[0]; // drop slash-bass
  if (!s) return null;
  const m = s.match(/^([A-Ga-g])([#♭b]?)(.*)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2] === '#' ? '#' : (m[2] === '♭' || m[2] === 'b') ? '♭' : '';
  const rootName = letter + acc;
  const root = acc === '#' ? SHARPS[rootName] : acc === '♭' ? FLATS[rootName] : SHARPS[letter];
  if (root === undefined) return null;
  const tail = m[3].toLowerCase();
  let quality: ChordQuality = 'maj';
  if (/^maj7|^ma7|^Δ7/.test(tail)) quality = 'maj7';
  else if (/^(m|min)(?!aj)/.test(tail) && /7/.test(tail)) quality = 'm7';
  else if (/^(m|min)(?!aj)/.test(tail)) quality = 'min';
  else if (/^sus2/.test(tail)) quality = 'sus2';
  else if (/^sus/.test(tail)) quality = 'sus4';
  else if (/^(dim|°)/.test(tail)) quality = 'dim';
  else if (/^(aug|\+)/.test(tail)) quality = 'aug';
  else if (/^7/.test(tail)) quality = '7';
  const pitchClasses = QUALITY_INTERVALS[quality].map((i) => (root + i) % 12);
  return { root, quality, pitchClasses };
}

// ---- Chord templates for matching the live chromagram ----
interface ChordTemplate { root: number; quality: ChordQuality; vec: number[]; label: string }
const TEMPLATES: ChordTemplate[] = (() => {
  const out: ChordTemplate[] = [];
  const quals: ChordQuality[] = ['maj', 'min', '7', 'm7', 'sus4', 'dim', 'aug'];
  for (let root = 0; root < 12; root++) {
    for (const q of quals) {
      const vec = new Array(12).fill(0);
      QUALITY_INTERVALS[q].forEach((i) => { vec[(root + i) % 12] = 1; });
      const suffix = q === 'maj' ? '' : q === 'min' ? 'm' : q;
      out.push({ root, quality: q, vec, label: noteName(root) + suffix });
    }
  }
  return out;
})();

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Best-matching chord for one chromagram frame. */
export function matchChord(chroma: number[]): { label: string; root: number; quality: ChordQuality; confidence: number } | null {
  const energy = chroma.reduce((a, b) => a + b, 0);
  if (energy < 0.01) return null; // silence
  let best: ChordTemplate | null = null; let bestScore = 0;
  for (const t of TEMPLATES) {
    const s = cosine(chroma, t.vec);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  if (!best || bestScore < 0.62) return null;
  return { label: best.label, root: best.root, quality: best.quality, confidence: bestScore };
}

// ---- Key estimation: the SHARED Krumhansl-Schmuckler judge ----
// One implementation for the whole app (see ./keyProfile) — the Ear and the
// file analyzer can never disagree about the same music again.
export function estimateKey(avgChroma: number[]): { key: string; mode: 'major' | 'minor'; confidence: number } | null {
  const est = estimateKeyFromChroma(avgChroma);
  return est && est.confidence > 0 ? est : null;
}

/** BPM from an onset-energy envelope via autocorrelation (60–200 BPM). */
export function estimateBpm(onset: number[], fps: number): number | null {
  if (onset.length < fps * 4) return null;
  const minLag = Math.round((60 / 200) * fps);
  const maxLag = Math.round((60 / 60) * fps);
  let bestLag = 0, bestVal = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, onset.length - 1); lag++) {
    let v = 0;
    for (let i = 0; i + lag < onset.length; i++) v += onset[i] * onset[i + lag];
    if (v > bestVal) { bestVal = v; bestLag = lag; }
  }
  return bestLag ? Math.round((60 * fps) / bestLag) : null;
}

// ==========================================================================
// The Listener — mic → chromagram ring buffer → live chord/key/bpm → match
// against the library's chord charts → credits.
// ==========================================================================

export interface ListenFrame {
  chord: string | null;
  chordConfidence: number;
  key: string | null;      // e.g. "G major"
  bpm: number | null;
}

export interface LibraryRef {
  id: string;
  title: string;
  chromaMean: number[];    // average chroma of the song's chord chart
  chordTrail: string[];    // chord labels in order
}

/** Build a reference fingerprint from a song's own chord chart. */
export function buildReference(id: string, title: string, chordSymbols: string[]): LibraryRef {
  const chromaMean = new Array(12).fill(0);
  const chordTrail: string[] = [];
  for (const sym of chordSymbols) {
    const pc = parseChordSymbol(sym);
    if (!pc) continue;
    pc.pitchClasses.forEach((p) => { chromaMean[p] += 1; });
    chordTrail.push(noteName(pc.root) + (pc.quality === 'maj' ? '' : pc.quality === 'min' ? 'm' : pc.quality));
  }
  return { id, title, chromaMean, chordTrail };
}

/** Score the live trail against one library song (0..1). */
export function scoreMatch(avgChroma: number[], trail: string[], ref: LibraryRef): number {
  const chromaScore = cosine(avgChroma, ref.chromaMean);
  // chord-trail overlap: how many of the live chords appear in the chart
  let overlap = 0;
  const set = new Set(ref.chordTrail);
  for (const c of trail) if (set.has(c)) overlap++;
  const trailScore = trail.length ? overlap / trail.length : 0;
  return chromaScore * 0.55 + trailScore * 0.45;
}

export interface ListenMatch { id: string; title: string; score: number }

export class EarEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private chromaSum = new Array(12).fill(0);
  private frames = 0;
  private chordTrail: string[] = [];
  private lastChord: string | null = null;
  private onset: number[] = [];
  private lastEnergy = 0;
  private onsetClock = 0;

  get trail(): string[] { return [...this.chordTrail]; }
  get averageChroma(): number[] {
    return this.frames ? this.chromaSum.map((v) => v / this.frames) : [...this.chromaSum];
  }

  async start(onFrame: (f: ListenFrame) => void): Promise<void> {
    this.stream = await getMicStream({ echoCancellation: false, noiseSuppression: false, autoGainControl: true });
    this.ctx = await runningAudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.5;
    src.connect(this.analyser);
    const spectrum = new Float32Array(this.analyser.frequencyBinCount);
    const fps = 15; // analysis frames per second
    let lastTick = 0;

    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (!this.analyser || now - lastTick < 1000 / fps) return;
      lastTick = now;
      this.analyser.getFloatFrequencyData(spectrum);
      const binHz = this.ctx!.sampleRate / this.analyser.fftSize;
      const chroma = new Array(12).fill(0);
      let energy = 0;
      for (let i = 1; i < spectrum.length; i++) {
        const hz = i * binHz;
        if (hz < 55 || hz > 4000) continue;
        const mag = Math.pow(10, spectrum[i] / 20); // dB → linear
        energy += mag;
        const midi = Math.round(69 + 12 * Math.log2(hz / 440));
        chroma[((midi % 12) + 12) % 12] += mag;
      }
      // onset envelope for BPM
      const flux = Math.max(0, energy - this.lastEnergy);
      this.lastEnergy = energy;
      this.onset.push(flux);
      if (this.onset.length > fps * 30) this.onset.shift();
      this.onsetClock++;
      // accumulate
      this.frames++;
      for (let i = 0; i < 12; i++) this.chromaSum[i] += chroma[i];
      // live chord
      const chord = matchChord(chroma);
      if (chord && chord.label !== this.lastChord) {
        this.chordTrail.push(chord.label);
        if (this.chordTrail.length > 64) this.chordTrail.shift();
        this.lastChord = chord.label;
      }
      const keyEst = estimateKey(this.averageChroma);
      onFrame({
        chord: chord?.label ?? null,
        chordConfidence: chord?.confidence ?? 0,
        key: keyEst ? `${keyEst.key} ${keyEst.mode}` : null,
        bpm: estimateBpm(this.onset, fps),
      });
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Identify against the library right now. */
  identify(refs: LibraryRef[]): ListenMatch | null {
    if (!this.chordTrail.length && this.frames < 30) return null;
    let best: ListenMatch | null = null;
    for (const ref of refs) {
      const score = scoreMatch(this.averageChroma, this.chordTrail, ref);
      if (!best || score > best.score) best = { id: ref.id, title: ref.title, score };
    }
    return best && best.score >= 0.45 ? best : null;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null; this.ctx = null; this.analyser = null;
  }
}
