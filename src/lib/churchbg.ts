// ==========================================================================
// This Area Of Code Is: Per-Church Background Media.
// Explanation: Every church can put its own pictures AND videos running
// behind its app — one upload icon in Admin → This Church. Files live in
// the device's IndexedDB vault (big enough for video), the manifest is
// namespaced per church code so graham.praises.team and guam.praises.team
// each play their own memories. The backdrop interleaves them with the
// shared photo reel.
// In Other Words: Each church hangs its own family photos on its own walls.
// ==========================================================================

import { storeFile, resolveFileUrl } from './fileStore';

export interface ChurchBgItem {
  id: string;
  ref: string;                 // idb://…
  kind: 'image' | 'video';
  name: string;
}

const manifestKey = (code: string) => `ntcc.churchbg.${code}`;

export function loadChurchBg(code: string): ChurchBgItem[] {
  try {
    const raw = localStorage.getItem(manifestKey(code));
    if (raw) return JSON.parse(raw) as ChurchBgItem[];
  } catch { /* fall through */ }
  return [];
}

/* ------------------- The Text-In-Picture Guard -------------------
   The boss's rule: "any picture that has text and it's not written
   correctly will mess up the application" — so a picture with writing on
   it must NEVER circulate as a background. This on-device scan measures
   text-likeness (dense fine edges + flat color = documents, flyers,
   screenshots of words) and refuses those files as backgrounds. Such
   pictures may still live as vault attachments or in the controlled
   bulletin popup — just never behind the app. */
export async function looksLikeTextImage(file: File): Promise<boolean> {
  if (!file.type.startsWith('image')) return false;
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    const W = 96, H = 96;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let edges = 0, colorful = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = (y * W + x) * 4, j = i + 4;
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const lum2 = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
        if (Math.abs(lum - lum2) > 48) edges++;                    // sharp fine contrast
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx - mn > 40) colorful++;                              // real photos are colorful
      }
    }
    const edgeRatio = edges / (W * H);
    const colorRatio = colorful / (W * H);
    // Documents/flyers: very edge-dense AND mostly monochrome.
    return edgeRatio > 0.16 && colorRatio < 0.30;
  } catch { return false; }
}

export async function addChurchBg(code: string, file: File): Promise<ChurchBgItem[]> {
  if (await looksLikeTextImage(file)) {
    throw new Error(
      '🚫 That picture looks like it has writing on it — pictures with text can garble the app ' +
      'behind the buttons, so it can\'t be a background. Use it as a bulletin attachment instead ' +
      '(Director → Bulletin), where it shows in a clean popup.');
  }
  const ref = await storeFile(file);
  const item: ChurchBgItem = {
    id: ref.slice(6),
    ref,
    kind: file.type.startsWith('video') ? 'video' : 'image',
    name: file.name,
  };
  const list = [...loadChurchBg(code), item];
  localStorage.setItem(manifestKey(code), JSON.stringify(list));
  return list;
}

export function removeChurchBg(code: string, id: string): ChurchBgItem[] {
  const list = loadChurchBg(code).filter((i) => i.id !== id);
  localStorage.setItem(manifestKey(code), JSON.stringify(list));
  return list;
}

export interface ResolvedBg { url: string; kind: 'image' | 'video' }

/** Resolve the manifest to playable object URLs for the backdrop. */
export async function resolveChurchBg(code: string): Promise<ResolvedBg[]> {
  const out: ResolvedBg[] = [];
  for (const item of loadChurchBg(code)) {
    const url = await resolveFileUrl(item.ref);
    if (url) out.push({ url, kind: item.kind });
  }
  return out;
}
