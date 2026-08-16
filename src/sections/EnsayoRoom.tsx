// ==========================================================================
// This Area Of Code Is: The Ensayo Room — the rebuilt practice room.
// Explanation: The boss lost the original "Ensayo" (rehearsal) room when
// Bolt ate the Adoración app. This rebuilds it better: a live-camera video
// grid (local getUserMedia + roster placeholders), an editable session
// header with a running timer, Auto-Dub toggle, a practice queue (Cola de
// Práctica) fed by the song library, a synchronized playback panel with six
// muteable stem tiles, a persistent team chat, and MediaRecorder-based
// recording that exports a .webm of the rehearsal mic. Everything is
// local-first: preferences, stems, and chat all live in localStorage.
// In Other Words: The whole band rehearses in one room — camera, songs,
// stems, chat, and a red RECORD light — and nothing ever leaves the device.
// ==========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAllSongs } from '../lib/songs';
import { getMicStream, micErrorMessage } from '../lib/mic';
import { loadRoster } from '../lib/team';
import { useAuth } from '../lib/auth';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  author: string;
  time: string; // "h:mm"
  text: string;
}

interface TeamTile {
  name: string;
  part: string; // instrument or choir section
  cameraOff: boolean;
}

const AUTODUB_KEY = 'ntcc.ensayo.autodub';
const CHAT_KEY = 'ntcc.ensayo.chat';
const STEMS_KEY = (songId: string) => `ntcc.ensayo.stems.${songId}`;

const STEMS = ['Piano', 'Guitar', 'Vocals', 'Bass', 'Drums', 'Strings'] as const;

const FALLBACK_TEAM: TeamTile[] = [
  { name: 'Sarah Johnson', part: 'Vocals', cameraOff: false },
  { name: 'Michael Chen', part: 'Keys', cameraOff: false },
  { name: 'David Kim', part: 'Guitar', cameraOff: true },
];

function parseDuration(d?: string): number {
  // "m:ss" -> seconds; default 4:00
  if (!d) return 240;
  const parts = d.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 240;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 240;
}

function fmtClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtHMS(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* fall through */
  }
  return [];
}

function loadStemState(songId: string): Record<string, boolean> {
  // true = muted
  try {
    const raw = localStorage.getItem(STEMS_KEY(songId));
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* fall through */
  }
  return {};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnsayoRoom() {
  const { user } = useAuth();

  // Header state
  const [sessionName, setSessionName] = useState('Sunday Rehearsal');
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [autoDub, setAutoDub] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTODUB_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Camera / mic state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'loading' | 'on' | 'denied'>('loading');
  const [micOn, setMicOn] = useState(true);

  // Recording state
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);

  // Songs / queue — PERSISTED so the room's lineup survives a reload.
  // (This is the room's song lineup; PracticeTools' ntcc.practice.queue is a
  // free-form drill to-do list — two different jobs, each kept on its own key.)
  const songs = useMemo(() => loadAllSongs(), []);
  const QUEUE_KEY = 'ntcc.ensayo.queue';
  const [queueIds, setQueueIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as string[];
      const valid = saved.filter((id) => songs.some((s) => s.id === id));
      return valid.length ? valid : songs.slice(0, 5).map((s) => s.id);
    } catch { return songs.slice(0, 5).map((s) => s.id); }
  });
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueIds));
  }, [queueIds]);
  const [currentId, setCurrentId] = useState<string | null>(() => songs[0]?.id ?? null);
  const [addSelect, setAddSelect] = useState('');

  // Playback
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds

  // Stems (muted set, per song)
  const [mutedStems, setMutedStems] = useState<Record<string, boolean>>({});

  // Chat
  const [chat, setChat] = useState<ChatMessage[]>(() => loadChat());
  const [chatDraft, setChatDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentId) ?? null,
    [songs, currentId],
  );
  const songDuration = useMemo(() => parseDuration(currentSong?.duration), [currentSong]);
  const queue = useMemo(
    () => queueIds.map((id) => songs.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [queueIds, songs],
  );

  // Team tiles from the director's roster (up to 3, choir first then band).
  const teamTiles = useMemo<TeamTile[]>(() => {
    const roster = loadRoster();
    const tiles: TeamTile[] = [
      ...roster.choir.map((m) => ({
        name: m.name,
        part: m.sections[0] ?? 'Choir',
        cameraOff: false,
      })),
      ...roster.band.map((m) => ({
        name: m.name,
        part: m.instruments[0] ?? 'Band',
        cameraOff: false,
      })),
    ].slice(0, 3);
    return tiles.length > 0 ? tiles : FALLBACK_TEAM;
  }, []);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Session timer — counts up once started.
  useEffect(() => {
    if (!started) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [started]);

  // Live camera for the local tile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Camera + mic together; if the combo is refused, fall back to video-
        // only so the tile still appears instead of dying silently.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState('on');
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Playback progress ticker.
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= songDuration) {
          setPlaying(false);
          return songDuration;
        }
        return p + 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [playing, songDuration]);

  // Load stem state when song changes; reset playback.
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    if (currentId) setMutedStems(loadStemState(currentId));
    else setMutedStems({});
  }, [currentId]);

  // Recording elapsed ticker.
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  // Persist chat + scroll to latest.
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
    } catch {
      /* storage full — chat is best-effort */
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const toggleAutoDub = useCallback(() => {
    setAutoDub((v) => {
      const next = !v;
      try {
        localStorage.setItem(AUTODUB_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      const next = !micOn;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
      setMicOn(next);
    } else {
      setMicOn((v) => !v);
    }
  }, [micOn]);

  const toggleStem = useCallback(
    (stem: string) => {
      if (!currentId) return;
      setMutedStems((prev) => {
        const next = { ...prev, [stem]: !prev[stem] };
        try {
          localStorage.setItem(STEMS_KEY(currentId), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [currentId],
  );

  const addToQueue = useCallback(() => {
    if (addSelect && !queueIds.includes(addSelect)) {
      setQueueIds((q) => [...q, addSelect]);
    }
    setAddSelect('');
  }, [addSelect, queueIds]);

  const sendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text) return;
    const now = new Date();
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: user?.name ?? 'Yo',
      time: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
      text,
    };
    setChat((c) => [...c, msg]);
    setChatDraft('');
  }, [chatDraft, user]);

  const startRecording = useCallback(async () => {
    setRecError(null);
    try {
      const stream = await getMicStream();
      recStreamRef.current = stream;
      // iOS Safari records MP4/AAC, Chrome records WebM/Opus — ask for what
      // the device actually supports, then name the file after the REAL type
      // (a .webm label on MP4 data makes an unplayable download).
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
        .find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const actual = recorder.mimeType || mime || 'audio/webm';
        const ext = actual.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(recChunksRef.current, { type: actual });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `ensayo-${date}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
        recorderRef.current = null;
      };
      recorder.start();
      setRecElapsed(0);
      setRecording(true);
    } catch (e) {
      setRecError(micErrorMessage(e));
    }
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ======================= HEADER ======================= */}
      <header className="glass-card p-4 flex flex-wrap items-center gap-3">
        <input
          className="auth-input font-display text-lg flex-1 min-w-[200px]"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          aria-label="Nombre de la sesión (Session name)"
        />
        <span className="pill" title="Duration">
          ⏱ {fmtHMS(elapsed)}
        </span>
        <span className="pill" title="Songs">
          🎵 {queue.length} songs
        </span>
        <button
          type="button"
          onClick={toggleAutoDub}
          className={`pill ${autoDub ? 'pill-green' : ''}`}
          title="Auto-Dub"
        >
          Auto-Dub: {autoDub ? 'ON' : 'OFF'}
        </button>
        {!started ? (
          <button type="button" className="glass-btn primary" onClick={() => setStarted(true)}>
            ▶ Start
          </button>
        ) : (
          <button
            type="button"
            className={`glass-btn ${recording ? 'danger' : ''}`}
            onClick={toggleRecording}
          >
            {recording ? `⏺ Recording… ${fmtHMS(recElapsed)}` : '⏺ Record'}
          </button>
        )}
        <button type="button" className="cta-gold" onClick={() => void startRecording()}>
          Start Recording to Export
        </button>
      </header>

      {recording && (
        <div className="glass-card p-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span>
            Recording rehearsal — {fmtHMS(recElapsed)}
          </span>
          <button type="button" className="glass-btn danger ml-auto" onClick={stopRecording}>
            ■ Stop & Export
          </button>
        </div>
      )}
      {recError && (
        <div className="glass-card p-3 text-sm text-red-400">{recError}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ======================= MAIN COLUMN ======================= */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video tiles */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Local tile */}
            <div className="glass-card overflow-hidden relative aspect-video">
              {cameraState === 'on' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                  <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-xl font-display">
                    {initials(user?.name ?? 'Tú')}
                  </div>
                  <span className="mt-2 text-lg">📷🚫</span>
                  <span className="text-sm text-muted mt-1">
                    {cameraState === 'loading'
                      ? 'Activando cámara… (Starting camera…)'
                      : 'Camera unavailable — check permissions'}
                  </span>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 p-2 flex items-center gap-2 bg-black/40">
                <span className="text-sm font-medium truncate">
                  {user?.name ?? 'Tú'} (You)
                </span>
                <span className="w-2 h-2 rounded-full bg-green-400" title="En línea (Online)" />
                <button
                  type="button"
                  onClick={toggleMic}
                  className="ml-auto glass-btn px-2 py-1 text-xs"
                  title={micOn ? 'Silenciar (Mute)' : 'Activar mic (Unmute)'}
                >
                  {micOn ? '🎤' : '🔇'}
                </button>
              </div>
            </div>

            {/* Team tiles */}
            {teamTiles.map((t) => (
              <div
                key={t.name}
                className="glass-card overflow-hidden relative aspect-video bg-gradient-to-br from-purple-800 via-fuchsia-900 to-indigo-900"
              >
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center text-2xl font-display">
                    {initials(t.name)}
                  </div>
                  {t.cameraOff && <span className="mt-2 text-lg">📷🚫</span>}
                  {t.cameraOff && (
                    <span className="text-xs text-muted mt-1">Camera off</span>
                  )}
                </div>
                <div className="absolute bottom-0 inset-x-0 p-2 flex items-center gap-2 bg-black/40">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-xs text-muted truncate">{t.part}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-green-400" title="En línea (Online)" />
                  <span className="ml-auto flex gap-1">
                    <span className="glass-btn px-2 py-1 text-xs" title="Mic">🎤</span>
                    <span className="glass-btn px-2 py-1 text-xs" title="Compartir (Share)">📤</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Reproducción Sincronizada */}
          <section className="glass-card p-4 space-y-3">
            <h2 className="font-display text-lg">
              Synchronized Playback
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="glass-btn primary"
                disabled={!currentSong}
                onClick={() => {
                  if (position >= songDuration) setPosition(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {currentSong ? currentSong.title : '— sin canción (no song) —'}
                </div>
                <div className="w-full h-2 rounded bg-white/10 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all duration-1000"
                    style={{ width: `${songDuration > 0 ? (position / songDuration) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-muted whitespace-nowrap">
                {fmtClock(position)} / {fmtClock(songDuration)}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STEMS.map((stem) => {
                const muted = !!mutedStems[stem];
                return (
                  <button
                    key={stem}
                    type="button"
                    onClick={() => toggleStem(stem)}
                    className={`glass-btn text-xs px-2 py-2 ${muted ? 'opacity-50' : ''}`}
                    title={muted ? 'Activar (Unmute)' : 'Silenciar (Mute)'}
                  >
                    {muted ? '🔇' : '🔊'} {stem}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ======================= SIDEBAR ======================= */}
        <aside className="space-y-4">
          {/* Cola de Práctica */}
          <section className="glass-card p-4 space-y-3">
            <h2 className="font-display text-lg">
              Practice Queue
            </h2>
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {queue.length === 0 && (
                <li className="text-sm text-muted">La cola está vacía (Queue is empty).</li>
              )}
              {queue.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentId(s.id)}
                    className={`w-full text-left px-2 py-2 rounded flex items-center gap-2 text-sm ${
                      s.id === currentId ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    {s.id === currentId && <span title="Actual (Current)">▶</span>}
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="text-muted text-xs">{s.duration ?? '4:00'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select
                className="auth-input flex-1 text-sm"
                value={addSelect}
                onChange={(e) => setAddSelect(e.target.value)}
                aria-label="Choose song"
              >
                <option value="">— library —</option>
                {songs
                  .filter((s) => !queueIds.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
              <button type="button" className="glass-btn" onClick={addToQueue}>
                + Add Song
              </button>
            </div>
          </section>

          {/* Chat del Equipo */}
          <section className="glass-card p-4 space-y-3">
            <h2 className="font-display text-lg">
              Team Chat
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {chat.length === 0 && (
                <p className="text-sm text-muted">
                  No messages yet.
                </p>
              )}
              {chat.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="text-accent font-medium">{m.author}</span>{' '}
                  <span className="text-muted text-xs">{m.time}</span>
                  <div>{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                className="auth-input flex-1 text-sm"
                placeholder="Write a message…"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                }}
              />
              <button type="button" className="glass-btn primary" onClick={sendChat}>
                Send
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
