// ==========================================================================
// This Area Of Code Is: The Director's Arrangement Board (UI).
// Explanation: Press the voice types you have — with counts ("this many
// basses, this many altos") — pick your instruments, and the app assigns
// every part and AUTO-TRANSPOSES it (B♭, E♭, F instruments get their own
// written key). Then override anything: tap a part, swap it to a soprano
// solo or a better instrument, and the app re-transposes on the spot.
// ==========================================================================

import { useMemo, useState } from 'react';
import {
  ARRANGEMENT_VOICES, ARRANGEMENT_INSTRUMENTS, autoArrange, reassignPart,
  writtenKeyFor, loadArrangement, saveArrangement, type Arrangement,
} from '../lib/arrange';
import { loadAllSongs } from '../lib/songs';
import { loadInstrumentation } from '../lib/instruments';

export default function ArrangeBoard() {
  const songs = useMemo(() => loadAllSongs(), []);
  const inst = useMemo(loadInstrumentation, []);
  const [songId, setSongId] = useState(songs[0]?.id ?? '');
  const song = songs.find((s) => s.id === songId);

  // Start from the church's declared instrumentation (counts included).
  const [voiceCounts, setVoiceCounts] = useState<Record<string, number>>(inst.voices);
  const [picked, setPicked] = useState<string[]>(
    Object.entries(inst.instruments).filter(([, n]) => n > 0).map(([name]) => name));
  const [arr, setArr] = useState<Arrangement | null>(() => (songId ? loadArrangement(songId) : null));
  const [swapTarget, setSwapTarget] = useState<string | null>(null);

  const build = () => {
    if (!song) return;
    const a = autoArrange(song.id, song.key, voiceCounts, picked);
    saveArrangement(a);
    setArr(a);
  };

  const swap = (partId: string, newAssignee: string) => {
    if (!arr) return;
    setArr(reassignPart(arr, partId, newAssignee, newAssignee.includes('Solo') || false));
    setSwapTarget(null);
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h3 className="text-accent font-semibold">🎼 Arrangement Board — Write &amp; Compose</h3>
        <p className="text-muted text-sm">
          Say who showed up. Get a finished, transposed arrangement. Don't like a choice? Tap it — it moves.
        </p>
      </div>

      {/* Song picker */}
      <label className="text-xs text-muted block">Song
        <select className="auth-input w-full mt-1" value={songId}
                onChange={(e) => { setSongId(e.target.value); setArr(loadArrangement(e.target.value)); }}>
          {songs.map((s) => <option key={s.id} value={s.id}>{s.title} — key of {s.key}</option>)}
        </select>
      </label>

      {/* Voice press-pads with counts */}
      <div>
        <p className="font-semibold text-sm mb-2">Voices — press what you have, set the count</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {ARRANGEMENT_VOICES.map((v) => {
            const n = voiceCounts[v] ?? 0;
            return (
              <div key={v} className={`rounded-xl border p-2 text-center ${n > 0 ? 'border-[var(--accent)]' : 'border-[var(--glass-border)]'}`}>
                <button className="text-sm font-semibold w-full" onClick={() =>
                  setVoiceCounts((p) => ({ ...p, [v]: n > 0 ? 0 : 4 }))}>{v}</button>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <button className="glass-btn text-xs px-2" aria-label={`fewer ${v}`}
                          onClick={() => setVoiceCounts((p) => ({ ...p, [v]: Math.max(0, n - 1) }))}>−</button>
                  <span className="text-accent font-black">{n}</span>
                  <button className="glass-btn text-xs px-2" aria-label={`more ${v}`}
                          onClick={() => setVoiceCounts((p) => ({ ...p, [v]: n + 1 }))}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted text-xs mt-1">
          Strength at a glance: {ARRANGEMENT_VOICES.filter((v) => (voiceCounts[v] ?? 0) > 0)
            .map((v) => `${v} ×${voiceCounts[v]}`).join(' · ') || 'no voices selected'}
        </p>
      </div>

      {/* Instruments */}
      <div>
        <p className="font-semibold text-sm mb-2">Instruments</p>
        <div className="flex gap-1.5 flex-wrap">
          {ARRANGEMENT_INSTRUMENTS.map((i) => (
            <button key={i.name}
                    className={`glass-btn text-xs ${picked.includes(i.name) ? 'primary' : ''}`}
                    title={i.transposition !== 'concert' ? `${i.transposition} transposing instrument` : 'concert pitch'}
                    onClick={() => setPicked((p) => p.includes(i.name) ? p.filter((x) => x !== i.name) : [...p, i.name])}>
              {i.name}{i.transposition !== 'concert' ? ` (${i.transposition})` : ''}
            </button>
          ))}
        </div>
      </div>

      <button className="cta-gold px-8 py-2.5" onClick={build}>✨ Auto-arrange &amp; transpose</button>

      {/* The arrangement — every part shows its written key */}
      {arr && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">
            Arrangement — concert key <span className="text-accent">{arr.concertKey}</span>
          </p>
          {arr.parts.map((p) => {
            const wk = writtenKeyFor(arr.concertKey, p.assignedTo);
            return (
              <div key={p.id} className="rounded-xl border border-[var(--glass-border)] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.part}</span>
                  <span>→</span>
                  <button className="glass-btn text-xs primary" onClick={() => setSwapTarget(swapTarget === p.id ? null : p.id)}>
                    {p.assignedTo}{p.solo ? ' (solo)' : ''} ⇄
                  </button>
                  <span className="pill pill-green text-xs ml-auto">
                    written in {wk.key} · {wk.label}
                  </span>
                </div>
                {swapTarget === p.id && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {[...ARRANGEMENT_VOICES.map((v) => v),
                      ...ARRANGEMENT_VOICES.map((v) => `${v} Solo`),
                      ...ARRANGEMENT_INSTRUMENTS.map((i) => i.name)]
                      .filter((x) => x.replace(' Solo', '') !== p.assignedTo)
                      .map((x) => (
                        <button key={x} className="glass-btn text-xs" onClick={() => swap(p.id, x)}>{x}</button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-muted text-xs">
            Every assignment is only the app's advice — you have the final say. Swap any part and the written key re-transposes instantly.
          </p>
        </div>
      )}
    </div>
  );
}
