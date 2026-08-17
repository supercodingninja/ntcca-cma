// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useState, useEffect, useCallback } from 'react';
import type { Song } from '../lib/music';
import { getAllSongs, addSong, updateSong } from '../lib/songs';

// ==========================================================================
// This Area Of Code Is: Song Form Section Component
// Explanation: The single screen for creating a new song or editing an
//              existing one. Covers all 17 MVP fields: title, artist,
//              duration, lead singer, key, tempo, transposition, key
//              changes, ChordPro lyrics, audio/YouTube links, theme tags,
//              CCLI number, and copyright info. Persists via songs.ts.
// In Other Words: The data entry desk — every song starts here.
// ==========================================================================

type TabKey = 'details' | 'music' | 'content' | 'meta';

const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb',
  'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
];

const COMMON_TEMPO_MARKS = [
  { bpm: 60, label: 'Largo' },
  { bpm: 76, label: 'Adagio' },
  { bpm: 108, label: 'Andante' },
  { bpm: 120, label: 'Moderato' },
  { bpm: 140, label: 'Allegro' },
  { bpm: 168, label: 'Vivace' },
];

const SERVICE_TYPES = [
  'Sunday Morning', 'Sunday Evening', 'Wednesday Bible Study',
  'Special Event', 'Funeral', 'Wedding', 'Revival',
];

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ==========================================================================
// This Area Of Code Is: Empty Song Factory
// Explanation: Creates a blank Song object with safe defaults so the
//              form never crashes on undefined values.
// In Other Words: A blank sheet of paper with the right lines on it.
// ==========================================================================
function createEmptySong(): Song & { id: string } {
  return {
    id: generateId(),
    title: '',
    artist: '',
    duration: 0,
    leadSinger: '',
    key: 'C',
    transposition: 0,
    tempo: 120,
    keyChanges: '',
    lyrics: '',
    audioUrl: '',
    youtubeUrl: '',
    themeTags: [],
    ccliNumber: '',
    copyright: '',
    practiceHistory: [],
    usageHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Song & { id: string };
}

// ==========================================================================
// This Area Of Code Is: Tag Input Helper
// Explanation: Converts a comma-separated string to a trimmed array and
//              back, so the user can type "Worship, Praise, Fast" easily.
// In Other Words: Turns a sentence into a stack of labels.
// ==========================================================================
function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function formatTags(tags: string[]): string {
  return tags.join(', ');
}

// ==========================================================================
// This Area Of Code Is: Song Form Section UI
// Explanation: Tabbed form with four panels. Handles both create mode
//              (no initial song) and edit mode (pre-populated). On save,
//              writes to localStorage via songs.ts and shows feedback.
// In Other Words: The control panel for every field a song can have.
// ==========================================================================
export default function SongFormSection({
  editSongId,
  onSaved,
}: {
  editSongId?: string;
  onSaved?: () => void;
}) {
  const [tab, setTab] = useState<TabKey>('details');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [song, setSong] = useState<Song & { id: string }>(() => {
    if (!editSongId) return createEmptySong();
    const found = getAllSongs().find((s) => (s as any).id === editSongId);
    return (found as any) || createEmptySong();
  });

  // Refresh song data if editSongId changes
  useEffect(() => {
    if (editSongId) {
      const found = getAllSongs().find((s) => (s as any).id === editSongId);
      if (found) setSong(found as any);
    } else {
      setSong(createEmptySong());
    }
  }, [editSongId]);

  const updateField = useCallback(<K extends keyof typeof song>(
    field: K,
    value: (typeof song)[K]
  ) => {
    setSong((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    setMessage(null);

    if (!song.title.trim()) {
      setMessage({ type: 'error', text: 'Title is required.' });
      setSaving(false);
      return;
    }

    const payload = { ...song, updatedAt: new Date().toISOString() };

    try {
      if (editSongId) {
        updateSong(editSongId, payload as any);
        setMessage({ type: 'success', text: 'Song updated successfully.' });
      } else {
        addSong(payload as any);
        setMessage({ type: 'success', text: 'Song created successfully.' });
        setSong(createEmptySong());
      }
      onSaved?.();
    } catch (err) {
      setMessage({ type: 'error', text: 'Save failed. Check console.' });
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [song, editSongId, onSaved]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'music', label: 'Music' },
    { key: 'content', label: 'Content' },
    { key: 'meta', label: 'Meta & Rights' },
  ];

  return (
    <section className="song-form-section w-full px-4 py-6 md:px-8">
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
        {editSongId ? 'Edit Song' : 'Add New Song'}
      </h2>
      <p className="mb-6 text-sm text-white/50">
        {editSongId ? 'Update the fields below and save.' : 'Fill out all sections to add a song to the library.'}
      </p>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* DETAILS TAB */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Title *</label>
            <input
              type="text"
              value={song.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Amazing Grace"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Artist / Composer</label>
              <input
                type="text"
                value={song.artist}
                onChange={(e) => updateField('artist', e.target.value)}
                placeholder="John Newton"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Duration (minutes)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={song.duration || ''}
                onChange={(e) => updateField('duration', parseFloat(e.target.value) || 0)}
                placeholder="4.5"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Lead Singer</label>
            <input
              type="text"
              value={song.leadSinger}
              onChange={(e) => updateField('leadSinger', e.target.value)}
              placeholder="Minister Thomas"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>
      )}

      {/* MUSIC TAB */}
      {tab === 'music' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Key</label>
              <select
                value={song.key}
                onChange={(e) => updateField('key', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              >
                {MUSICAL_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Transpose (semitones)</label>
              <input
                type="number"
                min={-11}
                max={11}
                value={song.transposition || 0}
                onChange={(e) => updateField('transposition', parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Tempo (BPM)</label>
              <input
                type="number"
                min={20}
                max={300}
                value={song.tempo || ''}
                onChange={(e) => updateField('tempo', parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Common Tempos</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_TEMPO_MARKS.map((m) => (
                <button
                  key={m.bpm}
                  type="button"
                  onClick={() => updateField('tempo', m.bpm)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-amber-500 hover:text-black"
                >
                  {m.label} · {m.bpm}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Key Changes</label>
            <input
              type="text"
              value={song.keyChanges}
              onChange={(e) => updateField('keyChanges', e.target.value)}
              placeholder="Verse: C, Pre-Chorus: G, Chorus: D"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-white/40">Describe where the key changes happen.</p>
          </div>
        </div>
      )}

      {/* CONTENT TAB */}
      {tab === 'content' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Lyrics & Chords (ChordPro)</label>
            <textarea
              value={song.lyrics}
              onChange={(e) => updateField('lyrics', e.target.value)}
              rows={16}
              placeholder={`[Verse 1]\n[G]Amazing grace, how [C]sweet the [G]sound\nThat [D]saved a wretch like [G]me\n\n[Chorus]\n[G]How precious did that [C]grace ap[G]pear\nThe [D]hour I first be[G]lieved`}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm leading-relaxed text-white outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-white/40">
              Use ChordPro format: chords in brackets before lyrics, e.g. [G]Amazing grace.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Audio URL</label>
              <input
                type="url"
                value={song.audioUrl}
                onChange={(e) => updateField('audioUrl', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">YouTube URL</label>
              <input
                type="url"
                value={song.youtubeUrl}
                onChange={(e) => updateField('youtubeUrl', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* META TAB */}
      {tab === 'meta' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Theme Tags</label>
            <input
              type="text"
              value={formatTags(song.themeTags || [])}
              onChange={(e) => updateField('themeTags', parseTags(e.target.value))}
              placeholder="Worship, Praise, Gospel, Communion, Easter"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-white/40">Separate tags with commas.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">CCLI Number</label>
              <input
                type="text"
                value={song.ccliNumber}
                onChange={(e) => updateField('ccliNumber', e.target.value)}
                placeholder="12345678"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Copyright Info</label>
              <input
                type="text"
                value={song.copyright}
                onChange={(e) => updateField('copyright', e.target.value)}
                placeholder="© 2026 Example Music Publishing"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {editSongId && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 text-sm font-semibold text-white">History Snapshot</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-black/30 p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">
                    {(song as any).practiceHistory?.length || 0}
                  </p>
                  <p className="text-xs text-white/50">Practice Sessions</p>
                </div>
                <div className="rounded-lg bg-black/30 p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">
                    {(song as any).usageHistory?.length || 0}
                  </p>
                  <p className="text-xs text-white/50">Service Usages</p>
                </div>
                <div className="rounded-lg bg-black/30 p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">
                    {song.createdAt ? new Date(song.createdAt).toLocaleDateString() : '—'}
                  </p>
                  <p className="text-xs text-white/50">Date Added</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : editSongId ? 'Update Song' : 'Create Song'}
        </button>

        {editSongId && (
          <button
            onClick={() => {
              const fresh = getAllSongs().find((s) => (s as any).id === editSongId);
              if (fresh) setSong(fresh as any);
              setMessage(null);
            }}
            className="rounded-lg border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
          >
            Reset Changes
          </button>
        )}
      </div>
    </section>
  );
}
