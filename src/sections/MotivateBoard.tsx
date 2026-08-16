// ==========================================================================
// This Area Of Code Is: The Director's Motivation Board.
// Explanation: Two powers in one card — (1) post the bulletin that pops up
// for everyone except the viewer next login ("Check Your Emails!" with the
// app-rendered card, plus an optional attached picture that shows ONLY in
// the popup, never as a background); (2) award motivation stamps — Best
// Church Choir, Best Band, Best Vocalists, or custom stamps and messages
// the director creates himself.
// ==========================================================================

import { useRef, useState } from 'react';
import {
  DEFAULT_STAMPS, loadStamps, awardStamp, removeStamp,
  loadCustomDesigns, saveCustomDesign,
  loadBulletin, postBulletin, clearBulletin,
  type StampAudience,
} from '../lib/motivate';
import { storeFile } from '../lib/fileStore';
import { useAuth } from '../lib/auth';

const AUDIENCES: { id: StampAudience; label: string }[] = [
  { id: 'choir', label: '🎶 Choir' },
  { id: 'band', label: '🥁 Band' },
  { id: 'vocalists', label: '🎤 Vocalists' },
  { id: 'all', label: '🌟 Everyone' },
];

export default function MotivateBoard() {
  const { user } = useAuth();
  const [stamps, setStamps] = useState(loadStamps);
  const [designs, setDesigns] = useState(loadCustomDesigns);
  const [bulletin, setBulletin] = useState(loadBulletin);
  const [msg, setMsg] = useState('');

  // Bulletin composer
  const [bKind, setBKind] = useState<'checkEmails' | 'custom'>('checkEmails');
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [bImage, setBImage] = useState<string>('');
  const imgRef = useRef<HTMLInputElement>(null);

  // Custom stamp composer
  const [cTitle, setCTitle] = useState('');
  const [cIcon, setCIcon] = useState('🏅');
  const [cMessage, setCMessage] = useState('');

  const award = (title: string, icon: string, message: string, audience: StampAudience, custom: boolean) => {
    setStamps(awardStamp({ title, icon, message, audience, custom, awardedBy: user?.name ?? 'Director' }));
    setMsg(`${icon} "${title}" awarded to ${audience === 'all' ? 'everyone' : `the ${audience}`}!`);
  };

  const post = async () => {
    const title = bKind === 'checkEmails' ? 'Check Your Emails!' : bTitle.trim() || 'Message from the Director';
    const b = postBulletin({ kind: bKind, title, message: bMessage.trim(), imageRef: bImage || undefined });
    setBulletin(b);
    setMsg('📣 Bulletin posted — it will pop up for every musician, engineer, editor and admin at their next login (viewers never see it).');
    setBMessage(''); setBTitle(''); setBImage('');
  };

  return (
    <div className="glass-card p-5 space-y-5">
      <div>
        <h3 className="text-accent font-semibold">📣 Bulletin & Motivation Stamps</h3>
        <p className="text-muted text-sm">Speak to the whole team at login — then hand out trophies.</p>
      </div>
      {msg && <p className="text-amber-400 text-sm">{msg}</p>}

      {/* ------------------------- Bulletin composer ------------------------- */}
      <div className="rounded-xl border border-[var(--glass-border)] p-4">
        <p className="font-semibold text-sm mb-2">Post a bulletin (everyone except the viewer sees it at login)</p>
        <div className="flex gap-2 flex-wrap mb-3">
          <button className={`glass-btn text-sm ${bKind === 'checkEmails' ? 'primary' : ''}`}
                  onClick={() => setBKind('checkEmails')}>📣 Check Your Emails!</button>
          <button className={`glass-btn text-sm ${bKind === 'custom' ? 'primary' : ''}`}
                  onClick={() => setBKind('custom')}>✏️ Custom message</button>
        </div>
        {bKind === 'custom' && (
          <input className="auth-input w-full mb-2" placeholder="Bulletin title"
                 value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
        )}
        <textarea className="auth-input w-full min-h-20" placeholder="Add a message (optional)…"
                  value={bMessage} onChange={(e) => setBMessage(e.target.value)} />
        <div className="flex gap-2 items-center mt-2 flex-wrap">
          <button className="glass-btn text-sm" onClick={() => imgRef.current?.click()}>
            🖼 Attach a picture (popup only — never a background)
          </button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) void storeFile(f).then((ref) => { setBImage(ref); setMsg('🖼 Picture attached — it shows only inside the popup.'); });
                 }} />
          {bImage && <span className="pill pill-green text-xs">picture attached ✓</span>}
          <button className="cta-gold px-6 py-2 ml-auto" onClick={() => void post()}>📣 Post Bulletin</button>
        </div>
        {bulletin?.active && (
          <p className="text-xs text-muted mt-2">
            Active bulletin: <strong>{bulletin.title}</strong> · posted {new Date(bulletin.ts).toLocaleString()}{' '}
            <button className="glass-btn text-xs danger ml-2" onClick={() => { clearBulletin(); setBulletin(null); }}>Take it down</button>
          </p>
        )}
      </div>

      {/* --------------------------- Stamp awards --------------------------- */}
      <div>
        <p className="font-semibold text-sm mb-2">Award a stamp</p>
        <div className="space-y-2">
          {[...DEFAULT_STAMPS.map((d) => ({ ...d, custom: false })),
            ...designs.map((d) => ({ ...d, audience: 'all' as StampAudience, custom: true }))].map((d, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap rounded-lg border border-[var(--glass-border)] p-2">
              <span className="text-xl">{d.icon}</span>
              <span className="font-semibold text-sm">{d.title}</span>
              <span className="text-muted text-xs flex-1 min-w-32">{d.message}</span>
              <span className="flex gap-1">
                {AUDIENCES.map((a) => (
                  <button key={a.id} className="glass-btn text-xs"
                          onClick={() => award(d.title, d.icon, d.message, a.id, d.custom)}>
                    {a.label}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------- Create your own -------------------------- */}
      <div className="rounded-xl border border-[var(--glass-border)] p-4">
        <p className="font-semibold text-sm mb-2">Create your own stamp</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className="auth-input" placeholder="Title (e.g. Most Faithful)" value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
          <input className="auth-input" placeholder="Icon (emoji)" value={cIcon} onChange={(e) => setCIcon(e.target.value)} maxLength={4} />
          <input className="auth-input" placeholder="Motivating message" value={cMessage} onChange={(e) => setCMessage(e.target.value)} />
        </div>
        <button className="glass-btn primary text-sm mt-2"
                onClick={() => {
                  if (!cTitle.trim()) return;
                  setDesigns(saveCustomDesign({ title: cTitle.trim(), icon: cIcon || '🏅', message: cMessage.trim() || 'Well done!' }));
                  setCTitle(''); setCMessage('');
                  setMsg('✓ Custom stamp created — award it above, any time.');
                }}>
          ✚ Create stamp
        </button>
      </div>

      {/* ------------------------------ Trophy shelf ----------------------------- */}
      {stamps.length > 0 && (
        <div>
          <p className="font-semibold text-sm mb-2">🏆 Awarded</p>
          <ul className="space-y-1">
            {[...stamps].reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span>{s.icon}</span>
                <strong>{s.title}</strong>
                <span className="pill pill-green text-xs">{s.audience}</span>
                <span className="text-muted text-xs">{new Date(s.ts).toLocaleDateString()}</span>
                <button className="glass-btn text-xs danger ml-auto" onClick={() => setStamps(removeStamp(s.id))}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
