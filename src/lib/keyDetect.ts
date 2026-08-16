// ==========================================================================
// This Area Of Code Is: The ear of the app — key and tempo detection from
// an uploaded audio file.
// Explanation: Someone records themselves singing or playing and uploads
// the file; the app LISTENS. I decode the audio, walk through it in small
// windows, and build a chromagram — how much of every pitch class (C, C#,
// D…) lives in the recording. Then I match that profile against the
// Krumhansl-Schmuckler key profiles (the standard, published model of how
// major and minor keys "feel") and the best match is the key. Tempo comes
// from an onset envelope — where the energy jumps — autocorrelated to find
// the heartbeat between 40 and 220 BPM. Everything runs on the device;
// the audio never leaves the phone.
// In Other Words: Sing it, upload it, and the app says "that's A major at
// about 96" — even if the singer couldn't tell you what key they were in.
// ==========================================================================

export interface KeyGuess {
  key: string;        // e.g. "A" or "F#m"
  bpm: number | null; // null when no clear beat
  confidence: number; // 0..1 correlation of the winning key profile
}

// The Krumhansl-Schmuckler engine now lives in ONE shared home
// (./keyProfile) — imported by both this file analyzer and the live Ear.
import { estimateKeyFromChroma } from './keyProfile';

/** Analyze an audio file and guess its key and tempo. */
export async function analyzeAudio(file: File): Promise<KeyGuess | null> {
  let ctx: AudioContext | null = null;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());

    // Work MONO, DOWNSAMPLED to ~11 kHz, capped at 90 seconds — phone-fast.
    // (Full-rate 3-minute recordings meant hundreds of millions of ops and
    // the detector appeared to stall; music analysis needs none of it.)
    const raw = buf.getChannelData(0).slice(0, Math.min(buf.length, Math.floor(buf.sampleRate * 90)));
    const factor = Math.max(1, Math.round(buf.sampleRate / 11025));
    const data = factor === 1 ? raw : (() => {
      const out = new Float32Array(Math.floor(raw.length / factor));
      for (let i = 0, j = 0; j < out.length; i += factor, j++) out[j] = raw[i];
      return out;
    })();
    const sr = buf.sampleRate / factor;
    const win = 4096;
    const hop = win >> 1;
    const chroma = new Array<number>(12).fill(0);
    const energy: number[] = [];

    for (let start = 0; start + win <= data.length; start += hop) {
      // Goertzel per pitch class across octaves 2–6 — cheap targeted FFT.
      let frameEnergy = 0;
      for (let pc = 0; pc < 12; pc++) {
        let power = 0;
        for (let oct = 2; oct <= 6; oct++) {
          const freq = 440 * Math.pow(2, (pc - 9) / 12 + oct - 4);
          if (freq >= sr / 2) continue;
          const k = Math.round((win * freq) / sr);
          const w = (2 * Math.PI * k) / win;
          const coeff = 2 * Math.cos(w);
          let s0 = 0, s1 = 0, s2 = 0;
          for (let i = 0; i < win; i++) {
            s0 = data[start + i] + coeff * s1 - s2;
            s2 = s1; s1 = s0;
          }
          power += s1 * s1 + s2 * s2 - coeff * s1 * s2;
        }
        const p = Math.sqrt(Math.max(0, power));
        chroma[pc] += p;
        frameEnergy += p;
      }
      energy.push(frameEnergy);
    }
    void ctx.close();

    // Key: the shared Krumhansl-Schmuckler judge (one implementation app-wide).
    const est = estimateKeyFromChroma(chroma);
    const bestKey = est ? (est.mode === 'minor' ? `${est.key}m` : est.key) : 'C';
    const bestCorr = est?.confidence ?? 0;

    // Tempo: onset envelope (positive energy difference), autocorrelate.
    let bpm: number | null = null;
    if (energy.length > 8) {
      const onset = energy.map((e, i) => (i === 0 ? 0 : Math.max(0, e - energy[i - 1])));
      const framesPerSec = sr / hop;
      const minLag = Math.floor(framesPerSec * 60 / 220); // 220 BPM
      const maxLag = Math.floor(framesPerSec * 60 / 40);  // 40 BPM
      let bestLag = 0, bestVal = 0;
      for (let lag = minLag; lag <= Math.min(maxLag, onset.length >> 1); lag++) {
        let v = 0;
        for (let i = 0; i + lag < onset.length; i++) v += onset[i] * onset[i + lag];
        if (v > bestVal) { bestVal = v; bestLag = lag; }
      }
      if (bestLag > 0) bpm = Math.round(60 / (bestLag / framesPerSec));
    }

    return { key: bestKey, bpm, confidence: Math.max(0, Math.min(1, (bestCorr + 1) / 2)) };
  } catch (err) {
    console.warn('Audio analysis failed:', err);
    return null; // undecodable file — caller keeps manual entry
  } finally {
    void ctx?.close().catch(() => undefined);
  }
}
