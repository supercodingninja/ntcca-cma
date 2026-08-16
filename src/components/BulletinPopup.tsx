// ==========================================================================
// This Area Of Code Is: The Director's Bulletin Popup.
// Explanation: When the Music Director posts a bulletin — "Check Your
// Emails!" or anything custom — it pops up the moment ANY user except the
// viewer logs on: musicians, sound engineers, media, tempo, editors,
// admins. The card is rendered BY THE APP (text always spelled right, no
// garbled-image risk); an attached picture shows only here, in this
// controlled popup — never circulating as a background. Each person sees
// each posting once.
// ==========================================================================

import { useEffect, useState } from 'react';
import { type Bulletin, loadBulletin, bulletinSeen, markBulletinSeen } from '../lib/motivate';
import { resolveFileUrl } from '../lib/fileStore';
import { useAuth } from '../lib/auth';

export default function BulletinPopup() {
  const { user, effectiveRole } = useAuth();
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [imgUrl, setImgUrl] = useState('');

  useEffect(() => {
    // Everyone but the viewer — and only a fresh, unseen posting.
    if (!user || effectiveRole === 'viewer') return;
    const b = loadBulletin();
    if (!b || !b.active || bulletinSeen(b.id)) return;
    setBulletin(b);
    if (b.imageRef) void resolveFileUrl(b.imageRef).then((u) => { if (u) setImgUrl(u); });
  }, [user, effectiveRole]);

  if (!bulletin) return null;

  const dismiss = () => {
    markBulletinSeen(bulletin.id);
    setBulletin(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
         role="dialog" aria-modal="true" aria-label="Message from the Music Director">
      <div className="glass-card max-w-md w-full p-6 text-center border-2 border-[var(--accent)] shadow-2xl">
        {bulletin.kind === 'checkEmails' ? (
          /* The built-in card — rendered by the app itself, so the words
             can NEVER be garbled like text baked into a picture. */
          <div className="rounded-2xl p-6 mb-4 bg-gradient-to-b from-[rgba(212,175,55,0.25)] to-transparent border border-[var(--accent)]">
            <p className="text-5xl mb-3" aria-hidden>📣✉️</p>
            <h2 className="font-display text-3xl text-accent font-black tracking-wide">Check Your Emails!</h2>
            <p className="text-muted text-sm mt-2">A message from your Music Director</p>
          </div>
        ) : (
          <h2 className="font-display text-2xl text-accent mb-3">{bulletin.title}</h2>
        )}
        {imgUrl && (
          <img src={imgUrl} alt="Attached by the Music Director"
               className="rounded-xl max-h-56 mx-auto mb-3 object-contain" />
        )}
        {bulletin.message && <p className="text-sm mb-4 whitespace-pre-wrap">{bulletin.message}</p>}
        <button className="cta-gold px-8 py-2.5" onClick={dismiss} autoFocus>
          ✓ Got it
        </button>
      </div>
    </div>
  );
}
