// ==========================================================================
// This Area Of Code Is: Tonya's Theme Studio — push-and-click church looks.
// Explanation: Like WordPress / Wix / Figma community templates, an org
// admin picks a preset theme or tweaks the colors, and the WHOLE CHURCH's
// app repaints — musicians, sound, media, tempo, editors, everyone under
// that church code. Themes are CSS variables on :root, so functions never
// break. And Tonya's guardrail is absolute: no feature may ever be REMOVED.
// Try, and she warns "You're forgetting about this feature!" and relocates
// it instead. Buttons may appear differently or in a different order — but
// every capability always survives.
// In Other Words: Change the paint all you want. The house stands.
// ==========================================================================

import { loadChurchProfile } from './church';

export interface ChurchTheme {
  presetId: string;
  accent: string;         // --accent
  bgDeep: string;         // app background base
  glassBg: string;        // --glass-bg
  textPrimary: string;    // --text-primary
  density: 'cozy' | 'comfortable';
  navStyle: 'classic' | 'compact';
}

export interface ThemePreset {
  id: string;
  name: string;
  swatch: string;         // preview color
  theme: Omit<ChurchTheme, 'presetId'>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'ntcca-gold', name: 'NTCCA Gold (classic)', swatch: '#d4af37',
    theme: { accent: '#d4af37', bgDeep: '#0a0a0f', glassBg: 'rgba(255,255,255,0.06)', textPrimary: '#f5f1e6', density: 'comfortable', navStyle: 'classic' },
  },
  {
    id: 'praise-violet', name: 'Praise Violet', swatch: '#9d7bea',
    theme: { accent: '#b78ff5', bgDeep: '#0d0a14', glassBg: 'rgba(157,123,234,0.10)', textPrimary: '#f2eefc', density: 'comfortable', navStyle: 'classic' },
  },
  {
    id: 'river-blue', name: 'River of Life Blue', swatch: '#4fa3d1',
    theme: { accent: '#6cbbe8', bgDeep: '#08101a', glassBg: 'rgba(108,187,232,0.08)', textPrimary: '#eaf4fb', density: 'comfortable', navStyle: 'classic' },
  },
  {
    id: 'olive-peace', name: 'Olive Branch', swatch: '#7d9b5a',
    theme: { accent: '#a4c47c', bgDeep: '#0c110a', glassBg: 'rgba(164,196,124,0.08)', textPrimary: '#f0f5e8', density: 'comfortable', navStyle: 'compact' },
  },
  {
    id: 'ember-revival', name: 'Revival Ember', swatch: '#d1694f',
    theme: { accent: '#e88a6c', bgDeep: '#140b08', glassBg: 'rgba(232,138,108,0.08)', textPrimary: '#fbf0ea', density: 'cozy', navStyle: 'compact' },
  },
  {
    id: 'dove-white', name: 'Dove White (high light)', swatch: '#e8e4da',
    theme: { accent: '#8a6d2f', bgDeep: '#efece4', glassBg: 'rgba(0,0,0,0.05)', textPrimary: '#211d14', density: 'comfortable', navStyle: 'classic' },
  },
];

const themeKey = () => `ntcc.theme.${loadChurchProfile().code || 'default'}`;

export function loadChurchTheme(): ChurchTheme {
  try {
    const raw = localStorage.getItem(themeKey());
    if (raw) return JSON.parse(raw) as ChurchTheme;
  } catch { /* fall through */ }
  return { presetId: 'ntcca-gold', ...THEME_PRESETS[0].theme };
}

export function saveChurchTheme(t: ChurchTheme): void {
  localStorage.setItem(themeKey(), JSON.stringify(t));
  applyChurchTheme(t);
}

// Repaint the live app — CSS variables only, so nothing functional moves.
export function applyChurchTheme(t: ChurchTheme): void {
  const r = document.documentElement.style;
  r.setProperty('--accent', t.accent);
  r.setProperty('--glass-bg', t.glassBg);
  r.setProperty('--text-primary', t.textPrimary);
  r.setProperty('--app-bg', t.bgDeep);
  document.body.style.background = t.bgDeep;
  document.body.dataset.themePreset = t.presetId;
  document.body.dataset.density = t.density;
  document.body.dataset.navStyle = t.navStyle;
}

// Apply on boot (called once from main/Home).
export function bootChurchTheme(): void {
  applyChurchTheme(loadChurchTheme());
}

/* ------------------------- The Feature Guardrail ------------------------ */
// Every capability of the app, named. Tonya walks this list when an admin
// restyles: anything the new layout would hide is RELOCATED, never dropped.
export const GUARDED_FEATURES = [
  { id: 'library', label: 'Song Library' },
  { id: 'song', label: 'Song View & Transpose' },
  { id: 'setlist', label: 'Setlist' },
  { id: 'live', label: 'Live Service' },
  { id: 'musician', label: 'Musician Portal' },
  { id: 'presenter', label: 'Presenter' },
  { id: 'director', label: 'Music Director Tools' },
  { id: 'engineer', label: 'Engineer Bench' },
  { id: 'tools', label: 'Tuner & Audio Tools' },
  { id: 'ai', label: 'AI Assistants' },
  { id: 'access', label: 'Accessibility & Language' },
  { id: 'profile', label: 'Profile' },
] as const;

export type FeaturePlacement = 'nav' | 'menu' | 'header';

const placeKey = () => `ntcc.theme.placements.${loadChurchProfile().code || 'default'}`;

export function loadPlacements(): Record<string, FeaturePlacement> {
  try {
    const raw = localStorage.getItem(placeKey());
    if (raw) return JSON.parse(raw) as Record<string, FeaturePlacement>;
  } catch { /* fall through */ }
  // Default: everything reachable; four essentials in nav, rest in menu.
  const out: Record<string, FeaturePlacement> = {};
  for (const f of GUARDED_FEATURES) out[f.id] = 'menu';
  out.library = 'nav'; out.song = 'nav'; out.setlist = 'nav'; out.live = 'nav';
  return out;
}

export function savePlacements(p: Record<string, FeaturePlacement>): void {
  localStorage.setItem(placeKey(), JSON.stringify(p));
}

// THE GUARDRAIL: a placement plan is valid only if EVERY feature is placed
// somewhere. Anything missing is relocated to the menu — with a warning.
export function enforceGuardrail(p: Record<string, FeaturePlacement>): {
  fixed: Record<string, FeaturePlacement>;
  warnings: string[];
} {
  const fixed = { ...p };
  const warnings: string[] = [];
  for (const f of GUARDED_FEATURES) {
    if (!fixed[f.id]) {
      fixed[f.id] = 'menu';
      warnings.push(`⚠️ You're forgetting about this feature: ${f.label} — Tonya won't let it be removed, so she placed it in the ✦ menu.`);
    }
  }
  return { fixed, warnings };
}
