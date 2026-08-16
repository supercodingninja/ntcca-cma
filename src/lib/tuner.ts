// ==========================================================================
// This Area Of Code Is: The Universal Chromatic Tuner (vocals + all
// instruments), from our SCN Tuner Pro work.
// Explanation: Listens through the mic, finds the pitch with an
// autocorrelation algorithm (reliable for voice and instruments alike),
// converts it to the nearest note, and reports how many cents sharp or flat
// the sound is. A4 calibration defaults to 440 Hz with 442/444 options.
// In Other Words: It hears your note and tells you exactly how to land on
// pitch — like a tuning fork that knows every instrument.
// ==========================================================================

import { NOTE_NAMES } from '../omniscore/pitch';
import { getMicStream, runningAudioContext } from './mic';

export interface TunerReading {
  freq: number;
  note: string;
  octave: number;
  cents: number; // -50 … +50 relative to the nearest note at current A4
  inTune: boolean;
}

export function freqToReading(freq: number, a4 = 440): TunerReading {
  // Semitones from A4 → note + cents offset.
  const semis = 12 * Math.log2(freq / a4);
  const nearest = Math.round(semis);
  const cents = Math.round((semis - nearest) * 100);
  const midi = 69 + nearest; // A4 = MIDI 69
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { freq, note, octave, cents, inTune: Math.abs(cents) <= 5 };
}

/** Autocorrelation pitch detection on an audio buffer. Returns Hz or 0. */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return 0; // too quiet to judge

  // Correlate the buffer with shifted copies of itself; the strongest shift
  // is the period of the waveform.
  const corr = new Array<number>(SIZE).fill(0);
  for (let lag = 0; lag < SIZE / 2; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE / 2; i++) sum += buf[i] * buf[i + lag];
    corr[lag] = sum;
  }
  let d = 0;
  while (d < corr.length - 1 && corr[d] > corr[d + 1]) d++;
  let maxLag = -1, maxVal = -1;
  for (let i = d; i < SIZE / 2; i++) {
    if (corr[i] > maxVal) { maxVal = corr[i]; maxLag = i; }
  }
  if (maxLag <= 0) return 0;
  return sampleRate / maxLag;
}

export class TunerEngine {
  private ac: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  a4 = 440;
  onReading: ((r: TunerReading | null) => void) | null = null;

  async start(): Promise<boolean> {
    try {
      this.stream = await getMicStream();
      this.ac = await runningAudioContext();
      const src = this.ac.createMediaStreamSource(this.stream);
      const analyser = this.ac.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = detectPitch(buf, this.ac!.sampleRate);
        this.onReading?.(freq > 40 && freq < 2000 ? freqToReading(freq, this.a4) : null);
        this.raf = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      return false; // mic denied — caller shows instructions
    }
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ac?.close();
    this.ac = null;
    this.stream = null;
  }
}
