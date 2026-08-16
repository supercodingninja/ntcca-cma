// ==========================================================================
// This Area Of Code Is: The media-link normalizer.
// Explanation: People paste YouTube links in every shape — the full
// "watch?v=" address from a computer, the short "youtu.be" link from a
// phone, Shorts, Live links, even an already-embedded URL. I accept every
// one of them, pull out the video's real ID, and build the one correct
// embed address that plays on every device. I also decide whether a video
// reference is an uploaded file (idb://), a direct media file (mp4/webm/
// mov…), or something YouTube should handle.
// In Other Words: Paste ANY video link from ANY device — it just works.
// ==========================================================================

// Extract a YouTube video ID from every known URL shape.
export function youtubeId(url: string): string | null {
  const u = url.trim();
  // youtu.be/<id>
  let m = u.match(/youtu\.be\/([\w-]{6,15})/);
  if (m) return m[1];
  // youtube.com/watch?v=<id> (any position of the param)
  m = u.match(/[?&]v=([\w-]{6,15})/);
  if (m) return m[1];
  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  m = u.match(/(?:embed|shorts|live|v)\/([\w-]{6,15})/);
  if (m) return m[1];
  // A bare 11-character ID pasted by itself
  if (/^[\w-]{11}$/.test(u)) return u;
  return null;
}

// Build the canonical embed URL (privacy-enhanced mode) or null if not YouTube.
export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

// True when the reference points at a real video FILE (uploaded blob or direct link).
export function isVideoFile(ref: string): boolean {
  const r = ref.trim().toLowerCase();
  if (r.startsWith('idb://') || r.startsWith('blob:')) return true;
  return /\.(mp4|m4v|webm|mov|ogv|m3u8)(\?|#|$)/.test(r);
}

// ==========================================================================
// This Area Of Code Is: YouTube auto-population through the front door.
// Explanation: Paste any YouTube link and I ask YouTube's own PUBLIC
// oEmbed service — the official, legal metadata door — for the video's
// title, its channel (the artist), and its thumbnail. The song form fills
// itself. No scraping, no keys, no terms-of-service games.
// ==========================================================================
export interface YoutubeInfo {
  title: string;
  author: string;      // channel name — the artist, usually
  thumbnail: string;
}

export async function fetchYoutubeInfo(url: string): Promise<YoutubeInfo | null> {
  const id = youtubeId(url);
  if (!id) return null;
  try {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    );
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: data.title ?? '',
      author: data.author_name ?? '',
      thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}
