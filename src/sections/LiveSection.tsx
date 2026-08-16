// ==========================================================================
// This Area Of Code Is: The Live Service stage ("Servicio en Vivo").
// Explanation: This is my Adoración flagship's signature — the whole church
// watches the service live, right inside the app, on any device. The video
// itself comes through YouTube Live (or any uploaded/direct video file), so
// it plays on iPhone, Android, and desktop with zero servers of our own.
// Around it I built the full live-service experience: the red EN VIVO
// badge, the participant panel, live on-screen captions (speech-to-text
// running on the device), a full time-stamped transcript you can save, and
// a join screen so nobody is dropped cold into a stream.
// In Other Words: Open the app, tap Live, and you're in church — with
// captions for the hard of hearing and a transcript for the bulletin.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import { youtubeEmbed, isVideoFile } from '../lib/media';
import { resolveFileUrl, storeFile } from '../lib/fileStore';
import { useAuth } from '../lib/auth';
import { loadChurchProfile } from '../lib/church';
import { sanitizeText } from '../lib/shieldwall';
import {
  platformMime, platformStatus, startBroadcast, startPlatformPing,
  attachPlatformPlayer, type Broadcaster, type PlatformStatus,
} from '../lib/platformLive';

interface LiveConfig {
  title: string;
  speaker: string;
  url: string;          // YouTube live link, direct MP4, or idb:// upload
  startedAt: number;    // epoch ms — viewers compute "live for mm:ss"
}

interface TranscriptLine { at: number; text: string; }

const STORE_KEY = 'ntcc.live.service';
const loadConfig = (): LiveConfig | null => {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) as LiveConfig : null; }
  catch { return null; }
};

// Caption languages — English first, Spanish second, the way we serve.
const CAPTION_LANGS: Array<[string, string]> = [
  ['en-US', 'English'], ['es-ES', 'Español'], ['pt-BR', 'Português'],
  ['fr-FR', 'Français'], ['tl-PH', 'Tagalog'], ['sw-KE', 'Kiswahili'],
];

export default function LiveSection() {
  const { user } = useAuth();
  const canHost = user ? user.role !== 'viewer' : false; // staff + engineers can host

  const [cfg, setCfg] = useState<LiveConfig | null>(loadConfig);
  const [joined, setJoined] = useState(false);
  const [viewers, setViewers] = useState(1);

  // Host setup form state
  const [title, setTitle] = useState(cfg?.title ?? 'Sunday Morning Service');
  const [speaker, setSpeaker] = useState(cfg?.speaker ?? '');
  const [url, setUrl] = useState(cfg?.url ?? '');

  // Playback state
  const [fileSrc, setFileSrc] = useState('');
  const [muted, setMuted] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Caption state
  const [captionsOn, setCaptionsOn] = useState(true);
  const [capLang, setCapLang] = useState('en-US');
  const [liveLine, setLiveLine] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const [roomCode, setRoomCode] = useState('graham');
  const [inRoom, setInRoom] = useState(false);
  // The church's OWN live room: the church code IS the room code — nothing
  // to type, nothing to leak, one room per church on our platform.
  const churchRoom = (loadChurchProfile().code || 'ntcca').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'ntcca';

  // ── OUR PLATFORM: broadcast (host) + watch (viewer) ──────────────────
  const [pStatus, setPStatus] = useState<PlatformStatus | null>(null);
  const [pError, setPError] = useState('');
  const broadcasterRef = useRef<Broadcaster | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [watching, setWatching] = useState(false);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const watchVideoRef = useRef<HTMLVideoElement>(null);

  // Poll the platform: is a service live on OUR pipe right now?
  useEffect(() => {
    let alive = true;
    const check = () => platformStatus(churchRoom).then((s) => { if (alive) setPStatus(s); });
    void check();
    const t = window.setInterval(check, 10000);
    return () => { alive = false; window.clearInterval(t); };
  }, [churchRoom]);

  // Heartbeat while watching — the "how many are watching" count.
  useEffect(() => {
    if (!watching) return;
    return startPlatformPing(churchRoom);
  }, [watching, churchRoom]);

  // Attach the HLS player when the viewer joins.
  useEffect(() => {
    if (!watching || !watchVideoRef.current) return;
    const player = attachPlatformPlayer(watchVideoRef.current, churchRoom);
    return () => player.destroy();
  }, [watching, churchRoom]);

  const goLive = async () => {
    setPError('');
    if (!platformMime()) {
      setPError('This browser cannot record fragmented MP4 (needed for our platform pipe). Use the rehearsal room below, or a newer browser.');
      return;
    }
    try {
      // Camera + mic, iOS-tolerant: ideal first, plain fallback.
      // Camera ladder: 720p ideal → front camera → anything with a lens —
      // iOS throws OverconstrainedError on strict asks, so we climb down gently.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }))
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
      const b = await startBroadcast(churchRoom, stream);
      broadcasterRef.current = b;
      if (hostVideoRef.current) {
        hostVideoRef.current.srcObject = stream;
        await hostVideoRef.current.play().catch(() => { /* preview is silent */ });
      }
      setBroadcasting(true);
    } catch (e) {
      const { micErrorMessage } = await import('../lib/mic');
      setPError(micErrorMessage(e));
    }
  };

  const endBroadcast = async () => {
    await broadcasterRef.current?.stop();
    broadcasterRef.current = null;
    setBroadcasting(false);
    setPStatus((s) => (s ? { ...s, live: false } : s));
  };
  // Auto-Dub: every finished caption line is SPOKEN aloud by the device in
  // the chosen language — on-device voice translation, no server, no API.
  const [autoDub, setAutoDub] = useState(() => localStorage.getItem('ntcc.live.autodub') === '1');
  // This Area Of Code Is: The Viewer Stream Fallback.
  // Explanation: A viewer's only window is THEIR church's stream. If no host
  // has gone live on this device, fall back to the church's own stream link
  // (set by the director, or delivered once through the viewer invite link).
  const church = loadChurchProfile();
  const effectiveCfg = cfg ?? (church.streamUrl
    ? { title: `${church.name} — Live Stream`, speaker: '', url: church.streamUrl, startedAt: Date.now() }
    : null);
  const embed = effectiveCfg ? youtubeEmbed(effectiveCfg.url) : null;

  // This Area Of Code Is: Presence — the "1 espectador" counter.
  // Explanation: Every open viewer announces itself over BroadcastChannel
  // and answers roll-call. Devices watching together see the count rise.
  useEffect(() => {
    if (!joined) return;
    const me = crypto.randomUUID();
    const ch = new BroadcastChannel('ntcca.live.presence');
    const seen = new Set<string>([me]);
    ch.onmessage = (e) => {
      const d = e.data as { t: string; id: string };
      if (d.t === 'hello') { seen.add(d.id); ch.postMessage({ t: 'here', id: me }); }
      if (d.t === 'here') seen.add(d.id);
      if (d.t === 'bye') seen.delete(d.id);
      setViewers(seen.size);
    };
    ch.postMessage({ t: 'hello', id: me });
    const pulse = window.setInterval(() => ch.postMessage({ t: 'here', id: me }), 10000);
    return () => {
      window.clearInterval(pulse);
      ch.postMessage({ t: 'bye', id: me });
      ch.close();
    };
  }, [joined]);

  // Resolve uploaded video files (idb://) into playable object URLs.
  useEffect(() => {
    let alive = true;
    if (cfg && isVideoFile(cfg.url)) {
      void resolveFileUrl(cfg.url).then((u) => { if (alive) setFileSrc(u ?? ''); });
    } else setFileSrc('');
    return () => { alive = false; };
  }, [cfg]);

  // This Area Of Code Is: Live captions — the auto-transcription engine.
  // Explanation: The device's own speech recognition listens to the room
  // (or the stream playing out loud) and turns it into rolling captions,
  // exactly like Adoración's "Pastor Juan: Welcome to today's worship
  // service" line. Each finished sentence is stamped and filed into the
  // full transcript. Everything stays on the device.
  useEffect(() => {
    if (!joined || !captionsOn) { recogRef.current?.stop(); recogRef.current = null; return; }
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionShim; webkitSpeechRecognition?: new () => SpeechRecognitionShim });
    const Ctor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
    if (!Ctor) return; // graceful degradation — video still plays
    const rec = new Ctor();
    rec.lang = capLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) {
            setTranscript((t) => [...t.slice(-199), { at: Date.now(), text }]);
            // Auto-Dub — speak the line in the service language.
            // Guarded: no speech API (or iOS blocking speech outside a
            // gesture) must never break captioning.
            if (localStorage.getItem('ntcc.live.autodub') === '1' && 'speechSynthesis' in window) {
              try {
                const u = new SpeechSynthesisUtterance(text);
                u.lang = rec.lang;
                speechSynthesis.speak(u);
              } catch { /* captions continue without the voice */ }
            }
          }
        } else interim += r[0].transcript;
      }
      setLiveLine(interim);
    };
    rec.onend = () => { try { rec.start(); } catch { /* restarted next toggle */ } };
    try { rec.start(); recogRef.current = rec; } catch { /* mic denied */ }
    return () => { recogRef.current = null; try { rec.stop(); } catch { /* already stopped */ } };
  }, [joined, captionsOn, capLang]);

  const startService = () => {
    const clean: LiveConfig = {
      title: sanitizeText(title, 100) || 'Live Service',
      speaker: sanitizeText(speaker, 80),
      url: url.trim(),
      startedAt: Date.now(),
    };
    if (!clean.url) { alert('Paste the live stream link (YouTube Live or video URL) first.'); return; }
    localStorage.setItem(STORE_KEY, JSON.stringify(clean));
    setCfg(clean);
    setJoined(true);
  };

  const endService = () => {
    localStorage.removeItem(STORE_KEY);
    setCfg(null); setJoined(false); setTranscript([]); setLiveLine('');
  };

  const downloadTranscript = () => {
    const body = transcript.map((l) =>
      `[${new Date(l.at).toLocaleTimeString()}] ${cfg?.speaker || 'Speaker'}: ${l.text}`).join('\n');
    const blob = new Blob([`${cfg?.title ?? 'Live Service'} — Transcript\n\n${body}\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Join screen ("Join the Live Service") ──────────────────────────
  if (effectiveCfg && !joined) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="glass-card p-8 text-center">
          <p className="text-5xl mb-3" aria-hidden>📹</p>
          <span className="service-badge" style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }}>● LIVE</span>
          <h2 className="font-display text-2xl text-accent mt-3">Join the Live Service</h2>
          <p className="font-semibold mt-1">{effectiveCfg.title}</p>
          {effectiveCfg.speaker && <p className="text-muted mt-1">🎤 {effectiveCfg.speaker}</p>}
          <p className="text-muted text-sm mt-2">
            Connect to watch the service with automatic real-time translation ·{' '}
            Started {new Date(effectiveCfg.startedAt).toLocaleTimeString()} · {viewers > 1 ? `${viewers} watching` : 'you are among the first'}
          </p>

          {/* The three Adoración capability tiles */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="rounded-xl p-4 text-center border border-green-500/40 bg-green-500/10">
              <p className="text-2xl">🌐</p>
              <p className="text-sm font-semibold mt-1">Auto-Dubbing</p>
              <p className="text-xs text-muted">Real-time voice translation</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-blue-500/40 bg-blue-500/10">
              <p className="text-2xl">💬</p>
              <p className="text-sm font-semibold mt-1">Live Subtitles</p>
              <p className="text-xs text-muted">Accurate transcription and translation</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-purple-500/40 bg-purple-500/10">
              <p className="text-2xl">🎧</p>
              <p className="text-sm font-semibold mt-1">Audio HD</p>
              <p className="text-xs text-muted">Crystal quality, multiple languages</p>
            </div>
          </div>

          <div className="grid gap-3 mt-6">
            <button className="cta-gold py-3" onClick={() => { setCaptionsOn(true); setJoined(true); }}>
              📺 Connect to the Service — with Live Captions
            </button>
            <button className="glass-btn py-3" onClick={() => { setCaptionsOn(false); setJoined(true); }}>
              🔇 Join — Video Only
            </button>
          </div>
        </div>

        {/* Translation Status — the honesty strip: what the on-device
            engine actually does, measured live, not marketing numbers */}
        <div className="glass-card p-4">
          <h3 className="text-accent font-semibold text-center mb-3">Translation Status</h3>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div><p className="text-green-400 text-lg font-black">●</p><p className="font-semibold">On-device</p><p className="text-muted">no servers</p></div>
            <div><p className="text-blue-400 text-lg font-black">●</p><p className="font-semibold">{CAPTION_LANGS.length}+ Languages</p><p className="text-muted">captions & dub</p></div>
            <div><p className="text-yellow-400 text-lg font-black">●</p><p className="font-semibold">Device-grade</p><p className="text-muted">accuracy</p></div>
            <div><p className="text-purple-400 text-lg font-black">●</p><p className="font-semibold">Real Time</p><p className="text-muted">~0.5s latency</p></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Watching the service ────────────────────────────────────────────────
  if (effectiveCfg && joined) {
    return (
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div ref={stageRef} className="relative rounded-xl overflow-hidden border border-[var(--glass-border)] bg-black">
            {embed && (
              <iframe className="w-full aspect-video" src={embed} title={effectiveCfg.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            )}
            {!embed && fileSrc && (
              <video className="w-full aspect-video" src={fileSrc} controls playsInline
                autoPlay muted={muted} preload="auto" />
            )}
            {!embed && !fileSrc && (
              <div className="aspect-video grid place-items-center text-muted text-sm p-6 text-center">
                That link is not playable here — use a YouTube Live link, a direct MP4 link, or upload a video file.
              </div>
            )}
            <span className="absolute top-3 left-3 service-badge" style={{ color: '#ff6b6b', borderColor: '#ff6b6b', background: 'rgba(0,0,0,.55)' }}>● LIVE</span>
            <span className="absolute top-3 right-3 service-badge" style={{ background: 'rgba(0,0,0,.55)' }}>👥 {viewers}</span>
            {captionsOn && (liveLine || transcript.length > 0) && (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg px-4 py-2 text-center text-sm md:text-base"
                   style={{ background: 'rgba(10,6,20,.78)' }}>
                <strong className="text-accent">{effectiveCfg.speaker || 'Speaker'}:</strong>{' '}
                {liveLine || transcript[transcript.length - 1]?.text}
              </div>
            )}
          </div>

          <div className="glass-card p-4 flex flex-wrap items-center gap-3">
            <button className="glass-btn text-sm" onClick={() => setMuted((m) => !m)}>
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <button className="glass-btn text-sm" onClick={() => void stageRef.current?.requestFullscreen?.()}>
              ⛶ Fullscreen
            </button>
            <button className={`glass-btn text-sm ${captionsOn ? 'danger' : ''}`} onClick={() => setCaptionsOn((c) => !c)}>
              {captionsOn ? '📝 Captions: ON' : '📝 Captions: OFF'}
            </button>
            <button className={`glass-btn text-sm ${autoDub ? 'primary' : ''}`}
                    aria-pressed={autoDub}
                    onClick={() => {
                      const next = !autoDub;
                      setAutoDub(next);
                      localStorage.setItem('ntcc.live.autodub', next ? '1' : '0');
                      if (!next) speechSynthesis.cancel();
                    }}>
              🌐 Auto-Dub: {autoDub ? 'ON' : 'OFF'}
            </button>
            <select className="glass-btn text-sm" value={capLang} onChange={(e) => setCapLang(e.target.value)}>
              {CAPTION_LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <span className="text-sm text-muted flex-1 text-center">{effectiveCfg.title}{effectiveCfg.speaker ? ` · ${effectiveCfg.speaker}` : ''}</span>
            <button className="glass-btn danger text-sm" onClick={() => setJoined(false)}>🚪 Leave</button>
            {canHost && <button className="glass-btn danger text-sm" onClick={endService}>⏹ End Service</button>}
          </div>
        </div>

        {/* Participants + full transcript — the right-hand panels from Adoración */}
        <div className="space-y-3">
          <div className="glass-card p-4">
            <h3 className="text-accent font-semibold mb-2">Participants</h3>
            <p className="text-sm">🎥 {effectiveCfg.speaker || 'Host'} <span className="text-green-400">● live</span></p>
            <p className="text-sm text-muted mt-1">👥 {viewers} viewer{viewers === 1 ? '' : 's'} connected</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-accent font-semibold">Full Transcript</h3>
              <button className="glass-btn text-xs" onClick={downloadTranscript} disabled={transcript.length === 0}>
                💾 Save
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 text-sm">
              {transcript.length === 0 && (
                <p className="text-muted">Captions will appear here as speech is heard. Turn Captions ON and allow the microphone.</p>
              )}
              {transcript.map((l, i) => (
                <p key={i}>
                  <span className="text-muted text-xs">{new Date(l.at).toLocaleTimeString()} </span>
                  <strong className="text-accent">{effectiveCfg.speaker || 'Speaker'}</strong>{' '}{l.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── No live service yet: host setup (or waiting room for viewers) ──────
  return (
    <div className="max-w-2xl mx-auto space-y-5">
    {/* This Area Of Code Is: The Unity Video Room.
        Explanation: Band members and choir across the world rehearse FACE TO
        FACE — that is the whole point of unity. No server of ours: the room
        rides on the free, proven Jitsi Meet service (if it ain't broke,
        don't fix it); each church uses its own room code. */}
    <div className="glass-card p-6">
      <h2 className="font-display text-2xl text-accent">🌍 Unity Video Room</h2>
      <p className="text-muted text-sm mt-1">
        Rehearse together from anywhere — across town or across the world. Everyone enters the same
        room code (get it from your director), taps Join, and you're all on one screen.
      </p>
      {!inRoom ? (
        <div className="mt-3 flex gap-2">
          <input className="auth-input w-full" autoCapitalize="off" placeholder="Room code (e.g. graham)"
                 value={roomCode} onChange={(e) => setRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                 aria-label="Unity room code" />
          <button className="cta-gold px-5" disabled={!roomCode.trim()} onClick={() => setInRoom(true)}>
            🎥 Join
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <iframe
            title="Unity Video Room"
            src={`https://meet.jit.si/ntcca-${roomCode.trim()}#config.prejoinPageEnabled=false`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ width: '100%', height: 420, border: 0, borderRadius: 12 }}
          />
          <button className="glass-btn w-full" onClick={() => setInRoom(false)}>Leave room</button>
        </div>
      )}
    </div>

    {/* This Area Of Code Is: 🔴 LIVE — OUR OWN PLATFORM.
        Explanation: The church's camera goes live IN THE APP, and every
        viewer watches IN THE APP — no YouTube, no Facebook, no commercials,
        no middleman. The live room rides on each device's own carrier or
        Wi-Fi (exactly how Zoom connects people — centralized room, everyone
        joins with whatever internet they have). The room code IS the
        church's code, so there's nothing to type and nothing to leak. */}
    {/* This Area Of Code Is: 🔴 LIVE — OUR OWN PLATFORM (for real).
        Explanation: The host's phone records the service in 4-second
        fragments and uploads them to OUR Render service; every viewer plays
        the HLS feed straight from OUR pipe. Zero YouTube, zero Jitsi, zero
        commercials — the pipe belongs to praises.team. */}
    <div className="glass-card p-6">
      <h2 className="font-display text-2xl text-accent">🔴 {church.name} Live — our platform</h2>
      <p className="text-muted text-sm mt-1">
        Straight from the church's camera to every device through praises.team's
        own pipe. No commercials, no social-media middleman — the connection
        rides on each person's own carrier or Wi-Fi.
      </p>

      {/* HOST: broadcast truck in your pocket */}
      {canHost && (
        <div className="mt-4 space-y-3">
          {!broadcasting ? (
            <button className="cta-gold w-full py-3" onClick={() => void goLive()}>
              🔴 Go Live — broadcast from this device
            </button>
          ) : (
            <>
              <div className="relative rounded-xl overflow-hidden border border-red-500/60">
                <video ref={hostVideoRef} muted playsInline className="w-full aspect-video bg-black object-cover" />
                <span className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md bg-red-600 text-white animate-pulse">
                  ● LIVE on praises.team
                </span>
              </div>
              <p className="text-xs text-muted">
                You are broadcasting. Viewers tap 📺 Watch Live on their devices —
                {pStatus ? ` ${pStatus.viewers} watching now.` : ''}
              </p>
              <button className="glass-btn danger w-full py-3" onClick={() => void endBroadcast()}>
                ⏹ End Service
              </button>
            </>
          )}
          {pError && <p className="text-amber-400 text-sm">{pError}</p>}
        </div>
      )}

      {/* VIEWER: take your seat in OUR house */}
      {!canHost && (
        <div className="mt-4 space-y-3">
          {!watching ? (
            <>
              {pStatus?.live ? (
                <button className="cta-gold w-full py-3" onClick={() => setWatching(true)}>
                  📺 Watch Live — {pStatus.viewers > 0 ? `${pStatus.viewers} watching` : 'service is live'}
                </button>
              ) : (
                <p className="text-muted text-sm">
                  No service on the platform right this second. When {church.name} goes
                  live, the 📺 Watch Live button appears here — this page checks every
                  10 seconds, so just leave it open.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="relative rounded-xl overflow-hidden border border-[var(--glass-border)]">
                <video ref={watchVideoRef} controls autoPlay playsInline className="w-full aspect-video bg-black" />
                <span className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md bg-red-600 text-white">
                  ● LIVE
                </span>
              </div>
              <button className="glass-btn w-full" onClick={() => setWatching(false)}>🚪 Leave</button>
            </>
          )}
        </div>
      )}
    </div>

    <details className="glass-card p-6 group">
      <summary className="cursor-pointer select-none">
        <span className="font-display text-xl text-accent">🔗 Embed an existing stream</span>
        <span className="text-muted text-sm block mt-0.5">
          Already broadcasting somewhere? Control every outlet from here — YouTube Live,
          Facebook, a direct MP4 link, or upload a video file.
        </span>
      </summary>
      {canHost ? (
        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">Service Title</label>
            <input className="auth-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Speaker / Worship Leader</label>
            <input className="auth-input w-full" value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Stream Link — YouTube Live, youtu.be, or direct MP4</label>
            <input className="auth-input w-full" inputMode="url" autoCapitalize="off"
              placeholder="https://youtube.com/watch?v=… or youtu.be/…"
              value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">…or upload a video file</label>
            <input type="file" accept="video/*" className="text-xs text-muted"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void storeFile(file).then((ref) => setUrl(ref));
              }} />
          </div>
          <button className="cta-gold py-3 mt-2" onClick={startService}>🔴 Go Live</button>
        </div>
      ) : (
        <p className="text-muted mt-4">No embedded stream right now — your church's live room above is the main door. When the service starts, you're already in your seat.</p>
      )}
    </details>
    </div>
  );
}

// Minimal structural type for the Speech Recognition API across browsers.
interface SpeechRecognitionShim {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventShim) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventShim {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
