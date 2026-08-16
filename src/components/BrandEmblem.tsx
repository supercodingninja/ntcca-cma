// ==========================================================================
// This Area Of Code Is: The Living Emblem — simplified to ONE holy moment.
// Explanation: The emblem is HIS picture — the black dove over the Bible,
// the same art as the favicon. It rests. Then, in a single move, the black
// dove is ERASED out of the photo (content-aware-fill style, exactly like
// erasing a person from a picture) while the WHITE dove appears at that
// very spot and flies away across the screen. The open Bible remains…
// then the dove quietly returns and the emblem rests again.
// In Other Words: Not four acts — one miracle, repeated.
// ==========================================================================
import { useEffect, useState } from 'react';

type Phase = 'rest' | 'erase' | 'gone';

const REST_MS = 7000;    // the emblem simply is
const ERASE_MS = 1400;   // the black dove dissolves out of the photo
const GONE_MS = 2600;    // only the Bible remains while the white dove flies

export default function BrandEmblem() {
  const [phase, setPhase] = useState<Phase>('rest');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // a resting emblem, always
    let alive = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(() => { if (alive) fn(); }, ms));
    };

    const cycle = () => {
      // The erasure and the white dove's launch are SIMULTANEOUS.
      setPhase('erase');
      document.dispatchEvent(new CustomEvent('ntcc:dove-launch'));
      later(() => setPhase('gone'), ERASE_MS);
      later(() => setPhase('rest'), ERASE_MS + GONE_MS);
      later(cycle, ERASE_MS + GONE_MS + REST_MS);
    };
    later(cycle, REST_MS);
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  return (
    <div className="wordmark-badge brand-emblem" data-phase={phase}
         aria-label="NTCCA emblem — the dove over the Bible">
      {/* HIS emblem picture — the black dove over the Bible (the favicon art) */}
      <img className="em-shield em-black" src="/fav-black.png"
           alt="The dove over the Bible" draggable={false} />
      {/* The same photo with the dove ERASED — content-aware-fill style */}
      <img className="em-shield em-bible" src="/fav-bible.png"
           alt="" aria-hidden="true" draggable={false} />
    </div>
  );
}
