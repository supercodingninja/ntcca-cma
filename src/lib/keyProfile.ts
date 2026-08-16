// ==========================================================================
// This Area Of Code Is: THE key-estimation engine — one copy for the app.
// Explanation: Krumhansl-Schmuckler key detection (published, open research)
// used to live in TWO places (audio-file analysis AND the live Ear), scored
// two different ways (Pearson vs cosine), so the same song could get two
// different answers. Now both engines import this single implementation.
// In Other Words: One judge decides what key the music is in.
// ==========================================================================

import { NOTE_NAMES } from '../omniscore/pitch';

/** Krumhansl-Schmuckler tonal profiles. */
export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Pearson correlation between two equal-length series. */
export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

export interface KeyEstimate {
  key: string;                       // root name, e.g. "A" or "F#"
  mode: 'major' | 'minor';
  confidence: number;                // Pearson correlation of the winner, -1..1
}

/**
 * Estimate the key from an averaged 12-bin chromagram.
 * Chroma bins are pitch classes C..B; we correlate every rotation against
 * both profiles and take the strongest match.
 */
export function estimateKeyFromChroma(chroma: number[]): KeyEstimate | null {
  if (chroma.length < 12 || chroma.reduce((a, b) => a + b, 0) < 0.01) return null;
  let best: KeyEstimate = { key: 'C', mode: 'major', confidence: -2 };
  for (let rot = 0; rot < 12; rot++) {
    // Align chroma[rot] to profile[0]: if the song's tonic is `rot`, its
    // chroma rotated left by rot matches the profile shape.
    const rotated = [...chroma.slice(rot), ...chroma.slice(0, rot)];
    const cMaj = pearson(rotated, MAJOR_PROFILE);
    if (cMaj > best.confidence) best = { key: NOTE_NAMES[rot], mode: 'major', confidence: cMaj };
    const cMin = pearson(rotated, MINOR_PROFILE);
    if (cMin > best.confidence) best = { key: NOTE_NAMES[rot], mode: 'minor', confidence: cMin };
  }
  return best.confidence > -2 ? best : null;
}
