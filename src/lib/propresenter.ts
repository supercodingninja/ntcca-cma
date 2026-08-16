// ==========================================================================
// This Area Of Code Is: The ProPresenter Bridge (integrate OR replace).
// Explanation: Two doors. INTEGRATE: ProPresenter 7 exposes a network API
// on the production machine (port 1025) — enter its IP and this app can
// test the link and drive slides (next/previous/clear) over Wi-Fi, so the
// app runs the service WITH the church's existing ProPresenter ("if it
// ain't broke, don't fix it"). REPLACE: import ProPresenter text exports
// and OpenLyrics files straight into this app's library, then present from
// here — no ProPresenter needed at all.
// In Other Words: Shake hands with the old system, or lovingly retire it.
// ==========================================================================

export interface PPLink {
  ip: string;        // e.g. "192.168.1.50" or "192.168.1.50:1025"
  connected: boolean;
  version?: string;
}

const LINK_KEY = 'ntcc.presenter.pplink';

export function loadPPLink(): PPLink {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    if (raw) return JSON.parse(raw) as PPLink;
  } catch { /* fall through */ }
  return { ip: '', connected: false };
}

export function savePPLink(l: PPLink): void {
  localStorage.setItem(LINK_KEY, JSON.stringify(l));
}

function base(ip: string): string {
  const clean = ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `http://${clean.includes(':') ? clean : `${clean}:1025`}/v1`;
}

/** Test the link — ProPresenter answers /v1/version when the API is on. */
export async function testPP(ip: string): Promise<PPLink> {
  try {
    const r = await fetch(`${base(ip)}/version`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    const v = (await r.text()).slice(0, 40);
    const link: PPLink = { ip, connected: true, version: v };
    savePPLink(link);
    return link;
  } catch {
    const link: PPLink = { ip, connected: false };
    savePPLink(link);
    return link;
  }
}

/** Drive the production machine: next / previous slide, or clear. */
export async function ppTrigger(ip: string, what: 'next' | 'previous' | 'clear'): Promise<boolean> {
  const path = what === 'clear' ? '/clear/all' : `/trigger/${what}`;
  try {
    const r = await fetch(`${base(ip)}${path}`, { method: what === 'clear' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// IMPORT — ProPresenter "Export Text Bundle" / plain lyrics / OpenLyrics XML
// ---------------------------------------------------------------------------

export interface ImportedSongText {
  title: string;
  slides: string[][];   // each slide = its lyric lines
}

/** ProPresenter's text export separates slides with a blank line; songs are
 *  separated by a line of dashes or the next title line. This parser also
 *  handles a single-song plain lyrics file. */
export function parsePPText(text: string, fallbackTitle: string): ImportedSongText {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== ''))
    .filter((b) => b.length > 0);
  let title = fallbackTitle;
  let slides = blocks;
  // First block of one line = the song title (common PP export shape)
  if (blocks.length > 1 && blocks[0].length === 1) {
    title = blocks[0][0];
    slides = blocks.slice(1);
  }
  return { title, slides };
}

/** OpenLyrics (.xml) — the open format ProPresenter also imports/exports. */
export function parseOpenLyrics(xmlText: string, fallbackTitle: string): ImportedSongText | null {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const title = doc.querySelector('properties > titles > title')?.textContent?.trim() || fallbackTitle;
    const slides: string[][] = [];
    doc.querySelectorAll('lyrics > verse').forEach((v) => {
      const lines = (v.querySelector('lines')?.textContent ?? '')
        .split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length) slides.push(lines);
    });
    return slides.length ? { title, slides } : null;
  } catch { return null; }
}
