// ==========================================================================
// This Area Of Code Is: Pitch utilities for OmniScore.
// Explanation: Shared note-name → index table and MIDI conversion helpers,
// kept separate so the WASM DSP paths (Phase 12) and the TS bridge use the
// exact same math.
// In Other Words: One ruler for measuring every note in the app.
// ==========================================================================

/** Sharp-spelled pitch-class names — THE one copy for the whole app
    (tuner, listen, key-detect, bridge all import this). */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const NOTE_INDEX_FROM_NAME: Record<string, number> = {
  'C': 0, 'B#': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
  'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
  'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11,
};

/** Frequency → nearest MIDI note number. */
export function freqToMidi(freq: number, a4 = 440): number {
  return Math.round(69 + 12 * Math.log2(freq / a4));
}

/** MIDI note number → frequency at the given A4 calibration. */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}
