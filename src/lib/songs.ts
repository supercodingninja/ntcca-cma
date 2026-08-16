// ==========================================================================
// This Area Of Code Is: The Song Store — the living library.
// Explanation: Seed songs ship with the app; everything Admin/Editor adds,
// edits, or deletes lives on-device (local-first) and merges with the seeds.
// Seed songs can be edited too — the edit overlays the seed without ever
// destroying the original (a "deleted" seed simply comes back).
// In Other Words: The hymnal grows every week and never loses a page.
// ==========================================================================

import { SEED_SONGS, type Song } from './music';

const CUSTOM_KEY = 'ntcc.songs.custom';   // brand-new songs
const EDITS_KEY = 'ntcc.songs.edits';     // overlays onto seed songs
const DELETED_KEY = 'ntcc.songs.deleted'; // hidden seed ids

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T; }
  catch { return fallback; }
}

/** All songs = seeds (minus deleted, with edits applied) + customs. */
export function loadAllSongs(): Song[] {
  const customs = read<Song[]>(CUSTOM_KEY, []);
  const edits = read<Record<string, Partial<Song>>>(EDITS_KEY, {});
  const deleted = read<string[]>(DELETED_KEY, []);
  const seeds = SEED_SONGS
    .filter((s) => !deleted.includes(s.id))
    .map((s) => ({ ...s, ...(edits[s.id] ?? {}) }));
  return [...seeds, ...customs];
}

export function saveSong(song: Song): void {
  const isSeed = SEED_SONGS.some((s) => s.id === song.id);
  if (isSeed) {
    const edits = read<Record<string, Partial<Song>>>(EDITS_KEY, {});
    edits[song.id] = song;
    localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  } else {
    const customs = read<Song[]>(CUSTOM_KEY, []);
    const i = customs.findIndex((s) => s.id === song.id);
    if (i >= 0) customs[i] = song;
    else customs.push(song);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
  }
}

export function deleteSong(id: string): void {
  const isSeed = SEED_SONGS.some((s) => s.id === id);
  if (isSeed) {
    const deleted = read<string[]>(DELETED_KEY, []);
    if (!deleted.includes(id)) deleted.push(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
  } else {
    const customs = read<Song[]>(CUSTOM_KEY, []).filter((s) => s.id !== id);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
  }
}

/** Convert a raw ChordPro chart into SongSections.
 *  Format: section headers on their own line like "{Chorus}" or "== Chorus ==",
 *  chord-over-lyric lines as "[A]Te doy [E]gracias". */
import { parseChordLine, type SectionKind } from './music';

function kindOf(label: string): SectionKind {
  const l = label.toLowerCase();
  if (l.includes('chorus') || l.includes('coro')) return 'chorus';
  if (l.includes('bridge') || l.includes('puente')) return 'bridge';
  if (l.includes('intro')) return 'intro';
  if (l.includes('outro') || l.includes('final')) return 'outro';
  if (l.includes('tag')) return 'tag';
  return 'verse';
}

export function chartToSections(chart: string): Song['sections'] {
  const sections: Song['sections'] = [];
  let current: Song['sections'][number] | null = null;

  chart.split('\n').forEach((raw) => {
    const line = raw.trim();
    const header = line.match(/^(?:\{(.+)\}|==\s*(.+?)\s*==)$/);
    if (header) {
      const label = (header[1] ?? header[2]).trim();
      current = { kind: kindOf(label), label, lines: [] };
      sections.push(current);
    } else if (line) {
      if (!current) {
        current = { kind: 'verse', label: 'Verse 1', lines: [] };
        sections.push(current);
      }
      current.lines.push(parseChordLine(line));
    }
  });
  return sections;
}

/** Flatten a song's sections back into editable ChordPro text. */
export function sectionsToChart(song: Song): string {
  return song.sections
    .map((sec) => {
      const body = sec.lines
        .map((line) =>
          line.segments.map((seg) => (seg.chord ? `[${seg.chord}]` : '') + seg.lyric).join(''))
        .join('\n');
      return `{${sec.label}}\n${body}`;
    })
    .join('\n\n');
}
