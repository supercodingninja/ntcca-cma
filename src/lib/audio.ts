// ==========================================================================
// This Area Of Code Is: The Audio Engine — Music Director's Cut buzzer,
// precision metronome, and tone playback.
// Explanation: Built on Web Audio. The buzzer stacks detuned oscillators
// through a maximized gain stage (safe-limiting at the destination) to be
// ANNOYINGLY LOUD — it cuts through a full band. The metronome uses a
// lookahead scheduler (sample-accurate, no drift) from our SCN Tuner Pro
// work. A wake-lock keeps the screen alive during services.
// In Other Words: The director's voice when words aren't enough.
// ==========================================================================

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // iOS starts contexts suspended; resume() returns a promise that can
  // reject — catch it so we never leak an unhandled rejection.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* will retry on next sound */ });
  return ctx;
}

let wakeLock: { release: () => Promise<void> } | null = null;

/** Keep the screen on during services (best-effort, Chrome on iPad/Android). */
export async function holdWakeLock(): Promise<void> {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
  } catch { wakeLock = null; }
}
export async function releaseWakeLock(): Promise<void> {
  try { await wakeLock?.release(); } catch { /* noop */ }
  wakeLock = null;
}

// This Area Of Code Is: THE CUT BUZZER.
// Explanation: Three stacked oscillator pairs (square+saw, detuned) across
// piercing mid frequencies, hard-limited through a WaveShaper so it is as
// loud as the hardware allows without clipping garbage. Pulses three times
// like a referee's buzzer — unmissable on stage.
export function soundCutBuzzer(): () => void {
  const ac = audio();
  const master = ac.createGain();
  master.gain.value = 0.9;

  // Safe limiter: rounds the peaks instead of clipping harshly.
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    curve[i] = Math.tanh(2.2 * x);
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  master.connect(shaper).connect(ac.destination);

  const oscs: OscillatorNode[] = [];
  const freqs = [1244, 1864, 2489]; // piercing stack, all in speech-sensitive band
  const stopAt = ac.currentTime + 1.6;

  freqs.forEach((f) => {
    (['square', 'sawtooth'] as OscillatorType[]).forEach((type, i) => {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.value = f * (i === 0 ? 1 : 1.007); // slight detune = wider, meaner
      const g = ac.createGain();
      // Three hard pulses: 0–0.35s, 0.5–0.85s, 1.0–1.5s
      g.gain.setValueAtTime(0, ac.currentTime);
      [[0, 0.35], [0.5, 0.85], [1.0, 1.5]].forEach(([on, off]) => {
        g.gain.setValueAtTime(0.16, ac.currentTime + on);
        g.gain.setValueAtTime(0.0001, ac.currentTime + off);
      });
      osc.connect(g).connect(master);
      osc.start();
      osc.stop(stopAt);
      oscs.push(osc);
    });
  });

  // Return a stop function so the director can cut the buzzer itself.
  return () => {
    oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    master.disconnect();
  };
}

// This Area Of Code Is: The precision metronome.
// Explanation: Lookahead scheduling (checks every 25ms, schedules 100ms
// ahead) gives sample-accurate clicks that never drift — the same approach
// we used in SCN Tuner Pro. Accent on beat 1.
export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  bpm = 90;
  beatsPerBar = 4;
  onBeat: ((beat: number) => void) | null = null;

  start(): void {
    const ac = audio();
    this.stop();
    this.beat = 0;
    this.nextTime = ac.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ac = audio();
    while (this.nextTime < ac.currentTime + 0.1) {
      this.click(this.nextTime, this.beat === 0);
      const b = this.beat;
      // UI pulse, aligned to the audio clock.
      setTimeout(() => this.onBeat?.(b), Math.max(0, (this.nextTime - ac.currentTime) * 1000));
      this.nextTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % this.beatsPerBar;
    }
  }

  private click(when: number, accent: boolean): void {
    const ac = audio();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.value = accent ? 1568 : 1046;
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    osc.connect(g).connect(ac.destination);
    osc.start(when);
    osc.stop(when + 0.07);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

/** Simple reference tone (tuner companion): play A4=440 or any frequency. */
export function playTone(freq = 440, seconds = 1.5): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.25, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + seconds);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + seconds + 0.05);
}
