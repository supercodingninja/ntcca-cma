// ==========================================================================
// This Area Of Code Is: The cinematic photo backdrop (Adoración DNA).
// Explanation: Full-bleed church photography behind everything, slow
// Ken-Burns drift, crossfading to the next random non-repeating photo every
// 14 seconds, dark-vignetted so text stays readable. Each role sees its own
// slice of the photo pool.
// In Other Words: The church's memories play softly behind the app.
// ==========================================================================

import { useEffect, useRef, useState } from 'react';
import { nextPhoto, currentPhoto } from '../lib/photos';
import { resolveChurchBg, type ResolvedBg } from '../lib/churchbg';
import { loadChurchProfile } from '../lib/church';
import type { Role } from '../lib/auth';

const FADE_MS = 1600;
const TICK_MS = 14000;
// John Orkin Smith's In Memoriam photo plays everywhere in the app EXCEPT
// the landing — its text confuses the login words there. Honor, placed right.
const MEMORIAL = '58F53E82-7541-4A48-90EE-6FB05E20B4A7';

export default function Backdrop({ role, dim = 0.72, landing = false }: { role: Role; dim?: number; landing?: boolean }) {
  // Per-church media (pictures AND videos the church uploaded) — every third
  // backdrop turn comes from the church's own walls when it has them.
  const [churchMedia, setChurchMedia] = useState<ResolvedBg[]>([]);
  useEffect(() => {
    void resolveChurchBg(loadChurchProfile().code).then(setChurchMedia);
  }, []);
  const bgTurn = useRef(0);

  const pick = (peek = false) => {
    if (!peek && churchMedia.length && ++bgTurn.current % 3 === 0) {
      return churchMedia[Math.floor(Math.random() * churchMedia.length)];
    }
    let p = peek ? currentPhoto(role) : nextPhoto(role);
    while (landing && p.includes(MEMORIAL)) p = nextPhoto(role);
    return { url: p, kind: 'image' as const };
  };
  const [photo, setPhoto] = useState<ResolvedBg>(() => pick(true));
  const [next, setNext] = useState<ResolvedBg | null>(null);

  useEffect(() => {
    // The sign-out race: if the app was showing the memorial INSIDE (allowed),
    // the moment we land on the login it must leave NOW — not in 14 seconds.
    if (landing && photo.url.includes(MEMORIAL)) {
      const p = pick();
      setPhoto(p);
      setNext(null);
    }
    const id = window.setInterval(() => {
      const p = pick();
      setNext(p);
      // After the crossfade completes, promote the next photo to current.
      window.setTimeout(() => { setPhoto(p); setNext(null); }, FADE_MS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [role, landing]);

  const img = (item: ResolvedBg, opacity: number, key: string) => (
    item.kind === 'video' ? (
      <video
        key={key}
        aria-hidden
        className="kenburns absolute inset-0 w-full h-full object-cover"
        src={item.url}
        autoPlay muted loop playsInline
        style={{ opacity, transition: `opacity ${FADE_MS}ms ease` }}
      />
    ) : (
      <div
        key={key}
        aria-hidden
        className="kenburns absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${item.url})`,
          opacity,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />
    )
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--space)]">
      {img(photo, 1, photo.url)}
      {next && img(next, 1, next.url)}
      {/* Cinematic vignette — the Adoración dark-photo look */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(120% 90% at 50% 20%, transparent 20%, rgba(6,6,10,${dim}) 75%), linear-gradient(rgba(6,6,10,${dim * 0.55}), rgba(6,6,10,${dim}))`,
      }} />
    </div>
  );
}
