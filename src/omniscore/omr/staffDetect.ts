// ==========================================================================
// This Area Of Code Is: OMR Stage 1 — Staff-Line Detection (perceptual
// ingestion; we READ PIXELS like a human, never proprietary file formats).
// Explanation: A photo or PDF page of sheet music is drawn to a canvas,
// converted to grayscale, and scanned row by row (horizontal projection
// profile). Rows that are mostly dark are staff lines; five lines grouped
// together make a staff. The result lands in USMG as engraving metadata —
// the foundation every later OMR stage (symbols, VLM refinement) builds on.
// In Other Words: The app finds the lines of the music paper first, exactly
// like your eyes do before you read the notes.
// ==========================================================================

import { createUSMG } from '../usmg';
import { registerIngestor, type Ingestor } from '../registry';

export interface StaffSystem {
  /** y-coordinates of the 5 staff lines, in pixels */
  lines: number[];
  /** staff-space in pixels (distance between adjacent lines) */
  spacePx: number;
}

export interface OMRStage1Result {
  width: number;
  height: number;
  systems: StaffSystem[];
  confidence: number;
}

/** Draw the source to canvas and return grayscale pixel data.
    (Exported so Stage 2 — symbol recognition — reads the same pixels.) */
export async function toGray(src: string, maxW = 1200): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114) | 0;
  }
  return { data: gray, width: w, height: h };
}

/** Horizontal projection: for each row, fraction of dark pixels.
    (Exported for Stage 2.) */
export function projection(gray: Uint8ClampedArray, w: number, h: number, threshold = 128): Float32Array {
  const prof = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let dark = 0;
    for (let x = 0; x < w; x++) if (gray[y * w + x] < threshold) dark++;
    prof[y] = dark / w;
  }
  return prof;
}

/** Peak-pick rows where darkness covers most of the width (staff lines span it).
    Real staff lines are 2–5 px thick (and antialiased in photos), so we find
    the whole RUN of dark rows and record its CENTER — one entry per line.
    (Exported for Stage 2.) */
export function detectSystems(prof: Float32Array): StaffSystem[] {
  const rows: number[] = [];
  let runStart = -1;
  for (let y = 0; y < prof.length; y++) {
    if (prof[y] > 0.45) {
      if (runStart < 0) runStart = y;
    } else if (runStart >= 0) {
      rows.push(Math.round((runStart + y - 1) / 2)); // center of the thick line
      runStart = -1;
    }
  }
  if (runStart >= 0) rows.push(Math.round((runStart + prof.length - 1) / 2));
  // Group into systems of 5 lines with consistent spacing.
  const systems: StaffSystem[] = [];
  for (let i = 0; i + 4 < rows.length; i++) {
    const five = rows.slice(i, i + 5);
    const gaps = five.slice(1).map((v, j) => v - five[j]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const consistent = gaps.every((g) => Math.abs(g - avg) <= avg * 0.5);
    if (consistent && avg >= 4) {
      systems.push({ lines: five, spacePx: avg });
      i += 4; // skip past this system
    }
  }
  return systems;
}

// This Area Of Code Is: The OMR Stage-1 Ingestor plugin.
// Explanation: Registered as "omr.staff1" in the OmniScore registry. Feed it
// an image (data URL or object URL of a photo/PDF page) and it returns a
// USMG document whose metadata records the detected staff systems — later
// stages add symbols and semantics onto this skeleton.
export async function analyzeSheetImage(src: string): Promise<OMRStage1Result> {
  const { data, width, height } = await toGray(src);
  const systems = detectSystems(projection(data, width, height));
  const confidence = systems.length > 0 ? Math.min(0.95, 0.5 + systems.length * 0.1) : 0;
  return { width, height, systems, confidence };
}

const omrStage1: Ingestor<string> = {
  id: 'omr.staff1',
  label: 'OMR Stage 1 — Staff Detection',
  accepts: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf-page'],
  async ingest(src) {
    const result = await analyzeSheetImage(src);
    if (result.systems.length === 0) {
      return { errors: ['No staff systems detected — try a clearer, flatter photo.'] };
    }
    const doc = createUSMG({
      title: 'Scanned sheet', artist: 'Unknown', key: 'C',
      timeSignature: '4/4', bpm: 90, language: 'en',
      sourceKind: 'omr', confidence: result.confidence,
    });
    // Engraving metadata: each staff line becomes a barline-anchored glyph
    // skeleton later stages populate with notes.
    result.systems.forEach((sys, si) => {
      sys.lines.forEach((y, li) => {
        doc.glyphs.push({
          id: crypto.randomUUID(), kind: 'barline',
          x: li, y: y / sys.spacePx, staffIndex: si,
          hints: { staffLine: true, pixelY: y },
        });
      });
    });
    return { doc };
  },
};

registerIngestor(omrStage1 as Ingestor);
