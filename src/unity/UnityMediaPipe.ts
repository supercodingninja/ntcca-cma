// ==========================================================================
// This Area Of Code Is: UnityMediaPipe.ts — blink-to-beat conductor
// (Unity Solution™ file 4 of 4).
// Explanation: Watches the worship leader's face through the camera. MediaPipe
// FaceLandmarker finds 478 facial points ON-DEVICE (no video ever leaves the
// phone). The EAR formula measures how open each eye is; when both eyes stay
// closed for a few consecutive frames, that's a deliberate blink — one beat.
// Blink intervals become a smoothed tempo, which drives the metronome, the
// lighting engine, and every synced device.
// Architecture (mirrors the deck exactly):
//   FaceDetector → BlinkDetector (EAR) → BeatMapper → MidiOutput
//   MediaPipeService = orchestrator
// In Other Words: The leader blinks on purpose, and the whole band's gear
// follows their tempo. Like a conductor's baton made of light.
// ==========================================================================

import {
  FaceLandmarker, FilesetResolver, type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { BlinkEvent, TempoChange, UnityMediaPipeConfig, Landmark } from './midi';
import { DEFAULT_CONFIG } from './midi';

// ------------------------- Landmark indices (per the deck) ------------------
const LEFT_EYE = [362, 385, 387, 263, 373, 380];   // left eye EAR set
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];   // right eye EAR set

// ------------------------------ EAR formula --------------------------------
// EAR = (|p2-p6| + |p3-p5|) / (2 × |p1-p4|)
// Open eye ≈ 0.3+, closed ≈ 0.1 — blink when EAR < threshold for N frames.
function euclidean(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function eyeAspectRatio(pts: Landmark[]): number {
  const [p1, p2, p3, p4, p5, p6] = pts;
  return (euclidean(p2, p6) + euclidean(p3, p5)) / (2 * euclidean(p1, p4));
}

// ------------------------------ BlinkDetector ------------------------------
class BlinkDetector {
  private framesBelow = 0;
  private cfg: UnityMediaPipeConfig;
  constructor(cfg: UnityMediaPipeConfig) { this.cfg = cfg; }

  update(landmarks: Landmark[], ts: number): BlinkEvent | null {
    const leftEAR = eyeAspectRatio(LEFT_EYE.map((i) => landmarks[i]));
    const rightEAR = eyeAspectRatio(RIGHT_EYE.map((i) => landmarks[i]));
    const ear = (leftEAR + rightEAR) / 2;

    if (ear < this.cfg.earThreshold) {
      this.framesBelow += 1;
    } else {
      // Eyes reopened — if they were closed long enough, that was a blink.
      if (this.framesBelow >= this.cfg.consecutiveFrames) {
        const blink: BlinkEvent = { ts, ear, eye: 'both' };
        this.framesBelow = 0;
        return blink;
      }
      this.framesBelow = 0;
    }
    return null;
  }
}

// ------------------------------ BeatMapper ---------------------------------
// Converts blink intervals → smoothed tempo (EMA with smoothingFactor).
class BeatMapper {
  private lastTs = 0;
  private smoothed = 0;
  private intervals: number[] = [];
  private cfg: UnityMediaPipeConfig;

  constructor(cfg: UnityMediaPipeConfig) { this.cfg = cfg; }

  onBlink(b: BlinkEvent): TempoChange | null {
    if (this.lastTs === 0) { this.lastTs = b.ts; return null; }
    const interval = b.ts - this.lastTs;
    this.lastTs = b.ts;
    // Ignore impossible intervals (30–300 BPM window).
    if (interval < 200 || interval > 2000) return null;

    this.intervals.push(interval);
    if (this.intervals.length > 8) this.intervals.shift();
    const rawBpm = 60000 / interval;

    this.smoothed = this.smoothed === 0
      ? rawBpm
      : this.cfg.smoothingFactor * this.smoothed + (1 - this.cfg.smoothingFactor) * rawBpm;

    // Confidence = how consistent the recent intervals are (low variance wins).
    const mean = this.intervals.reduce((a, c) => a + c, 0) / this.intervals.length;
    const variance = this.intervals.reduce((a, c) => a + (c - mean) ** 2, 0) / this.intervals.length;
    const cv = Math.sqrt(variance) / mean;
    const confidence = Math.max(0, Math.min(1, 1 - cv * 3));

    return { bpm: Math.round(this.smoothed), rawBpm, ts: b.ts, source: 'blink', confidence };
  }

  reset(): void { this.lastTs = 0; this.intervals = []; }
}

// ------------------------------ MidiOutput ---------------------------------
class MidiOutput {
  onTempo: ((t: TempoChange) => void) | null = null;
  private cfg: UnityMediaPipeConfig;
  constructor(cfg: UnityMediaPipeConfig) { this.cfg = cfg; }
  emit(t: TempoChange): void {
    if (this.cfg.midiOutputEnabled) this.onTempo?.(t);
  }
}

// ---------------------------- MediaPipeService -----------------------------
// The orchestrator (per the deck): owns the camera, the landmarker, and the
// detection loop. Graceful degradation at every step.
export class MediaPipeService {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private blinker: BlinkDetector;
  private beats: BeatMapper;
  private out = new MidiOutput(DEFAULT_CONFIG);

  running = false;
  modelReady = false;
  onBlink: ((b: BlinkEvent) => void) | null = null;
  onTempo: ((t: TempoChange) => void) | null = null;
  onError: ((msg: string) => void) | null = null;
  private cfg: UnityMediaPipeConfig;

  constructor(cfg: UnityMediaPipeConfig = DEFAULT_CONFIG) {
    this.cfg = cfg;
    this.blinker = new BlinkDetector(cfg);
    this.beats = new BeatMapper(cfg);
    this.out = new MidiOutput(cfg);
    this.out.onTempo = (t) => this.onTempo?.(t);
  }

  /** Load the face model from LOCAL files (CSP-safe, works offline). */
  async loadModel(): Promise<boolean> {
    try {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/models/face_landmarker.task' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: this.cfg.minDetectionConfidence,
        minFacePresenceConfidence: this.cfg.minDetectionConfidence,
        minTrackingConfidence: this.cfg.minTrackingConfidence,
      });
      this.modelReady = true;
      return true;
    } catch (err) {
      this.onError?.(`Model failed to load: ${String(err)}`);
      return false;
    }
  }

  async start(video: HTMLVideoElement): Promise<boolean> {
    if (!this.modelReady && !(await this.loadModel())) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: this.cfg.cameraWidth, height: this.cfg.cameraHeight, facingMode: 'user' },
        audio: false,
      });
      this.video = video;
      video.srcObject = this.stream;
      await video.play();
      this.running = true;
      this.loop();
      return true;
    } catch (err) {
      this.onError?.('Camera unavailable — check permissions.');
      void err;
      return false;
    }
  }

  private lastVideoTime = -1;
  private loop(): void {
    if (!this.running || !this.video || !this.landmarker) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      const now = performance.now();
      let result: FaceLandmarkerResult | null = null;
      try { result = this.landmarker.detectForVideo(v, now); } catch { result = null; }
      const face = result?.faceLandmarks?.[0];
      if (face) {
        const blink = this.blinker.update(face as Landmark[], now);
        if (blink) {
          this.onBlink?.(blink);
          const tempo = this.beats.onBlink(blink);
          if (tempo) this.out.emit(tempo);
        }
      }
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;
    this.beats.reset();
  }
}
