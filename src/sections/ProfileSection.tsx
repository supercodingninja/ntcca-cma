// ==========================================================================
// This Area Of Code Is: Your Profile — every seat gets one.
// Explanation: Who you are, which seat you hold (admin, musician, sound,
// media, tempo, viewer), and the keys to it: change your password, sign out.
// In Other Words: Home base for your own account.
// ==========================================================================
import { useRef, useState } from 'react';
import { useAuth, type Role } from '../lib/auth';

const ROLE_TITLES: Record<Role, string> = {
  admin: '👑 Administrator',
  editor: '🎹 Editor',
  sound: '🔊 Sound Engineer',
  media: '🎬 Media Engineer',
  tempo: '🎚 Tempo Engineer',
  musician: '🎤 Musician',
  viewer: '🙌 Congregation',
};

export default function ProfileSection() {
  const { user, logout, resetPassword, resetAppData } = useAuth();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const syncRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const changePw = () => {
    if (pw.length < 4) { setMsg('Give it at least 4 characters.'); return; }
    resetPassword(pw);
    setPw('');
    setMsg('✅ Password updated — use it at your next sign-in.');
  };

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="glass-card p-6 text-center">
        <p className="text-5xl mb-2">{ROLE_TITLES[user.role].split(' ')[0]}</p>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-muted text-sm">{user.email}</p>
        <p className="mt-2 inline-block px-3 py-1 rounded-full border border-[var(--glass-border)] text-sm text-accent">
          {ROLE_TITLES[user.role]}
        </p>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">🔑 Change password</h3>
        <div className="flex gap-2">
          <input className="auth-input !w-full" type="password" placeholder="New password"
                 value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password"
                 autoComplete="new-password" />
          <button className="glass-btn primary" onClick={changePw}>Save</button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">📱 Devices talking to each other</h3>
        <p className="text-sm text-muted">
          No server — your data lives on each device. To move it: export a sync file here,
          send it to your other device (AirDrop/email), then press <b>Update</b> there and load it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="glass-btn primary" onClick={() => {
            const data: Record<string, string> = {};
            Object.keys(localStorage).filter((k) => k.startsWith('ntcc.'))
              .forEach((k) => { data[k] = localStorage.getItem(k) ?? ''; });
            const blob = new Blob([JSON.stringify({ kind: 'ntcc-sync', data }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ntcca-sync.json';
            a.click();
            URL.revokeObjectURL(a.href);
          }}>⬇ Export sync file</button>
          <button className="glass-btn" onClick={() => syncRef.current?.click()}>🔄 Update from file</button>
          <input ref={syncRef} type="file" accept=".json,application/json" hidden
                 onChange={async (e) => {
                   const f = e.target.files?.[0];
                   e.target.value = '';
                   if (!f) return;
                   try {
                     const s = JSON.parse(await f.text()) as { kind: string; data: Record<string, string> };
                     if (s.kind !== 'ntcc-sync') throw new Error('bad');
                     Object.entries(s.data).forEach(([k, v]) => localStorage.setItem(k, v));
                     setMsg('✅ Updated from your other device. Refreshing…');
                     setTimeout(() => window.location.reload(), 1200);
                   } catch { setMsg('⚠️ That is not an NTCCA sync file.'); }
                 }} />
        </div>
      </div>

      <button className="glass-btn w-full" onClick={logout}>Sign out</button>

      {/* Fresh start — wipes every ntcc.* key on THIS device and reseeds.
          Long-press style confirmation: the button must be clicked twice. */}
      <button className="glass-btn danger w-full text-sm" onClick={(e) => {
        const b = e.currentTarget;
        if (b.dataset.armed === '1') {
          resetAppData();
          window.location.reload();
        } else {
          b.dataset.armed = '1';
          b.textContent = '⚠️ Tap again to erase EVERYTHING on this device';
          setTimeout(() => { b.dataset.armed = '0'; b.textContent = '🧹 Fresh start (erase this device)'; }, 4000);
        }
      }}>🧹 Fresh start (erase this device)</button>
    </div>
  );
}
