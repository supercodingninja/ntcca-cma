// ==========================================================================
// This Area Of Code Is: The Tools section — universal chromatic tuner.
// Explanation: Mic-based pitch detection with A4 calibration (440 default,
// 442/444 options), a needle gauge showing cents sharp/flat, and a green
// lock when within ±5 cents. Works for vocals and every instrument.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import { TunerEngine, type TunerReading } from '../lib/tuner';
import { playTone } from '../lib/audio';
import { analyzeSheetSymbols, type ScannedNote } from '../omniscore/omr/symbolDetect';
import { NOTE_NAMES, midiToFreq } from '../omniscore/pitch';
import { safeIngest } from '../omniscore/registry';
import { TRANSPOSITION_TABLE } from '../lib/music';

export default function ToolsSection() {
  // OmniScore demo state
  const [scanResult, setScanResult] = useState('');
  const [scanNotes, setScanNotes] = useState<ScannedNote[]>([]);
  const [scanTranspose, setScanTranspose] = useState(0);
  const [scanPlaying, setScanPlaying] = useState(false);
  const [humResult, setHumResult] = useState('');
  const [humming, setHumming] = useState(false);

  const scanSheet = async (file: File) => {
    setScanResult('Scanning…');
    setScanNotes([]);
    setScanTranspose(0);
    const url = URL.createObjectURL(file);
    try {
      // Stage 2: staff lines AND the notes on them — pixels to melody.
      const r = await analyzeSheetSymbols(url);
      if (r.systems.length === 0) {
        setScanResult('No staff lines found — try a flatter, clearer photo of the sheet music.');
      } else if (r.notes.length === 0) {
        setScanResult(`✓ Found ${r.systems.length} staff system(s), but no clear note-heads — try a sharper, brighter, closer photo.`);
      } else {
        setScanNotes(r.notes);
        setScanResult(
          `✓ Read ${r.notes.length} notes across ${r.systems.length} staff system(s)` +
          (r.key ? ` — key: ${r.key} (${(r.keyConfidence * 100).toFixed(0)}%)` : '') +
          ` · confidence ${(r.confidence * 100).toFixed(0)}%.`,
        );
      }
    } catch {
      setScanResult('Could not read that image.');
    }
    URL.revokeObjectURL(url);
  };

  // Play the scanned melody back, note by note (60 BPM eighths), transposed.
  const playScan = () => {
    if (scanPlaying || scanNotes.length === 0) return;
    setScanPlaying(true);
    const seq = scanNotes.slice(0, 64); // one listen, not the whole book
    seq.forEach((n, i) => {
      window.setTimeout(() => {
        playTone(midiToFreq(n.midi + scanTranspose), 0.3);
        if (i === seq.length - 1) window.setTimeout(() => setScanPlaying(false), 350);
      }, i * 350);
    });
  };

  // Spell a MIDI note: sharps up, flats down — the engraver's convention.
  const spell = (midi: number): string => {
    const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const names = scanTranspose < 0 ? flats : NOTE_NAMES;
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  };

  const hum = async () => {
    setHumming(true);
    setHumResult('Listening for 6 seconds — sing or play a melody…');
    const r = await safeIngest('acoustic.mic', { seconds: 6, bpm: 90 });
    setHumming(false);
    if (r.doc) {
      const notes = r.doc.events.map((e) => `${e.pitch}`).slice(0, 12).join(', ');
      setHumResult(`✓ Heard ${r.doc.events.length} notes (MIDI): ${notes}${r.doc.events.length > 12 ? '…' : ''}`);
    } else {
      setHumResult(r.errors?.[0] ?? 'Nothing heard.');
    }
  };

  const [reading, setReading] = useState<TunerReading | null>(null);
  const [running, setRunning] = useState(false);
  const [a4, setA4] = useState(440);
  const [denied, setDenied] = useState(false);
  const engineRef = useRef<TunerEngine | null>(null);

  useEffect(() => () => engineRef.current?.stop(), []);

  const toggle = async () => {
    if (running) {
      engineRef.current?.stop();
      setRunning(false);
      setReading(null);
      return;
    }
    const eng = new TunerEngine();
    eng.a4 = a4;
    eng.onReading = setReading;
    const ok = await eng.start();
    if (ok) { engineRef.current = eng; setRunning(true); setDenied(false); }
    else setDenied(true);
  };

  useEffect(() => { if (engineRef.current) engineRef.current.a4 = a4; }, [a4]);

  // Needle position: -50…+50 cents mapped to -90°…+90°.
  const angle = reading ? Math.max(-90, Math.min(90, reading.cents * 1.8)) : 0;

  return (
    <div className="space-y-4">
      <div className="glass-card p-6 text-center">
        <h2 className="font-display text-xl text-accent mb-2">🎻 Universal Tuner</h2>
        <p className="text-muted text-sm mb-4">Vocals & every instrument · A4 calibration</p>

        <div className="flex justify-center gap-2 mb-4">
          {[440, 442, 444].map((f) => (
            <button key={f} className={`glass-btn text-sm ${a4 === f ? 'primary' : ''}`}
                    onClick={() => setA4(f)} aria-pressed={a4 === f}>A4={f}</button>
          ))}
          <button className="glass-btn text-sm" onClick={() => playTone(a4)}>🔊 Reference</button>
        </div>

        {/* The gauge */}
        <div className="relative w-64 h-32 mx-auto overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-64 rounded-full border-4 border-[var(--glass-border)]"
               style={{ borderBottomColor: 'transparent' }} />
          <div className="absolute left-1/2 bottom-0 w-1 h-28 origin-bottom transition-transform duration-150"
               style={{ transform: `translateX(-50%) rotate(${angle}deg)`, background: reading?.inTune ? '#22c55e' : 'var(--accent)' }} />
          <div className="absolute left-1/2 bottom-0 w-4 h-4 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
        </div>

        <div className="mt-4 h-16">
          {reading ? (
            <>
              <p className="text-5xl font-black" style={{ color: reading.inTune ? '#22c55e' : 'var(--text-primary)' }}>
                {reading.note}<span className="text-2xl">{reading.octave}</span>
              </p>
              <p className="text-sm text-muted">
                {reading.freq.toFixed(1)} Hz · {reading.cents > 0 ? '+' : ''}{reading.cents} cents
                {reading.inTune && ' · ✓ in tune'}
              </p>
            </>
          ) : (
            <p className="text-muted">{running ? 'Play or sing a note…' : 'Tuner is off'}</p>
          )}
        </div>

        <button className={`cta-gold px-10 py-3 mt-2 ${running ? 'opacity-70' : ''}`} onClick={() => void toggle()}>
          {running ? '⏹ Stop' : '🎤 Start Tuner'}
        </button>
        {denied && (
          <p className="text-amber-400 text-sm mt-3">
            Microphone access was blocked. Allow mic permission in your browser settings, then try again.
          </p>
        )}
      </div>

      {/* OmniScore lab — perceptual ingestion demos (Phase 12 engines) */}
      <div className="glass-card p-6">
        <h3 className="text-accent font-semibold mb-2">🧬 OmniScore Lab</h3>
        <p className="text-muted text-sm mb-4">
          Music as pure data — read pixels, hear pitches, never touch proprietary file formats.
        </p>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">📄 Scan sheet music (photo → notes &amp; key)</p>
            <input
              type="file" accept="image/*"
              className="text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2 file:bg-[var(--glass-bg-strong)] file:text-[var(--text-primary)]"
              onChange={(e) => e.target.files?.[0] && void scanSheet(e.target.files[0])}
            />
            {scanResult && <p className="text-sm mt-2">{scanResult}</p>}
            {scanNotes.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* The melody the app read, spelled out — transposable on the fly. */}
                <p className="text-sm font-mono break-words">
                  {scanNotes.slice(0, 24).map((n) => spell(n.midi + scanTranspose)).join(' · ')}
                  {scanNotes.length > 24 && ' …'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="glass-btn text-sm" disabled={scanPlaying} onClick={playScan}>
                    {scanPlaying ? '🔊 Playing…' : '▶ Play it'}
                  </button>
                  <span className="text-xs text-muted">Transpose:</span>
                  <button className="glass-btn text-sm" onClick={() => setScanTranspose((v) => v - 1)}>−</button>
                  <span className="text-sm w-10 text-center">{scanTranspose > 0 ? `+${scanTranspose}` : scanTranspose}</span>
                  <button className="glass-btn text-sm" onClick={() => setScanTranspose((v) => v + 1)}>+</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">🎤 Hum-to-score (live mic → notes)</p>
            <button className={`glass-btn ${humming ? 'danger' : 'primary'}`} disabled={humming}
                    onClick={() => void hum()}>
              {humming ? '👂 Listening…' : '🎙 Start listening'}
            </button>
            {humResult && <p className="text-sm mt-2 font-mono">{humResult}</p>}
          </div>
        </div>
      {/* The sax-family transposition chart — concert → B♭ → E♭.
          Every note and its written equivalent, always at hand. */}
      <div className="glass-card p-6">
        <h3 className="text-accent font-semibold mb-2">🎷 Transposition Chart</h3>
        <p className="text-muted text-sm mb-4">
          Concert pitch (piano/guitar) · B♭ instruments (soprano &amp; tenor sax — up a whole tone) ·
          E♭ instruments (alto &amp; baritone sax — up a major 6th)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="text-accent border-b border-[var(--glass-border)]">
                <th className="py-2">Concert<br /><span className="text-muted text-xs font-normal">Piano · Guitar</span></th>
                <th>B♭ written<br /><span className="text-muted text-xs font-normal">Soprano · Tenor</span></th>
                <th>E♭ written<br /><span className="text-muted text-xs font-normal">Alto · Baritone</span></th>
              </tr>
            </thead>
            <tbody>
              {TRANSPOSITION_TABLE.map((r) => (
                <tr key={r.concert} className="border-b border-[var(--glass-border)] last:border-0">
                  <td className="py-1.5 font-semibold">{r.concert}</td>
                  <td className="py-1.5">{r.bb}</td>
                  <td className="py-1.5">{r.eb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
