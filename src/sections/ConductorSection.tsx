// ==========================================================================
// This Area Of Code Is: The Conductor panel — blink-to-beat control room.
// Explanation: Starts the camera, runs the MediaPipe face tracker ON-DEVICE
// (no video ever leaves this device), shows live blink count + smoothed BPM,
// and publishes every tempo change through UnityConductor to the metronome,
// UnityLED, MIDI gear, and every synced screen. Threshold presets follow the
// architecture deck: 0.25 universal / 0.20 conservative / 0.18 sensitive.
// In Other Words: Blink on purpose, and the whole room follows your tempo.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import { MediaPipeService } from '../unity/UnityMediaPipe';
import { unityConductor, type SyncState } from '../unity/UnityConductor';
import { DEFAULT_CONFIG, type TempoChange } from '../unity/midi';

const PRESETS = [
  { label: '0.25 Universal', ear: 0.25, frames: 3 },
  { label: '0.20 Conservative', ear: 0.20, frames: 5 },
  { label: '0.18 Sensitive', ear: 0.18, frames: 3 },
];

export default function ConductorSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const svcRef = useRef<MediaPipeService | null>(null);
  const [running, setRunning] = useState(false);
  const [blinks, setBlinks] = useState(0);
  const [tempo, setTempo] = useState<TempoChange | null>(null);
  const [preset, setPreset] = useState(0);
  const [msg, setMsg] = useState('');
  const [sync, setSync] = useState<SyncState | null>(null);

  useEffect(() => {
    // All tempo consumers subscribe once; mesh sync state flows in too.
    unityConductor.onTempo(setTempo);
    unityConductor.onSync(setSync);
    return () => svcRef.current?.stop();
  }, []);

  const start = async () => {
    const p = PRESETS[preset];
    const svc = new MediaPipeService({
      ...DEFAULT_CONFIG,
      earThreshold: p.ear,
      consecutiveFrames: p.frames,
    });
    svc.onError = setMsg;
    svc.onBlink = () => setBlinks((b) => b + 1);
    svc.onTempo = (t) => unityConductor.publish(t);
    svcRef.current = svc;

    setMsg('Loading face model (first time takes a few seconds)…');
    if (!videoRef.current) return;
    const ok = await svc.start(videoRef.current);
    setRunning(ok);
    setMsg(ok ? '🟢 Tracking — blink deliberately and steadily to set tempo.' : 'Could not start. Check camera permission.');
  };

  const stop = () => {
    svcRef.current?.stop();
    unityConductor.stopClock();
    setRunning(false);
    setMsg('Stopped.');
  };

  const tap = () => {
    // Tap tempo — the no-camera path (graceful degradation per the deck).
    const now = performance.now();
    const last = Number(sessionStorage.getItem('ntcc.tapTs') ?? 0);
    sessionStorage.setItem('ntcc.tapTs', String(now));
    if (last && now - last > 200 && now - last < 2000) {
      unityConductor.publish({
        bpm: Math.round(60000 / (now - last)), rawBpm: 60000 / (now - last),
        ts: now, source: 'tap', confidence: 0.9,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h2 className="font-display text-xl text-accent mb-1">🪄 Unity Conductor</h2>
        <p className="text-muted text-sm mb-4">
          Blink-to-beat — your eyes conduct the band. All vision processing happens
          on this device; no video is ever recorded or transmitted.
        </p>

        <div className="flex gap-2 flex-wrap mb-4">
          {PRESETS.map((p, i) => (
            <button key={p.label} className={`glass-btn text-xs ${preset === i ? 'primary' : ''}`}
                    onClick={() => setPreset(i)} disabled={running} aria-pressed={preset === i}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Camera view with landmark debug overlay */}
        <div className="relative rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-black aspect-video max-w-md mx-auto">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {running && (
            <div className="absolute top-2 left-2 pill pill-green">● LIVE</div>
          )}
        </div>

        {/* Satellite mesh status — the Unity sync fix, made visible */}
        {sync && (
          <div className="glass-card p-3 mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
            <span className={sync.role === 'master' ? 'text-accent font-semibold' : ''}>
              {sync.role === 'master' ? '👑 MASTER' : sync.role === 'satellite' ? '🛰 Satellite' : '● Standalone'}
            </span>
            <span className="text-muted">Nodes: {sync.satellites + 1}</span>
            {sync.role === 'satellite' && (
              <>
                <span className="text-muted">Offset: {sync.offsetMs} ms</span>
                <span className="text-muted">RTT: {sync.rttMs} ms</span>
              </>
            )}
            <span className={sync.synced ? 'pill pill-green' : 'pill'}>
              {sync.synced ? 'SYNCED' : 'SYNCING…'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center mt-4">
          <div className="glass-card p-3">
            <p className="text-3xl font-black text-accent">{blinks}</p>
            <p className="text-muted text-xs">Blinks</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-3xl font-black text-accent">{tempo?.bpm ?? '—'}</p>
            <p className="text-muted text-xs">BPM</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-3xl font-black text-accent">
              {tempo ? `${(tempo.confidence * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-muted text-xs">Confidence</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap justify-center">
          {!running
            ? <button className="cta-gold px-8 py-3" onClick={() => void start()}>📷 Start conducting</button>
            : <button className="glass-btn danger px-8 py-3" onClick={stop}>⏹ Stop</button>}
          <button className="glass-btn px-6 py-3" onClick={tap}>👆 Tap tempo</button>
        </div>
        {msg && <p className="text-sm text-muted mt-3 text-center">{msg}</p>}
      </div>

      <div className="glass-card p-4 text-sm text-muted">
        <strong className="text-accent">How it conducts:</strong> deliberate blinks →
        EAR eye-measurement → tempo smoothing (80% EMA) → metronome + UnityLED +
        MIDI clock (24 PPQN) + every open device via BroadcastChannel sync.
        No camera? Tap tempo does the same job — the system degrades gracefully, never fails.
      </div>
    </div>
  );
}
