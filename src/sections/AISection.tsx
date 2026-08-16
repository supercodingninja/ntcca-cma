// ==========================================================================
// This Area Of Code Is: The AI Trio panels — JP, Tanya, Vickie.
// Explanation: JP takes spoken/typed tasking commands from admins and tracks
// ETAs + 2-admin unreachable approvals. Tanya collects design changes into a
// draft and composes the "Changes To Make" email (sent only on command).
// Vickie answers music questions for every role.
// ==========================================================================

import { useRef, useState } from 'react';
import { useAI, askVickie } from '../lib/ai';
import { useAuth } from '../lib/auth';

// Web Speech API, loosely typed (Chrome on iPad/desktop supports it).
type SpeechRec = {
  lang: string; interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function makeRecognizer(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function AISection() {
  const { jp, tanya } = useAI();
  const { user, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  // JP state
  const [jpInput, setJpInput] = useState('');
  const [jpReply, setJpReply] = useState('JP: Say "JP, my guy" or type a command.');
  const [tasks, setTasks] = useState(jp.getTasks());
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  jp.onChange(() => setTasks([...jp.getTasks()]));

  // Tanya state
  const [draft, setDraft] = useState(tanya.getDraft());
  const [emailText, setEmailText] = useState('');
  tanya.onChange(() => setDraft([...tanya.getDraft()]));

  // Vickie state
  const [q, setQ] = useState('');
  const [chat, setChat] = useState<{ who: string; text: string }[]>([
    { who: 'Vickie', text: askVickie('who are you') },
  ]);

  const sendJp = (text: string) => {
    if (!text.trim()) return;
    setJpReply(jp.command(text, user?.name ?? 'admin', effectiveRole));
    setJpInput('');
  };

  const toggleListen = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = makeRecognizer();
    if (!rec) { setJpReply('JP: Voice input needs Chrome. Type instead — same result.'); return; }
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => sendJp(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const askV = () => {
    if (!q.trim()) return;
    setChat((c) => [...c, { who: 'You', text: q }, { who: 'Vickie', text: askVickie(q) }]);
    setQ('');
  };

  return (
    <div className="space-y-4">
      {/* VICKIE — for everyone */}
      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-2">🎓 Vickie — Music Scholar</h2>
        <div className="max-h-56 overflow-y-auto space-y-2 mb-3">
          {chat.map((m, i) => (
            <p key={i} className={`text-sm ${m.who === 'You' ? 'text-right text-muted' : ''}`}>
              <strong className={m.who === 'You' ? '' : 'text-accent'}>{m.who}: </strong>{m.text}
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="auth-input" placeholder="Ask about notes, stanzas, tempo, CCLI…"
                 value={q} onChange={(e) => setQ(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && askV()} aria-label="Ask Vickie" />
          <button className="glass-btn primary" onClick={askV}>Ask</button>
        </div>
      </div>

      {isAdmin && (
        <>
          {/* JP — admin tasking */}
          <div className="glass-card p-5">
            <h2 className="text-accent font-semibold mb-2">🎙️ JP — Tasking Assistant</h2>
            <p className="text-sm mb-3">{jpReply}</p>
            <div className="flex gap-2">
              <input className="auth-input" placeholder='JP, task Maria fix the alto chart…'
                     value={jpInput} onChange={(e) => setJpInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && sendJp(jpInput)} aria-label="Command JP" />
              <button className="glass-btn primary" onClick={() => sendJp(jpInput)}>Send</button>
              <button className={`glass-btn ${listening ? 'danger' : ''}`} onClick={toggleListen} aria-label="Voice command">
                {listening ? '⏹' : '🎤'}
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="glass-card p-3 text-sm">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span><strong>{t.assignedTo}</strong>: {t.title}</span>
                    <span className="text-muted text-xs">{t.status}{t.eta ? ` · ETA ${t.eta}` : ''}</span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className="glass-btn text-xs" onClick={() => {
                      const eta = prompt('Estimated completion time?');
                      if (eta) jp.giveEta(t.id, eta);
                    }}>Set ETA</button>
                    <button className="glass-btn text-xs" onClick={() => jp.markUnreachable(t.id)}>Unreachable</button>
                    <button className="glass-btn text-xs" onClick={() => setJpReply(jp.approve(t.id, user?.email ?? ''))}>
                      Approve ({t.approvals.length}/2)
                    </button>
                    <button className="glass-btn text-xs" onClick={() => jp.complete(t.id)}>Done</button>
                  </div>
                </li>
              ))}
              {tasks.length === 0 && <li className="text-muted text-sm">No tasks yet.</li>}
            </ul>
          </div>

          {/* TANYA — design drafts */}
          <div className="glass-card p-5" title={tanya.describe()}>
            <h2 className="text-accent font-semibold mb-2">🎨 Tanya — Design Assistant</h2>
            <p className="text-muted text-sm mb-3">{tanya.describe()}</p>
            <p className="text-sm"><strong>{draft.length}</strong> draft change(s) collected.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className="glass-btn" onClick={() => {
                // Demo recorder: real drag/resize hooks call tanya.record().
                const label = prompt('Element changed (e.g. "Library card")?');
                const prop = prompt('Property (e.g. "width", "zIndex")?') ?? '';
                const val = prompt('New value?') ?? '';
                if (label && val) {
                  tanya.record({
                    elementLabel: label, property: prop, oldValue: '(previous)',
                    newValue: val, byUser: user?.name ?? 'admin',
                    codeRef: `src/sections — ${label} (${prop})`,
                  });
                }
              }}>+ Record change</button>
              <button className="glass-btn primary" disabled={draft.length === 0}
                      onClick={() => setEmailText(tanya.composeEmail())}>
                Save as draft → compose email
              </button>
              <button className="glass-btn danger" onClick={() => { tanya.clear(); setEmailText(''); }}>Clear</button>
            </div>
            {emailText && (
              <div className="mt-3">
                <pre className="whitespace-pre-wrap font-mono text-xs glass-card p-3 max-h-56 overflow-y-auto">{emailText}</pre>
                <a className="cta-gold inline-block px-6 py-2 mt-2"
                   href={`mailto:FrederickDThomasJr@gmail.com?subject=${encodeURIComponent('Changes To Make')}&body=${encodeURIComponent(emailText)}`}>
                  ✉️ Send email
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
