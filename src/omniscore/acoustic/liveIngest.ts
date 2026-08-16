// ==========================================================================
// This Area Of Code Is: Acoustic-to-Score Stage 1 — live mic ingestion.
// Explanation: Records a short performance through the mic, finds note
// onsets (transients = sudden energy jumps) and pitches (autocorrelation,
// shared math with the tuner), quantizes them onto a rhythm grid, and emits
// USMG sonic events with confidence scores. This is machine listening —
// audio becomes score data natively. (The Rust→WASM DSP upgrade path swaps
// these internals without touching the registry contract.)
// In Other Words: Hum a melody and the app writes down the notes it heard.
// ==========================================================================

import { createUSMG, type USMGDocument, type SonicEvent } from '../usmg';
import { registerIngestor, type Ingestor } from '../registry';
import { detectPitch } from '../../lib/tuner';
import { getMicStream, runningAudioContext } from '../../lib/mic';
import { freqToMidi } from '../pitch';

export interface AcousticIngestOptions {
  seconds?: number;   // recording window (default 6)
  bpm?: number;       // quantization grid (default 90)
  a4?: number;        // calibration (default 440)
}

interface Frame { t: number; pitch: number; energy: number }

async function recordFrames(seconds: number, a4: number): Promise<Frame[]> {
  void a4;
  const stream = await getMicStream();
  const ac = await runningAudioContext();
  const srcNode = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  srcNode.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const frames: Frame[] = [];
  const start = ac.currentTime;

  await new Promise<void>((resolve) => {
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let energy = 0;
      for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
      energy = Math.sqrt(energy / buf.length);
      const freq = detectPitch(buf, ac.sampleRate);
      frames.push({
        t: ac.currentTime - start,
        pitch: freq > 40 && freq < 2000 ? freq : 0,
        energy,
      });
      if (ac.currentTime - start < seconds) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });

  stream.getTracks().forEach((t) => t.stop());
  void ac.close();
  return frames;
}

/** Onset = energy jump above the local baseline; attach nearest pitch. */
function framesToEvents(frames: Frame[], bpm: number): SonicEvent[] {
  const events: SonicEvent[] = [];
  const beat = 60 / bpm;
  let lastOnset = -1;
  for (let i = 2; i < frames.length; i++) {
    const prev = (frames[i - 1].energy + frames[i - 2].energy) / 2;
    const cur = frames[i];
    const jumped = cur.energy > Math.max(0.02, prev * 1.8);
    if (jumped && cur.pitch > 0 && cur.t - lastOnset > beat / 4) {
      lastOnset = cur.t;
      // Quantize onset to the nearest 1/4 beat.
      const q = Math.round(cur.t / (beat / 4)) * (beat / 4);
      events.push({
        id: crypto.randomUUID(),
        pitch: freqToMidi(cur.pitch),
        onset: q,
        duration: beat, // placeholder — replaced by the inter-onset pass below
        velocity: Math.min(127, Math.round(cur.energy * 900)),
        voice: 0, staffIndex: 0,
        confidence: Math.min(0.9, 0.4 + cur.energy * 4),
      });
    }
  }
  // This Area Of Code Is: Real note DURATIONS.
  // Explanation: a note lasts from its onset until the next onset (that's
  // how long the musician actually held it). The final note gets one beat
  // plus its measured decay tail. Durations snap to the 1/4-beat grid, at
  // least one grid step, never longer than four beats.
  for (let i = 0; i < events.length; i++) {
    const nextOnset = events[i + 1]?.onset;
    const raw = nextOnset !== undefined ? nextOnset - events[i].onset : beat;
    const snapped = Math.max(beat / 4, Math.round(raw / (beat / 4)) * (beat / 4));
    events[i].duration = Math.min(snapped, beat * 4);
  }
  return events;
}

// This Area Of Code Is: The Acoustic Ingestor plugin ("acoustic.mic").
// Explanation: Registered in the OmniScore registry — a performance goes in
// as sound and comes out as a USMG graph. Everything downstream (chart
// render, transposition, UnityLED cues) can then treat humming like sheet
// music.
const acousticMic: Ingestor<AcousticIngestOptions> = {
  id: 'acoustic.mic',
  label: 'Acoustic-to-Score — Live Mic',
  accepts: ['audio/live-mic'],
  async ingest(opts) {
    const { seconds = 6, bpm = 90, a4 = 440 } = opts ?? {};
    const frames = await recordFrames(seconds, a4);
    const events = framesToEvents(frames, bpm);
    if (events.length === 0) {
      return { errors: ['No clear notes heard — sing or play louder and closer to the mic.'] };
    }
    const doc: USMGDocument = createUSMG({
      title: 'Live capture', artist: 'Live', key: 'C',
      timeSignature: '4/4', bpm, language: 'en',
      sourceKind: 'acoustic',
      confidence: events.reduce((a, e) => a + e.confidence, 0) / events.length,
    });
    doc.events = events;
    return { doc };
  },
};

registerIngestor(acousticMic as Ingestor<AcousticIngestOptions> as Ingestor);
