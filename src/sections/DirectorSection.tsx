// ==========================================================================
// This Area Of Code Is: The Music Director's Cut suite.
// Explanation: THE CUT BUZZER (annoyingly loud, cuts through the band), the
// precision metronome with visual beat pulse, reference tones, and the
// masculine / feminine / unisex director theme switch.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import { soundCutBuzzer, Metronome, playTone, holdWakeLock, releaseWakeLock } from '../lib/audio';
import { useA11y, type DirectorTheme } from '../lib/a11y';
import { useI18n } from '../lib/i18n';
import MotivateBoard from './MotivateBoard';
import ArrangeBoard from './ArrangeBoard';
import IdeasBoard from './IdeasBoard';

// ==========================================================================
// This Area Of Code Is: The Director's voice roster.
// Explanation: Per the Music Director's Cut spec, the spoken cut alert
// offers 5–10 masculine voices and 5–10 feminine voices, with gender modes:
// Masculine, Neutral, Feminine, Unisex. Browsers don't label voice gender,
// so I classify by well-known voice names and keep the best ten of each.
// In Other Words: The director picks whose voice shouts "CUT!" — mine if
// you want it loud and commanding.
// ==========================================================================
type VoiceGender = 'masculine' | 'feminine';
const MALE_NAMES = ['daniel', 'david', 'alex', 'fred', 'george', 'james', 'john', 'paul', 'mark', 'thomas', 'aaron', 'guy', 'reed', 'rocko', 'bruce', 'ralph', 'male'];
const FEMALE_NAMES = ['samantha', 'victoria', 'karen', 'susan', 'zira', 'hazel', 'catherine', 'allison', 'ava', 'serena', 'kate', 'stephanie', 'tessa', 'moira', 'fiona', 'joelle', 'shelley', 'female'];

function classifyVoice(v: SpeechSynthesisVoice): VoiceGender | null {
  const n = v.name.toLowerCase();
  if (MALE_NAMES.some((m) => n.includes(m))) return 'masculine';
  if (FEMALE_NAMES.some((f) => n.includes(f))) return 'feminine';
  return null;
}

function speakCut(voice: SpeechSynthesisVoice | null, phrase: string): void {
  // Annoyingly loud: max volume, slightly slowed for authority.
  // Guard: browsers without speechSynthesis must never crash the buzzer.
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(phrase);
    if (voice) u.voice = voice;
    u.volume = 1; u.rate = 0.9; u.pitch = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* the buzzer still sounds — voice is a bonus */ }
}

export default function DirectorSection() {
  const { t } = useI18n();
  const { theme, setTheme } = useA11y();
  const [bpm, setBpm] = useState(90);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const metroRef = useRef<Metronome | null>(null);
  const stopBuzzRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { metroRef.current?.stop(); releaseWakeLock(); }, []);

  const toggleMetronome = () => {
    if (running) {
      metroRef.current?.stop();
      setRunning(false);
      setBeat(-1);
      void releaseWakeLock();
    } else {
      const m = new Metronome();
      m.bpm = bpm;
      m.onBeat = (b) => setBeat(b);
      m.start();
      metroRef.current = m;
      setRunning(true);
      void holdWakeLock(); // screen stays on through the service
    }
  };

  useEffect(() => {
    if (metroRef.current && running) metroRef.current.bpm = bpm;
  }, [bpm, running]);

  const buzz = () => {
    stopBuzzRef.current?.();
    stopBuzzRef.current = soundCutBuzzer();
    speakCut(selectedVoice, 'Cut!');
  };

  // Voice roster state — loaded async because browsers populate voices lazily.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [genderMode, setGenderMode] = useState<'masculine' | 'neutral' | 'feminine' | 'unisex'>('unisex');
  const [voiceURI, setVoiceURI] = useState<string>('');
  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.onvoiceschanged = load;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  const roster = (() => {
    const masc = voices.filter((v) => classifyVoice(v) === 'masculine').slice(0, 10);
    const fem = voices.filter((v) => classifyVoice(v) === 'feminine').slice(0, 10);
    if (genderMode === 'masculine') return masc;
    if (genderMode === 'feminine') return fem;
    if (genderMode === 'unisex') return [...masc.slice(0, 5), ...fem.slice(0, 5)];
    return voices.slice(0, 10); // neutral — whatever the device offers
  })();
  const selectedVoice = voices.find((v) => v.voiceURI === voiceURI) ?? roster[0] ?? null;

  return (
    <div className="space-y-4">
      {/* THE CUT BUZZER — the reason this section exists */}
      <div className="glass-card p-6 text-center">
        <h2 className="font-display text-xl text-accent mb-1">Music Director’s Cut</h2>
        <p className="text-muted text-sm mb-5">{t('buzzerHint')}</p>
        <button
          className="glass-btn danger text-4xl font-black px-16 py-10 rounded-3xl w-full sm:w-auto"
          onClick={buzz}
          aria-label={t('buzzer')}
        >
          🚨 {t('buzzer')}
        </button>
        <button className="glass-btn mt-3" onClick={() => { stopBuzzRef.current?.(); speechSynthesis.cancel(); }}>{t('stop')}</button>

        {/* Director's voice roster — Masculine / Neutral / Feminine / Unisex,
            glass hover on every option, per the Music Director's Cut spec */}
        <div className="mt-5">
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            {(['masculine', 'neutral', 'feminine', 'unisex'] as const).map((g) => (
              <button key={g} className={`glass-btn hover-glass text-xs ${genderMode === g ? 'primary' : ''}`}
                      onClick={() => setGenderMode(g)} aria-pressed={genderMode === g}>
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {roster.map((v) => (
              <button
                key={v.voiceURI}
                className={`glass-btn hover-glass text-xs ${voiceURI === v.voiceURI ? 'primary' : ''}`}
                onClick={() => { setVoiceURI(v.voiceURI); speakCut(v, 'Cut!'); }}
              >
                🗣 {v.name.replace(/\(.*\)/, '').trim()}
              </button>
            ))}
            {roster.length === 0 && (
              <p className="text-muted text-xs col-span-full">Loading voices… the buzzer still works.</p>
            )}
          </div>
        </div>
      </div>

      {/* Precision metronome */}
      <div className="glass-card p-6">
        <h3 className="text-accent font-semibold mb-3">{t('metronome')}</h3>
        <div className="flex flex-wrap items-center gap-4">
          <button className={`glass-btn primary ${running ? 'danger' : ''}`} onClick={toggleMetronome}>
            {running ? `⏹ ${t('stop')}` : `▶ ${t('start')}`}
          </button>
          <label className="flex items-center gap-2 text-sm">
            {t('bpm')}: <strong className="text-accent">{bpm}</strong>
            <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
          </label>
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2, 3].map((b) => (
              <span key={b} className={`w-4 h-4 rounded-full transition-all ${
                beat === b ? 'bg-[var(--accent)] scale-125' : 'bg-[var(--glass-border)]'}`} />
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="glass-btn text-sm" onClick={() => playTone(440)}>A4 · 440</button>
          <button className="glass-btn text-sm" onClick={() => playTone(523.25)}>C5</button>
          <button className="glass-btn text-sm" onClick={() => playTone(659.25)}>E5</button>
        </div>
      </div>

      {/* Bulletin & stamps — speak to the whole team, hand out trophies */}
      <MotivateBoard />

      {/* Ideas review — everyone's music literature lands here; pause anytime */}
      <IdeasBoard mode="review" />

      {/* Arrangement board — voices + counts + instruments → transposed parts */}
      <ArrangeBoard />

      {/* Director theme variants */}
      <div className="glass-card p-6">
        <h3 className="text-accent font-semibold mb-3">{t('theme')}</h3>
        <div className="flex gap-2 flex-wrap">
          {(['masculine', 'feminine', 'unisex'] as DirectorTheme[]).map((th) => (
            <button
              key={th}
              className={`glass-btn ${theme === th ? 'primary' : ''}`}
              onClick={() => setTheme(th)}
              aria-pressed={theme === th}
            >
              {t(th)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
