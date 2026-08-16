// ==========================================================================
// This Area Of Code Is: The Motivation Engine — bulletins & stamps.
// Explanation: The Music Director posts a "Check Your Emails!" bulletin (a
// crisp in-app rendered card — no image text can ever be garbled — plus an
// optional attached picture). It pops up when ANY user except the viewer
// logs on: musicians, sound, media, tempo, editors, admins. The director
// also awards motivation stamps ("Best Church Choir", "Best Band", custom
// ones he creates himself) to the choir, band, or vocalists.
// Everything lives on the device — the device IS the server.
// In Other Words: The director's bulletin board and trophy shelf.
// ==========================================================================

export interface Bulletin {
  id: string;
  kind: 'checkEmails' | 'custom';
  title: string;
  message: string;
  imageRef?: string;        // idb://… optional attached picture (popup ONLY)
  active: boolean;
  ts: number;
}

export type StampAudience = 'choir' | 'band' | 'vocalists' | 'all';

export interface Stamp {
  id: string;
  title: string;
  icon: string;
  message: string;
  audience: StampAudience;
  custom: boolean;
  awardedBy: string;
  ts: number;
}

const BULLETIN_KEY = 'ntcc.bulletin';
const STAMPS_KEY = 'ntcc.motivate.stamps';

const uid = () => `mv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------- Bulletin ------------------------------- */

export function loadBulletin(): Bulletin | null {
  try {
    const raw = localStorage.getItem(BULLETIN_KEY);
    if (raw) return JSON.parse(raw) as Bulletin;
  } catch { /* fall through */ }
  return null;
}

export function postBulletin(
  b: Omit<Bulletin, 'id' | 'active' | 'ts'>,
): Bulletin {
  const out: Bulletin = { ...b, id: uid(), active: true, ts: Date.now() };
  localStorage.setItem(BULLETIN_KEY, JSON.stringify(out));
  return out;
}

export function clearBulletin(): void {
  localStorage.removeItem(BULLETIN_KEY);
}

// Seen-tracking: each person sees the bulletin once per posting.
const seenKey = (id: string) => `ntcc.bulletin.seen.${id}`;
export function bulletinSeen(id: string): boolean {
  return localStorage.getItem(seenKey(id)) === '1';
}
export function markBulletinSeen(id: string): void {
  localStorage.setItem(seenKey(id), '1');
}

/* -------------------------------- Stamps -------------------------------- */

export const DEFAULT_STAMPS: Omit<Stamp, 'id' | 'custom' | 'awardedBy' | 'ts'>[] = [
  { title: 'Best Church Choir', icon: '🏆', message: 'You lifted the whole house — heaven heard you!', audience: 'choir' },
  { title: 'Best Band', icon: '🥁', message: 'Tight, on time, and full of fire. Take a bow!', audience: 'band' },
  { title: 'Best Vocalists', icon: '🎤', message: 'Every note landed. Anointed and excellent!', audience: 'vocalists' },
  { title: 'Best Musicians Ever', icon: '🌟', message: 'Choir and band together — simply the best. Ever.', audience: 'all' },
];

export function loadStamps(): Stamp[] {
  try {
    const raw = localStorage.getItem(STAMPS_KEY);
    if (raw) return JSON.parse(raw) as Stamp[];
  } catch { /* fall through */ }
  return [];
}

export function awardStamp(
  s: Omit<Stamp, 'id' | 'ts'>,
): Stamp[] {
  const list = [...loadStamps(), { ...s, id: uid(), ts: Date.now() }];
  localStorage.setItem(STAMPS_KEY, JSON.stringify(list));
  return list;
}

export function removeStamp(id: string): Stamp[] {
  const list = loadStamps().filter((s) => s.id !== id);
  localStorage.setItem(STAMPS_KEY, JSON.stringify(list));
  return list;
}

// Create a custom stamp design the director can award over and over.
const CUSTOM_KEY = 'ntcc.motivate.customStamps';
export interface CustomStampDesign { id: string; title: string; icon: string; message: string }
export function loadCustomDesigns(): CustomStampDesign[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return JSON.parse(raw) as CustomStampDesign[];
  } catch { /* fall through */ }
  return [];
}
export function saveCustomDesign(d: Omit<CustomStampDesign, 'id'>): CustomStampDesign[] {
  const list = [...loadCustomDesigns(), { ...d, id: uid() }];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return list;
}
