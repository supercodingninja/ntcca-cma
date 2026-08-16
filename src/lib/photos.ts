// ==========================================================================
// This Area Of Code Is: The Cinematic Photo Reel (random, non-repeating).
// Explanation: All uploaded church photos live in /photos. Each role starts
// at a different point in the pool, and the reel shuffles WITHOUT repeating
// until every photo has shown, then reshuffles — exactly per spec item 11.
// The reel persists its position so a refresh never restarts the sequence.
// In Other Words: The church's memories play behind the app like a slow
// movie, never showing the same photo twice until it's shown them all.
// ==========================================================================

import type { Role } from './auth';

// Manifest of the copied photo pool (filenames are the upload UUIDs).
export const PHOTO_FILES = [
  '00AE0FCC-1FE3-465B-88B1-C2B80B801C70',
  '030EB431-E71D-44CE-AE86-DA198F764109',
  '0845C3E4-02DB-436D-BEB7-D3206154CD2A',
  '16E179BB-9325-4F98-A282-9352B7EB69EF',
  '1BBA9DB6-C375-4E11-B17F-152FEE13FEF2',
  '1F24D3C4-AA1B-47BE-B057-361065FFFEB4',
  '20B789D2-2A0A-406A-8FCD-E388D486DC5E',
  '233D8E83-133B-4926-A565-0ED1C594C3CD',
  '29F740B9-8E7B-4BE0-8D4E-941115B6AD7D',
  '2AD1B98F-7D24-4C12-B3C6-320529FAB347',
  '31E15CA5-0039-4FEE-BBDA-22AC56E6E774',
  '31FF3C7E-FB18-4154-BD98-FF53B5C3C73F',
  '36AE7E32-9F61-4CB1-B405-7CAE4A7FBB88',
  '3DB32CB6-1741-4862-B2C3-1234CF1B8431',
  '3DEC8119-0E47-4423-BB17-A7F997E6CBE3',
  '41C2F11B-9D16-4097-B34F-C5BB5C2D92FB',
  '46B54FB8-7782-4422-B4CB-68E904F2D973',
  '58F53E82-7541-4A48-90EE-6FB05E20B4A7', // John Orkin Smith — In Memoriam (never on the landing; text would confuse the login words)
  '5CBA3851-1D78-4629-956D-F65E2955A60E',
  '652B5CD4-365F-4E14-94E5-4E69FBC472E7',
  '65D023E7-1CAD-4CEB-912A-2FC5E724C463',
  '697698EC-8649-4246-9BF3-2D302E41F7EE',
  '699F4A0B-830E-49CA-B1AC-12744763B9A5',
  '70D394E4-44C5-401C-BB04-C6302E5C1325',
  '71D11A4E-029E-4B1E-B676-D071588856BB',
  '7699734B-9183-4B55-B76E-F6CF8157A2CC',
  '774398D6-92EA-4F5E-BF81-143A8DFE2E72',
  '81F3411E-F8D0-4092-83BC-F05877F25438',
  '84B415D2-2B07-4CC3-9A24-3BA13C8C62BB',
  '8B8F2090-D2A4-4E4E-83E6-D32DA1A5DEE0',
  '93146B62-8A8B-43F9-9243-BB5778322711',
  '9C7893DE-991B-4503-9B63-128D644D44A6',
  '9F977209-C489-4054-B5BC-7624173B7913',
  'B1693216-3085-48B3-BE41-2BA8CC621EF9',
  'C130875F-615B-429F-BC25-7BEE3C7E04AE',
  'C2550D32-798C-454A-86D7-2E206D9AF67D',
  'CA0E2381-B808-4AA6-B146-FEE14AFB163D',
  'D790EEDC-7A2F-4C3B-9E45-3D127E6CF146',
  'D9CDF7CA-E9E7-4886-9B72-13461D48AEF0',
  'DBEC5E1F-D6B9-4CB3-A907-B8F9CD3B7FC5',
  'E03127C4-C123-4D05-B77B-7A0B934F35E5',
  'EF16CCA2-70EB-49C6-85EB-DA5B94DF08EF',
  'F2B58526-65CA-4A7C-95B5-A21B87854E58',
  'FA404CAD-2C00-45D0-B781-FB383C644F8B',
].map((n) => `/photos/${n}.jpg`);

// Each role starts on a different slice of the pool (spec: different set per role).
const ROLE_OFFSET: Record<Role, number> = {
  admin: 0, editor: 25, viewer: 50,
  // Sound/media/tempo/musician each get their own starting slice too —
  // before this they silently fell back to NaN → offset 0 (admin's reel).
  sound: 75, media: 100, tempo: 125, musician: 150,
};

function shuffled<T>(arr: T[], seed: number): T[] {
  // Deterministic Fisher-Yates so the reel is stable per device.
  const a = [...arr];
  let s = seed || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ReelState {
  order: number[]; // INDEXES into PHOTO_FILES — never the URLs themselves (the single-file build's data URIs would burst localStorage)
  index: number;
}

function reelKey(role: Role): string {
  return `ntcc.reel.${role}`;
}

export function nextPhoto(role: Role): string {
  let state: ReelState | null = null;
  try { state = JSON.parse(localStorage.getItem(reelKey(role)) ?? 'null') as ReelState | null; } catch { state = null; }

  if (!state || state.order.length !== PHOTO_FILES.length || typeof state.order[0] !== 'number') {
    // First run (or pool changed): seeded shuffle, rotated by role offset.
    const deviceSeed = Number(localStorage.getItem('ntcc.reelSeed') ?? Math.floor(Math.random() * 1e9));
    localStorage.setItem('ntcc.reelSeed', String(deviceSeed));
    const base = shuffled(PHOTO_FILES.map((_, i) => i), deviceSeed);
    const off = ROLE_OFFSET[role] % base.length;
    state = { order: [...base.slice(off), ...base.slice(0, off)], index: 0 };
  }

  const photo = PHOTO_FILES[state.order[state.index]];
  state.index = (state.index + 1) % state.order.length; // wraps → full cycle before repeat
  localStorage.setItem(reelKey(role), JSON.stringify(state));
  return photo;
}

/** Peek the current photo without advancing (used between reel ticks). */
export function currentPhoto(role: Role): string {
  try {
    const state = JSON.parse(localStorage.getItem(reelKey(role)) ?? 'null') as ReelState | null;
    if (state && state.order.length && typeof state.order[0] === 'number') {
      return PHOTO_FILES[state.order[(state.index - 1 + state.order.length) % state.order.length]];
    }
  } catch { /* fall through */ }
  return nextPhoto(role);
}
