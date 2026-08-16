// ==========================================================================
// This Area Of Code Is: The Universal Access panel — the floating ♿ icon
// and its glass control room.
// Explanation: One floating glass button, always reachable. Tap it and a
// full glass panel rises (never a dropdown — I heard you): first the six
// category cards, tap a category and its options populate that SAME space
// with big iOS-style toggles, and there is ALWAYS a ← Back and a ✕ Close
// (plus the gold Close bar at the bottom, like the GetWell card). Every
// toggle flips a real accommodation in the Universal Access engine and
// announces what it did.
// In Other Words: One tap on the little gold ♿, and the app reshapes
// itself around exactly who you are.
// ==========================================================================

import { useEffect, useState } from 'react';
import { useA11y, type AccessMode, COLOR_VISION_OPTIONS } from '../lib/a11y';
import { narrate } from '../lib/narration';
import AccessOrb from './AccessOrb';

interface Option { mode: AccessMode; icon: string; label: string; hint: string; }
interface Category { id: string; icon: string; title: string; options: Option[]; }

const CATEGORIES: Category[] = [
  {
    id: 'neuro', icon: '🧠', title: 'NEURODIVERGENT',
    options: [
      { mode: 'calm', icon: '🧩', label: 'Autism-Friendly Mode (Calm)', hint: 'Stills all motion, mutes colors, softens contrast shifts' },
      { mode: 'focus', icon: '⚡', label: 'ADHD Support (Focus)', hint: 'Dims the photo reel and extra decoration so content leads' },
      { mode: 'dyslexiaFont', icon: '📖', label: 'Dyslexia-Friendly Font', hint: 'Wider letter spacing and word spacing, heavier line height' },
      { mode: 'dyspraxia', icon: '🎯', label: 'Dyspraxia Support', hint: 'Bigger targets plus generous spacing between tappables' },
    ],
  },
  {
    id: 'mental', icon: '💙', title: 'MENTAL HEALTH',
    options: [
      { mode: 'anxietyRelief', icon: '🌊', label: 'Anxiety Relief Mode', hint: 'Removes timers, badges, and anything that urges or counts' },
      { mode: 'noFlash', icon: '🎖', label: 'PTSD Support (No Flash)', hint: 'Kills every flash, pulse, and sudden animation' },
      { mode: 'steadyMood', icon: '⚖️', label: 'Bipolar/Mania Support', hint: 'Neutral, steady palette — no high-arousal gold flashes' },
      { mode: 'lowCognitive', icon: '🧘', label: 'Cognitive Load Reduction', hint: 'One thing at a time: simplified layout, fewer choices per screen' },
    ],
  },
  {
    id: 'vision', icon: '👁', title: 'VISION',
    options: [
      { mode: 'screenReader', icon: '🔍', label: 'Screen Reader Mode', hint: 'Turns on full narration — the app speaks everything' },
      { mode: 'highContrast', icon: '☀️', label: 'High Contrast', hint: 'WCAG-AAA contrast across every surface' },
    ],
  },
  {
    id: 'hearing', icon: '👂', title: 'HEARING',
    options: [
      { mode: 'signLanguage', icon: '🤟', label: 'Sign Language Mode', hint: 'Visual-first cues replace every sound cue' },
      { mode: 'visualAlerts', icon: '📢', label: 'Visual Alerts', hint: 'Screen-edge flash whenever the app would make a sound' },
      { mode: 'captionsOn', icon: '📋', label: 'Captions Always On', hint: 'Live Service captions start on, automatically' },
    ],
  },
  {
    id: 'motor', icon: '✋', title: 'MOTOR & PHYSICAL',
    options: [
      { mode: 'largeTargets', icon: '🎯', label: 'Large Click Targets', hint: 'Every button grows to an easy, forgiving size' },
      { mode: 'keyboardOnly', icon: '⌨️', label: 'Keyboard Navigation Only', hint: 'Arrows move, Enter selects, Escape always closes' },
      { mode: 'extendedTime', icon: '⏱', label: 'Extended Time', hint: 'Nothing expires — confirmations and sessions wait for you' },
      { mode: 'switchControl', icon: '🖲', label: 'Switch Control Support', hint: 'Sequential focus with a strong visible ring for switch devices' },
    ],
  },
  {
    id: 'speech', icon: '💬', title: 'SPEECH & COMMUNICATION',
    options: [
      { mode: 'speechInput', icon: '🗣', label: 'Speech-to-Text Input', hint: 'Microphone buttons appear on text fields' },
      { mode: 'simpleLanguage', icon: '📖', label: 'Simplified Language', hint: 'Plain words, short sentences everywhere' },
    ],
  },
];

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`ua-switch ${on ? 'on' : ''}`}
    >
      <span className="ua-knob" />
    </button>
  );
}

// Any component (like the login card's ♿ orb) can open this panel by
// calling openAccessPanel() — one control room, many doors.
export function openAccessPanel() {
  document.dispatchEvent(new CustomEvent('ntcc:open-access'));
}

export default function UniversalAccess() {
  const { modes, toggleMode, colorVision, setColorVision, fontScale, setFontScale,
          reducedMotion, setReducedMotion, announce } = useA11y();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Category | null>(null);

  // Escape always closes (GetWell keyboard signature).
  useEffect(() => {
    const esc = () => { setCat(null); setOpen(false); };
    const openReq = () => { setOpen(true); setCat(null); narrate('Universal Access. Choose a category.'); };
    document.addEventListener('ntcc:escape', esc);
    document.addEventListener('ntcc:open-access', openReq);
    return () => {
      document.removeEventListener('ntcc:escape', esc);
      document.removeEventListener('ntcc:open-access', openReq);
    };
  }, []);

  const flip = (o: Option) => {
    toggleMode(o.mode);
    const now = !modes[o.mode];
    announce(`${o.label} ${now ? 'on' : 'off'}`);
    narrate(`${o.label} ${now ? 'enabled' : 'disabled'}. ${o.hint}`);
  };

  return (
    <>
      {/* The floating glass ♿ — always one tap away, never in the way */}
      <button
        className="ua-fab" aria-label="Universal Access — accessibility options"
        onClick={() => { setOpen(true); setCat(null); narrate('Universal Access. Choose a category.'); }}
      >
        <AccessOrb size={44} />
      </button>

      {open && (
        <div className="ua-overlay" role="dialog" aria-modal="true" aria-label="Universal Access">
          <div className="ua-panel">
            {/* Header: Back (in a category) and Close (always) */}
            <div className="ua-header">
              {cat
                ? <button className="glass-btn hover-glass text-sm" onClick={() => setCat(null)}>← Back</button>
                : <span className="ua-header-icon">♿</span>}
              <h2 className="ua-title">{cat ? `${cat.icon} ${cat.title}` : 'Universal Access'}</h2>
              <button className="glass-btn hover-glass text-sm" aria-label="Close" onClick={() => { setCat(null); setOpen(false); }}>✕</button>
            </div>
            {!cat && <p className="ua-sub">Customizable options for every ability and need</p>}

            <div className="ua-body">
              {!cat && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {CATEGORIES.map((c) => {
                      const active = c.options.filter((o) => modes[o.mode]).length;
                      return (
                        <button key={c.id} className="ua-cat hover-glass" onClick={() => { setCat(c); narrate(`${c.title}. ${c.options.length} options.`); }}>
                          <span className="text-2xl">{c.icon}</span>
                          <span className="ua-cat-title">{c.title}</span>
                          <span className="ua-cat-count">{active > 0 ? `${active} on` : `${c.options.length} options`}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Text size + motion live on the home screen of the panel */}
                  <div className="ua-row mt-4">
                    <span className="ua-row-label">🔠 Text Size</span>
                    <input type="range" min={0.8} max={2} step={0.1} value={fontScale}
                      aria-label="Text size"
                      onChange={(e) => setFontScale(+e.target.value)} />
                    <span className="text-accent text-sm w-12">{Math.round(fontScale * 100)}%</span>
                  </div>
                  <div className="ua-row">
                    <span className="ua-row-label">🎬 Reduced Motion</span>
                    <Toggle on={reducedMotion} label="Reduced motion"
                      onClick={() => { setReducedMotion(!reducedMotion); announce(`Reduced motion ${!reducedMotion ? 'on' : 'off'}`); }} />
                  </div>
                </>
              )}

              {cat && (
                <>
                  {cat.options.map((o) => (
                    <div key={o.mode} className="ua-row">
                      <div className="flex-1">
                        <p className="ua-row-label">{o.icon} {o.label}</p>
                        <p className="ua-row-hint">{o.hint}</p>
                      </div>
                      <Toggle on={modes[o.mode]} label={o.label} onClick={() => flip(o)} />
                    </div>
                  ))}

                  {cat.id === 'vision' && (
                    <>
                      <p className="ua-row-hint mt-3 mb-2">Color Vision Types:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {COLOR_VISION_OPTIONS.map((c) => (
                          <button key={c.id}
                            className={`glass-btn hover-glass text-sm ${colorVision === c.id ? 'primary' : ''}`}
                            onClick={() => { setColorVision(c.id); announce(`Color vision: ${c.label}`); }}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <button className="ua-close" onClick={() => { setCat(null); setOpen(false); }}>
              Close Settings
            </button>
          </div>
        </div>
      )}
    </>
  );
}
