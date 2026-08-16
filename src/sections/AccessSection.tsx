// ==========================================================================
// This Area Of Code Is: The Access section — signature accessibility panel
// + the 47+ language picker.
// Explanation: Font scaling, high contrast, reduced motion — all live, all
// persisted. The language picker is searchable with native names and
// announces the switch to screen readers.
// ==========================================================================

import { useState } from 'react';
import { useA11y } from '../lib/a11y';
import { useI18n, LANGUAGES } from '../lib/i18n';

export default function AccessSection() {
  const { t, lang, setLang } = useI18n();
  const {
    fontScale, setFontScale, highContrast, setHighContrast,
    reducedMotion, setReducedMotion, narration, setNarrationEnabled, announce,
  } = useA11y();
  const [filter, setFilter] = useState('');

  const langs = LANGUAGES.filter((l) =>
    l.native.toLowerCase().includes(filter.toLowerCase()) ||
    l.english.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Accessibility engine controls */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="font-display text-xl text-accent">♿ {t('access')}</h2>

        <div>
          <label className="block text-sm mb-1" htmlFor="fscale">
            {t('fontSize')} — {Math.round(fontScale * 100)}%
          </label>
          <input
            id="fscale" type="range" min={0.8} max={2} step={0.05}
            value={fontScale} onChange={(e) => setFontScale(+e.target.value)}
            className="w-full"
          />
          <p className="text-muted text-xs">{t('fontSizeHint')}</p>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span>{t('contrast')} <span className="text-muted text-xs block">{t('contrastHint')}</span></span>
          <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)}
                 className="w-6 h-6 accent-[#d4af37]" />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span>{t('motion')} <span className="text-muted text-xs block">{t('motionHint')}</span></span>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)}
                 className="w-6 h-6 accent-[#d4af37]" />
        </label>

        {/* Narration — the app speaks what's on the page and what it did */}
        <label className="flex items-center justify-between cursor-pointer">
          <span>🔊 Narration <span className="text-muted text-xs block">The app reads pages and actions aloud.</span></span>
          <input type="checkbox" checked={narration} onChange={(e) => setNarrationEnabled(e.target.checked)}
                 className="w-6 h-6 accent-[#d4af37]" />
        </label>
      </div>

      {/* 47+ language picker */}
      <div className="glass-card p-6">
        <h2 className="font-display text-xl text-accent mb-3">🌍 {t('language')} · {LANGUAGES.length}+</h2>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('searchSongs')}
          className="w-full rounded-full px-5 py-2.5 mb-3 bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
          aria-label={t('language')}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {langs.map((l) => (
            <button
              key={l.code}
              className={`glass-btn text-sm justify-start ${lang === l.code ? 'primary' : ''}`}
              onClick={() => { setLang(l.code); announce(`${t('language')}: ${l.native}`); }}
              aria-pressed={lang === l.code}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
