// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The landing page — "Welcome Back!" screen with
// church picker, role selector, demo logins, and language cycling.
// Explanation: This is the front door of the sanctuary app. Every musician,
// director, and admin enters here. The church picker pulls from the single
// registry in `src/lib/churches.ts` — no hardcoded lists, no missing churches.
// The role selector determines which menu tiles and sections the user sees.
// Demo logins let visitors try the app without an account.
// In Other Words: The greeter at the door who asks "Which church are you
// from?" and "What do you do here?" before handing you the right key.
// ==========================================================================

import { useState, useEffect, useMemo } from 'react';
import { CHURCH_REGISTRY, type ChurchEntry } from '../lib/churches';
import { type ChurchProfile } from '../lib/church';
import { type Role } from '../lib/auth';

// --------------------------------------------------------------------------
// Demo credentials — one-tap login for testing each role
// --------------------------------------------------------------------------
const DEMO_LOGINS: { role: Role; label: string; emoji: string }[] = [
  { role: 'admin', label: 'Admin', emoji: '👑' },
  { role: 'editor', label: 'Editor', emoji: '✏️' },
  { role: 'sound', label: 'Sound', emoji: '🔊' },
  { role: 'media', label: 'Media', emoji: '📺' },
  { role: 'tempo', label: 'Tempo', emoji: '⏱️' },
  { role: 'musician', label: 'Musician', emoji: '🎷' },
  { role: 'viewer', label: 'Viewer', emoji: '👁️' },
];

// Supported languages for the 🌐 orb
const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Español', native: 'Español' },
  { code: 'tl', name: 'Tagalog', native: 'Tagalog' },
  { code: 'de', name: 'Deutsch', native: 'Deutsch' },
];

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------
interface LoginProps {
  onLogin: (role: Role, churchCode: string) => void;
  churchProfile: ChurchProfile | null;
}

// --------------------------------------------------------------------------
// Login page
// --------------------------------------------------------------------------
export default function Login({ onLogin, churchProfile }: LoginProps) {
  const [churchCode, setChurchCode] = useState(churchProfile?.code ?? '');
  const [role, setRole] = useState<Role>('viewer');
  const [langIndex, setLangIndex] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Pre-select the church from the subdomain or saved profile
  useEffect(() => {
    if (churchProfile?.code) {
      setChurchCode(churchProfile.code);
    }
  }, [churchProfile]);

  // Sort churches: org first, then seminaries, then churches alphabetically
  const sortedChurches = useMemo(() => {
    const org = CHURCH_REGISTRY.filter((c) => c.kind === 'org');
    const seminaries = CHURCH_REGISTRY.filter((c) => c.kind === 'seminary')
      .sort((a, b) => a.name.localeCompare(b.name));
    const churches = CHURCH_REGISTRY.filter((c) => c.kind === 'church')
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...org, ...seminaries, ...churches];
  }, []);

  const selectedChurch = useMemo(
    () => CHURCH_REGISTRY.find((c) => c.code === churchCode),
    [churchCode]
  );

  const currentLang = LANGUAGES[langIndex];

  // ------------------------------------------------------------------------
  // Translations
  // ------------------------------------------------------------------------
  const t = useMemo(() => {
    const dict: Record<string, Record<string, string>> = {
      en: {
        welcome: 'Welcome Back!',
        subtitle: 'Sign in to your church music ministry',
        churchLabel: 'Select Your Church',
        roleLabel: 'Your Role',
        signIn: 'Sign In',
        demo: 'Or try a demo login:',
        language: 'Language',
      },
      es: {
        welcome: '¡Bienvenido!',
        subtitle: 'Inicia sesión en el ministerio musical de tu iglesia',
        churchLabel: 'Selecciona tu Iglesia',
        roleLabel: 'Tu Rol',
        signIn: 'Iniciar Sesión',
        demo: 'O prueba una sesión de demostración:',
        language: 'Idioma',
      },
      tl: {
        welcome: 'Maligayang Pagbabalik!',
        subtitle: 'Mag-sign in sa iyong music ministry',
        churchLabel: 'Piliin ang Iyong Simbahan',
        roleLabel: 'Iyong Tungkulin',
        signIn: 'Mag-Sign In',
        demo: 'O subukan ang demo login:',
        language: 'Wika',
      },
      de: {
        welcome: 'Willkommen zurück!',
        subtitle: 'Melden Sie sich bei Ihrem Kirchenmusikdienst an',
        churchLabel: 'Wählen Sie Ihre Kirche',
        roleLabel: 'Ihre Rolle',
        signIn: 'Anmelden',
        demo: 'Oder testen Sie eine Demo-Anmeldung:',
        language: 'Sprache',
      },
    };
    return dict[currentLang.code] ?? dict.en;
  }, [currentLang]);

  // ------------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------------
  const handleSignIn = () => {
    if (!churchCode) return;
    onLogin(role, churchCode);
  };

  const handleDemoLogin = (demoRole: Role) => {
    const code = churchCode || 'graham';
    setRole(demoRole);
    onLogin(demoRole, code);
  };

  const cycleLanguage = () => {
    setLangIndex((i) => (i + 1) % LANGUAGES.length);
  };

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------
  return (
    <div className="login-screen">
      {/* Language orb — bottom left, cycles languages */}
      <button
        className="orb orb-language"
        onClick={cycleLanguage}
        aria-label={`Current language: ${currentLang.native}. Click to cycle.`}
        title={`${currentLang.native} — click to cycle`}
      >
        🌐
      </button>

      {/* Login card — centered, glass morphism */}
      <div className="login-card glass-card-solid">
        {/* Brand */}
        <div className="brand">{t.welcome}</div>
        <div className="subtitle">{t.subtitle}</div>

        {/* Church selector */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label htmlFor="church-select">{t.churchLabel}</label>
          <select
            id="church-select"
            value={churchCode}
            onChange={(e) => setChurchCode(e.target.value)}
            className="church-select"
          >
            <option value="" disabled>
              — Select a church —
            </option>
            {sortedChurches.map((church) => (
              <option key={church.code} value={church.code}>
                {church.name} — {church.location}
              </option>
            ))}
          </select>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label htmlFor="role-select">{t.roleLabel}</label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="church-select"
          >
            <option value="admin">👑 Admin — Full access</option>
            <option value="editor">✏️ Editor — Can edit songs & setlists</option>
            <option value="sound">🔊 Sound — Audio & mixing</option>
            <option value="media">📺 Media — Video & lighting</option>
            <option value="tempo">⏱️ Tempo — Conductor & metronome</option>
            <option value="musician">🎷 Musician — Parts & practice</option>
            <option value="viewer">👁️ Viewer — Read-only access</option>
          </select>
        </div>

        {/* Sign In button */}
        <button
          className="btn btn-primary"
          onClick={handleSignIn}
          disabled={!churchCode}
          style={{ width: '100%', marginBottom: '1.5rem' }}
        >
          {t.signIn}
        </button>

        {/* Demo logins */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--ntcc-text-muted)',
              marginBottom: '0.75rem',
            }}
          >
            {t.demo}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              justifyContent: 'center',
            }}
          >
            {DEMO_LOGINS.map((demo) => (
              <button
                key={demo.role}
                className="btn btn-secondary btn-sm"
                onClick={() => handleDemoLogin(demo.role)}
                title={`Demo as ${demo.label}`}
              >
                {demo.emoji} {demo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected church info */}
        {selectedChurch && (
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--glass-border)',
              fontSize: '0.8125rem',
              color: 'var(--ntcc-text-muted)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--ntcc-gold)' }}>
              {selectedChurch.name}
            </div>
            <div>{selectedChurch.location}</div>
            {selectedChurch.social.website && (
              <a
                href={selectedChurch.social.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--ntcc-gold)',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginTop: '0.25rem',
                }}
              >
                🌐 {selectedChurch.social.website}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
