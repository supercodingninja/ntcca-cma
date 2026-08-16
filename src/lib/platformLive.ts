// ==========================================================================
// This Area Of Code Is: THE PRAISES.TEAM LIVE PLATFORM (client side).
// Explanation: The host's phone becomes the broadcast truck: camera + mic
// are recorded in 4-second fragmented-MP4 pieces and uploaded, in order, to
// our own Render service. Viewers watch the same service's HLS playlist —
// Safari plays it natively, Chrome/Android through hls.js. No third-party
// video service anywhere in the path.
// In Other Words: Your phone is the TV station; our server is the tower;
// every other phone is the TV.
// ==========================================================================

import Hls from 'hls.js';

const BASE = 'https://ntcc-music-converter.onrender.com';

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'ntcca';

/** The one video mime our HLS pipe carries (fragmented MP4). */
export function platformMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* next */ }
  }
  return null;
}

export interface PlatformStatus {
  church: string;
  live: boolean;
  startedAt: number | null;
  viewers: number;
}

/** Is a service live on OUR platform right now? (and how many are watching) */
export async function platformStatus(church: string): Promise<PlatformStatus> {
  try {
    const r = await fetch(`${BASE}/live/${clean(church)}/status`, { cache: 'no-store' });
    if (!r.ok) return { church, live: false, startedAt: null, viewers: 0 };
    return await r.json() as PlatformStatus;
  } catch {
    return { church, live: false, startedAt: null, viewers: 0 };
  }
}

/** Viewer heartbeat so the room knows how many are watching. */
export function startPlatformPing(church: string): () => void {
  const id = crypto.randomUUID();
  const beat = () => void fetch(`${BASE}/live/${clean(church)}/ping`, {
    method: 'POST', headers: { 'X-Viewer': id },
  }).catch(() => { /* the count is a nicety, never a failure */ });
  beat();
  const t = window.setInterval(beat, 10000);
  return () => window.clearInterval(t);
}

export interface Broadcaster {
  stop: () => Promise<void>;
  stream: MediaStream;
}

/**
 * Go live from this device. Records 4-second fragments and uploads them in
 * strict order (a queue — fragments must arrive in sequence).
 */
export async function startBroadcast(church: string, stream: MediaStream): Promise<Broadcaster> {
  const mime = platformMime();
  if (!mime) throw new Error('This browser cannot record fragmented MP4 — use the rehearsal room instead.');
  const code = clean(church);

  await fetch(`${BASE}/live/${code}/start`, { method: 'POST' });

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 1_800_000,
    audioBitsPerSecond: 128_000,
  });

  let seq = 0;
  let first = true;
  // Strictly ordered upload queue — a live stream is a sequence, not a race.
  let queue: Promise<unknown> = Promise.resolve();
  const post = (url: string, blob: Blob, headers: Record<string, string> = {}) => {
    queue = queue.then(() =>
      fetch(url, { method: 'POST', headers, body: blob })
        .then((r) => { if (!r.ok) throw new Error(`upload ${r.status}`); })
        .catch((e) => console.warn('[platformLive] fragment upload retry-later:', e)),
    );
  };

  rec.ondataavailable = (e) => {
    if (!e.data || e.data.size === 0) return;
    if (first) {
      first = false;
      // Chunk zero carries ftyp+moov — the decoder's birth certificate.
      post(`${BASE}/live/${code}/init`, e.data, { 'Content-Type': 'video/mp4' });
      return;
    }
    post(`${BASE}/live/${code}/segment`, e.data, {
      'Content-Type': 'video/iso.segment',
      'X-Seq': String(seq++),
      'X-Dur': '4.0',
    });
  };

  rec.start(4000);

  return {
    stream,
    stop: async () => {
      try { rec.stop(); } catch { /* already stopped */ }
      await queue.catch(() => { /* fragments that didn't land are behind us */ });
      try {
        await fetch(`${BASE}/live/${code}/stop`, { method: 'POST' });
      } catch { /* the window ages out regardless */ }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export interface PlatformPlayer {
  destroy: () => void;
}

/** Attach a <video> element to our live playlist. Safari: native. Others: hls.js. */
export function attachPlatformPlayer(video: HTMLVideoElement, church: string): PlatformPlayer {
  const src = `${BASE}/live/${clean(church)}/playlist.m3u8`;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari (iPhone, iPad, macOS) speaks HLS out of the box.
    video.src = src;
    return { destroy: () => { video.removeAttribute('src'); video.load(); } };
  }
  if (Hls.isSupported()) {
    const hls = new Hls({
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 6,
      maxLiveSyncPlaybackRate: 1.5,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return { destroy: () => hls.destroy() };
  }
  // No HLS support at all — leave the video element blank; caller shows guidance.
  return { destroy: () => { /* nothing attached */ } };
}
