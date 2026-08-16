// ==========================================================================
// This Area Of Code Is: The language orb — one glass globe, 48 languages.
// Explanation: A floating glass button with a golden halo, sitting right
// beside the Universal Access ♿ on every screen including login. Tap it
// and a glass panel rises with every language written in its OWN tongue
// (never flags — languages aren't countries), a live search, the current
// language crowned in gold, and instant RTL flipping. Escape or the gold
// bar closes it, always.
// In Other Words: Any saint, from any nation, taps the glowing globe and
// the app speaks their heart language.
// ==========================================================================

import { useEffect, useState } from 'react';
import { LANGUAGES, useI18n } from '../lib/i18n';
import { narrate } from '../lib/narration';
import EarthOrb from './EarthOrb';

// Any component (like the login card's language pill) can open this panel
// by calling openLanguagePanel() — one panel, many doors.
export function openLanguagePanel() {
  document.dispatchEvent(new CustomEvent('ntcc:open-language'));
}

export default function LanguageAccess() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const esc = () => setOpen(false);
    const openReq = () => { setOpen(true); narrate('Language. Choose your language.'); };
    document.addEventListener('ntcc:escape', esc);
    document.addEventListener('ntcc:open-language', openReq);
    return () => {
      document.removeEventListener('ntcc:escape', esc);
      document.removeEventListener('ntcc:open-language', openReq);
    };
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang);
  const q = query.trim().toLowerCase();
  const shown = LANGUAGES.filter((l) =>
    !q || l.native.toLowerCase().includes(q) || l.english.toLowerCase().includes(q) || l.code.includes(q));

  return (
    <>
      <button
        className="ua-fab lang-fab" aria-label={`Language — currently ${current?.english ?? 'English'}`}
        onClick={() => { setOpen(true); narrate('Language. Choose your language.'); }}
      >
        <EarthOrb size={42} />
      </button>

      {open && (
        <div className="ua-overlay" role="dialog" aria-modal="true" aria-label="Language">
          <div className="ua-panel">
            <div className="ua-header">
              <span className="ua-header-icon"><EarthOrb size={30} /></span>
              <h2 className="ua-title">Language · Idioma</h2>
              <button className="glass-btn hover-glass text-sm" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            </div>
            {/* English is the default and stays on top; Español second;
                the world after — no scoreboard, just pick your tongue. */}
            <p className="ua-sub">Choose your language · Elige tu idioma</p>

            <div className="ua-body">
              <input
                className="auth-input w-full mb-3"
                placeholder="Search languages…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shown.map((l) => (
                  <button
                    key={l.code}
                    className={`menu-tile hover-glass lang-tile ${l.code === lang ? 'active' : ''}`}
                    onClick={() => { setLang(l.code); setOpen(false); narrate(l.english); }}
                  >
                    <span className="lang-native">{l.native}</span>
                    <span className="lang-english">{l.english}{l.rtl ? ' · RTL' : ''}</span>
                  </button>
                ))}
                {shown.length === 0 && <p className="text-muted text-sm col-span-full">No language matches "{query}".</p>}
              </div>
            </div>

            <button className="ua-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
