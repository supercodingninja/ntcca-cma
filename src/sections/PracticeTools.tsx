// ==========================================================================
// This Area Of Code Is: The Practice Tools (Vocal Key Finder, Chord
// Builder, Practice Queue). Explanation: The reference app's musicians had
// an AI studio — ours runs on the device, free forever. Sing your lowest
// and highest notes and the Key Finder tells you which keys fit YOUR voice
// and how far to transpose; the Chord Builder spells any chord instantly;
// the Practice Queue keeps your personal hit-list on this device.
// In Other Words: A vocal coach and a theory book in every pocket.
// ==========================================================================
import { useEffect, useRef, useState } from 'react';
import { TunerEngine, type TunerReading } from '../lib/tuner';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiOf = (note: string, octave: number) => NOTES.indexOf(note) + (octave + 1) * 12;

// ---------------------------------------------------------------- key finder
export function VocalKeyFinder({ songKeys }: { songKeys: string[] }) {
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [on, setOn] = useState(false);
  const [low, setLow] = useState<number | null>(null);
  const [high, setHigh] = useState<number | null>(null);
  const [songKey, setSongKey] = useState('');
  const eng = useRef<TunerEngine | null>(null);

  useEffect(() => () => eng.current?.stop(), []);

  const toggle = async () => {
    if (on) { eng.current?.stop(); setOn(false); return; }
    eng.current = new TunerEngine();
    eng.current.onReading = setReading;
    setOn(await eng.current.start());
  };

  const rangeKnown = low !== null && high !== null && high > low;
  const center = rangeKnown ? (low + high) / 2 : 0;
  // Best keys = whose root sits nearest the center of YOUR range.
  const ranked = rangeKnown
    ? NOTES.map((n) => {
        const root = midiOf(n, 4); // reference octave
        const d = Math.min(Math.abs(root - center), 12 - Math.abs(root - center));
        return { n, d };
      }).sort((a, b) => a.d - b.d)
    : [];
  const transposeAdvice = (() => {
    if (!rangeKnown || !songKey) return '';
    const cur = midiOf(songKey, 4);
    const best = ranked[0].n;
    let semis = NOTES.indexOf(best) - NOTES.indexOf(songKey);
    if (semis > 6) semis -= 12;
    if (semis < -6) semis += 12;
    void cur;
    return semis === 0
      ? `${songKey} already fits your voice — sing it as written.`
      : `Move it ${semis > 0 ? `up ${semis}` : `down ${-semis}`} semitone(s): ${songKey} → ${best} fits YOUR voice best.`;
  })();

  const [step, setStep] = useState<1 | 2>(1); // Adoración parity: guided steps

  return (
    <div className="glass-card p-5 space-y-3">
      <h3 className="font-semibold">🎤 Vocal Key Finder <span className="text-muted text-sm font-normal">Find your vocal range and optimal keys for worship songs</span></h3>

      {step === 1 && (
        /* STEP 1 — Find Middle C (C4), exactly as the Adoración editor
           taught it: piano guidance AND guitar guidance side by side. */
        <div className="space-y-3">
          <p className="text-accent font-semibold">𝄠 Step 1: Find Middle C (C4)</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[var(--glass-border)] p-3">
              <p className="font-semibold mb-1">On Piano</p>
              <ul className="space-y-1 text-muted list-disc list-inside">
                <li>Find the C in the center of the keyboard</li>
                <li>White key immediately left of the 2-black-keys group</li>
                <li>This Middle C is C4 (261.63 Hz)</li>
                <li>Often has the manufacturer mark nearby</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--glass-border)] p-3">
              <p className="font-semibold mb-1">On Guitar</p>
              <ul className="space-y-1 text-muted list-disc list-inside">
                <li>Middle C (C4) is 1st fret of 2nd string (B)</li>
                <li>Also 5th fret of 3rd string (G)</li>
                <li>Or 10th fret of 4th string (D)</li>
                <li>Use this as reference to find your range</li>
              </ul>
            </div>
          </div>
          <button className="cta-gold px-6 py-2" onClick={() => setStep(2)}>
            ✓ Found Middle C — Continue
          </button>
        </div>
      )}

      {step === 2 && (
      <>
      <p className="text-sm text-muted">Step 2: Sing your lowest comfortable note, tap "set low" — then your highest, "set high". The app finds the keys that fit YOUR voice.</p>
      <div className="flex gap-2 flex-wrap items-center">
        <button className={`glass-btn ${on ? 'primary' : ''}`} onClick={() => void toggle()}>{on ? '⏹ Stop mic' : '🎙 Start mic'}</button>
        {reading && <span className="text-lg font-mono">{reading.note}{reading.octave} <span className={reading.inTune ? 'text-green-400' : 'text-amber-300'}>{reading.cents > 0 ? '+' : ''}{reading.cents}¢ {reading.inTune ? '✓' : ''}</span></span>}
        <button className="glass-btn text-sm" disabled={!reading} onClick={() => reading && setLow(midiOf(reading.note, reading.octave))}>Set low</button>
        <button className="glass-btn text-sm" disabled={!reading} onClick={() => reading && setHigh(midiOf(reading.note, reading.octave))}>Set high</button>
      </div>
      {rangeKnown && (
        <>
          <p className="text-sm">Your range: <b>{NOTES[low % 12]}{Math.floor(low / 12) - 1}</b> → <b>{NOTES[high % 12]}{Math.floor(high / 12) - 1}</b> · Best keys: <b>{ranked.slice(0, 4).map((r) => r.n).join(', ')}</b></p>
          <div className="flex gap-2 items-center">
            <select className="auth-input !w-32" value={songKey} onChange={(e) => setSongKey(e.target.value)} aria-label="Song key">
              <option value="">Song key…</option>
              {Array.from(new Set([...NOTES, ...songKeys])).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <span className="text-sm">{transposeAdvice}</span>
          </div>
        </>
      )}
      </>
      )}

      {/* Professional Tips — straight from the Adoración editor */}
      <div className="rounded-xl border border-[var(--glass-border)] p-3 grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="font-semibold mb-1">⚙ Finding Song Key:</p>
          <p className="text-muted">The last melody note indicates the key 99% of the time. Sing or play the last note, find it on piano, and that will likely be the tonic.</p>
        </div>
        <div>
          <p className="font-semibold mb-1">Major vs. Minor:</p>
          <p className="text-muted">Listen to the third degree of the scale. If it sounds bright and happy, it's major. If it sounds melancholic or sad, it's minor.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- chord builder
const QUALITIES: Record<string, number[]> = {
  'maj': [0, 4, 7], 'min': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'dim': [0, 3, 6],
  'aug': [0, 4, 8], 'add9': [0, 4, 7, 14], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9],
};

export function ChordBuilder() {
  const [root, setRoot] = useState('C');
  const [quality, setQuality] = useState('maj');
  const notes = QUALITIES[quality].map((i) => NOTES[(NOTES.indexOf(root) + i) % 12]);
  return (
    <div className="glass-card p-5 space-y-3">
      <h3 className="font-semibold">🎹 Chord Builder</h3>
      <div className="flex gap-2 flex-wrap">
        <select className="auth-input !w-24" value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Chord root">
          {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="auth-input !w-28" value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Chord quality">
          {Object.keys(QUALITIES).map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>
      <p className="text-xl font-mono">{root}{quality === 'maj' ? '' : quality} = <b className="text-accent">{notes.join(' – ')}</b></p>
    </div>
  );
}

// ---------------------------------------------------------------- practice queue
interface QItem { id: string; text: string; done: boolean }
const Q_KEY = 'ntcc.practice.queue';

export function PracticeQueue({ onPick }: { onPick?: (text: string) => void }) {
  const [items, setItems] = useState<QItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(Q_KEY) ?? '[]') as QItem[]; } catch { return []; }
  });
  const [text, setText] = useState('');
  const save = (next: QItem[]) => { setItems(next); localStorage.setItem(Q_KEY, JSON.stringify(next)); };
  const pending = items.filter((i) => !i.done).length;

  return (
    <div className="glass-card p-5 space-y-3">
      <h3 className="font-semibold">📋 My practice queue <span className="text-muted text-sm font-normal">({pending} to go)</span></h3>
      <div className="flex gap-2">
        <input className="auth-input !w-full" placeholder="Add a song / part / drill…" value={text}
               onChange={(e) => setText(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { save([...items, { id: `q-${Date.now()}`, text: text.trim(), done: false }]); setText(''); } }}
               aria-label="Add to practice queue" />
        <button className="glass-btn primary" onClick={() => { if (text.trim()) { save([...items, { id: `q-${Date.now()}`, text: text.trim(), done: false }]); setText(''); } }}>Add</button>
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <button className={`glass-btn text-xs ${i.done ? 'primary' : ''}`}
                    onClick={() => save(items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x))}>
              {i.done ? '✓' : '○'}
            </button>
            <span className={i.done ? 'line-through text-muted' : ''}>{i.text}</span>
            {!i.done && onPick && <button className="glass-btn text-xs ml-auto" onClick={() => onPick(i.text)}>▶ practice this</button>}
            <button className="glass-btn text-xs ml-auto" onClick={() => save(items.filter((x) => x.id !== i.id))}>✕</button>
          </li>
        ))}
        {items.length === 0 && <p className="text-muted">Nothing queued — add what you'll work on next.</p>}
      </ul>
    </div>
  );
}
