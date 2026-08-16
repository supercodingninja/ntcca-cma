// ==========================================================================
// This Area Of Code Is: MIDI Type Definitions (Unity Solution™ file 1 of 4).
// Explanation: Shared types for the whole Unity Solution — tempo changes,
// blink events, landmark geometry, and MIDI messages, fully typed so every
// module integrates with compile-time safety.
// In Other Words: The common language the conductor system speaks.
// ==========================================================================

/** A single 3D facial landmark point (MediaPipe normalized coordinates). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** A confirmed blink — timestamp + the EAR that triggered it. */
export interface BlinkEvent {
  ts: number;          // ms since epoch (performance clock)
  ear: number;         // eye aspect ratio at detection
  eye: 'both';
}

/** A tempo change derived from blink intervals. */
export interface TempoChange {
  bpm: number;         // smoothed BPM
  rawBpm: number;      // unsmoothed instantaneous BPM
  ts: number;
  source: 'blink' | 'tap' | 'midi';
  confidence: number;  // 0–1, from interval consistency
}

/** Web MIDI message wrapper (3 bytes of classic MIDI). */
export interface MidiMessage {
  data: Uint8Array;
  ts: number;
}

/** Unity Solution configuration (defaults per Session 7 architecture). */
export interface UnityMediaPipeConfig {
  earThreshold: number;        // 0.25 universal, 0.20 conservative, 0.18 sensitive
  consecutiveFrames: number;   // 3 responsive / 5 conservative
  cameraWidth: number;         // 640
  cameraHeight: number;        // 480
  minDetectionConfidence: number; // 0.5
  minTrackingConfidence: number;  // 0.5
  smoothingFactor: number;     // 0.8 — EMA weight on previous tempo
  midiOutputEnabled: boolean;
  debugMode: boolean;
}

export const DEFAULT_CONFIG: UnityMediaPipeConfig = {
  earThreshold: 0.25,
  consecutiveFrames: 3,
  cameraWidth: 640,
  cameraHeight: 480,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  smoothingFactor: 0.8,
  midiOutputEnabled: true,
  debugMode: false,
};
