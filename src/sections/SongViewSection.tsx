// Copyright © 2026 NTCCA Music App™ | Gifted to New Testament Christian Churches of America, INC. by Reverend Frederick D. Thomas, Jr., NTCC Graham, WA | Class of 2011, Commissioned Change Your World
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The performance Song View.
// Explanation: Renders chord-over-lyrics charts with live transposition
// (sharp/flat aware), capo calculator, and adjustable auto-scroll for
// hands-free stage use. Section changes are reported up so the UnityLED
// engine can fire lighting scenes in sync.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import {
  type Song, type SectionKind, transposeChord, keyDiff, capoFor, INSTRUMENTS,
} from '../lib/music';
import { resolveFileUrl } from '../lib/fileStore';
import { youtubeEmbed, isVideoFile } from '../lib/media';
import { ATTACHMENT_ICON } from '../lib/attachments';
import type { SongAttachment } from '../lib/music';
import PdfViewer from '../components/PdfViewer';
import SibViewer from '../components/SibViewer';
import UnifiedViewer from '../components/UnifiedViewer';
import EngravedSheet from '../components/EngravedSheet';
import { ListenPanel } from './ListenPanel';
import { useI18n } from '../lib/i18n';

const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

interface Props {
  song: Song;
  onSection: (kind: SectionKind) => void;
  onOpenSong?: (id: string) => void;
}

export default function SongViewSection({ song, onSection, onOpenSong }: Props) {
  const { t } = useI18n();
  const [targetKey, setTargetKey] = useState(song.key);
  const [scrolling, setScrolling] = useState(false);
  const [engraving, setEngraving] = useState(false);
  const [speed, setSpeed] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Instrument transposition: the horns read above concert (see the sax
  // chart in music.ts). Chart chords = concert transposition + instrument offset.
  const [instrumentId, setInstrumentId] = useState('concert');
  const instrument = INSTRUMENTS.find((i) => i.id === instrumentId) ?? INSTRUMENTS[0];

  const semis = keyDiff(song.key, targetKey);
  const displaySemis = semis + instrument.offset;
  const preferFlats = targetKey.includes('b') || instrument.family !== 'C';
  const capo = capoFor(song.key, targetKey);
  const writtenKey = transposeChord(targetKey, instrument.offset, preferFlats);

  // Uploaded files live in IndexedDB ("idb://…") — resolve to a playable URL.
  const [audioSrc, setAudioSrc] = useState(song.audioUrl ?? '');
  useEffect(() => {
    let alive = true;
    void resolveFileUrl(song.audioUrl ?? '').then((u) => { if (alive) setAudioSrc(u ?? ''); });
    return () => { alive = false; };
  }, [song.id, song.audioUrl]);

  // This Area Of Code Is: Video source resolution.
  // Explanation: A song's video can be an uploaded file (idb://), a direct
  // MP4/WebM link, or any shape of YouTube link. I resolve files through the
  // vault and normalize YouTube links once, here, so the player below stays
  // simple and works the same on iPhone, Android, and desktop.
  const [videoSrc, setVideoSrc] = useState('');
  const [videoIsFile, setVideoIsFile] = useState(false);
  useEffect(() => {
    let alive = true;
    const ref = song.videoUrl ?? '';
    if (ref && isVideoFile(ref)) {
      void resolveFileUrl(ref).then((u) => {
        if (alive) { setVideoSrc(u ?? ''); setVideoIsFile(true); }
      });
    } else if (alive) { setVideoSrc(''); setVideoIsFile(false); }
    return () => { alive = false; };
  }, [song.id, song.videoUrl]);

  const ytEmbed = song.youtubeUrl ? youtubeEmbed(song.youtubeUrl) : null;

  // This Area Of Code Is: Attachment resolution + the PDF viewer.
  // Explanation: Every attachment on the song is resolved from the vault
  // (idb://) into a real URL once, here. PDFs get an inline viewer; audio
  // and video get players; score files get an Import button back into the
  // reader; everything else gets a safe download link.
  const [attUrls, setAttUrls] = useState<Record<string, string>>({});
  const [openPdf, setOpenPdf] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const atts = song.attachments ?? [];
    void Promise.all(atts.map(async (a) => [a.id, await resolveFileUrl(a.ref)] as const))
      .then((pairs) => {
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const [id, url] of pairs) if (url) map[id] = url;
        setAttUrls(map);
      });
    return () => { alive = false; };
  }, [song.id, song.attachments]);

  const renderAttachment = (a: SongAttachment) => {
    const url = attUrls[a.id];
    const lowerName = a.name?.toLowerCase() ?? '';

    // MusicXML / XML — full notation renderer
    if (lowerName.endsWith('.musicxml') || lowerName.endsWith('.xml')) {
      return (
        <div key={a.id} className="glass-card p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{ATTACHMENT_ICON[a.kind]}</span>
            <span className="flex-1 truncate text-sm">{a.name}</span>
            <span className="pill text-xs">MusicXML score</span>
          </div>
          <UnifiedViewer fileUrl={url ?? a.ref} fileName={a.name} />
        </div>
      );
    }

    // Sibelius .sib file viewer — renders the score inline
    if (lowerName.endsWith('.sib')) {
      return (
        <div key={a.id} className="glass-card p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{ATTACHMENT_ICON[a.kind]}</span>
            <span className="flex-1 truncate text-sm">{a.name}</span>
            <span className="pill text-xs">Sibelius score</span>
          </div>
          <SibViewer fileUrl={url ?? a.ref} fileName={a.name} />
        </div>
      );
    }

    return (
      <div key={a.id} className="glass-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{ATTACHMENT_ICON[a.kind]}</span>
          <span className="flex-1 truncate text-sm">{a.name}</span>
          {a.kind === 'pdf' && url && (
            <button className="glass-btn text-xs" onClick={() => setOpenPdf(openPdf === a.id ? null : a.id)}>
              {openPdf === a.id ? 'Hide' : '👁 View'}
            </button>
          )}
          {a.kind === 'score' && (
            <span className="pill text-xs">score file</span>
          )}
          {url && (
            <a className="glass-btn text-xs" href={url} download={a.name} target="_blank" rel="noreferrer">
              ⬇ Open
            </a>
          )}
        </div>
        {a.kind === 'audio' && url && <audio controls preload="metadata" src={url} className="w-full mt-2" />}
        {a.kind === 'video' && url && <video controls playsInline preload="metadata" src={url} className="w-full aspect-video bg-black rounded-lg mt-2" />}
        {a.kind === 'pdf' && url && openPdf === a.id && <PdfViewer url={url} name={a.name} />}
      </div>
    );
  };

  // This Area Of Code Is: Hands-free auto-scroll.
  // Explanation: When enabled, the chart scrolls itself at `speed` px/tick,
  // so a musician on stage never touches the iPad mid-song. Driven by
  // requestAnimationFrame (smoother and more reliable than intervals on
  // mobile), and it stops itself at the bottom of the chart.
  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const dt = Math.min(100, now - last);
      last = now;
      el.scrollTop += (speed * dt) / 40;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setScrolling(false); // end of the song — stop gracefully
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  useEffect(() => { setTargetKey(song.key); }, [song.id]);

  return (
    <div className="space-y-4">
      {/* 🎧 The Ear — our own on-device recognition engine */}
      <ListenPanel onOpenSong={onOpenSong} />
      <div className="glass-card p-5">
        <h2 className="font-display text-2xl text-accent">{song.title}</h2>
        <p className="text-muted text-sm">{song.credit} · {song.bpm} BPM · {song.timeSignature}</p>
        {/* Federal-compliance credits — always honor the original artist,
            label, publisher and CCLI number; link to buy the original. */}
        <p className="text-xs text-muted mt-0.5">
          {song.originalArtist && <>Originally performed by <b>{song.originalArtist}</b>. </>}
          {song.label && <>℗ {song.label}. </>}
          {song.publisher && <>© {song.year ? `${song.year} ` : ''}{song.publisher}. </>}
          {song.ccliNumber && <>CCLI #{song.ccliNumber}. </>}
          <a className="text-accent underline ml-1" target="_blank" rel="noreferrer"
             href={`https://music.apple.com/us/search?term=${encodeURIComponent(`${song.title} ${song.originalArtist ?? song.artist}`)}`}>
            ▶ Buy / stream the original
          </a>
        </p>

        {/* Title block — spec #4b: lead singer, artist, key, tempo, key
            changes, copyright, YouTube links, audio files, all together */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mt-2">
          {song.leadSinger && <span>🎤 Lead: <strong>{song.leadSinger}</strong></span>}
          {song.duration && <span>⏱ {song.duration}</span>}
          {song.keyChanges && <span>🎹 Key changes: {song.keyChanges}</span>}
          {song.ccliNumber && <span>CCLI #{song.ccliNumber}</span>}
        </div>
        {song.tags && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {song.tags.map((tag) => (
              <span key={tag} className="service-badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>#{tag}</span>
            ))}
          </div>
        )}
        {song.copyrightInfo && <p className="text-muted text-xs mt-2">{song.copyrightInfo}</p>}
        {song.scriptureKJV && <p className="text-muted text-xs mt-2 italic">📖 {song.scriptureKJV}</p>}

        {/* Audio + video integration (spec #4a) — uploaded video files,
            direct MP4 links, and every YouTube link shape, on every device */}
        {(audioSrc || videoSrc || ytEmbed) && (
          <div className="mt-3 space-y-2">
            {audioSrc && <audio controls preload="metadata" src={audioSrc} className="w-full" />}
            {videoSrc && videoIsFile && (
              <div className="rounded-xl overflow-hidden border border-[var(--glass-border)]">
                <video controls playsInline preload="metadata" src={videoSrc} className="w-full aspect-video bg-black" />
              </div>
            )}
            {ytEmbed && (
              <div className="rounded-xl overflow-hidden border border-[var(--glass-border)]">
                <iframe
                  className="w-full aspect-video"
                  src={ytEmbed}
                  title={`${song.title} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}

        {/* Attachments — every file that belongs to this song, with the
            "Your Part" picker so each musician opens their own chart */}
        {(song.attachments ?? []).length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-accent text-sm font-semibold">📎 Files</h3>
              {(song.attachments ?? []).some((a) => a.part) && (
                <>
                  <label className="text-sm text-muted" htmlFor="partsel">🎼 Your part:</label>
                  <select
                    id="partsel"
                    className="rounded-lg px-3 py-1.5 text-sm bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
                    value={openPdf ?? ''}
                    onChange={(e) => setOpenPdf(e.target.value || null)}
                  >
                    <option value="">— choose —</option>
                    {(song.attachments ?? []).filter((a) => a.part).map((a) => (
                      <option key={a.id} value={a.id}>{a.part}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {(song.attachments ?? []).map(renderAttachment)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <label className="text-sm text-muted" htmlFor="keysel">{t('transpose')}:</label>
          <select
            id="keysel"
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="rounded-lg px-3 py-2 bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
          >
            {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-sm text-muted">
            {t('key')}: <strong className="text-accent">{targetKey}</strong>
            {capo > 0 && instrument.id === 'concert' && <> · {t('capo')} {capo} ({song.key} shapes)</>}
          </span>
          {/* Sax-family transposition — concert C, B♭ horns read D, E♭ horns read A */}
          <label className="text-sm text-muted" htmlFor="instsel">🎷 Instrument:</label>
          <select
            id="instsel"
            value={instrumentId}
            onChange={(e) => setInstrumentId(e.target.value)}
            className="rounded-lg px-3 py-2 bg-[var(--glass-bg-strong)] border border-[var(--glass-border)]"
          >
            {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          {instrument.id !== 'concert' && (
            <span className="text-sm text-muted">
              written key: <strong className="text-accent">{writtenKey}</strong>
              <span className="text-xs"> ({instrument.interval})</span>
            </span>
          )}
          <button className="glass-btn text-sm" onClick={() => setEngraving(true)}>
            🖨 Engrave
          </button>
          <button className={`glass-btn text-sm ${scrolling ? 'danger' : ''}`} onClick={() => setScrolling(!scrolling)}>
            {scrolling ? `⏸ ${t('stop')}` : `▶ ${t('autoScroll')}`}
          </button>
          <label className="text-sm text-muted flex items-center gap-2">
            {t('speed')}
            <input type="range" min={1} max={5} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          </label>
        </div>

        {/* BAND PARTS — the director's auto-transposer: every chair, every
            fresh part, instantly. Tap a chair and the chart (and the
            engraved sheet) becomes that player's written part. If someone's
            absent, their part is ALWAYS ready. */}
        <div className="band-parts">
          <span className="band-parts-label">🎺 Band Parts:</span>
          {INSTRUMENTS.map((inst) => {
            const partKey = transposeChord(targetKey, inst.offset, preferFlats);
            const active = instrument.id === inst.id;
            return (
              <button
                key={inst.id}
                className={`band-part ${active ? 'on' : ''}`}
                onClick={() => setInstrumentId(inst.id)}
                aria-pressed={active}
                title={`${inst.label} — written in ${partKey}`}
              >
                <span className="band-part-name">{inst.label}</span>
                <span className="band-part-key">{partKey}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="song-scroll max-h-[60vh] overflow-y-auto space-y-6 pr-2">
        {song.sections.map((sec, i) => (
          <div key={i} className="glass-card p-5" onClick={() => onSection(sec.kind)}>
            <h3 className="text-accent font-semibold mb-3">{sec.label}</h3>
            {sec.lines.map((line, j) => (
              <div className="chord-line text-lg leading-relaxed" key={j}>
                {line.segments.map((seg, k) => (
                  <span className="chord-word" key={k}>
                    <span className="chord">{transposeChord(seg.chord, displaySemis, preferFlats) || ' '}</span>
                    <span className="lyric">{seg.lyric}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Phase 13: the engraved sheet overlay (print → native PDF) */}
      {engraving && <EngravedSheet song={song} onClose={() => setEngraving(false)} partLabel={instrument.label} partKey={writtenKey} semis={displaySemis} flats={preferFlats} />}
    </div>
  );
}
