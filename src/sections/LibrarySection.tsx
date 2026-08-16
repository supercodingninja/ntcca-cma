// ==========================================================================
// This Area Of Code Is: The Song Library section.
// Explanation: Searchable, FILTERABLE glass-card library (spec #14: tag by
// theme; filter by key, tempo, duration — "all songs ≤ 5 minutes"). Admin/
// Editor get Add / Edit / Delete. Zero-trust: search input is sanitized
// through ShieldWall, injection attempts are reported.
// In Other Words: The whole hymnal, findable any way you think of it.
// ==========================================================================

import { useMemo, useRef, useState } from 'react';
import { type Song } from '../lib/music';
import { sanitizeText, looksLikeInjection } from '../lib/shieldwall';
import { importMusicFile } from '../lib/converter';
import { storeFile } from '../lib/fileStore';
import { kindForFile } from '../lib/attachments';
import { useI18n } from '../lib/i18n';

interface Props {
  songs: Song[];
  canEdit: boolean;
  onOpen: (song: Song) => void;
  onAdd: (song: Song) => void;
  onNew: () => void;
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  setlistIds: string[];
  reportThreat: (kind: string, detail: string) => void;
}

// Adoración parity helpers: status badge + instrument chips per song.
function songStatus(song: Song): 'arranged' | 'transcribing' | 'ready' {
  try {
    if (localStorage.getItem(`ntcc.arrange.${song.id}`)) return 'arranged';
  } catch { /* ignore */ }
  if ((song.attachments?.length ?? 0) > 0 && (song.sections?.length ?? 0) === 0) return 'transcribing';
  return 'ready';
}

function instrumentChips(song: Song): string[] {
  try {
    const raw = localStorage.getItem(`ntcc.arrange.${song.id}`);
    if (raw) {
      const a = JSON.parse(raw) as { parts?: { kind: string; assignedTo: string }[] };
      const inst = [...new Set((a.parts ?? []).filter((p) => p.kind === 'instrument').map((p) => p.assignedTo.split(' (')[0]))];
      if (inst.length) return [...inst.slice(0, 4), 'Vocals'];
    }
  } catch { /* ignore */ }
  return ['Piano', 'Guitar', 'Vocals', 'Bass'];
}

/** "4:32" → 272 seconds; unparseable = 0 (never excluded by duration filter). */
function toSeconds(d?: string): number {
  const m = d?.match(/^(\d+):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : 0;
}

export default function LibrarySection({
  songs, canEdit, onOpen, onAdd, onNew, onEdit, onDelete, setlistIds, reportThreat,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [keyF, setKeyF] = useState('');
  const [maxDur, setMaxDur] = useState(0); // minutes; 0 = any
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Universal Music Reader: ANY file, straight into the library.
  // Readable files become full songs; unreadable files are still stored in
  // the vault and attached to a new song — nothing is ever rejected.
  const doImport = async (file: File) => {
    setImportMsg(`⏳ Reading ${file.name}…`);
    const r = await importMusicFile(file, setImportMsg);
    // The original file rides along as an attachment either way.
    const ref = await storeFile(file);
    const kind = kindForFile(file);
    if (r.ok && r.song) {
      r.song.attachments = [...(r.song.attachments ?? []),
        { id: crypto.randomUUID(), name: file.name, kind, ref }];
      setImportMsg(`✓ Imported "${r.song.title}" — opening editor…`);
      onEdit(r.song); // opens in the form; Save persists it
    } else {
      // Keep the file safe on a fresh song so the user loses nothing.
      const holder: Song = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'Unknown', key: 'C', bpm: 90, timeSignature: '4/4',
        language: 'en', credit: `Uploaded file: ${file.name}`,
        sections: [],
        attachments: [{ id: crypto.randomUUID(), name: file.name, kind, ref }],
      };
      setImportMsg(`📎 ${r.error} — file kept on a new song; opening editor…`);
      onEdit(holder);
    }
  };

  const allTags = useMemo(
    () => [...new Set(songs.flatMap((s) => s.tags ?? []))].sort(),
    [songs]);
  const allKeys = useMemo(
    () => [...new Set(songs.map((s) => s.key))].sort(),
    [songs]);

  const filtered = songs.filter((s) => {
    const q = query.toLowerCase();
    const textHit = !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
    const tagHit = !tag || (s.tags ?? []).includes(tag);
    const keyHit = !keyF || s.key === keyF;
    const durHit = !maxDur || (toSeconds(s.duration) > 0 && toSeconds(s.duration) <= maxDur * 60);
    return textHit && tagHit && keyHit && durHit;
  });

  const handleSearch = (raw: string) => {
    if (looksLikeInjection(raw)) {
      reportThreat('payload-injection', `Injection attempt in library search: ${raw.slice(0, 80)}`);
    }
    setQuery(sanitizeText(raw, 120));
  };

  const sel = 'auth-input !w-auto text-sm';

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="search" value={query} onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('searchSongs')} aria-label={t('searchSongs')}
          className="flex-1 min-w-48 rounded-full px-5 py-3 bg-[var(--glass-bg-strong)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
        {canEdit && <button className="cta-gold px-5 py-3" onClick={onNew}>➕ Song</button>}
        {canEdit && (
          <>
            <button className="glass-btn px-5 py-3" onClick={() => fileRef.current?.click()}>
              📥 Import
            </button>
            {/* accept set to "all files" — the iOS file-picker fix: Safari
                ignores extension filters and blocks .sib/.mus otherwise */}
            <input
              ref={fileRef} type="file" accept="*/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }}
            />
          </>
        )}
      </div>
      {importMsg && <p className="text-sm">{importMsg}</p>}

      {/* Spec #14 filters — theme, key, duration */}
      <div className="flex gap-2 flex-wrap items-center text-sm">
        <select className={sel} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by theme">
          <option value="">🏷 All themes</option>
          {allTags.map((tg) => <option key={tg} value={tg}>#{tg}</option>)}
        </select>
        <select className={sel} value={keyF} onChange={(e) => setKeyF(e.target.value)} aria-label="Filter by key">
          <option value="">🎹 All keys</option>
          {allKeys.map((k) => <option key={k}>{k}</option>)}
        </select>
        <select className={sel} value={maxDur} onChange={(e) => setMaxDur(+e.target.value)} aria-label="Filter by duration">
          <option value={0}>⏱ Any length</option>
          <option value={3}>≤ 3 min</option>
          <option value={5}>≤ 5 min</option>
          <option value={7}>≤ 7 min</option>
        </select>
        <span className="text-muted">{filtered.length} {t('songsInLibrary')}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((song) => (
          <div key={song.id} className="glass-card interactive p-5 cursor-pointer" role="button" tabIndex={0}
               data-nav onClick={() => onOpen(song)}
               onKeyDown={(e) => e.key === 'Enter' && onOpen(song)}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl text-accent">{song.title}</h3>
              {/* Adoración-style status badge: arranged (a saved arrangement
                  exists), transcribing (attachments but no chart yet), ready */}
              <span className={`pill text-xs shrink-0 ${
                songStatus(song) === 'arranged' ? 'pill-green' : ''}`}>
                {songStatus(song) === 'arranged' ? '✓ arranged'
                  : songStatus(song) === 'transcribing' ? '✍ transcribing' : '● ready'}
              </span>
            </div>
            <p className="text-muted text-sm mt-1">{song.artist}</p>
            {/* Adoración-style labeled rows: Duración / Tonalidad / Tempo */}
            <div className="text-sm mt-2 space-y-0.5">
              <p className="flex justify-between"><span className="text-muted">Duration:</span> <strong>{song.duration ?? '—'}</strong></p>
              <p className="flex justify-between"><span className="text-muted">{t('key')}:</span> <strong>{song.key}</strong></p>
              <p className="flex justify-between"><span className="text-muted">Tempo:</span> <strong>{song.bpm} BPM · {song.timeSignature}</strong></p>
            </div>
            {/* Instrument chips — from the song's saved arrangement, or the
                worship-band default */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {instrumentChips(song).map((chip) => (
                <span key={chip} className="pill text-xs">{chip}</span>
              ))}
            </div>
            {song.tags && song.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {song.tags.map((tg) => (
                  <span key={tg} className="service-badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>#{tg}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <button className="glass-btn text-sm"
                onClick={(e) => { e.stopPropagation(); onAdd(song); }}
                disabled={setlistIds.includes(song.id)}>
                {setlistIds.includes(song.id) ? '✓' : `+ ${t('addToSetlist')}`}
              </button>
              {canEdit && (
                <>
                  <button className="glass-btn text-sm" onClick={(e) => { e.stopPropagation(); onEdit(song); }}>✏️</button>
                  {/* Two-tap inline confirm — works where popup confirms can't */}
                  <button
                    className={`glass-btn text-sm ${confirmId === song.id ? 'danger' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmId === song.id) { onDelete(song); setConfirmId(null); }
                      else { setConfirmId(song.id); window.setTimeout(() => setConfirmId((c) => (c === song.id ? null : c)), 3000); }
                    }}
                  >
                    {confirmId === song.id ? '⚠️ Sure?' : '🗑'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-muted text-center py-8">No songs match those filters.</p>
      )}
    </div>
  );
}
