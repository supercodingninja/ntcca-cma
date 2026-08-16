// ==========================================================================
// This Area Of Code Is: The Universal Access Engine — the GetWell card's
// signature accessibility, upgraded into the most accessible worship app
// ever shipped.
// Explanation: One central store drives EVERY accommodation: font scaling
// (80%–200%), WCAG-AAA contrast, reduced motion, director themes, narration,
// plus the full GetWell Universal Access roster — neurodivergent modes
// (Autism-Calm, ADHD-Focus, Dyslexia Font, Dyspraxia), mental-health modes
// (Anxiety Relief, PTSD No-Flash, Bipolar/Mania, Cognitive Load Reduction),
// vision modes (Screen Reader, High Contrast, eight Color Vision filters),
// hearing modes (Sign Language, Visual Alerts, Captions Always On), motor
// modes (Large Targets, Keyboard-Only, Extended Time, Switch Control), and
// speech modes (Speech-to-Text, Simplified Language). Everything persists
// per device and applies instantly through document data-attributes and
// SVG color matrices that the CSS reads.
// In Other Words: Every saint — blind, deaf, autistic, anxious, shaky
// hands, slow reader, any of God's children — uses this app THEIR way.
// ==========================================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setNarration, narrationEnabled } from './narration';

export type DirectorTheme = 'masculine' | 'feminine' | 'unisex';

// Every toggleable accommodation mode (persisted under ntcc.ua.*).
export type AccessMode =
  // 🧠 Neurodivergent
  | 'calm' | 'focus' | 'dyslexiaFont' | 'dyspraxia'
  // 💙 Mental health
  | 'anxietyRelief' | 'noFlash' | 'steadyMood' | 'lowCognitive'
  // 👁 Vision
  | 'screenReader' | 'highContrast'
  // 👂 Hearing
  | 'signLanguage' | 'visualAlerts' | 'captionsOn'
  // ✋ Motor & physical
  | 'largeTargets' | 'keyboardOnly' | 'extendedTime' | 'switchControl'
  // 💬 Speech & communication
  | 'speechInput' | 'simpleLanguage';

export type ColorVision =
  | 'normal' | 'deuteranomaly' | 'deuteranopia'
  | 'protanomaly' | 'protanopia'
  | 'tritanomaly' | 'tritanopia' | 'achromatopsia';

export const COLOR_VISION_OPTIONS: Array<{ id: ColorVision; label: string }> = [
  { id: 'normal', label: 'Normal Vision' },
  { id: 'deuteranomaly', label: 'Deuteranomaly' },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'protanomaly', label: 'Protanomaly' },
  { id: 'protanopia', label: 'Protanopia' },
  { id: 'tritanomaly', label: 'Tritanomaly' },
  { id: 'tritanopia', label: 'Tritanopia' },
  { id: 'achromatopsia', label: 'Achromatopsia' },
];

interface A11yState {
  fontScale: number;
  setFontScale: (v: number) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  theme: DirectorTheme;
  setTheme: (t: DirectorTheme) => void;
  narration: boolean;
  setNarrationEnabled: (v: boolean) => void;
  announce: (msg: string) => void;
  announcement: string;
  // Universal Access additions
  modes: Record<AccessMode, boolean>;
  toggleMode: (m: AccessMode) => void;
  colorVision: ColorVision;
  setColorVision: (c: ColorVision) => void;
}

const Ctx = createContext<A11yState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

const ALL_MODES: AccessMode[] = [
  'calm', 'focus', 'dyslexiaFont', 'dyspraxia',
  'anxietyRelief', 'noFlash', 'steadyMood', 'lowCognitive',
  'screenReader', 'highContrast',
  'signLanguage', 'visualAlerts', 'captionsOn',
  'largeTargets', 'keyboardOnly', 'extendedTime', 'switchControl',
  'speechInput', 'simpleLanguage',
];

function loadModes(): Record<AccessMode, boolean> {
  const out = {} as Record<AccessMode, boolean>;
  for (const m of ALL_MODES) out[m] = load(`ntcc.ua.${m}`, false);
  return out;
}

export function A11yProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScale] = useState(() => load('ntcc.fontScale', 1));
  const [highContrast, setHighContrastState] = useState(() => load('ntcc.contrast', false));
  const [reducedMotion, setReducedMotion] = useState(() =>
    load('ntcc.motion', window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [theme, setTheme] = useState<DirectorTheme>(() => load('ntcc.theme', 'unisex'));
  const [narration, setNarrationState] = useState(() => narrationEnabled());
  const [announcement, setAnnouncement] = useState('');
  const [modes, setModes] = useState<Record<AccessMode, boolean>>(loadModes);
  const [colorVision, setColorVision] = useState<ColorVision>(() => load('ntcc.ua.colorVision', 'normal'));

  const setNarrationEnabled = (v: boolean) => {
    setNarration(v);
    setNarrationState(v);
  };
  const setHighContrast = (v: boolean) => {
    setHighContrastState(v);
    setModes((p) => ({ ...p, highContrast: v }));
  };
  const toggleMode = (m: AccessMode) => {
    // Compute the next value FIRST, then fire every side effect from the
    // event handler — never inside a state updater (StrictMode double-
    // invokes updaters, which used to desync narration/contrast).
    const nextValue = !modes[m];
    setModes((p) => ({ ...p, [m]: nextValue }));
    if (m === 'highContrast') setHighContrastState(nextValue);
    if (m === 'screenReader') setNarrationEnabled(nextValue);
    if (m === 'noFlash' && nextValue) setReducedMotion(true);
    if (m === 'calm' && nextValue) setReducedMotion(true);
  };

  // Apply everything to the document so the token CSS does the work.
  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty('--font-scale', String(Math.min(2, Math.max(0.8, fontScale))));
    el.dataset.contrast = highContrast ? 'high' : 'normal';
    el.dataset.motion = reducedMotion ? 'reduced' : 'full';
    el.dataset.theme = theme;
    el.dataset.cvd = colorVision;
    for (const m of ALL_MODES) el.dataset[m] = modes[m] ? 'on' : 'off';
    localStorage.setItem('ntcc.fontScale', JSON.stringify(fontScale));
    localStorage.setItem('ntcc.contrast', JSON.stringify(highContrast));
    localStorage.setItem('ntcc.motion', JSON.stringify(reducedMotion));
    localStorage.setItem('ntcc.theme', JSON.stringify(theme));
    localStorage.setItem('ntcc.ua.colorVision', JSON.stringify(colorVision));
    for (const m of ALL_MODES) localStorage.setItem(`ntcc.ua.${m}`, JSON.stringify(modes[m]));
  }, [fontScale, highContrast, reducedMotion, theme, modes, colorVision]);

  // Screen-reader announcements via an ARIA live region (rendered in App).
  const announce = (msg: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(msg));
  };

  return (
    <Ctx.Provider value={{
      fontScale, setFontScale, highContrast, setHighContrast,
      reducedMotion, setReducedMotion, theme, setTheme,
      narration, setNarrationEnabled, announce, announcement,
      modes, toggleMode, colorVision, setColorVision,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useA11y(): A11yState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useA11y outside provider');
  return v;
}

// This Area Of Code Is: Keyboard navigation (GetWell signature).
// Explanation: Global Arrow / Escape handling. ArrowLeft/Right move through
// tab-like [data-nav] items, Escape closes any overlay. Attach once at the
// app shell. Extended Time mode is honored by sections that run timers —
// they check dataset.extendedTime before expiring anything.
export function attachKeyboardNav(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Escape') return;
    if (e.key === 'Escape') {
      (document.activeElement as HTMLElement | null)?.blur();
      document.dispatchEvent(new CustomEvent('ntcc:escape'));
      return;
    }
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-nav]'));
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % items.length
      : (idx - 1 + items.length) % items.length;
    items[next]?.focus();
    e.preventDefault();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
