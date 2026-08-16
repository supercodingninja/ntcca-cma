// ==========================================================================
// This Area Of Code Is: Attachment classification and viewing.
// Explanation: Every file that lands on a song gets sorted by what it
// actually is — audio plays, video plays, PDFs open in the built-in
// viewer, score files (.sib/.mscz/.musicxml) are marked for the reader,
// and everything else is offered as a safe download. Classification looks
// at the extension AND the MIME type, because phones are creative with
// both.
// In Other Words: Whatever you hand me, I know how to hold it.
// ==========================================================================

import type { SongAttachment } from './music';

export function kindForFile(file: { name: string; type?: string }): SongAttachment['kind'] {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = (file.type ?? '').toLowerCase();
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'm4v', 'webm', 'mov', 'ogv'].includes(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['sib', 'mus', 'mscz', 'mscx', 'musicxml', 'xml', 'mxl'].includes(ext)) return 'score';
  return 'other';
}

export const ATTACHMENT_ICON: Record<SongAttachment['kind'], string> = {
  audio: '🎵', video: '🎬', pdf: '📄', score: '🎼', other: '📎',
};
