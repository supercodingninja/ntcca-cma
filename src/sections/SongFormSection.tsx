// ==========================================================================
// This Area Of Code Is: The Song Form — add & edit songs (Admin/Editor).
// Explanation: Every field from the 17-point spec in one place: title,
// artist, duration, lead singer, key, tempo, time signature, key changes,
// theme tags, CCLI #, copyright, YouTube + audio links, and the full chord
// chart in ChordPro ("[A]Amazing [E]grace" with {Chorus} section headers).
// Saves into the on-device song store; seed songs can be edited safely
// (edits overlay, originals are never destroyed).
// In Other Words: The "write a new page in the hymnal" desk.
// ==========================================================================

import { useState } from 'react';
import { type Song, type SongAttachment } from '../lib/music';
import { chartToSections, sectionsToChart } from '../lib/songs';
import { sanitizeText } from '../lib/shieldwall';
import { storeFile } from '../lib/fileStore';
import { kindForFile, ATTACHMENT_ICON } from '../lib/attachments';
import { learnFromScoreFile } from '../lib/parts';
import { analyzeAudio } from '../lib/keyDetect';
import { fetchYoutubeInfo, youtubeId } from '../lib/media';

const KEYS = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];

interface Props {
  song: Song | null;          // null = new song
  onSave: (song: Song) => void;
  onCancel: () => void;
}

export default function SongFormSection({ song, onSave, onCancel }: Props) {
  const [f, setF] = useState({
    title: song?.title ?? '',
    artist: song?.artist ?? '',
    duration: song?.duration ?? '',
    leadSinger: song?.leadSinger ?? '',
    key: song?.key ?? 'C',
    bpm: song?.bpm ?? 90,
    timeSignature: song?.timeSignature ?? '4/4',
    keyChanges: song?.keyChanges ?? '',
    tags: (song?.tags ?? []).join(', '),
    ccliNumber: song?.ccliNumber ?? '',
    copyrightInfo: song?.copyrightInfo ?? '',
    youtubeUrl: song?.youtubeUrl ?? '',
    videoUrl: song?.videoUrl ?? '',
    audioUrl: song?.audioUrl ?? '',
    language: song?.language ?? 'en',
    scriptureKJV: song?.scriptureKJV ?? '',
    chart: song ? sectionsToChart(song) : '',
  });

  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  // Live status for every auto-population path (audio, scores, YouTube).
  const [detectMsg, setDetectMsg] = useState('');

  // Attachments — ANY file type, kept on the song readable or not.
  // Score files auto-populate: title, part, and composer are learned from
  // the filename and the PDF's own printed text layer.
  const [attachments, setAttachments] = useState<SongAttachment[]>(song?.attachments ?? []);
  const [dragOver, setDragOver] = useState(false);
  const attachFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: SongAttachment[] = [];
    for (const file of Array.from(files)) {
      const kind = kindForFile(file);
      const ref = await storeFile(file);
      let part: string | undefined;
      if (kind === 'pdf' || kind === 'score') {
        setDetectMsg(`🔍 Reading ${file.name}…`);
        const learned = await learnFromScoreFile(file);
        part = learned.part || undefined;
        if (!f.title && learned.title) set('title', learned.title);
        if (!f.artist && learned.composer) set('artist', learned.composer);
        setDetectMsg(`✓ ${file.name} → ${learned.title}${part ? ` · part: ${part}` : ''}`);
      }
      added.push({ id: crypto.randomUUID(), name: file.name, kind, ref, part });
    }
    setAttachments((p) => [...p, ...added]);
  };

  // Audio upload — the app LISTENS: detects the key and tempo of the
  // recording and fills them in. Sing it, and the form fills itself.
  const audioUpload = async (file: File) => {
    const ref = await storeFile(file);
    set('audioUrl', ref);
    setDetectMsg(`👂 Listening to ${file.name}… detecting key and tempo`);
    const guess = await analyzeAudio(file);
    if (!guess) {
      const ext = (file.name.split('.').pop() || file.type || 'this format').toUpperCase();
      setDetectMsg(`⚠️ Could not decode ${ext} for analysis — the file IS saved and plays fine; please set key/tempo manually (MP3, WAV or M4A analyze best)`);
      return;
    }
    const m = guess.key.match(/^([A-G]#?)(m?)$/);
    if (m && !m[2]) set('key', m[1]);
    if (m && m[2]) {
      // Minor detected — set the relative major and note the minor.
      const REL_MAJOR: Record<string, string> = {
        'C#m': 'E', 'F#m': 'A', 'G#m': 'B', 'D#m': 'F#', 'A#m': 'C#',
        'Cm': 'Eb', 'Dm': 'F', 'Em': 'G', 'Fm': 'Ab', 'Gm': 'Bb', 'Am': 'C', 'Bm': 'D',
      };
      const rel = REL_MAJOR[guess.key];
      if (rel) set('key', rel);
      set('keyChanges', `sung in ${guess.key} minor`);
    }
    if (guess.bpm) set('bpm', guess.bpm);
    setDetectMsg(`✓ Detected: key of ${guess.key}${guess.bpm ? ` · ~${guess.bpm} BPM` : ''} — filled in for you`);
  };

  // YouTube link — paste it and the song fills itself: title, artist
  // (channel), straight from YouTube's official oEmbed metadata.
  const youtubePopulate = async (url: string) => {
    if (!youtubeId(url)) return;
    setDetectMsg('📺 Asking YouTube about this video…');
    const info = await fetchYoutubeInfo(url);
    if (!info) { setDetectMsg('📺 Link accepted (metadata unavailable right now)'); return; }
    if (!f.title && info.title) set('title', info.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').trim());
    if (!f.artist && info.author) set('artist', info.author.replace(/\s*-?\s*Topic$/i, ''));
    setDetectMsg(`✓ From YouTube: "${info.title}" · ${info.author} — filled in for you`);
  };

  // ANY song URL — paste it and the form populates itself. YouTube carries
  // full metadata; Spotify / Apple Music / other links encode "artist –
  // title" in the URL slug, which we decode (and de-hyphenate) as a solid
  // first draft. Every field stays editable — the form is the fallback
  // when the URL can't tell us something.
  const titleFromSlug = (s: string) =>
    decodeURIComponent(s)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const urlPopulate = async (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    if (youtubeId(url)) { void youtubePopulate(url); return; }
    let u: URL;
    try { u = new URL(url.startsWith('http') ? url : `https://${url}`); } catch { return; }
    // Spotify: /track/<id> … page slugs rarely help, but the share title
    // often rides in the query (?si=…&…context=artist-title) — try the
    // path's last readable segment first.
    const segs = u.pathname.split('/').filter(Boolean);
    const readable = segs.filter((s) => /[a-zA-Z]{3,}/.test(s) && !/^(track|album|watch|song|music|video|v|embed|us|en|es)$/.test(s));
    const slug = readable[readable.length - 1];
    if (!slug) { setDetectMsg('🔗 Link accepted — fill in anything the link didn\'t carry.'); return; }
    // "artist-title" or "artist---title" (Spotify style) or just "title"
    const parts = slug.split(/-{2,}/).map(titleFromSlug).filter(Boolean);
    if (parts.length >= 2) {
      if (!f.artist) set('artist', parts[0]);
      if (!f.title) set('title', parts.slice(1).join(' '));
    } else {
      const t = titleFromSlug(slug.replace(/^\d+-/, ''));
      if (!f.title) set('title', t);
    }
    setDetectMsg('✓ Read the link and filled in what it carried — anything missing, the fields below are yours.');
  };
  const input = 'auth-input w-full';
  const label = 'text-xs text-muted block mb-1 mt-3';

  const save = () => {
    if (!f.title.trim()) { alert('Title is required.'); return; }
    const out: Song = {
      id: song?.id ?? crypto.randomUUID(),
      title: sanitizeText(f.title, 120),
      artist: sanitizeText(f.artist, 120) || 'Unknown',
      key: f.key, bpm: Number(f.bpm) || 90,
      timeSignature: f.timeSignature, language: f.language,
      credit: song?.credit ?? sanitizeText(f.artist, 120),
      duration: f.duration || undefined,
      leadSinger: f.leadSinger || undefined,
      keyChanges: f.keyChanges || undefined,
      tags: f.tags.split(',').map((t) => sanitizeText(t, 30)).filter(Boolean),
      ccliNumber: f.ccliNumber || undefined,
      copyrightInfo: f.copyrightInfo || undefined,
      youtubeUrl: f.youtubeUrl || undefined,
      videoUrl: f.videoUrl || undefined,
      audioUrl: f.audioUrl || undefined,
      attachments,
      scriptureKJV: f.scriptureKJV || undefined,
      sections: chartToSections(f.chart),
    };
    onSave(out);
  };

  return (
    <div className="glass-card p-5">
      <h2 className="text-accent font-semibold text-lg mb-2">
        {song ? `✏️ Edit: ${song.title}` : '➕ Add New Song'}
      </h2>

      <div className="grid sm:grid-cols-2 gap-x-4">
        <div><label className={label}>Title *</label>
          <input className={input} value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div><label className={label}>Artist</label>
          <input className={input} value={f.artist} onChange={(e) => set('artist', e.target.value)} /></div>
        <div><label className={label}>Duration (e.g. 4:32)</label>
          <input className={input} value={f.duration} onChange={(e) => set('duration', e.target.value)} /></div>
        <div><label className={label}>Lead Singer</label>
          <input className={input} value={f.leadSinger} onChange={(e) => set('leadSinger', e.target.value)} /></div>
        <div><label className={label}>Key</label>
          <select className={input} value={f.key} onChange={(e) => set('key', e.target.value)}>
            {KEYS.map((k) => <option key={k}>{k}</option>)}
          </select></div>
        <div><label className={label}>Tempo (BPM)</label>
          <input className={input} type="number" min={30} max={240} value={f.bpm}
                 onChange={(e) => set('bpm', +e.target.value)} /></div>
        <div><label className={label}>Time Signature</label>
          <select className={input} value={f.timeSignature} onChange={(e) => set('timeSignature', e.target.value)}>
            {['4/4', '3/4', '6/8', '2/4', '12/8'].map((ts) => <option key={ts}>{ts}</option>)}
          </select></div>
        <div><label className={label}>Key Changes (e.g. "A → B at bridge")</label>
          <input className={input} value={f.keyChanges} onChange={(e) => set('keyChanges', e.target.value)} /></div>
        <div><label className={label}>Theme Tags (comma separated)</label>
          <input className={input} placeholder="worship, praise, communion"
                 value={f.tags} onChange={(e) => set('tags', e.target.value)} /></div>
        <div><label className={label}>CCLI #</label>
          <input className={input} value={f.ccliNumber} onChange={(e) => set('ccliNumber', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label}>Copyright Info</label>
          <input className={input} value={f.copyrightInfo} onChange={(e) => set('copyrightInfo', e.target.value)} /></div>
        <div className="sm:col-span-2 rounded-xl border border-[var(--accent)]/50 p-3">
          <label className={label}>🔗 Paste ANY song link — YouTube, Spotify, Apple Music… everything the link carries fills in automatically</label>
          <input className={input} inputMode="url" autoCapitalize="off"
                 placeholder="Paste the song's link here — artist, title & credits populate themselves"
                 onChange={(e) => {
                   const v = e.target.value;
                   if (/^https?:\/\//.test(v.trim()) || youtubeId(v)) {
                     if (youtubeId(v)) { set('youtubeUrl', v.trim()); }
                     void urlPopulate(v);
                   }
                 }}
                 onPaste={(e) => {
                   const v = e.clipboardData.getData('text');
                   if (youtubeId(v)) set('youtubeUrl', v.trim());
                   void urlPopulate(v);
                 }} />
          <p className="text-xs text-muted mt-1">Whatever the link can't tell us, the fields below remain — you always have the final word.</p>
        </div>
        <div><label className={label}>YouTube URL — paste &amp; everything fills in</label>
          <input className={input} inputMode="url" autoCapitalize="off"
                 placeholder="youtube.com/watch?v=… or youtu.be/…"
                 value={f.youtubeUrl}
                 onChange={(e) => { set('youtubeUrl', e.target.value); if (youtubeId(e.target.value)) void youtubePopulate(e.target.value); }}
                 onBlur={(e) => void youtubePopulate(e.target.value)} /></div>
        <div><label className={label}>Video — paste a direct MP4 link or upload a file</label>
          <input className={input} inputMode="url" autoCapitalize="off"
                 placeholder="https://…/video.mp4"
                 value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} />
          <input type="file" accept="video/*" className="text-xs text-muted mt-2"
                 onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) void storeFile(file).then((ref) => set('videoUrl', ref));
                 }} /></div>
        <div className="sm:col-span-2"><label className={label}>Attachments — ANY file (PDF scores, .sib/.mscz sessions, docs, recordings) · title &amp; part auto-fill</label>
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag and drop files here, or browse"
            className={`mt-1 rounded-xl border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-accent bg-white/10' : 'border-white/25 hover:border-white/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void attachFiles(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById('attach-input')?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('attach-input')?.click(); }}
          >
            <p className="text-sm font-semibold">{dragOver ? '📥 Drop them — I\'ve got them' : '📂 Drag & drop files here'}</p>
            <p className="text-xs text-muted mt-0.5">or tap to browse — PDFs, .sib, .mscz, docs, recordings, anything</p>
          </div>
          <input id="attach-input" type="file" multiple accept="*/*" className="hidden"
                 onChange={(e) => void attachFiles(e.target.files)} />
          {detectMsg && <p className="text-sm text-accent mt-1">{detectMsg}</p>}
          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span>{ATTACHMENT_ICON[a.kind]}</span>
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.part && <span className="pill pill-green text-xs">{a.part}</span>}
                  <button type="button" className="glass-btn text-xs danger"
                          onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div><label className={label}>Audio File URL — or upload below</label>
          <input className={input} inputMode="url" autoCapitalize="off"
                 value={f.audioUrl} onChange={(e) => set('audioUrl', e.target.value)} />
          <input type="file" accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.flac,.caf" className="text-xs text-muted mt-2"
                 onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) void audioUpload(file);
                 }} />
          <p className="text-xs text-muted mt-1">Upload a recording — the app detects the key &amp; tempo automatically.</p></div>
        <div><label className={label}>Language</label>
          <select className={input} value={f.language} onChange={(e) => set('language', e.target.value)}>
            <option value="en">English</option><option value="es">Español</option>
          </select></div>
        <div><label className={label}>Scripture (KJV)</label>
          <input className={input} value={f.scriptureKJV} onChange={(e) => set('scriptureKJV', e.target.value)} /></div>
      </div>

      <label className={label}>Chord Chart — ChordPro: [C]word, sections as {'{Chorus}'}</label>
      <textarea
        className={`${input} font-mono text-sm min-h-40`}
        value={f.chart}
        onChange={(e) => set('chart', e.target.value)}
        placeholder={'{Verse 1}\n[C]Your song\'s [G]lyrics go here…\n{Chorus}\n[F]Every [C]nation…'}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />

      <div className="flex gap-2 mt-4">
        <button className="cta-gold px-8 py-2.5" onClick={save}>💾 Save Song</button>
        <button className="glass-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
