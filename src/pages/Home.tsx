// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The App Shell — auth gate, role universe, photo
// backdrop, tab navigation, and engine wiring.
// Explanation: Signed-out users see the Adoración-style Login over the
// cinematic photo reel. Signed-in users get the app painted in their role's
// colors (Admin gold / Editor violet / Viewer warm). Viewers first pass
// through In Memoriam. Admin/Editor get the "View as Viewer" safety toggle.
// The whole app runs local-first — no server can ever break it.
// ==========================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import LibrarySection from '../sections/LibrarySection';
import SongViewSection from '../sections/SongViewSection';
import SetlistSection from '../sections/SetlistSection';
import DirectorSection from '../sections/DirectorSection';
import SecuritySection from '../sections/SecuritySection';
import UniversalAccess from '../components/UniversalAccess';
import LanguageAccess from '../components/LanguageAccess';
import CvdFilters from '../components/CvdFilters';
import HistorySection from '../sections/HistorySection';
import ToolsSection from '../sections/ToolsSection';
import AISection from '../sections/AISection';
import LightingSection from '../sections/LightingSection';
import EngineerSection from '../sections/EngineerSection';
import ProfileSection from '../sections/ProfileSection';
import MusicianSection from '../sections/MusicianSection';
import PresenterSection from '../sections/PresenterSection';
import { followSection } from '../lib/lights';
import EarthOrb from '../components/EarthOrb';
import AccessOrb from '../components/AccessOrb';
import { openAccessPanel } from '../components/UniversalAccess';
import { openLanguagePanel } from '../components/LanguageAccess';
import AdminSection from '../sections/AdminSection';
import SongFormSection from '../sections/SongFormSection';
import ConductorSection from '../sections/ConductorSection';
import LiveSection from '../sections/LiveSection';
import Login from './Login';
import Backdrop from '../components/Backdrop';
import InMemoriam from '../components/InMemoriam';
import { type Song, type SectionKind } from '../lib/music';
import { loadAllSongs, saveSong, deleteSong } from '../lib/songs';
import {
  AdaptiveThreatEngine, computeFingerprint, HONEYPOT_ROUTES,
  poisonPayload, type ThreatEvent,
} from '../lib/shieldwall';
import { attachKeyboardNav, useA11y } from '../lib/a11y';
import { narrate } from '../lib/narration';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { loadChurchProfile } from '../lib/church';
import BulletinPopup from '../components/BulletinPopup';
import { bootChurchTheme } from '../lib/theme';
import DashboardSection from '../sections/DashboardSection';
import EnsayoRoom from '../sections/EnsayoRoom';

type Tab = 'inicio' | 'library' | 'song' | 'setlist' | 'history' | 'director' | 'lighting' | 'engineer' | 'profile' | 'musician' | 'presenter'
  | 'conductor' | 'live' | 'tools' | 'ai' | 'security' | 'access' | 'admin' | 'ensayo';

export default function Home() {
  const { t } = useI18n();
  const { announce, announcement } = useA11y();
  const { user, effectiveRole, viewAsRole, setViewAsRole, logout } = useAuth();
  const [church] = useState(loadChurchProfile);

  const [tab, setTab] = useState<Tab>('inicio');
  const [song, setSong] = useState<Song | null>(null);
  const [songs, setSongs] = useState<Song[]>(() => loadAllSongs());
  const [editing, setEditing] = useState<Song | null | 'new'>(null);
  const [memoriamSeen, setMemoriamSeen] = useState(
    () => sessionStorage.getItem('ntcc.memoriamSeen') === '1');
  const [setlist, setSetlist] = useState<Song[]>(() => {
    try { return JSON.parse(localStorage.getItem('ntcc.setlist') ?? '[]') as Song[]; }
    catch { return []; }
  });
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [fingerprint, setFingerprint] = useState('…');
  const [firstSeen] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);

  // ==========================================================================
  // This Area Of Code Is: Body scroll lock when menu opens.
  // Explanation: When the MORE menu is open, the page behind must freeze so
  // the user can't scroll the background. Adds/removes the 'menu-locked'
  // class on document.body, which sets overflow: hidden.
  // In Other Words: The background sits still while the menu is up.
  // ==========================================================================
  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('menu-locked');
    } else {
      document.body.classList.remove('menu-locked');
    }
    return () => {
      document.body.classList.remove('menu-locked');
    };
  }, [menuOpen]);

  // Escape closes the overlay menu — the "always a way back" rule.
  useEffect(() => {
    const esc = () => setMenuOpen(false);
    document.addEventListener('ntcc:escape', esc);
    return () => document.removeEventListener('ntcc:escape', esc);
  }, []);

  const engine = useMemo(() => new AdaptiveThreatEngine(), []);

  // Tonya's church look paints the app on boot — every role, this church.
  useEffect(() => { bootChurchTheme(); }, []);

  useEffect(() => {
    engine.onEvent((e) => setEvents((prev) => [...prev, e]));
    void computeFingerprint().then(setFingerprint);
    const offKeys = attachKeyboardNav();
    if (HONEYPOT_ROUTES.some((r) => location.pathname.startsWith(r))) {
      engine.report('honeypot-touch', `Landing on ${location.pathname}`, 'critical');
      document.title = poisonPayload(location.pathname).split('\n')[0];
    }
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { offKeys(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [engine]);

  useEffect(() => {
    localStorage.setItem('ntcc.setlist', JSON.stringify(setlist));
  }, [setlist]);

  const openSong = (s: Song) => {
    setSong(s);
    setTab('song');
    announce(`${t('nowPlaying')}: ${s.title}`);
    narrate(`${s.title}. ${t('key')} ${s.key}. ${s.bpm} beats per minute.`);
  };

  // This Area Of Code Is: Page narration on every tab change.
  // Explanation: When narration is enabled in Access, the app speaks what
  // page you landed on and what is on it — so the page tells you what it
  // said and what it did.
  useEffect(() => {
    const descriptions: Record<Tab, string> = {
      inicio: 'Home dashboard. Your ministry at a glance.',
      ensayo: 'Practice room. Video tiles, practice queue, synchronized playback, team chat.',
      library: `${t('library')}. ${songs.length} ${t('songsInLibrary')}.`,
      song: song ? `${song.title}.` : t('library'),
      setlist: `${t('setlist')}. ${setlist.length} songs.`,
      history: 'Tracking. Practice and performance history.',
      director: 'Music Director tools. Cut buzzer and metronome.',
      conductor: 'Unity Conductor. Blink to set the tempo.',
      live: 'Live Service. Watch the service with live captions.',
      tools: 'Universal tuner. A4 calibration.',
      ai: 'AI assistants. Vickie, JP, and Tanya.',
      security: 'ShieldWall security dashboard.',
      access: 'Accessibility and language settings.',
      admin: 'User management.',
      musician: 'Musician portal. Practice tracking and team roster.',
      presenter: 'Presenter. Lyric slides, scripture on-the-fly, projector and stage display.',
      lighting: 'Lighting. Stage scenes and house lights.',
      profile: 'Your profile and app settings.',
      engineer: 'Engineer bench. Sound meter, run of show, and tempo tools.',
    };
    narrate(descriptions[tab]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const addToSetlist = (s: Song) => {
    setSetlist((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
    announce(`${s.title} — ${t('addToSetlist')}`);
  };

  const onSection = (kind: SectionKind) => { followSection(kind); }; // Stage Lights follow the song when enabled

  const reportThreat = (kind: string, detail: string) => {
    engine.report(kind, detail, kind === 'payload-injection' ? 'high' : 'low');
  };

  // Song store actions — save/delete refresh the library everywhere.
  const handleSaveSong = (s: Song) => {
    saveSong(s);
    setSongs(loadAllSongs());
    setEditing(null);
    announce(`Saved ${s.title}`);
  };
  const handleDeleteSong = (s: Song) => {
    deleteSong(s.id);
    setSongs(loadAllSongs());
    if (song?.id === s.id) { setSong(null); setTab('library'); }
    setSetlist((p) => p.filter((x) => x.id !== s.id));
    announce(`Deleted ${s.title}`);
  };

  // Viewer sessions honor our brother first (spec 7.c.i).
  const mustSeeMemoriam = user && effectiveRole === 'viewer' && !memoriamSeen;
  const enterFromMemoriam = () => {
    sessionStorage.setItem('ntcc.memoriamSeen', '1');
    setMemoriamSeen(true);
  };

  const tabs = [
    { id: 'inicio', icon: '🏠', label: 'Home' },
    { id: 'library', icon: '🎵', label: t('library') },
    { id: 'ensayo', icon: '▶️', label: 'Practice' },
    { id: 'song', icon: '🎼', label: song ? song.title : 'Song' },
    { id: 'setlist', icon: '📋', label: t('setlist') },
    { id: 'history', icon: '🗓️', label: 'Tracking' },
    { id: 'musician', icon: '🎤', label: 'Portal' },
    { id: 'presenter', icon: '📽', label: 'Present' },
    { id: 'director', icon: '🎬', label: t('director') },
    { id: 'lighting', icon: '💡', label: 'Lights' },
    { id: 'conductor', icon: '🪄', label: 'Conductor' },
    { id: 'live', icon: '🔴', label: 'Live' },
    { id: 'tools', icon: '🎻', label: 'Tuner' },
    { id: 'engineer', icon: '🎛️', label: 'Engineer' },
    { id: 'profile', icon: '🙋', label: 'Profile' },
    { id: 'ai', icon: '🧠', label: 'AI' },
    { id: 'security', icon: '🛡️', label: t('security'), roles: ['admin'] },
    { id: 'admin', icon: '👥', label: 'Admin', roles: ['admin'] },
  ].filter((tb) => !tb.roles || tb.roles.includes(effectiveRole)) as { id: Tab; icon: string; label: string; roles?: string[] }[];

  // This Area Of Code Is: The viewport handshake (Navigation 3.0).
  // Explanation: We MEASURE the nav row — every icon that truly fits stays
  // out; the overflow goes to MORE. If everything fits (iPad, desktop),
  // MORE has no reason to exist and it leaves. Re-measured on every resize
  // and rotation, so a phone held sideways gets a new answer.
  const navRef = useRef<HTMLElement>(null);
  const [navVisible, setNavVisible] = useState(tabs.length);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const compute = () => {
      const total = el.clientWidth;
      const buttons = Array.from(el.querySelectorAll('[data-nav]')) as HTMLElement[];
      if (buttons.length === 0) return;
      const orbs = (el.querySelector('.nav-orbs') as HTMLElement | null)?.offsetWidth ?? 0;
      const MORE_W = 70; // the MORE pill's footprint when it must exist
      let used = orbs + 8;
      let count = 0;
      for (const b of buttons) {
        const w = b.offsetWidth + 6;
        const reserveMore = count === buttons.length - 1 ? 0 : MORE_W;
        if (used + w + reserveMore <= total) { used += w; count++; } else break;
      }
      setNavVisible(Math.max(1, count));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  return (
    <div className="min-h-screen" data-role={effectiveRole}>
      {/* Cinematic photo backdrop — every screen, every role */}
      <Backdrop role={effectiveRole} dim={user ? 0.8 : 0.35} landing={!user} />

      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>

      {!user ? (
        <Login />
      ) : mustSeeMemoriam ? (
        <InMemoriam onEnter={enterFromMemoriam} />
      ) : effectiveRole === 'viewer' ? (
        /* This Area Of Code Is: The Viewer Sanctuary (stream-only).
           Explanation: Viewers signed in with the codeword "view" — and the
           ONLY thing they see is their church's stream. No library, no
           menus, no tools: just the service, near or far, on their lunch
           break or across the world. */
        <>
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-[rgba(10,10,15,0.72)] border-b border-[var(--glass-border)]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <h1 className="font-display text-lg sm:text-xl text-accent flex items-center gap-2">
                <img src="/ntcca-emblem.png" alt="NTCCA emblem" className="w-6 h-6 rounded-sm" />
                {church.name}
              </h1>
              <button className="glass-btn text-xs" onClick={logout}>Sign out</button>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
            <LiveSection />
          </main>
        </>
      ) : (
        <>
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-[rgba(10,10,15,0.72)] border-b border-[var(--glass-border)]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <h1 className="font-display text-lg sm:text-xl text-accent">{t('appName')}</h1>
              <div className="flex items-center gap-2">
                {/* Admin AND Editor get the view-as preview (per the header spec). */}
                {(user.role === 'admin' || user.role === 'editor') && (
                  <select
                    className="auth-input !w-auto text-xs !py-1.5"
                    value={viewAsRole ?? ''}
                    onChange={(e) => setViewAsRole((e.target.value || null) as typeof viewAsRole)}
                    aria-label="View the app as any role"
                    title="See the app through their eyes — sound engineer, media, tempo, musician, or the viewer watching the live stream"
                  >
                    <option value="">👁 Admin view</option>
                    <option value="editor">👁 as Editor</option>
                    <option value="sound">👁 as Sound Eng.</option>
                    <option value="media">👁 as Media Eng.</option>
                    <option value="tempo">👁 as Tempo Eng.</option>
                    <option value="musician">👁 as Musician</option>
                    <option value="viewer">👁 as Viewer</option>
                  </select>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full border ${
                  online ? 'border-green-500 text-green-400' : 'border-amber-500 text-amber-400'}`}>
                  {online ? `● ${t('online')}` : `○ ${t('offline')}`}
                </span>
                <button className="glass-btn text-xs" onClick={logout}>Sign out</button>
              </div>
            </div>
            {/* Navigation 3.0 — THE HANDSHAKE: as many icons as the viewport
                honestly fits stay out; the rest go into MORE. Wide screen?
                Everything visible and MORE disappears entirely. Nothing ever
                bleeds past the edge again. */}
            <nav ref={navRef} className="max-w-5xl mx-auto px-2 pb-2 nav-shell" aria-label="Main">
              {tabs.map(({ id, icon, label }, i) => (
                /* Overflow icons stay IN the DOM (measurable) but invisible —
                   that's how the handshake can grow back on rotation/resize. */
                <button
                  key={id}
                  data-nav
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  aria-hidden={i >= navVisible || undefined}
                  tabIndex={i >= navVisible ? -1 : 0}
                  className={`glass-btn text-sm whitespace-nowrap ${tab === id ? 'primary' : ''}${i >= navVisible ? ' nav-collapsed' : ''}`}
                >
                  {icon} <span className="sr-only">{label}</span>
                </button>
              ))}
              {/* Language + accessibility live WITH the other selections — not
                  floating over content (boss's order) */}
              <div className="nav-orbs ml-auto">
                <button className="nav-orb-btn" onClick={() => openLanguagePanel()}
                        aria-label="Language — choose your tongue">
                  <EarthOrb size={40} />
                </button>
                <button className="nav-orb-btn" onClick={() => openAccessPanel()}
                        aria-label="Accessibility options">
                  <AccessOrb size={40} />
                </button>
              </div>
              {navVisible < tabs.length && (
                <button
                  className="nav-menu-fab"
                  aria-label="MORE — open the full section menu"
                  aria-expanded={menuOpen}
                  onClick={() => { setMenuOpen(true); narrate('Menu open. Every section, one tap away.'); }}
                >
                  <span className="nav-menu-word">MORE</span>
                  <span aria-hidden="true">✦</span>
                </button>
              )}
            </nav>
          </header>

          <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
            {tab === 'inicio' && (
              <DashboardSection songs={songs}
                onNewSong={() => { setEditing('new'); setTab('library'); }}
                onStartPractice={() => setTab('ensayo')}
                onGoLive={() => setTab('live')} />
            )}
            {tab === 'ensayo' && <EnsayoRoom />}
            {tab === 'library' && (editing !== null ? (
              <SongFormSection
                song={editing === 'new' ? null : editing}
                onSave={handleSaveSong}
                onCancel={() => setEditing(null)}
              />
            ) : (
              // Only admin/editor may add, edit, or delete songs — the
              // engineer and musician seats read and play, they don't
              // rewrite the library.
              <LibrarySection songs={songs} canEdit={effectiveRole === 'admin' || effectiveRole === 'editor'}
                onOpen={openSong} onAdd={addToSetlist}
                onNew={() => setEditing('new')} onEdit={(s) => setEditing(s)}
                onDelete={handleDeleteSong}
                setlistIds={setlist.map((s) => s.id)} reportThreat={reportThreat} />
            ))}
            {tab === 'song' && (song
              ? <SongViewSection song={song} onSection={onSection}
                  onOpenSong={(id) => { const s = songs.find((x) => x.id === id); if (s) openSong(s); }} />
              : <div className="glass-card p-8 text-center text-muted">
                  No song selected — pick one from the 🎵 Library first.
                </div>)}
            {tab === 'setlist' && (
              <SetlistSection setlist={setlist} onOpen={openSong}
                onRemove={(id) => setSetlist((p) => p.filter((s) => s.id !== id))} />
            )}
            {tab === 'history' && <HistorySection songs={songs} />}
            {tab === 'musician' && <MusicianSection />}
            {tab === 'presenter' && <PresenterSection />}
            {tab === 'director' && <DirectorSection />}
            {tab === 'conductor' && <ConductorSection />}
            {tab === 'live' && <LiveSection />}
            {tab === 'tools' && <ToolsSection />}
            {tab === 'ai' && <AISection />}
            {tab === 'lighting' && <LightingSection />}
            {tab === 'engineer' && <EngineerSection />}
            {tab === 'profile' && <ProfileSection />}
            {tab === 'security' && effectiveRole === 'admin' && (
              <SecuritySection engine={engine} fingerprint={fingerprint}
                events={events} firstSeen={firstSeen} />
            )}
            {tab === 'admin' && effectiveRole === 'admin' && <AdminSection />}
          </main>

          {/* The glass overlay menu — tap ✦ and every section appears as a
              tile; tap a tile and it populates the page. Back and Close
              are always on screen, and Escape works too. */}
          {menuOpen && (
            <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="All sections">
              <div className="menu-panel">
                <div className="ua-header mb-3">
                  <button className="glass-btn hover-glass text-sm" onClick={() => setMenuOpen(false)}>← Back</button>
                  <h2 className="ua-title">✦ Every Section</h2>
                  <button className="glass-btn hover-glass text-sm" aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
                </div>
                <div className="menu-grid">
                  {tabs.map(({ id, icon, label }) => (
                    <button
                      key={id}
                      className={`menu-tile hover-glass ${tab === id ? 'active' : ''}`}
                      onClick={() => { setTab(id); setMenuOpen(false); }}
                    >
                      <span className="tile-icon">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <button className="ua-close" onClick={() => setMenuOpen(false)}>Close Menu</button>
              </div>
            </div>
          )}

          <footer className={`app-copyright${menuOpen ? ' hidden' : ''}`}>
            © 2026 NTCCA Music App™ · Gifted to New Testament Christian Churches of America, INC. by Reverend Frederick D. Thomas, Jr.
          </footer>
        </>
      )}

      {/* The Director's Bulletin — pops up at login for EVERYONE except the
          viewer (musicians, sound, media, tempo, editors, admins) */}
      <BulletinPopup />

      {/* Universal Access — the floating ♿ and its glass control room,
          available on EVERY screen including login, plus the invisible
          color-vision filter definitions */}
      <UniversalAccess />
      <LanguageAccess />
      <CvdFilters />
    </div>
  );
}
