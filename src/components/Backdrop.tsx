// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The cinematic background — church photos and videos
// playing behind the app like a slow movie, with Ken Burns drift and fade
// transitions. Every role sees a different starting point in the reel, and
// no photo repeats until all have shown.
// Explanation: The backdrop pulls from two sources: (1) the shared photo
// pool in `src/lib/photos.ts` — 43 church memories that shuffle without
// repetition, and (2) per-church uploads from `src/lib/churchbg.ts` — each
// church hangs its own family photos on its own walls. The John Orkin Smith
// memorial photo (58F53E82...) is NEVER shown on the landing page — text
// would confuse the login words. Videos auto-play muted and loop.
// In Other Words: The stained glass and sanctuary photos behind the app —
// slowly changing, never repeating, always appropriate to whose church
// you're visiting.
// ==========================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { nextPhoto, currentPhoto } from '../lib/photos';
import { resolveChurchBg, type ResolvedBg } from '../lib/churchbg';
import { type Role } from '../lib/auth';

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------
interface BackdropProps {
  role: Role;
  landing?: boolean;
  churchCode?: string;
}

// Fade duration in ms — must match CSS transition
const FADE_MS = 1600;
// Time between photo changes
const INTERVAL_MS = 8000;
// The memorial photo that never appears on the landing page
const MEMORIAL = '58F53E82-7541-4A48-90EE-6FB05E20B4A7';

// --------------------------------------------------------------------------
// Backdrop component
// --------------------------------------------------------------------------
export default function Backdrop({ role, landing = false, churchCode }: BackdropProps) {
  const [photo, setPhoto] = useState('');
  const [nextPhotoUrl, setNextPhotoUrl] = useState('');
  const [churchMedia, setChurchMedia] = useState<ResolvedBg[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const churchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ------------------------------------------------------------------------
  // Load per-church background media
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (!churchCode || churchCode === 'ntcca') return;
    let mounted = true;
    resolveChurchBg(churchCode).then((items) => {
      if (mounted) setChurchMedia(items);
    });
    return () => { mounted = false; };
  }, [churchCode]);

  // ------------------------------------------------------------------------
  // Photo reel — shared pool, one photo at a time with crossfade
  // ------------------------------------------------------------------------
  const advancePhoto = useCallback(() => {
    setFading(true);
    // Preload the next photo
    const upcoming = nextPhoto(role);
    setNextPhotoUrl(upcoming);

    // After fade completes, swap and clear the "next" buffer
    setTimeout(() => {
      setPhoto(upcoming);
      setNextPhotoUrl('');
      setFading(false);
    }, FADE_MS);
  }, [role]);

  // Initialize the first photo
  useEffect(() => {
    const initial = currentPhoto(role);
    setPhoto(initial);
  }, [role]);

  // Auto-advance the photo reel
  useEffect(() => {
    timerRef.current = setInterval(advancePhoto, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [advancePhoto]);

  // ------------------------------------------------------------------------
  // Church media rotation — interleave with shared reel (every 3rd photo)
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (churchMedia.length === 0) return;
    churchTimerRef.current = setInterval(() => {
      setMediaIndex((i) => (i + 1) % churchMedia.length);
    }, INTERVAL_MS * 3);
    return () => {
      if (churchTimerRef.current) clearInterval(churchTimerRef.current);
    };
  }, [churchMedia.length]);

  // ------------------------------------------------------------------------
  // Determine what to show: shared photo or church media
  // ------------------------------------------------------------------------
  const showChurchMedia = churchMedia.length > 0 && mediaIndex < churchMedia.length;
  const currentMedia = showChurchMedia ? churchMedia[mediaIndex] : null;

  // On landing, NEVER show the memorial photo (text confuses login)
  const isMemorial = photo.includes(MEMORIAL);
  const displayPhoto = landing && isMemorial ? '' : photo;

  // ------------------------------------------------------------------------
  // Preload the upcoming image for smooth crossfade
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (nextPhotoUrl) {
      const img = new Image();
      img.src = nextPhotoUrl;
    }
  }, [nextPhotoUrl]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------
  return (
    <div className="backdrop-layer" aria-hidden="true">
      {/* Current photo — Ken Burns subtle zoom */}
      {displayPhoto && !currentMedia && (
        <img
          src={displayPhoto}
          alt=""
          style={{
            opacity: fading ? 0 : 1,
            transform: 'scale(1.05)',
            animation: 'kenBurns 20s ease-in-out infinite alternate',
          }}
        />
      )}

      {/* Next photo (preloaded, fading in) */}
      {nextPhotoUrl && !currentMedia && (
        <img
          src={nextPhotoUrl}
          alt=""
          style={{
            opacity: fading ? 1 : 0,
            transform: 'scale(1.05)',
          }}
        />
      )}

      {/* Church media — image */}
      {currentMedia?.kind === 'image' && (
        <img
          src={currentMedia.url}
          alt=""
          style={{
            opacity: 1,
            transform: 'scale(1.05)',
            animation: 'kenBurns 20s ease-in-out infinite alternate',
          }}
        />
      )}

      {/* Church media — video */}
      {currentMedia?.kind === 'video' && (
        <video
          src={currentMedia.url}
          autoPlay
          muted
          loop
          playsInline
          style={{ opacity: 1 }}
        />
      )}

      {/* Dark vignette — keeps text readable over any background */}
      <div className="backdrop-vignette" />

      {/* Ken Burns animation keyframes (injected inline for portability) */}
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.15) translate(-1%, -1%); }
        }
      `}</style>
    </div>
  );
}
