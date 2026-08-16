// ==========================================================================
// This Area Of Code Is: The Ideas Board — compose & review.
// Explanation: mode="submit" — anyone (musician, engineer, editor… anyone)
// composes music literature ideas and sends them in; every idea routes
// straight to the Music Director's review inbox. mode="review" — the
// director decides "does this fit with the music?", and can PAUSE the
// whole pipeline: while paused, everyone sees "No ideas at this time."
// ==========================================================================

import { useState } from 'react';
import {
  loadIdeas, submitIdea, reviewIdea, removeIdea,
  ideasPaused, setIdeasPaused, type Idea,
} from '../lib/ideas';
import { useAuth } from '../lib/auth';

export default function IdeasBoard({ mode }: { mode: 'submit' | 'review' }) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>(loadIdeas);
  const [paused, setPaused] = useState(ideasPaused);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');

  /* ------------------------------ Submit side ------------------------------ */
  if (mode === 'submit') {
    const mine = ideas.filter((i) => i.author === user?.name);
    return (
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-accent font-semibold">💡 Music Ideas — Compose &amp; Share</h3>
        {paused ? (
          <p className="text-amber-400 text-sm font-semibold">⏸ No ideas at this time — the Music Director has paused submissions.</p>
        ) : (
          <>
            <p className="text-muted text-sm">
              Got a hook, a lyric, a whole song idea? Write it here — it goes straight to the Music Director to see if it fits with the music.
            </p>
            <input className="auth-input w-full" placeholder="Idea title"
                   value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="auth-input w-full min-h-28" placeholder="Your music literature — lyrics, melody notes, theme…"
                      value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="cta-gold px-6 py-2"
                    onClick={() => {
                      if (!title.trim() || !body.trim()) { setMsg('Give your idea a title and the literature itself.'); return; }
                      setIdeas(submitIdea(user?.name ?? 'Anonymous', title, body));
                      setTitle(''); setBody('');
                      setMsg('💡 Sent to the Music Director for review!');
                    }}>
              💡 Submit idea
            </button>
          </>
        )}
        {msg && <p className="text-amber-400 text-sm">{msg}</p>}
        {mine.length > 0 && (
          <ul className="space-y-1 pt-2">
            {mine.map((i) => (
              <li key={i.id} className="text-sm flex items-center gap-2">
                <strong>{i.title}</strong>
                <span className={`pill text-xs ${i.status === 'fits' ? 'pill-green' : ''}`}>
                  {i.status === 'pending' ? '⏳ in review' : i.status === 'fits' ? '✓ fits the music!' : 'not this time'}
                </span>
                {i.note && <span className="text-muted text-xs">— {i.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* ------------------------------ Review side ------------------------------ */
  const pending = ideas.filter((i) => i.status === 'pending');
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-accent font-semibold">💡 Ideas Inbox — Director Review</h3>
        <button className={`glass-btn text-sm ${paused ? 'danger' : ''}`}
                onClick={() => { const p = !paused; setIdeasPaused(p); setPaused(p); }}>
          {paused ? '▶ Resume accepting ideas' : '⏸ Pause — no ideas at this time'}
        </button>
      </div>
      {paused && <p className="text-amber-400 text-sm">Submissions are paused — everyone sees "No ideas at this time."</p>}
      {pending.length === 0 ? (
        <p className="text-muted text-sm">Inbox zero. Every idea has been reviewed.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((i) => (
            <li key={i.id} className="rounded-xl border border-[var(--glass-border)] p-3">
              <p className="text-sm"><strong>{i.title}</strong> <span className="text-muted">— {i.author}</span></p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{i.body}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <button className="glass-btn primary text-xs"
                        onClick={() => {
                          // The director can attach a real note instead of a canned line.
                          const note = window.prompt(`Note to ${i.author} (optional):`, '');
                          setIdeas(reviewIdea(i.id, 'fits', note?.trim() || undefined));
                        }}>
                  ✓ Fits the music
                </button>
                <button className="glass-btn text-xs"
                        onClick={() => setIdeas(reviewIdea(i.id, 'notNow'))}>
                  Not this time
                </button>
                <button className="glass-btn danger text-xs" onClick={() => setIdeas(removeIdea(i.id))}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
