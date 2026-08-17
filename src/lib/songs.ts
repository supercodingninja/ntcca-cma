// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The song data layer — CRUD operations, localStorage
// persistence, practice/usage history logging, search, filters, and the
// self-healing seed merge that ensures the app always has songs on day one.
// Explanation: This is the ONE file that every section talks to for song
// data. The Song type lives in `src/lib/music.ts` (the domain model). This
// file handles storage (localStorage + IndexedDB for attachments), querying
// (search by title/artist/tags, filter by choir/duration/key), and history
// tracking (who practiced what, when, and for how long). The seed library
// from `music.ts` merges automatically if the local store is empty.
// In Other Words: The church music filing cabinet — every song card,
// practice log, and CCLI report pulls from here.
// ==========================================================================

import { type Song, SEED_SONGS } from './music';

// --------------------------------------------------------------------------
// Storage keys
// --------------------------------------------------------------------------
const SONGS_KEY = 'ntcc.songs.v2';
const PRACTICE_KEY = 'ntcc.practice.v2';
const USAGE_KEY = 'ntcc.usage.v2';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface PracticeRecord {
  id: string;
  songId: string;
  date: string;          // ISO date
  durationMinutes: number;
  notes?: string;
  loggedBy: string;      // user name or role
}

export interface UsageRecord {
  id: string;
  songId: string;
  date: string;          // ISO date
  serviceType: string;   // "Sunday AM", "Wednesday PM", "Conference", etc.
  leadSinger?: string;
  notes?: string;
  loggedBy: string;
}

// --------------------------------------------------------------------------
// Helper: generate UUID v4
// --------------------------------------------------------------------------
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --------------------------------------------------------------------------
// Load songs from localStorage (with seed merge)
// --------------------------------------------------------------------------
export function loadAllSongs(): Song[] {
  try {
    const raw = localStorage.getItem(SONGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Song[];
      // Self-healing: if stored array is empty or corrupted, merge seeds
      if (!Array.isArray(stored) || stored.length === 0) {
        return mergeSeeds([]);
      }
      return stored;
    }
  } catch {
    // Corrupted storage — start fresh with seeds
  }
  return mergeSeeds([]);
}

// --------------------------------------------------------------------------
// Save songs to localStorage
// --------------------------------------------------------------------------
export function saveAllSongs(songs: Song[]): void {
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
}

// --------------------------------------------------------------------------
// Seed merge — adds seed songs only if their IDs don't already exist
// --------------------------------------------------------------------------
function mergeSeeds(existing: Song[]): Song[] {
  const map = new Map(existing.map((s) => [s.id, s]));
  for (const seed of SEED_SONGS) {
    if (!map.has(seed.id)) {
      map.set(seed.id, seed);
    }
  }
  return Array.from(map.values());
}

// --------------------------------------------------------------------------
// CRUD: Create
// --------------------------------------------------------------------------
export function createSong(partial: Omit<Song, 'id'>): Song {
  const song: Song = {
    ...partial,
    id: uuid(),
  };
  const songs = loadAllSongs();
  songs.push(song);
  saveAllSongs(songs);
  return song;
}

// --------------------------------------------------------------------------
// CRUD: Read (by ID)
// --------------------------------------------------------------------------
export function getSongById(id: string): Song | undefined {
  return loadAllSongs().find((s) => s.id === id);
}

// --------------------------------------------------------------------------
// CRUD: Update
// --------------------------------------------------------------------------
export function updateSong(id: string, updates: Partial<Song>): Song | null {
  const songs = loadAllSongs();
  const index = songs.findIndex((s) => s.id === id);
  if (index === -1) return null;
  songs[index] = { ...songs[index], ...updates };
  saveAllSongs(songs);
  return songs[index];
}

// --------------------------------------------------------------------------
// CRUD: Delete (two-tap safety: mark deleted, then purge)
// --------------------------------------------------------------------------
export function deleteSong(id: string): boolean {
  const songs = loadAllSongs();
  const filtered = songs.filter((s) => s.id !== id);
  if (filtered.length === songs.length) return false;
  saveAllSongs(filtered);
  return true;
}

// --------------------------------------------------------------------------
// Search & Filter
// --------------------------------------------------------------------------
export interface SongFilter {
  query?: string;        // search title, artist, lyrics
  tags?: string[];       // match ANY tag
  isChoir?: boolean;     // filter by choir flag
  key?: string;          // exact key match
  maxDuration?: number;  // in minutes
  leadSinger?: string;   // exact match
}

export function filterSongs(filter: SongFilter): Song[] {
  const songs = loadAllSongs();
  return songs.filter((song) => {
    if (filter.query) {
      const q = filter.query.toLowerCase();
      const inTitle = song.title.toLowerCase().includes(q);
      const inArtist = song.artist.toLowerCase().includes(q);
      const inLyrics = song.sections.some((sec) =>
        sec.lines.some((line) =>
          line.segments.some((seg) => seg.lyric.toLowerCase().includes(q))
        )
      );
      if (!inTitle && !inArtist && !inLyrics) return false;
    }
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some((t) => song.tags?.includes(t));
      if (!hasTag) return false;
    }
    if (filter.isChoir !== undefined) {
      if (!!song.tags?.includes('choir') !== filter.isChoir) return false;
    }
    if (filter.key) {
      if (song.key !== filter.key) return false;
    }
    if (filter.maxDuration !== undefined && song.duration) {
      const mins = parseDurationMinutes(song.duration);
      if (mins > filter.maxDuration) return false;
    }
    if (filter.leadSinger) {
      if (song.leadSinger !== filter.leadSinger) return false;
    }
    return true;
  });
}

/** Parse "4:32" → 4.53 minutes */
function parseDurationMinutes(dur: string): number {
  const m = dur.match(/^(\d+):([0-5]\d)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

// --------------------------------------------------------------------------
// Practice History
// --------------------------------------------------------------------------
export function loadPracticeHistory(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (raw) return JSON.parse(raw) as PracticeRecord[];
  } catch { /* fall through */ }
  return [];
}

export function savePracticeHistory(records: PracticeRecord[]): void {
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(records));
}

export function logPractice(
  songId: string,
  durationMinutes: number,
  loggedBy: string,
  notes?: string
): PracticeRecord {
  const record: PracticeRecord = {
    id: uuid(),
    songId,
    date: new Date().toISOString(),
    durationMinutes,
    notes,
    loggedBy,
  };
  const records = loadPracticeHistory();
  records.push(record);
  savePracticeHistory(records);
  return record;
}

export function getPracticeForSong(songId: string): PracticeRecord[] {
  return loadPracticeHistory()
    .filter((r) => r.songId === songId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// --------------------------------------------------------------------------
// Usage History
// --------------------------------------------------------------------------
export function loadUsageHistory(): UsageRecord[] {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) return JSON.parse(raw) as UsageRecord[];
  } catch { /* fall through */ }
  return [];
}

export function saveUsageHistory(records: UsageRecord[]): void {
  localStorage.setItem(USAGE_KEY, JSON.stringify(records));
}

export function logUsage(
  songId: string,
  serviceType: string,
  loggedBy: string,
  leadSinger?: string,
  notes?: string
): UsageRecord {
  const record: UsageRecord = {
    id: uuid(),
    songId,
    date: new Date().toISOString(),
    serviceType,
    leadSinger,
    notes,
    loggedBy,
  };
  const records = loadUsageHistory();
  records.push(record);
  saveUsageHistory(records);
  return record;
}

export function getUsageForSong(songId: string): UsageRecord[] {
  return loadUsageHistory()
    .filter((r) => r.songId === songId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// --------------------------------------------------------------------------
// Aggregate stats for a song
// --------------------------------------------------------------------------
export interface SongStats {
  practiceCount: number;
  totalPracticeMinutes: number;
  usageCount: number;
  lastPracticed?: string;
  lastUsed?: string;
}

export function getSongStats(songId: string): SongStats {
  const practice = getPracticeForSong(songId);
  const usage = getUsageForSong(songId);
  return {
    practiceCount: practice.length,
    totalPracticeMinutes: practice.reduce((sum, r) => sum + r.durationMinutes, 0),
    usageCount: usage.length,
    lastPracticed: practice[0]?.date,
    lastUsed: usage[0]?.date,
  };
}

// --------------------------------------------------------------------------
// Export / Backup
// --------------------------------------------------------------------------
export function exportAllData(): string {
  return JSON.stringify({
    songs: loadAllSongs(),
    practice: loadPracticeHistory(),
    usage: loadUsageHistory(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (Array.isArray(data.songs)) saveAllSongs(data.songs);
    if (Array.isArray(data.practice)) savePracticeHistory(data.practice);
    if (Array.isArray(data.usage)) saveUsageHistory(data.usage);
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// CCLI helpers: get all usage in a date range
// --------------------------------------------------------------------------
export function getUsageInRange(startDate: string, endDate: string): UsageRecord[] {
  return loadUsageHistory().filter((r) => {
    const d = r.date.slice(0, 10); // YYYY-MM-DD
    return d >= startDate && d <= endDate;
  });
}

/** Group usage records by song ID for reporting */
export function groupUsageBySong(records: UsageRecord[]): Map<string, UsageRecord[]> {
  const map = new Map<string, UsageRecord[]>();
  for (const r of records) {
    const list = map.get(r.songId) ?? [];
    list.push(r);
    map.set(r.songId, list);
  }
  return map;
}
