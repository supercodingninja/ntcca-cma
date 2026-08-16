// ==========================================================================
// This Area Of Code Is: THE PRAISES.TEAM LIVE PLATFORM (server side).
// Explanation: A church's phone records the service in 4-second fragments
// (MediaRecorder, fragmented MP4) and uploads them here in order. Viewers
// everywhere play the stream as a live HLS feed — Safari plays it natively,
// everyone else via hls.js. No YouTube, no Jitsi, no commercials, no
// account — the church's own platform riding on Render.
// In Other Words: Host taps Go Live; the world taps Watch; the video flows
// through OUR pipe and nobody else's.
//
// Routes (all CORS-open; the app calls them from the browser):
//   POST /live/:church/start     — begin a broadcast (wipes the old window)
//   POST /live/:church/init      — the fMP4 init segment (ftyp+moov), once
//   POST /live/:church/segment   — one 4s fragment; X-Seq + X-Dur headers
//   POST /live/:church/stop      — end the broadcast (playlist gets ENDLIST)
//   POST /live/:church/ping      — viewer heartbeat { id } → viewer count
//   GET  /live/:church/status    — { live, startedAt, viewers }
//   GET  /live/:church/playlist.m3u8 — the live HLS playlist
//   GET  /live/:church/seg/:file     — one fragment (immutable bytes)
// ==========================================================================

import { Router, raw } from 'express';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

const router = Router();

// One broadcast window per church. Everything lives on the instance's disk
// (Render's ephemeral fs) — a live window is temporary by definition.
const ROOT = path.join(tmpdir(), 'ntcca-live');
mkdirSync(ROOT, { recursive: true });

const TARGET_DUR = 5;          // seconds — HLS target duration
const WINDOW = 30;             // segments kept in the live playlist window
const sessions = new Map();    // church -> { startedAt, live, init:boolean, segs:[{seq,name,dur}], pings:Map<id,at> }

const clean = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
const dir = (church) => path.join(ROOT, church || 'ntcca');

function getSession(church, create = false) {
  let s = sessions.get(church);
  if (!s && create) {
    s = { startedAt: Date.now(), live: true, init: false, segs: [], pings: new Map() };
    sessions.set(church, s);
  }
  return s;
}

const rawBody = raw({ type: '*/*', limit: '20mb' });

// ---- broadcast control ---------------------------------------------------
router.post('/live/:church/start', (req, res) => {
  const church = clean(req.params.church);
  // A fresh broadcast wipes the previous window entirely.
  rmSync(dir(church), { recursive: true, force: true });
  mkdirSync(dir(church), { recursive: true });
  const s = { startedAt: Date.now(), live: true, init: false, segs: [], pings: new Map() };
  sessions.set(church, s);
  res.json({ ok: true, church, startedAt: s.startedAt });
});

router.post('/live/:church/init', rawBody, (req, res) => {
  const church = clean(req.params.church);
  const s = getSession(church, true);
  writeFileSync(path.join(dir(church), 'init.mp4'), req.body);
  s.init = true;
  res.json({ ok: true });
});

router.post('/live/:church/segment', rawBody, (req, res) => {
  const church = clean(req.params.church);
  const s = getSession(church, true);
  const seq = Number(req.headers['x-seq'] ?? s.segs.length);
  const dur = Math.max(0.5, Math.min(TARGET_DUR + 2, Number(req.headers['x-dur']) || TARGET_DUR - 1));
  const name = `seg-${seq}.m4s`;
  writeFileSync(path.join(dir(church), name), req.body);
  s.segs.push({ seq, name, dur });
  s.segs.sort((a, b) => a.seq - b.seq);
  // Slide the window: forget (and delete) fragments far behind the live edge.
  while (s.segs.length > WINDOW) {
    const old = s.segs.shift();
    try { rmSync(path.join(dir(church), old.name), { force: true }); } catch { /* gone */ }
  }
  res.json({ ok: true, seq, window: s.segs.length });
});

router.post('/live/:church/stop', (req, res) => {
  const s = getSession(clean(req.params.church));
  if (s) s.live = false;
  res.json({ ok: true });
});

router.post('/live/:church/ping', (req, res) => {
  const s = getSession(clean(req.params.church));
  const id = clean(req.headers['x-viewer']);
  if (s && id) s.pings.set(id, Date.now());
  res.json({ ok: true });
});

// ---- viewer side ----------------------------------------------------------
router.get('/live/:church/status', (req, res) => {
  const church = clean(req.params.church);
  const s = getSession(church);
  const now = Date.now();
  const viewers = s ? [...s.pings.values()].filter((at) => now - at < 30000).length : 0;
  res.json({
    church,
    live: Boolean(s?.live && s.init && s.segs.length > 0),
    startedAt: s?.startedAt ?? null,
    viewers,
  });
});

router.get('/live/:church/playlist.m3u8', (req, res) => {
  const church = clean(req.params.church);
  const s = getSession(church);
  res.set('Content-Type', 'application/vnd.apple.mpegurl');
  res.set('Cache-Control', 'no-store');
  if (!s || !s.init || s.segs.length === 0) {
    // A valid, empty, stay-tuned playlist — hls.js keeps retrying politely.
    return res.send(
      '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:5\n#EXT-X-MEDIA-SEQUENCE:0\n',
    );
  }
  const first = s.segs[0];
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:7',
    `#EXT-X-TARGETDURATION:${TARGET_DUR}`,
    `#EXT-X-MEDIA-SEQUENCE:${first.seq}`,
    '#EXT-X-PLAYLIST-TYPE:EVENT',
    '#EXT-X-MAP:URI="seg/init.mp4"',
    ...s.segs.flatMap((g) => [`#EXTINF:${g.dur.toFixed(3)},`, `seg/${g.name}`]),
  ];
  if (!s.live) lines.push('#EXT-X-ENDLIST');
  res.send(lines.join('\n') + '\n');
});

router.get('/live/:church/seg/:file', (req, res) => {
  const church = clean(req.params.church);
  const file = path.basename(req.params.file); // no traversal, ever
  const fp = path.join(dir(church), file);
  if (!existsSync(fp)) return res.sendStatus(404);
  res.set('Content-Type', file.endsWith('.mp4') ? 'video/mp4' : 'video/iso.segment');
  res.set('Cache-Control', 'public, max-age=60, immutable');
  res.send(readFileSync(fp));
});

export default router;
