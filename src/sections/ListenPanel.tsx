// ==========================================================================
// This Area Of Code Is: The "Listen" panel — our own recognition, on-device.
// Explanation: Tap Listen and the device becomes its own server: it hears
// whatever is playing, names the live chord, the key and the tempo — and
// IDENTIFIES the song against OUR library, surfacing the federal-compliance
// credits ("Originally performed by…", label, publisher, CCLI) and the link
// to buy the original. No Shazam, no cloud, no key — Find-a-Way.
// In Other Words: Point it at the music; it tells you everything.
// ==========================================================================

import { useMemo, useRef, useState } from 'react';
import { EarEngine, buildReference, type ListenFrame, type ListenMatch } from '../lib/listen';
import { micErrorMessage } from '../lib/mic';
import { loadAllSongs } from '../lib/songs';
import type { Song } from '../lib/music';

function songChordSymbols(song: Song): string[] {
  const out: string[] = [];
  for (const sec of song.sections)
    for (const line of sec.lines)
      for (const seg of line.segments)
        if (seg.chord) out.push(seg.chord);
  return out;
}

export function ListenPanel({ onOpenSong }: { onOpenSong?: (id: string) => void }) {
  const [listening, setListening] = useState(false);
  const [frame, setFrame] = useState<ListenFrame | null>(null);
  const [match, setMatch] = useState<ListenMatch | null>(null);
  const [denied, setDenied] = useState('');
  const earRef = useRef<EarEngine | null>(null);

  // The library's fingerprints — built once from OUR chord charts.
  const refs = useMemo(
    () => loadAllSongs().map((s) => buildReference(s.id, s.title, songChordSymbols(s))),
    [],
  );
  const songs = useMemo(() => new Map(loadAllSongs().map((s) => [s.id, s])), []);
  const matchedSong = match ? songs.get(match.id) : undefined;

  const start = async () => {
    setDenied('');
    const ear = new EarEngine();
    earRef.current = ear;
    try {
      await ear.start((f) => {
        setFrame(f);
        const m = ear.identify(refs);
        if (m) setMatch(m);
      });
      setListening(true);
    } catch (e) {
      setDenied(micErrorMessage(e));
    }
  };
  const stop = () => {
    earRef.current?.stop();
    earRef.current = null;
    setListening(false);
  };

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">🎧 Listen — what's that song?</h3>
        <button className={`glass-btn text-sm ${listening ? 'danger' : 'primary'}`}
                onClick={listening ? stop : start}>
          {listening ? '⏹ Stop' : '🎧 Start listening'}
        </button>
      </div>
      <p className="text-xs text-muted">
        Our own engine — no Shazam, no cloud, no servers. Your device hears the music,
        finds the chords, the key and the tempo, and recognizes the song all by itself.
      </p>
      {denied && (
        <p className="text-sm text-amber-400">{denied}</p>
      )}
      {listening && frame && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-[var(--glass-border)] rounded-xl p-3">
            <p className="text-xs text-muted">Chord right now</p>
            <p className="text-xl font-bold text-accent">{frame.chord ?? '…'}</p>
          </div>
          <div className="border border-[var(--glass-border)] rounded-xl p-3">
            <p className="text-xs text-muted">Key</p>
            <p className="text-xl font-bold">{frame.key ?? '…'}</p>
          </div>
          <div className="border border-[var(--glass-border)] rounded-xl p-3">
            <p className="text-xs text-muted">Tempo</p>
            <p className="text-xl font-bold">{frame.bpm ? `${frame.bpm} BPM` : '…'}</p>
          </div>
        </div>
      )}
      {matchedSong && (
        <div className="border border-accent/40 rounded-xl p-4 space-y-1">
          <p className="font-semibold">🎯 That sounds like <span className="text-accent">{matchedSong.title}</span>
            <span className="text-xs text-muted"> ({Math.round(match!.score * 100)}% match)</span></p>
          <p className="text-xs text-muted">
            Key: {matchedSong.key} · {matchedSong.bpm} BPM · {matchedSong.timeSignature}
            {matchedSong.leadSinger ? ` · Lead: ${matchedSong.leadSinger}` : ''}
          </p>
          <p className="text-xs">
            {matchedSong.originalArtist && <>Originally performed by <b>{matchedSong.originalArtist}</b>. </>}
            {matchedSong.label && <>℗ {matchedSong.label}. </>}
            {matchedSong.publisher && <>© {matchedSong.year ? `${matchedSong.year} ` : ''}{matchedSong.publisher}. </>}
            {matchedSong.ccliNumber && <>CCLI #{matchedSong.ccliNumber}. </>}
          </p>
          <div className="flex gap-2 flex-wrap pt-1">
            {onOpenSong && (
              <button className="glass-btn text-xs primary" onClick={() => onOpenSong(matchedSong.id)}>
                📖 Open chart & transpose
              </button>
            )}
            <a className="glass-btn text-xs" target="_blank" rel="noreferrer"
               href={`https://music.apple.com/us/search?term=${encodeURIComponent(`${matchedSong.title} ${matchedSong.originalArtist ?? matchedSong.artist}`)}`}>
              ▶ Buy the original
            </a>
          </div>
          <p className="text-xs text-muted">
            Not the recorded key? Open the chart and transpose to {frame?.key?.split(' ')[0] ?? 'your key'} —
            the app re-fingers every chord for YOUR instruments.
          </p>
        </div>
      )}
    </div>
  );
}
