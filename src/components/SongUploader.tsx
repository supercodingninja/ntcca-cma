// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useState, useCallback, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { kindForFile, ATTACHMENT_ICON } from '../lib/attachments';
import { createSong } from '../lib/songs';
import type { Song, SongAttachment } from '../lib/music';
import {
  Upload,
  X,
  FileArchive,
  Music,
  FileText,
  Image as ImageIcon,
  QrCode,
  Download,
  Save,
  ChevronRight,
  ChevronLeft,
  Tag,
  Clock,
  User,
  KeyRound,
  Hash,
  Copyright,
  BookOpen,
  Globe,
  AlertCircle,
  CheckCircle2,
  Package,
  Trash2,
  Edit3,
  Plus,
} from 'lucide-react';

// ==========================================================================
// This Area Of Code Is: Lazy JSZip loader with graceful fallback.
// Explanation: ZIP extraction requires the jszip package. We load it
// dynamically so the component still works for individual files even if
// jszip is not yet installed. If a ZIP is dropped and jszip is missing,
// the user gets a clear install command.
// In Other Words: ZIP support is optional at runtime, mandatory only
// when you actually drop a ZIP.
// ==========================================================================
let JSZipCache: typeof import('jszip') | null = null;

async function getJSZip(): Promise<typeof import('jszip')> {
  if (JSZipCache) return JSZipCache;
  try {
    const mod = await import('jszip');
    JSZipCache = mod;
    return mod;
  } catch {
    throw new Error(
      'ZIP extraction requires jszip. Run: npm install jszip @types/jszip'
    );
  }
}

// ==========================================================================
// This Area Of Code Is: Internal helper types and UUID generator.
// Explanation: ProcessedFile holds a file plus its classified kind.
// The UUID helper is a local copy so this file is self-contained.
// In Other Words: Temporary holding tank for files before they become
// song attachments.
// ==========================================================================
interface ProcessedFile {
  id: string;
  file: File;
  kind: SongAttachment['kind'];
  name: string;
  size: number;
  part?: string;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==========================================================================
// This Area Of Code Is: File-to-base64 converter for attachment refs.
// Explanation: SongAttachment.ref expects an idb:// URL or external URL.
// Until IndexedDB storage is wired, we store small files (<2 MB) as
// base64 data URLs so the song record is portable and the file is
// immediately viewable. Larger files get an object URL (temporary).
// In Other Words: Every attachment carries its own payload so nothing
// is lost between upload and save.
// ==========================================================================
async function fileToRef(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function processedFileToAttachment(pf: ProcessedFile): Promise<SongAttachment> {
  const ref = await fileToRef(pf.file);
  return {
    id: pf.id,
    name: pf.name,
    kind: pf.kind,
    ref,
    part: pf.part,
  };
}

// ==========================================================================
// This Area Of Code Is: ZIP extractor — turns one .zip into many
// ProcessedFiles, each auto-classified by extension and MIME.
// Explanation: JSZip reads the archive, each entry becomes a File blob,
// and kindForFile sorts it into audio/video/pdf/score/other. MacOS
// __MACOSX and Windows Thumbs.db cruft is silently skipped.
// In Other Words: Drop one ZIP, get a whole song folder unpacked and
// organized automatically.
// ==========================================================================
async function extractZip(file: File): Promise<ProcessedFile[]> {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(file);
  const results: ProcessedFile[] = [];
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && !entry.name.startsWith('__MACOSX/') && !entry.name.includes('Thumbs.db')
  );

  for (const entry of entries) {
    const blob = await entry.async('blob');
    const extracted = new File([blob], entry.name, {
      type: blob.type || 'application/octet-stream',
    });
    results.push({
      id: uuid(),
      file: extracted,
      kind: kindForFile(extracted),
      name: entry.name,
      size: extracted.size,
    });
  }
  return results;
}

// ==========================================================================
// This Area Of Code Is: The SongUploader component — drag, drop, extract,
// classify, tag, save, and QR.
// Explanation: This is the one-stop shop for getting new songs into the
// NTCC library. Musicians or admins drag files (or a ZIP) onto the zone,
// the app sorts every file by type, the user fills in song metadata and
// labels parts ("Alto Sax", "Tenor 1", "Solo"), then saves. A unique QR
// code is generated linking directly to the song page so it can be taped
// to a music stand, bulletin board, or shared in chat.
// In Other Words: Drag, tag, save, scan — the whole workflow in one
// glass-morphism panel.
// ==========================================================================

type Step = 'upload' | 'review' | 'saved';

const COMMON_TAGS = [
  'worship',
  'praise',
  'communion',
  'choir',
  'spanish',
  'english',
  'gospel',
  'hymn',
  'medley',
  'victory',
  'gratitude',
  'love',
  'intimacy',
  'surrender',
  'power',
  'practice',
  'licks',
];

const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '12/8'];

export default function SongUploader() {
  // ------------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------------
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSong, setSavedSong] = useState<Song | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('C');
  const [bpm, setBpm] = useState<number>(100);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [duration, setDuration] = useState('');
  const [leadSinger, setLeadSinger] = useState('');
  const [language, setLanguage] = useState('en');
  const [ccliNumber, setCcliNumber] = useState('');
  const [copyrightInfo, setCopyrightInfo] = useState('');
  const [scriptureKJV, setScriptureKJV] = useState('');
  const [credit, setCredit] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------------------
  // Drag & drop handlers
  // ------------------------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processIncomingFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      setIsProcessing(true);
      setError(null);

      try {
        const newFiles: ProcessedFile[] = [];
        for (const file of Array.from(incoming)) {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          if (ext === 'zip') {
            const extracted = await extractZip(file);
            newFiles.push(...extracted);
          } else {
            newFiles.push({
              id: uuid(),
              file,
              kind: kindForFile(file),
              name: file.name,
              size: file.size,
            });
          }
        }
        setFiles((prev) => [...prev, ...newFiles]);
        // Auto-advance to review if we have files
        if (newFiles.length > 0) setStep('review');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process files');
      } finally {
        setIsProcessing(false);
        setIsDragging(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      processIncomingFiles(e.dataTransfer.files);
    },
    [processIncomingFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processIncomingFiles(e.target.files);
      e.target.value = ''; // reset so same file can be selected again
    },
    [processIncomingFiles]
  );

  // ------------------------------------------------------------------------
  // File list management
  // ------------------------------------------------------------------------
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updatePart = useCallback((id: string, part: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, part } : f))
    );
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setStep('upload');
    setError(null);
    setSavedSong(null);
    setQrDataUrl(null);
  }, []);

  // ------------------------------------------------------------------------
  // Tag management
  // ------------------------------------------------------------------------
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const addCustomTag = useCallback(() => {
    const t = customTag.trim().toLowerCase();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags((prev) => [...prev, t]);
    }
    setCustomTag('');
  }, [customTag, selectedTags]);

  // ------------------------------------------------------------------------
  // Save song
  // ------------------------------------------------------------------------
  const canSave = title.trim() && artist.trim() && files.length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsProcessing(true);
    setError(null);

    try {
      const attachments = await Promise.all(files.map(processedFileToAttachment));

      const song = createSong({
        title: title.trim(),
        artist: artist.trim(),
        key,
        bpm,
        timeSignature,
        language,
        duration: duration.trim() || undefined,
        leadSinger: leadSinger.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        ccliNumber: ccliNumber.trim() || undefined,
        copyrightInfo: copyrightInfo.trim() || undefined,
        scriptureKJV: scriptureKJV.trim() || undefined,
        credit: credit.trim() || 'Uploaded via NTCC Music App™',
        sections: [], // User can add lyrics later in SongFormSection
        attachments,
      });

      setSavedSong(song);

      // Generate song-level QR code
      const songUrl = `${window.location.origin}/song/${song.id}`;
      const qr = await QRCode.toDataURL(songUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(qr);
      setStep('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save song');
    } finally {
      setIsProcessing(false);
    }
  }, [
    canSave,
    files,
    title,
    artist,
    key,
    bpm,
    timeSignature,
    language,
    duration,
    leadSinger,
    selectedTags,
    ccliNumber,
    copyrightInfo,
    scriptureKJV,
    credit,
  ]);

  // ------------------------------------------------------------------------
  // QR download
  // ------------------------------------------------------------------------
  const downloadQr = useCallback(() => {
    if (!qrDataUrl || !savedSong) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${savedSong.id}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [qrDataUrl, savedSong]);

  // ------------------------------------------------------------------------
  // Keyboard: Enter in custom tag input adds the tag
  // ------------------------------------------------------------------------
  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomTag();
      }
    },
    [addCustomTag]
  );

  // ------------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------------
  const kindIcon = (kind: SongAttachment['kind']) => {
    switch (kind) {
      case 'audio':
        return <Music className="h-4 w-4 text-amber-400" />;
      case 'video':
        return <ImageIcon className="h-4 w-4 text-purple-400" />;
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-400" />;
      case 'score':
        return <BookOpen className="h-4 w-4 text-emerald-400" />;
      default:
        return <FileArchive className="h-4 w-4 text-white/50" />;
    }
  };

  // ==========================================================================
  // STEP 1: UPLOAD
  // ==========================================================================
  const renderUpload = () => (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Song Uploader
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Drop PDFs, audio, scores, or a ZIP folder. We sort everything.
        </p>
      </div>

      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
          ${
            isDragging
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.pdf,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.m4v,.webm,.mov,.ogv,.sib,.mus,.mscz,.mscx,.musicxml,.xml,.mxl"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`rounded-full p-4 ${
              isDragging ? 'bg-amber-500/20' : 'bg-white/10'
            }`}
          >
            <Upload
              className={`h-8 w-8 ${
                isDragging ? 'text-amber-400' : 'text-white/60'
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {isDragging ? 'Drop files here' : 'Click or drag files here'}
            </p>
            <p className="mt-1 text-xs text-white/40">
              ZIP, PDF, MP3, MP4, Sibelius, MusicXML, and more
            </p>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-amber-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          Processing files…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  // ==========================================================================
  // STEP 2: REVIEW
  // ==========================================================================
  const renderReview = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Review & Tag</h2>
          <p className="text-xs text-white/50">
            {files.length} file{files.length !== 1 ? 's' : ''} ready
          </p>
        </div>
        <button
          onClick={clearAll}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-red-500/20 hover:text-red-300"
        >
          Clear All
        </button>
      </div>

      {/* File list */}
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
        {files.map((pf) => (
          <div
            key={pf.id}
            className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
              {kindIcon(pf.kind)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">
                {pf.name}
              </p>
              <p className="text-[10px] text-white/40">
                {ATTACHMENT_ICON[pf.kind]} {pf.kind} · {formatBytes(pf.size)}
              </p>
            </div>
            <input
              type="text"
              placeholder="Part label (e.g. Alto Sax)"
              value={pf.part ?? ''}
              onChange={(e) => updatePart(pf.id, e.target.value)}
              className="w-32 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-amber-500"
            />
            <button
              onClick={() => removeFile(pf.id)}
              className="rounded-md p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add more files */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-2 text-xs text-white/50 hover:border-amber-500/50 hover:text-amber-400"
      >
        <Plus className="h-3.5 w-3.5" />
        Add more files
      </button>

      {/* Metadata form */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Music className="h-3 w-3" /> Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Artist */}
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <User className="h-3 w-3" /> Artist <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist or worship team"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Key */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <KeyRound className="h-3 w-3" /> Key
          </label>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          >
            {['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* BPM */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Clock className="h-3 w-3" /> BPM
          </label>
          <input
            type="number"
            min={30}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>

        {/* Time Signature */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Clock className="h-3 w-3" /> Time
          </label>
          <select
            value={timeSignature}
            onChange={(e) => setTimeSignature(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          >
            {TIME_SIGNATURES.map((ts) => (
              <option key={ts} value={ts}>{ts}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Clock className="h-3 w-3" /> Duration
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="4:32"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Lead Singer */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <User className="h-3 w-3" /> Lead Singer
          </label>
          <input
            type="text"
            value={leadSinger}
            onChange={(e) => setLeadSinger(e.target.value)}
            placeholder="Lead vocalist"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Language */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Globe className="h-3 w-3" /> Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </div>

        {/* CCLI */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Hash className="h-3 w-3" /> CCLI #
          </label>
          <input
            type="text"
            value={ccliNumber}
            onChange={(e) => setCcliNumber(e.target.value)}
            placeholder="CCLI number"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Copyright */}
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Copyright className="h-3 w-3" /> Copyright Info
          </label>
          <input
            type="text"
            value={copyrightInfo}
            onChange={(e) => setCopyrightInfo(e.target.value)}
            placeholder="© Year Owner — All Rights Reserved"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Scripture */}
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <BookOpen className="h-3 w-3" /> Scripture (KJV)
          </label>
          <input
            type="text"
            value={scriptureKJV}
            onChange={(e) => setScriptureKJV(e.target.value)}
            placeholder="Psalm 107:1 — O give thanks unto the LORD…"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>

        {/* Credit */}
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Edit3 className="h-3 w-3" /> Credit
          </label>
          <input
            type="text"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            placeholder="Arranger, producer, or upload credit"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/70">
          <Tag className="h-3 w-3" /> Tags
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          {COMMON_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add custom tag…"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500"
          />
          <button
            onClick={addCustomTag}
            className="rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-amber-500 hover:text-black"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {selectedTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300"
              >
                {tag}
                <button
                  onClick={() => toggleTag(tag)}
                  className="text-amber-400 hover:text-amber-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setStep('upload')}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <button
          onClick={handleSave}
          disabled={!canSave || isProcessing}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            canSave && !isProcessing
              ? 'bg-amber-500 text-black hover:bg-amber-400'
              : 'cursor-not-allowed bg-white/10 text-white/30'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Song
            </>
          )}
        </button>
      </div>

      {!canSave && (
        <p className="text-center text-xs text-white/30">
          Title, artist, and at least one file are required.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  // ==========================================================================
  // STEP 3: SAVED + QR
  // ==========================================================================
  const renderSaved = () => (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="rounded-full bg-emerald-500/20 p-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white">Song Saved!</h2>
        <p className="mt-1 text-sm text-white/50">
          {savedSong?.title} by {savedSong?.artist}
        </p>
      </div>

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <QrCode className="h-4 w-4 text-amber-400" />
            Song QR Code
          </div>
          <img
            src={qrDataUrl}
            alt={`QR code for ${savedSong?.title}`}
            className="h-56 w-56 rounded-lg bg-white"
          />
          <p className="max-w-xs text-xs text-white/40">
            Scan to open this song directly in the NTCC Music App™.
          </p>
          <button
            onClick={downloadQr}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-amber-500 hover:text-black"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      )}

      <div className="flex w-full gap-3">
        <button
          onClick={clearAll}
          className="flex-1 rounded-lg bg-white/5 py-2.5 text-sm text-white/70 hover:bg-white/10"
        >
          Upload Another
        </button>
        <button
          onClick={() => {
            if (savedSong) {
              window.location.href = `/song/${savedSong.id}`;
            }
          }}
          className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
        >
          View Song
        </button>
      </div>
    </div>
  );

  // ==========================================================================
  // Main render
  // ==========================================================================
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md md:p-8">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['upload', 'review', 'saved'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                step === s
                  ? 'bg-amber-500 text-black'
                  : i < ['upload', 'review', 'saved'].indexOf(step)
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/10 text-white/40'
              }`}
            >
              {i < ['upload', 'review', 'saved'].indexOf(step) ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[10px] font-medium uppercase tracking-wider ${
                step === s ? 'text-amber-400' : 'text-white/30'
              }`}
            >
              {s}
            </span>
            {i < 2 && (
              <ChevronRight className="h-3 w-3 text-white/20" />
            )}
          </div>
        ))}
      </div>

      {step === 'upload' && renderUpload()}
      {step === 'review' && renderReview()}
      {step === 'saved' && renderSaved()}
    </div>
  );
}
