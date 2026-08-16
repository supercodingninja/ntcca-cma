// ==========================================================================
// This Area Of Code Is: OMR Stage 2 — Note Recognition (symbol detection).
// Explanation: Stage 1 found the staff lines. Stage 2 erases those lines,
// then hunts for filled note-heads: dark blobs about one staff-space tall.
// Each head's center gives a PITCH (how high it sits against the staff) and
// an ONSET (how far right it sits = when it sounds). The pitch-class
// histogram of all heads goes through our shared Krumhansl judge to name
// the song's key.
// In Other Words: The app reads the dots on the page and tells you the
// notes, the melody, and the key — from a phone photo of sheet music.
// ==========================================================================

import { NOTE_NAMES } from '../pitch';
import { estimateKeyFromChroma } from '../../lib/keyProfile';
import { toGray, projection, detectSystems, type StaffSystem } from './staffDetect';

export interface ScannedNote {
  /** MIDI pitch (treble staff, bottom line = E4 = 64) */
  midi: number;
  /** Spelled name e.g. "G#4" */
  name: string;
  /** Horizontal position in staff-spaces (melody order) */
  x: number;
  /** Staff step: 0 = bottom line (E4), 1 = first space (F4), … */
  step: number;
  systemIndex: number;
}

export interface OMRStage2Result {
  systems: StaffSystem[];
  notes: ScannedNote[];
  /** Estimated key e.g. "G" or "E minor", null when too few notes */
  key: string | null;
  keyConfidence: number;
  confidence: number;
}

/** Diatonic semitone offsets above E (the treble staff's bottom line). */
const DIATONIC_FROM_E = [0, 1, 3, 5, 7, 8, 10]; // E F G A B C D

interface Blob { minX: number; maxX: number; minY: number; maxY: number; px: number }

/**
 * Connected-component labeling inside one horizontal band of the image,
 * on the staff-line-ERASED binary picture. A note-head survives erasure as
 * two arcs (above/below the erased line) — we rejoin fragments that sit in
 * the same column range, which is what the `colScan` merge below does.
 */
function blobsInBand(
  bin: Uint8Array, w: number, y0: number, y1: number,
): Blob[] {
  const h = y1 - y0;
  const label = new Int32Array(w * h).fill(-1);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let sy = 0; sy < h; sy++) {
    for (let x = 0; x < w; x++) {
      const idx = sy * w + x;
      // bin is band-relative: row 0 of bin IS image row y0.
      if (bin[sy * w + x] !== 1 || label[idx] !== -1) continue;
      // Flood fill this component.
      const id = blobs.length;
      const b: Blob = { minX: x, maxX: x, minY: sy, maxY: sy, px: 0 };
      stack.push(idx);
      label[idx] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        const cy = (cur / w) | 0, cx = cur % w;
        b.px++;
        if (cx < b.minX) b.minX = cx;
        if (cx > b.maxX) b.maxX = cx;
        if (cy < b.minY) b.minY = cy;
        if (cy > b.maxY) b.maxY = cy;
        // 8-connectivity
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (bin[ny * w + nx] === 1 && label[ni] === -1) {
              label[ni] = id;
              stack.push(ni);
            }
          }
        }
      }
      blobs.push(b);
    }
  }
  return blobs;
}

/** Detect filled note-heads within one staff system. */
function headsInSystem(
  gray: Uint8ClampedArray, w: number, h: number, sys: StaffSystem, systemIndex: number,
): ScannedNote[] {
  const sp = sys.spacePx;
  // The band: two spaces above the top line to two below the bottom line.
  const y0 = Math.max(0, Math.floor(sys.lines[0] - 2.5 * sp));
  const y1 = Math.min(h, Math.ceil(sys.lines[4] + 2.5 * sp));

  // Binarize adaptively: dark = below the local mean of the band.
  let sum = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) sum += gray[y * w + x];
  const mean = sum / ((y1 - y0) * w);
  const thr = Math.min(150, mean * 0.72);

  const bin = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      bin[(y - y0) * w + x] = gray[y * w + x] < thr ? 1 : 0;
    }
  }

  // Erase the staff lines (±2 px — real lines are 2–5 px thick; erasing only
  // ±1 leaves a surviving line-row that welds every head into one giant blob).
  sys.lines.forEach((ly) => {
    for (let dy = -2; dy <= 2; dy++) {
      const y = ly + dy;
      if (y < y0 || y >= y1) continue;
      for (let x = 0; x < w; x++) bin[(y - y0) * w + x] = 0;
    }
  });

  const blobs = blobsInBand(bin, w, y0, y1);

  // MERGE FIRST, filter second: erasing a staff line splits the note-head
  // that sat on it into two arcs — each too small to pass the head filter on
  // its own. Rejoin column-aligned fragments (small vertical gap), THEN
  // measure. (Filtering first threw the fragments away and line-notes
  // vanished — found the hard way.)
  const mergeable = blobs.filter((b) => {
    const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
    return bh <= sp * 2.2 && bw <= sp * 2.4 && b.px >= sp;
  });
  const merged: Blob[] = [];
  const used = new Array<boolean>(mergeable.length).fill(false);
  for (let i = 0; i < mergeable.length; i++) {
    if (used[i]) continue;
    let b = mergeable[i];
    for (let j = i + 1; j < mergeable.length; j++) {
      if (used[j]) continue;
      const o = mergeable[j];
      const xOverlap = Math.min(b.maxX, o.maxX) - Math.max(b.minX, o.minX);
      const sameColumn = xOverlap >= (Math.min(b.maxX - b.minX, o.maxX - o.minX) + 1) * 0.6;
      const gap = o.minY - b.maxY;
      // ±2 px erasure leaves up to a 5-row gap between a head's two arcs.
      if (sameColumn && gap >= -1 && gap <= 6) {
        b = {
          minX: Math.min(b.minX, o.minX), maxX: Math.max(b.maxX, o.maxX),
          minY: Math.min(b.minY, o.minY), maxY: Math.max(b.maxY, o.maxY),
          px: b.px + o.px,
        };
        used[j] = true;
      }
    }
    used[i] = true;
    merged.push(b);
  }

  // NOW the head filter: height ≈ 0.7–1.7 spaces, width ≈ 0.7–2.0 spaces,
  // fairly filled — anything else is a stem sliver, beam, or letter.
  const heads = merged.filter((b) => {
    const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
    const fill = b.px / (bw * bh);
    return bh >= sp * 0.7 && bh <= sp * 1.7 && bw >= sp * 0.7 && bw <= sp * 2.0 && fill >= 0.35;
  });

  // Center → staff step → pitch. Step 0 = bottom line (E4).
  const bottomLine = sys.lines[4];
  return heads
    .map((b) => {
      const cx = (b.minX + b.maxX) / 2;
      const cy = y0 + (b.minY + b.maxY) / 2;
      const step = Math.round((bottomLine - cy) / (sp / 2));
      if (step < -4 || step > 12) return null; // outside sane ledger range
      const octave = Math.floor(step / 7);
      const deg = ((step % 7) + 7) % 7;
      const midi = 64 + octave * 12 + DIATONIC_FROM_E[deg];
      const name = `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
      return { midi, name, x: cx / sp, step, systemIndex };
    })
    .filter((n): n is ScannedNote => n !== null)
    .sort((a, b) => a.x - b.x);
}

/**
 * Read a photo of sheet music: staves → note-heads → melody + key.
 * This is the completion of the OmniScore perceptual path — pixels to notes.
 */
export async function analyzeSheetSymbols(src: string): Promise<OMRStage2Result> {
  const { data, width, height } = await toGray(src);
  const systems = detectSystems(projection(data, width, height));
  if (systems.length === 0) {
    return { systems, notes: [], key: null, keyConfidence: 0, confidence: 0 };
  }

  const notes = systems.flatMap((sys, si) => headsInSystem(data, width, height, sys, si));

  // Key: pitch-class histogram through the ONE shared Krumhansl judge.
  let key: string | null = null;
  let keyConfidence = 0;
  if (notes.length >= 4) {
    const chroma = new Array<number>(12).fill(0);
    notes.forEach((n) => { chroma[n.midi % 12]++; });
    const est = estimateKeyFromChroma(chroma);
    if (est) {
      key = est.mode === 'minor' ? `${est.key} minor` : est.key;
      keyConfidence = Math.max(0, Math.min(1, (est.confidence + 1) / 2));
    }
  }

  // Confidence: heads per system is a healthy density (a real system of
  // melody has 8+ heads; photos lose some).
  const density = notes.length / systems.length;
  const confidence = Math.min(0.95, 0.3 + density * 0.05 + keyConfidence * 0.2);
  return { systems, notes, key, keyConfidence, confidence };
}
