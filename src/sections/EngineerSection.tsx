// ==========================================================================
// This Area Of Code Is: The Engineer Bench — universal tools for the three
// engineer seats. 🔊 Sound: live SPL loudness meter + house patch notes.
// 🎬 Media: the service run-sheet with check-offs. 🎚 Tempo: tap-tempo BPM
// + a real metronome click. Everything saves on the device — no account
// hopping, no lost notes. In Other Words: The booth in your pocket.
// ==========================================================================
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { loadAllSongs, saveSong } from '../lib/songs';
import { getMicStream, runningAudioContext, micErrorMessage } from '../lib/mic';

type Bench = 'sound' | 'media' | 'tempo' | 'tracks';
const BENCHES: { id: Bench; icon: string; label: string }[] = [
  { id: 'sound', icon: '🔊', label: 'Sound Engineer' },
  { id: 'tracks', icon: '🎚', label: 'Audio Track Engineer' },
  { id: 'media', icon: '🎬', label: 'Media Engineer' },
  { id: 'tempo', icon: '⏱', label: 'Tempo Engineer' },
];

const NOTE_KEY = (b: Bench) => `ntcc.eng.${b}.notes`;
const RUN_KEY = 'ntcc.eng.media.runsheet';

export default function EngineerSection() {
  const { user } = useAuth();
  const start: Bench = user && ['sound', 'media', 'tempo'].includes(user.role) ? (user.role as Bench) : 'sound';
  const [bench, setBench] = useState<Bench>(start);

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">🎛 The Engineer Bench</h2>
        <p className="text-muted text-sm">Universal tools for the booth — pick your seat.</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {BENCHES.map((b) => (
            <button key={b.id} className={`glass-btn text-sm ${bench === b.id ? 'primary' : ''}`}
                    onClick={() => setBench(b.id)} aria-pressed={bench === b.id}>
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>
      {bench === 'sound' && <SoundBench />}
      {bench === 'tracks' && <TracksBench />}
      {bench === 'media' && <MediaBench />}
      {bench === 'tempo' && <TempoBench />}
    </div>
  );
}

/* ---------------- 🎚 AUDIO TRACKS: the unified track console ----------------
   Per the boss: "I don't see a difference on sound engineer tools and audio
   track tools" — so there is ONE console now. Load stems or tracks (piano,
   guitar, vocals, bass, drums, strings…), ride every fader, mute/solo, and
   play them all in synchronized playback. The mix saves on the device.

   Per the boss (this wave): "the engineer controls the audio track with the
   band… add instruments that we may need and a song that we don't have so
   they have parts that play with the band during the live service — the
   sound engineer controls how much someone's playing loud or not playing."
   So the console now: (1) picks the SONG from the library — or quick-adds a
   song we don't have, (2) adds instrument GUIDE PARTS that play along with
   the band in the song's key and tempo (Click · Drums · Bass · Piano ·
   Guitar · Organ · Strings · Pads), and (3) every channel — file stem or
   guide part — rides a fader with Mute/Solo under the engineer's hand. */
interface TrackStrip {
  id: string; name: string; volume: number; muted: boolean; solo: boolean;
  kind: 'file' | 'guide';       // file = uploaded stem; guide = generated part
  url?: string;                 // file strips only
  instrument?: string;          // guide strips only (Click, Bass, …)
  songId?: string;              // guide strips: the song they belong to
}
const MIX_KEY = 'ntcc.eng.tracks.mix';
const PARTS_KEY = 'ntcc.eng.tracks.parts'; // Record<songId, instrument[]>
const SECTIONS_KEY = 'ntcc.eng.tracks.sections'; // Record<songId, SectionRow[]>
const ROSTER_KEY = 'ntcc.eng.tracks.roster';   // channel names the Sound Engineer's fader board rides

interface SectionRow { name: string; bars: number }
const DEFAULT_SECTIONS: SectionRow[] = [
  { name: 'Intro', bars: 4 }, { name: 'Verse 1', bars: 8 }, { name: 'Chorus', bars: 8 },
  { name: 'Verse 2', bars: 8 }, { name: 'Chorus', bars: 8 }, { name: 'Bridge', bars: 8 },
  { name: 'Chorus', bars: 8 }, { name: 'Outro', bars: 4 },
];

/* This Area Of Code Is: The Voice Guide Cue.
   Explanation: The same idea as Prime Multitrack and Playback — a voice in
   the mix calls the next section one bar early ("Chorus, 2, 3, 4") so the
   whole band turns together. The device speaks it; no cloud, no account. */
function speakCue(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.cancel(); // the latest cue always wins — no lag
    window.speechSynthesis.speak(u);
  } catch { /* device has no voice — cues stay visual */ }
}

const GUIDE_INSTRUMENTS = ['Click', 'Drums', 'Bass', 'Piano', 'Guitar', 'Organ', 'Strings', 'Pads'] as const;
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_IDX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};
const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/* This Area Of Code Is: The Guide-Part Engine.
   Explanation: When the band is missing a player — no bass this Sunday, no
   drummer, a song nobody charted — the app plays that PART itself, locked to
   the song's key and BPM on a 16th-note lookahead grid (the same sample-
   accurate scheduling as the metronome). Each instrument is a channel with
   its own GainNode, so the engineer's fader/mute/solo rides it like any
   other stem. A I–IV–V–IV loop keeps harmony underneath the band.
   In Other Words: The missing musician shows up — and the engineer still
   runs the board. */
class GuideEngine {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0; // 16th-note grid
  bpm = 90;
  root = 9; // semitone of the song key (A default)
  /** Fires at the top of every bar (bar index) so the console can call cues. */
  onBar: ((bar: number) => void) | null = null;
  private gains = new Map<string, { gain: GainNode; instrument: string }>();

  private ac(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }
  attach(id: string, instrument: string): GainNode {
    const g = this.ac().createGain();
    g.gain.value = 0;
    g.connect(this.ac().destination);
    this.gains.set(id, { gain: g, instrument });
    return g;
  }
  detach(id: string): void {
    const e = this.gains.get(id);
    if (e) { try { e.gain.disconnect(); } catch { /* gone */ } this.gains.delete(id); }
  }
  setLevel(id: string, level: number): void {
    const e = this.gains.get(id);
    if (e) e.gain.gain.setTargetAtTime(level, this.ac().currentTime, 0.02);
  }

  get running(): boolean { return this.timer !== null; }

  start(): void {
    const ctx = this.ac();
    // iOS: resume BEFORE the scheduler starts, or the first notes land in a
    // suspended context and never sound. Catch so no unhandled rejection.
    void ctx.resume().catch(() => { /* retried on next start */ });
    this.stop();
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.ac();
    const stepDur = 60 / this.bpm / 4; // 16ths
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime;
      const s = this.step;
      this.gains.forEach(({ gain, instrument }) => this.playStep(instrument, s, t, gain, stepDur));
      // Bar-boundary hook, aligned to the audio clock for the UI + voice cues.
      if (s % 16 === 0 && this.onBar) {
        const bar = Math.floor(s / 16);
        const cb = this.onBar;
        setTimeout(() => cb(bar), Math.max(0, (t - ctx.currentTime) * 1000));
      }
      this.step++;
      this.nextTime += stepDur;
    }
  }

  /** One 16th-note of one instrument. bar loop: I–IV–V–IV (offsets 0,5,7,5). */
  private playStep(inst: string, s: number, t: number, out: GainNode, stepDur: number): void {
    const ctx = this.ac();
    const inBar = s % 16;
    const bar = Math.floor(s / 16) % 4;
    const deg = [0, 5, 7, 5][bar];
    const chordRoot = this.root + deg;

    const tone = (midi: number, type: OscillatorType, vol: number, dur: number, when = t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = midiHz(midi);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g).connect(out);
      o.start(when);
      o.stop(when + dur + 0.02);
    };

    switch (inst) {
      case 'Click':
        if (inBar % 4 === 0) tone(inBar === 0 ? 84 : 79, 'square', 0.5, 0.05);
        break;
      case 'Drums':
        if (inBar % 8 === 0) tone(24, 'sine', 0.9, 0.14);                    // kick 1 & 3
        if (inBar === 4 || inBar === 12) tone(43, 'triangle', 0.6, 0.09);    // snare 2 & 4
        if (inBar % 2 === 0) tone(96, 'square', 0.12, 0.02);                 // hat 8ths
        break;
      case 'Bass':
        if (inBar % 4 === 0) tone(36 + chordRoot, 'sawtooth', 0.45, stepDur * 3.4); // root, quarters
        break;
      case 'Piano':
        if (inBar === 0 || inBar === 10) [0, 4, 7].forEach((iv) => tone(60 + chordRoot + iv, 'triangle', 0.22, 0.45));
        break;
      case 'Guitar':
        if (inBar === 0 || inBar === 8) [0, 7].forEach((iv, i) => tone(60 + chordRoot + iv, 'sawtooth', 0.16, 0.28, t + i * 0.035));
        break;
      case 'Organ':
        if (inBar === 0) [0, 4, 7].forEach((iv) => tone(60 + chordRoot + iv, 'square', 0.07, stepDur * 15));
        break;
      case 'Strings':
        if (inBar === 0) [0, 7, 12].forEach((iv) => tone(60 + chordRoot + iv, 'sawtooth', 0.06, stepDur * 15));
        break;
      case 'Pads':
        if (inBar === 0) [0, 4, 7, 11].forEach((iv) => tone(72 + chordRoot + iv, 'sine', 0.08, stepDur * 15));
        break;
    }
  }
}

function TracksBench() {
  const [tracks, setTracks] = useState<TrackStrip[]>([]);
  const [playing, setPlaying] = useState(false);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<GuideEngine | null>(null);
  const engine = () => (engineRef.current ??= new GuideEngine());

  // ---- Song context: pick from the library, or quick-add one we don't have.
  const [songs, setSongs] = useState(() => loadAllSongs());
  const [songId, setSongId] = useState('');
  const song = songs.find((s) => s.id === songId) ?? null;
  const [addingSong, setAddingSong] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKey, setNewKey] = useState('A');
  const [newBpm, setNewBpm] = useState('96');

  // ---- Section map + voice guide cues (the track engineer's roadmap).
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [cuesOn, setCuesOn] = useState(true);
  const [countInOn, setCountInOn] = useState(true);
  const [liveBar, setLiveBar] = useState<number | null>(null); // current bar while playing

  const loadSections = (sid: string): SectionRow[] => {
    try {
      const all = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, SectionRow[]>;
      if (Array.isArray(all[sid]) && all[sid].length) return all[sid];
    } catch { /* fall through to the default map */ }
    return DEFAULT_SECTIONS;
  };
  const saveSections = (sid: string, rows: SectionRow[]) => {
    setSections(rows);
    try {
      const all = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, SectionRow[]>;
      all[sid] = rows;
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(all));
    } catch { /* session-only */ }
  };
  /** Section boundaries as running bar numbers. */
  const boundaries = (rows: SectionRow[]) => {
    let at = 0;
    return rows.map((r) => { const b = { name: r.name, start: at }; at += Math.max(1, r.bars); return b; });
  };

  // Saved fader positions ride along by track NAME so a reloaded set of stems
  // picks its mix back up automatically.
  const savedMix = (() => {
    try { return JSON.parse(localStorage.getItem(MIX_KEY) ?? '{}') as Record<string, { volume: number; muted: boolean }>; }
    catch { return {}; }
  })();

  const loadParts = (sid: string): string[] => {
    try { return (JSON.parse(localStorage.getItem(PARTS_KEY) ?? '{}') as Record<string, string[]>)[sid] ?? []; }
    catch { return []; }
  };
  const saveParts = (sid: string, instruments: string[]) => {
    try {
      const all = JSON.parse(localStorage.getItem(PARTS_KEY) ?? '{}') as Record<string, string[]>;
      all[sid] = instruments;
      localStorage.setItem(PARTS_KEY, JSON.stringify(all));
    } catch { /* device full — parts stay for the session */ }
  };

  const mkGuide = (sid: string, instrument: string): TrackStrip => {
    const name = `${instrument} (guide)`;
    const saved = savedMix[name];
    return {
      id: crypto.randomUUID(), name, kind: 'guide', instrument, songId: sid,
      volume: saved?.volume ?? (instrument === 'Click' ? 0.5 : 0.7),
      muted: saved?.muted ?? false, solo: false,
    };
  };

  // The Sound Engineer's fader board rides this roster by channel NAME.
  const saveRoster = (list: TrackStrip[]) => {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(list.map((t) => ({ name: t.name, kind: t.kind }))));
    } catch { /* session-only */ }
  };

  // Pick a song → its saved instrument parts + section map come back.
  const chooseSong = (sid: string) => {
    setSongId(sid);
    setSections(sid ? loadSections(sid) : []);
    const picked = songs.find((s) => s.id === sid);
    if (picked) {
      engine().bpm = picked.bpm || 90;
      engine().root = NOTE_IDX[picked.key?.trim() ?? 'A'] ?? 9;
    }
    setTracks((prev) => {
      // Drop the old song's guides; keep file stems (this week's set stays).
      prev.filter((t) => t.kind === 'guide').forEach((t) => engine().detach(t.id));
      const files = prev.filter((t) => t.kind === 'file');
      const next = [...files, ...loadParts(sid).map((inst) => mkGuide(sid, inst))];
      saveRoster(next);
      return next;
    });
  };

  const addInstrument = (instrument: string) => {
    if (!song) return;
    if (tracks.some((t) => t.kind === 'guide' && t.songId === song.id && t.instrument === instrument)) return;
    const strip = mkGuide(song.id, instrument);
    engine().attach(strip.id, instrument);
    engine().setLevel(strip.id, playing ? effGain(strip, [...tracks, strip]) : 0);
    const next = [...tracks, strip];
    setTracks(next);
    saveRoster(next);
    saveParts(song.id, next.filter((t) => t.kind === 'guide' && t.songId === song.id).map((t) => t.instrument!));
  };

  const quickAddSong = () => {
    const title = newTitle.trim();
    if (!title) return;
    const s = {
      id: crypto.randomUUID(), title, artist: '', key: newKey,
      bpm: Math.max(40, Math.min(240, parseInt(newBpm, 10) || 96)),
      timeSignature: '4/4', language: 'English', credit: '', sections: [],
      tags: ['tracks-needed'],
    };
    saveSong(s);
    const all = loadAllSongs();
    setSongs(all);
    setAddingSong(false);
    setNewTitle('');
    chooseSong(s.id);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: TrackStrip[] = Array.from(files).map((f) => {
      const name = f.name.replace(/\.[^.]+$/, '');
      const saved = savedMix[name];
      return {
        id: crypto.randomUUID(), name, kind: 'file' as const,
        url: URL.createObjectURL(f),
        volume: saved?.volume ?? 0.8, muted: saved?.muted ?? false, solo: false,
      };
    });
    setTracks((p) => { const next = [...p, ...added]; saveRoster(next); return next; });
  };

  /** Effective gain: fader (perceptual v²) × mute × solo-isolation. */
  const effGain = (t: TrackStrip, all: TrackStrip[]) => {
    const anySolo = all.some((x) => x.solo);
    const silenced = t.muted || (anySolo && !t.solo);
    return silenced ? 0 : t.volume * t.volume;
  };

  const apply = (t: TrackStrip) => {
    if (t.kind === 'file') {
      const el = audioRefs.current.get(t.id);
      if (el) { el.volume = t.volume; el.muted = t.muted || (tracks.some((x) => x.solo) && !t.solo); }
    } else {
      engine().setLevel(t.id, playing ? effGain(t, tracks) : 0);
    }
  };

  const update = (id: string, patch: Partial<TrackStrip>) => {
    setTracks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      const mix: Record<string, { volume: number; muted: boolean }> = {};
      next.forEach((t) => { mix[t.name] = { volume: t.volume, muted: t.muted }; });
      localStorage.setItem(MIX_KEY, JSON.stringify(mix));
      // Re-level every guide channel so solo/mute isolation is exact.
      next.filter((t) => t.kind === 'guide').forEach((t) => engine().setLevel(t.id, playing ? effGain(t, next) : 0));
      if (song) saveParts(song.id, next.filter((t) => t.kind === 'guide' && t.songId === song.id).map((t) => t.instrument!));
      saveRoster(next);
      return next;
    });
  };

  const remove = (t: TrackStrip) => {
    if (t.kind === 'guide') engine().detach(t.id);
    const next = tracks.filter((x) => x.id !== t.id);
    setTracks(next);
    saveRoster(next);
    if (song && t.kind === 'guide' && t.songId === song.id) {
      saveParts(song.id, next.filter((x) => x.kind === 'guide' && x.songId === song.id).map((x) => x.instrument!));
    }
  };

  // ---- Transport with voice guide cues -------------------------------
  const cuesRef = useRef({ cuesOn, countInOn, sections });
  cuesRef.current = { cuesOn, countInOn, sections };

  const playAll = () => {
    const next = !playing;
    setPlaying(next);
    audioRefs.current.forEach((el) => {
      // play() can reject (bad/missing stem src) — never leak a rejection.
      if (next) void el.play().catch(() => { /* stem skipped */ });
      else { el.pause(); el.currentTime = 0; }
    });
    const eng = engine();
    if (next) {
      // Voice count-in before the downbeat, like a real guide track.
      if (cuesRef.current.countInOn) speakCue('1, 2, 3, 4');
      // At every bar top: light the current section; one bar before a
      // boundary, call the next section — "Chorus, 2, 3, 4".
      eng.onBar = (bar) => {
        setLiveBar(bar);
        const { cuesOn: cOn, sections: rows } = cuesRef.current;
        if (!cOn || rows.length === 0) return;
        const bs = boundaries(rows);
        const upcoming = bs.find((b) => b.start === bar + 1);
        if (upcoming) speakCue(`${upcoming.name}, 2, 3, 4`);
      };
      eng.start();
      setLiveBar(0);
      tracks.filter((t) => t.kind === 'guide').forEach((t) => eng.setLevel(t.id, effGain(t, tracks)));
    } else {
      eng.stop();
      eng.onBar = null;
      setLiveBar(null);
      try { window.speechSynthesis.cancel(); } catch { /* quiet */ }
    }
  };
  // Stopping on unmount keeps no synth running in the background.
  useEffect(() => () => { engineRef.current?.stop(); try { window.speechSynthesis.cancel(); } catch { /* quiet */ } }, []);

  // The Sound Engineer's fader board writes the same mix by channel NAME —
  // when it does, this console hears it and re-levels every live channel.
  useEffect(() => {
    const onExternal = () => {
      let mix: Record<string, { volume: number; muted: boolean }> = {};
      try { mix = JSON.parse(localStorage.getItem(MIX_KEY) ?? '{}'); } catch { return; }
      setTracks((prev) => {
        const next = prev.map((t) => (mix[t.name] ? { ...t, volume: mix[t.name].volume, muted: mix[t.name].muted } : t));
        next.forEach((t) => {
          if (t.kind === 'guide') engine().setLevel(t.id, playing ? effGain(t, next) : 0);
          else {
            const el = audioRefs.current.get(t.id);
            if (el) { el.volume = t.volume; el.muted = t.muted || (next.some((x) => x.solo) && !t.solo); }
          }
        });
        return next;
      });
    };
    window.addEventListener('ntcc.mix.external', onExternal);
    return () => window.removeEventListener('ntcc.mix.external', onExternal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const guideCount = tracks.filter((t) => t.kind === 'guide').length;

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h3 className="text-accent font-semibold">🎚 Audio Track Console — synchronized multi-stem</h3>
        <p className="text-muted text-sm">
          The sound engineer's board: ride every channel — file stems and generated band parts — with faders, Mute, and Solo during the live service.
        </p>
      </div>

      {/* 1 — The song: from the library, or one we don't have yet. */}
      <div className="rounded-xl border border-[var(--glass-border)] p-3 space-y-2">
        <label className="text-sm font-semibold" htmlFor="track-song">Song the tracks play with</label>
        <div className="flex gap-2 flex-wrap">
          <select id="track-song" className="auth-input text-sm flex-1 min-w-48" value={songId}
                  onChange={(e) => chooseSong(e.target.value)}>
            <option value="">— pick a song —</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>{s.title} · {s.key} · {s.bpm} BPM</option>
            ))}
          </select>
          <button className="glass-btn text-sm" onClick={() => setAddingSong((a) => !a)} aria-expanded={addingSong}>
            ＋ A song we don't have
          </button>
        </div>
        {addingSong && (
          <div className="flex gap-2 flex-wrap items-center">
            <input className="auth-input text-sm flex-1 min-w-40" placeholder="Song title"
                   value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="New song title" />
            <select className="auth-input !w-20 text-sm" value={newKey} onChange={(e) => setNewKey(e.target.value)} aria-label="Key">
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input className="auth-input !w-24 text-sm" inputMode="numeric" placeholder="BPM"
                   value={newBpm} onChange={(e) => setNewBpm(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Tempo in BPM" />
            <button className="glass-btn primary text-sm" onClick={quickAddSong}>Add song</button>
          </div>
        )}
        {song && (
          <p className="text-muted text-xs">
            Parts play in <strong className="text-accent">{song.key}</strong> at <strong className="text-accent">{song.bpm} BPM</strong> — the tempo keeps the band locked in.
          </p>
        )}
      </div>

      {/* 2 — Add the instrument the band is missing. */}
      <div className="rounded-xl border border-[var(--glass-border)] p-3 space-y-2">
        <p className="text-sm font-semibold">Add an instrument part — it plays with the band</p>
        {!song ? (
          <p className="text-muted text-xs">Pick a song above first — parts need its key and tempo.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {GUIDE_INSTRUMENTS.map((inst) => {
              const on = tracks.some((t) => t.kind === 'guide' && t.songId === song.id && t.instrument === inst);
              return (
                <button key={inst} className={`glass-btn text-xs ${on ? 'primary' : ''}`} disabled={on}
                        onClick={() => addInstrument(inst)} aria-pressed={on}>
                  {on ? '✓ ' : '＋ '}{inst}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3 — Section map + voice guide cues (Prime/Playback-style). */}
      {song && (
        <div className="rounded-xl border border-[var(--glass-border)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">🗺 Section map + voice guide cues</p>
            <div className="flex gap-2">
              <button className={`glass-btn text-xs ${cuesOn ? 'primary' : ''}`} aria-pressed={cuesOn}
                      onClick={() => setCuesOn((v) => !v)}>🗣 Cues {cuesOn ? 'ON' : 'OFF'}</button>
              <button className={`glass-btn text-xs ${countInOn ? 'primary' : ''}`} aria-pressed={countInOn}
                      onClick={() => setCountInOn((v) => !v)}>🔢 Count-in {countInOn ? 'ON' : 'OFF'}</button>
            </div>
          </div>
          {playing && liveBar !== null && sections.length > 0 && (() => {
            const bs = boundaries(sections);
            const cur = [...bs].reverse().find((b) => b.start <= liveBar);
            const nxt = bs.find((b) => b.start > liveBar);
            return (
              <div className="text-center py-2 rounded-lg bg-black/30" role="status">
                <p className="text-2xl font-bold text-accent">{cur?.name ?? '—'}</p>
                <p className="text-muted text-xs">bar {liveBar + 1}{nxt ? ` · next: ${nxt.name}` : ' · last section'}</p>
              </div>
            );
          })()}
          <ul className="space-y-1">
            {sections.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <input className="auth-input text-sm flex-1" value={row.name} aria-label={`Section ${i + 1} name`}
                       onChange={(e) => saveSections(song.id, sections.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                <input className="auth-input !w-16 text-sm text-center" inputMode="numeric" value={String(row.bars)}
                       aria-label={`${row.name} bars`}
                       onChange={(e) => saveSections(song.id, sections.map((r, j) => (j === i ? { ...r, bars: Math.max(1, parseInt(e.target.value, 10) || 1) } : r)))} />
                <span className="text-muted text-xs">bars</span>
                <button className="glass-btn text-xs" aria-label={`Remove ${row.name}`}
                        onClick={() => saveSections(song.id, sections.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
          <button className="glass-btn text-xs"
                  onClick={() => saveSections(song.id, [...sections, { name: 'Tag', bars: 4 }])}>
            ＋ Add section
          </button>
          <p className="text-muted text-xs">With cues on, the app speaks the next section one bar early — "Chorus, 2, 3, 4" — like a guide track in the in-ears.</p>
        </div>
      )}

      {/* 4 — File stems + playback. */}
      <div className="flex gap-2 flex-wrap">
        <button className="glass-btn" onClick={() => fileRef.current?.click()}>📂 Add tracks / stems</button>
        <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden"
               onChange={(e) => addFiles(e.target.files)} />
        {tracks.length > 0 && (
          <button className={`cta-gold px-6 ${playing ? 'opacity-80' : ''}`} onClick={playAll}>
            {playing ? '⏹ Stop all' : '▶ Synchronized Playback'}
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted text-sm">No channels yet — pick a song and add instrument parts, or load this week's stems.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {tracks.map((t) => (
            <div key={t.id} className="rounded-xl border border-[var(--glass-border)] p-3">
              {t.kind === 'file' && (
                <audio ref={(el) => { if (el) { audioRefs.current.set(t.id, el); apply(t); } }} src={t.url} preload="auto" />
              )}
              <p className="text-sm font-semibold truncate mb-2">
                {t.kind === 'guide' ? '🤖' : '🎵'} {t.name}
              </p>
              <input type="range" min={0} max={1} step={0.01} value={t.volume} className="w-full"
                     aria-label={`${t.name} volume`}
                     onChange={(e) => { update(t.id, { volume: +e.target.value }); apply({ ...t, volume: +e.target.value }); }} />
              <div className="flex gap-2 mt-1">
                <button className={`glass-btn text-xs ${t.muted ? 'danger' : ''}`}
                        onClick={() => { update(t.id, { muted: !t.muted }); apply({ ...t, muted: !t.muted }); }}>
                  {t.muted ? '🔇 Muted' : '🔊 Mute'}
                </button>
                <button className={`glass-btn text-xs ${t.solo ? 'primary' : ''}`}
                        onClick={() => { update(t.id, { solo: !t.solo }); apply({ ...t, solo: !t.solo }); }}>
                  ★ Solo
                </button>
                <button className="glass-btn text-xs danger ml-auto" aria-label={`Remove ${t.name}`}
                        onClick={() => remove(t)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {guideCount > 0 && (
        <p className="text-muted text-xs">
          🤖 {guideCount} generated part{guideCount > 1 ? 's' : ''} covering for the band — the engineer's faders decide how loud each one plays.
        </p>
      )}
    </div>
  );
}

/* ---------------- 🔊 SOUND: SPL + RTA + delay calc + patch notes ---------------- */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','Bb','B'];
function hzToNote(hz: number): string {
  const n = Math.round(12 * Math.log2(hz / 440)) + 69;
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

function SoundBench() {
  const [db, setDb] = useState<number | null>(null);
  const [peak, setPeak] = useState<number | null>(null);
  const [hot, setHot] = useState(''); // loudest frequency right now (feedback hunter)
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTE_KEY('sound')) ?? '');
  const [feet, setFeet] = useState('');
  // Auto-cleanup advisor: band energies the app watches so it can ADVISE the
  // engineer (never act alone — the engineer can override any suggestion).
  const [bands, setBands] = useState({ rumble: 0, harsh: 0 });
  const [overridden, setOverridden] = useState<string[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startMeter = async () => {
    try {
      const stream = await getMicStream();
      const ctx = await runningAudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const freq = new Uint8Array(an.frequencyBinCount);
      let alive = true;
      const tick = () => {
        if (!alive) return;
        // Loudness
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.max(-99, Math.round(20 * Math.log10(rms || 1e-8) + 94));
        setDb(level);
        setPeak((p) => (p === null || level > p ? level : p));
        // RTA spectrum + feedback hunter
        an.getByteFrequencyData(freq);
        let maxI = 0;
        for (let i = 1; i < freq.length; i++) if (freq[i] > freq[maxI]) maxI = i;
        const hz = (maxI * ctx.sampleRate) / an.fftSize;
        if (freq[maxI] > 140) setHot(`${Math.round(hz)} Hz ≈ ${hzToNote(hz)} — ring that band down`);
        else setHot('');
        // Cleanup advisor band analysis: rumble (<80 Hz) and harshness (2–5 kHz)
        const binHz = ctx.sampleRate / an.fftSize;
        const bandAvg = (lo: number, hi: number) => {
          let s = 0, n = 0;
          for (let i = Math.max(1, Math.floor(lo / binHz)); i <= Math.min(freq.length - 1, Math.ceil(hi / binHz)); i++) { s += freq[i]; n++; }
          return n ? s / n : 0;
        };
        setBands({ rumble: Math.round(bandAvg(20, 80)), harsh: Math.round(bandAvg(2000, 5000)) });
        const cv = canvasRef.current;
        if (cv) {
          const c = cv.getContext('2d');
          if (c) {
            const W = cv.width, H = cv.height;
            c.clearRect(0, 0, W, H);
            const bars = 48;
            for (let b = 0; b < bars; b++) {
              const idx = Math.floor((b / bars) * freq.length * 0.75);
              const v = freq[idx] / 255;
              c.fillStyle = `hsl(${140 - v * 120}, 70%, ${35 + v * 30}%)`;
              c.fillRect((b / bars) * W, H - v * H, W / bars - 2, v * H);
            }
          }
        }
        requestAnimationFrame(tick);
      };
      tick();
      stopRef.current = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };
      setErr('');
    } catch (e) {
      setErr(micErrorMessage(e));
    }
  };
  useEffect(() => () => stopRef.current?.(), []);

  const delayMs = feet ? (Number(feet) / 1.125).toFixed(1) : null; // sound ≈ 1.125 ft/ms

  // This Area Of Code Is: The Auto-Cleanup Advisor.
  // Explanation: Our online audio has been sounding rough, so the app
  // watches the room and ADVISES the sound engineer on the fix — it never
  // touches the sound by itself, and the engineer can override any advice.
  const advice: Array<{ id: string; text: string }> = [];
  if (db !== null) {
    if (bands.rumble > 110) advice.push({ id: 'rumble', text: `Low rumble detected (${bands.rumble}/255 below 80 Hz) — advise engaging the high-pass filter on vocal channels to clean the stream.` });
    if (bands.harsh > 120) advice.push({ id: 'harsh', text: `Harsh 2–5 kHz energy (${bands.harsh}/255) — advise a gentle 2–3 dB cut there so the online mix stops sounding rough.` });
    if (db >= 92) advice.push({ id: 'hot', text: `Signal running hot (${db} dB) — advise backing input gain down ~3 dB to protect the stream from clipping.` });
    if (db < 45) advice.push({ id: 'quiet', text: `Very quiet room (${db} dB) — check the mic/line is up before advising cleanup.` });
  }
  const visibleAdvice = advice.filter((a) => !overridden.includes(a.id));

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-semibold">🔊 Room Meter + Spectrum (RTA)</h3>
      <div className="text-center">
        <p className="text-5xl font-bold text-accent">{db ?? '—'}</p>
        <p className="text-muted text-xs">approx. dB in the room {peak !== null && `· peak ${peak}`}</p>
      </div>
      <canvas ref={canvasRef} width={560} height={120} className="w-full rounded-lg bg-black/30"
              aria-label="Real-time frequency spectrum" />
      {hot && <p className="text-sm text-red-300 text-center" role="alert">⚠️ {hot}</p>}
      <div className="flex gap-2 justify-center flex-wrap">
        <button className="glass-btn primary" onClick={() => void startMeter()}>Start meter</button>
        <button className="glass-btn" onClick={() => { stopRef.current?.(); setDb(null); setPeak(null); setHot(''); }}>Stop</button>
        <button className="glass-btn" onClick={() => setPeak(null)}>Reset peak</button>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}

      {visibleAdvice.length > 0 && (
        <div className="border border-amber-300/50 rounded-xl p-3 space-y-2" role="alert">
          <h4 className="text-sm font-semibold">🧹 Auto-Cleanup Advisor <span className="text-muted font-normal">(advises first — you decide)</span></h4>
          {visibleAdvice.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 text-sm">
              <span>💡 {a.text}</span>
              <button className="glass-btn text-xs shrink-0"
                      onClick={() => setOverridden((o) => [...o, a.id])}>
                Override
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 pt-3">
        <h4 className="text-sm font-semibold mb-2">📏 Speaker Delay Calculator</h4>
        <div className="flex gap-2 items-center flex-wrap">
          <input className="auth-input !w-28 text-sm" inputMode="decimal" placeholder="feet"
                 value={feet} onChange={(e) => setFeet(e.target.value.replace(/[^0-9.]/g, ''))}
                 aria-label="Distance to speaker in feet" />
          <span className="text-sm text-muted">ft from mains →</span>
          <strong className="text-accent">{delayMs ?? '—'} ms</strong>
        </div>
        <p className="text-muted text-xs mt-1">Dial that delay into the delayed fill/speakers so the room lands as one wavefront.</p>
      </div>

      <SoundFaderBoard />

      <label className="block text-sm font-semibold">House patch / board notes</label>
      <textarea className="auth-input !w-full min-h-28" value={notes}
                placeholder="Ch 1: Pastor's mic · Ch 2: Keys L …"
                onChange={(e) => { setNotes(e.target.value); localStorage.setItem(NOTE_KEY('sound'), e.target.value); }} />
    </div>
  );
}

/* ---------------- 🔊 The Sound Engineer's Live Fader Board ----------------
   His OWN profile: he doesn't load tracks — he rides them. Every channel the
   Audio Track Engineer is playing shows up here as a fader with a mute, and
   every move lands on the live channel mid-service (shared mix by channel
   name). "The sound engineer controls how much someone's playing — loud, or
   not playing." */
function SoundFaderBoard() {
  interface Row { name: string; kind: 'file' | 'guide'; volume: number; muted: boolean }
  const load = (): Row[] => {
    try {
      const roster = JSON.parse(localStorage.getItem(ROSTER_KEY) ?? '[]') as { name: string; kind: 'file' | 'guide' }[];
      const mix = JSON.parse(localStorage.getItem(MIX_KEY) ?? '{}') as Record<string, { volume: number; muted: boolean }>;
      return roster.map((r) => ({ ...r, volume: mix[r.name]?.volume ?? 0.8, muted: mix[r.name]?.muted ?? false }));
    } catch { return []; }
  };
  const [rows, setRows] = useState<Row[]>(load);

  const write = (next: Row[]) => {
    setRows(next);
    const mix: Record<string, { volume: number; muted: boolean }> = {};
    next.forEach((r) => { mix[r.name] = { volume: r.volume, muted: r.muted }; });
    localStorage.setItem(MIX_KEY, JSON.stringify(mix));
    // The track console listens for this and re-levels the live channels NOW.
    window.dispatchEvent(new CustomEvent('ntcc.mix.external'));
  };

  if (rows.length === 0) {
    return (
      <div className="border-t border-white/10 pt-3">
        <h4 className="text-sm font-semibold mb-1">🎛 Live Fader Board</h4>
        <p className="text-muted text-xs">No channels playing yet — the Audio Track Engineer loads the set (song, parts, stems), and every channel appears here for you to ride.</p>
      </div>
    );
  }
  return (
    <div className="border-t border-white/10 pt-3 space-y-2">
      <h4 className="text-sm font-semibold">🎛 Live Fader Board <span className="text-muted font-normal text-xs">— you ride loudness; the track engineer runs playback</span></h4>
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="text-xs w-32 truncate" title={r.name}>{r.kind === 'guide' ? '🤖' : '🎵'} {r.name}</span>
          <input type="range" min={0} max={1} step={0.01} value={r.volume} className="flex-1"
                 aria-label={`${r.name} fader`}
                 onChange={(e) => write(rows.map((x, j) => (j === i ? { ...x, volume: +e.target.value } : x)))} />
          <button className={`glass-btn text-xs ${r.muted ? 'danger' : ''}`} aria-pressed={r.muted}
                  onClick={() => write(rows.map((x, j) => (j === i ? { ...x, muted: !x.muted } : x)))}>
            {r.muted ? '🔇' : '🔊'}
          </button>
        </div>
      ))}
      <p className="text-muted text-xs">Every move lands on the live channel immediately — ride the room, not the playlist.</p>
    </div>
  );
}

/* ---------------- 🎬 MEDIA: run-sheet ---------------- */
function MediaBench() {
  const [items, setItems] = useState<{ text: string; done: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem(RUN_KEY) ?? '[]'); } catch { return []; }
  });
  const [draft, setDraft] = useState('');
  const save = (next: typeof items) => { setItems(next); localStorage.setItem(RUN_KEY, JSON.stringify(next)); };

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-semibold">🎬 Service Run-Sheet</h3>
      <div className="flex gap-2">
        <input className="auth-input !w-full" placeholder="e.g. Welcome slides up · 10:28"
               value={draft} onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { save([...items, { text: draft.trim(), done: false }]); setDraft(''); } }} />
        <button className="glass-btn primary" onClick={() => { if (draft.trim()) { save([...items, { text: draft.trim(), done: false }]); setDraft(''); } }}>
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="glass-card p-3 flex items-center gap-3">
            <input type="checkbox" checked={it.done} aria-label={`Done: ${it.text}`}
                   onChange={() => save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
            <span className={`flex-1 text-sm ${it.done ? 'line-through text-muted' : ''}`}>{it.text}</span>
            <button className="glass-btn text-xs" onClick={() => save(items.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
        {items.length === 0 && <p className="text-muted text-sm">No cues yet — build tonight's run above.</p>}
      </ul>

      <div className="border-t border-white/10 pt-3">
        <h4 className="text-sm font-semibold mb-2">🎥 Cinema Camera Quick Reference (phone rigs)</h4>
        <ul className="text-sm space-y-1 text-muted">
          <li><strong className="text-accent">Shutter:</strong> 180° rule — 1/(2×fps): 1/48 for 24fps, 1/120 for 60fps</li>
          <li><strong className="text-accent">ISO:</strong> lowest the room allows; raise light, not ISO</li>
          <li><strong className="text-accent">Focus:</strong> manual + peaking on the speaker's eyes; lock it before worship starts</li>
          <li><strong className="text-accent">White balance:</strong> lock to the stage lights (~3200K tungsten / 5600K LED) — never auto mid-service</li>
          <li><strong className="text-accent">Audio:</strong> feed the board's mix into the camera line-in; camera mics are backup only</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------- 🎚 TEMPO: tap BPM + metronome ---------------- */
function TempoBench() {
  const [taps, setTaps] = useState<number[]>([]);
  const [bpm, setBpm] = useState(96);
  const [clicking, setClicking] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const tap = () => {
    const now = performance.now();
    const recent = [...taps, now].filter((t) => now - t < 3000);
    setTaps(recent);
    if (recent.length >= 2) {
      const gaps = recent.slice(1).map((t, i) => t - recent[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(Math.round(60000 / avg));
      // Drift analysis — how steady is the human hand?
      const devs = gaps.map((g) => Math.abs(g - avg));
      const meanDev = devs.reduce((a, b) => a + b, 0) / devs.length;
      setDrift({ ms: Math.round(meanDev), score: Math.max(0, Math.round(100 - (meanDev / avg) * 400)) });
    }
  };
  const [drift, setDrift] = useState<{ ms: number; score: number } | null>(null);

  // Tempo map — the service's sections and their BPMs, saved on device.
  const MAP_KEY = 'ntcc.eng.tempo.map';
  const [mapRows, setMapRows] = useState<{ name: string; bpm: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? '[]'); } catch { return []; }
  });
  const [mapName, setMapName] = useState('');
  const saveMap = (rows: typeof mapRows) => { setMapRows(rows); localStorage.setItem(MAP_KEY, JSON.stringify(rows)); };

  const toggleClick = () => {
    if (clicking) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setClicking(false);
      return;
    }
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    // iOS: a fresh context can start suspended — resume or the click is silent.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* next tap retries */ });
    const click = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    };
    click();
    timerRef.current = window.setInterval(click, 60000 / bpm);
    setClicking(true);
  };
  // keep the click honest when BPM changes mid-run
  useEffect(() => {
    if (clicking && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
      }, 60000 / bpm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div className="glass-card p-5 space-y-4 text-center">
      <h3 className="font-semibold text-left">🎚 Tempo Tools</h3>
      <p className="text-6xl font-bold text-accent">{bpm} <span className="text-lg text-muted">BPM</span></p>
      <div className="flex gap-2 justify-center flex-wrap">
        <button className="glass-btn primary text-lg px-8" onClick={tap}>👆 TAP</button>
        <button className={`glass-btn ${clicking ? 'primary' : ''}`} onClick={toggleClick} aria-pressed={clicking}>
          {clicking ? '⏹ Stop click' : '▶ Metronome'}
        </button>
        <button className="glass-btn" onClick={() => setTaps([])}>Reset taps</button>
      </div>
      {drift && (
        <p className="text-sm">
          Timing drift: <strong className="text-accent">±{drift.ms} ms</strong> · steadiness{' '}
          <strong className={drift.score >= 85 ? 'text-green-300' : 'text-accent'}>{drift.score}%</strong>
          {drift.score >= 85 ? ' — locked to the grid 🔒' : ' — keep tapping, it tightens up'}
        </p>
      )}

      <div className="border-t border-white/10 pt-3 text-left">
        <h4 className="text-sm font-semibold mb-2">🗺 Service Tempo Map</h4>
        <div className="flex gap-2 flex-wrap">
          <input className="auth-input !w-full text-sm flex-1" placeholder="Section or song (e.g. Chorus 2)"
                 value={mapName} onChange={(e) => setMapName(e.target.value)} aria-label="Tempo map entry name" />
          <button className="glass-btn text-sm" onClick={() => {
            if (!mapName.trim()) return;
            saveMap([...mapRows, { name: mapName.trim(), bpm }]);
            setMapName('');
          }}>+ Add at {bpm} BPM</button>
        </div>
        <ul className="mt-2 space-y-1">
          {mapRows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{r.name}</span>
              <strong className="text-accent">{r.bpm} BPM</strong>
              <button className="glass-btn text-xs" aria-label={`Remove ${r.name}`}
                      onClick={() => saveMap(mapRows.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted text-xs">Tap along with the track to catch its tempo; the metronome follows whatever BPM is showing.</p>
    </div>
  );
}
