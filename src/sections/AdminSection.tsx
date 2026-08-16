// ==========================================================================
// This Area Of Code Is: The Admin section — user management.
// Explanation: Admins see every account, change roles, and remove users.
// Removing an admin takes TWO admins — except SCN (the app creator), who
// acts alone. The super-admin can never be removed.
// ==========================================================================

import { useRef, useState } from 'react';
import { useAuth, STAFF_ROSTER, type Role } from '../lib/auth';
import { loadChurchProfile, saveChurchProfile } from '../lib/church';
import { findChurch, churchUrl } from '../lib/churches';
import { loadChurchBg, addChurchBg, removeChurchBg, type ChurchBgItem } from '../lib/churchbg';
import TonyaStudio from './TonyaStudio';
import ChurchQr from '../components/ChurchQr';

export default function AdminSection() {
  const { user, allUsers, deleteUser, changeRole, createStaffAccount, createMemberAccount } = useAuth();
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  const [rosterEmails, setRosterEmails] = useState<Record<number, string>>({});
  const [handover, setHandover] = useState<Record<number, string>>({});
  // Director-minted member form
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mRole, setMRole] = useState<Role>('sound');
  const [mPass, setMPass] = useState('');
  const bgRef = useRef<HTMLInputElement>(null);
  // This church's settings (its subdomain identity, stream, report inbox)
  const [church, setChurch] = useState(loadChurchProfile);
  const [bgList, setBgList] = useState<ChurchBgItem[]>(() => loadChurchBg(loadChurchProfile().code));
  const entry = findChurch(church.code);

  if (user?.role !== 'admin') {
    return <div className="glass-card p-8 text-center text-muted">Admin access only.</div>;
  }

  const users = allUsers();
  // A roster member is "seated" once any account carries their exact name.
  const seated = new Set(users.map((u) => u.name.toLowerCase()));

  const createFromRoster = (i: number) => {
    const email = (rosterEmails[i] ?? '').trim();
    const r = createStaffAccount(i, email);
    if (r.ok && r.tempPassword) {
      setHandover((h) => ({ ...h, [i]: r.tempPassword! }));
      setMsg(`${STAFF_ROSTER[i].name}'s account created — hand them the temporary password below.`);
      setRosterEmails((e) => ({ ...e, [i]: '' }));
    } else {
      setMsg(r.error ?? 'Could not create account.');
    }
    bump((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">👥 User Management</h2>
        <p className="text-muted text-sm mb-4">
          Signed in as {user.name} {user.isSuperAdmin && '· ★ App Creator (SCN)'}
        </p>
        {msg && <p className="text-amber-400 text-sm mb-3">{msg}</p>}
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.email} className="glass-card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-40">
                <p className="font-semibold">{u.name} {u.isSuperAdmin && '★'}</p>
                <p className="text-muted text-xs">{u.email}</p>
              </div>
              <select
                className="auth-input !w-auto text-sm"
                value={u.role}
                disabled={!!u.isSuperAdmin}
                onChange={(e) => { changeRole(u.email, e.target.value as Role); bump((n) => n + 1); }}
                aria-label={`Role for ${u.name}`}
              >
                <option value="admin">admin</option>
                <option value="editor">editor</option>
                <option value="sound">sound eng.</option>
                <option value="media">media eng.</option>
                <option value="tempo">tempo eng.</option>
                <option value="musician">musician</option>
                <option value="viewer">viewer</option>
              </select>
              {!u.isSuperAdmin && u.email !== user.email && (
                <button className="glass-btn danger text-sm" onClick={() => {
                  const r = deleteUser(u.email);
                  setMsg(r.ok ? `${u.name} removed.` : (r.error ?? ''));
                  bump((n) => n + 1);
                }}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">⛪ This Church</h2>
        <p className="text-muted text-sm mb-3">
          <b>{church.name}</b> · door: <span className="text-accent">{churchUrl(church.code)}</span>
          {entry && ` · ${entry.location}`}
        </p>
        <div className="grid gap-2">
          <label className="text-xs text-muted">Church live stream link (what viewers see — YouTube Live or MP4)</label>
          <input className="auth-input !w-full" inputMode="url" autoCapitalize="off"
                 placeholder="https://youtube.com/@yourchurch/live or direct MP4"
                 value={church.streamUrl}
                 onChange={(e) => setChurch({ ...church, streamUrl: e.target.value })}
                 aria-label="Church stream link" />
          <label className="text-xs text-muted">Director's email for Saturday practice reports</label>
          <input className="auth-input !w-full" type="email" placeholder="director@yourchurch.org"
                 value={church.reportEmail}
                 onChange={(e) => setChurch({ ...church, reportEmail: e.target.value })}
                 aria-label="Director report email" />
          <button className="glass-btn primary" onClick={() => { saveChurchProfile(church); setMsg('✅ Church settings saved on this device.'); }}>
            Save church settings
          </button>
          {church.streamUrl && (
            <button className="glass-btn text-sm" onClick={() => {
              const link = `${window.location.origin}${window.location.pathname}?church=${church.code}&stream=${encodeURIComponent(church.streamUrl)}`;
              void navigator.clipboard?.writeText(link);
              setMsg('🔗 Viewer invite link copied — post it once; every viewer who opens it keeps your stream forever.');
            }}>🔗 Copy viewer invite link</button>
          )}

          {/* The invitation QR — scan it and the person lands at THIS
              church's door. Print-ready for the invitation cards. */}
          <div className="border-t border-[var(--glass-border)] pt-3 mt-1">
            <ChurchQr code={church.code} name={church.name} />
          </div>

          {/* 🖼 This church's background media — pictures & videos that run
              behind ITS app (namespaced per church; stored on this device). */}
          <div className="border-t border-[var(--glass-border)] pt-3 mt-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted">🖼 Background pictures & videos (run behind your church's app)</label>
              <button className="glass-btn text-sm" title="Upload background pictures or videos"
                      onClick={() => bgRef.current?.click()} aria-label="Upload background media">
                ⬆ Upload
              </button>
              <input ref={bgRef} type="file" accept="image/*,video/*" multiple hidden
                     onChange={async (e) => {
                       const files = Array.from(e.target.files ?? []);
                       e.target.value = '';
                       let added = 0;
                       for (const f of files) {
                         try { setBgList(await addChurchBg(church.code, f)); added++; }
                         catch (err) { setMsg(err instanceof Error ? err.message : 'That file could not be a background.'); }
                       }
                       if (added) setMsg(`🖼 ${added} background item(s) added — they'll fade in behind your church's app.`);
                     }} />
            </div>
            {bgList.length > 0 && (
              <ul className="space-y-1 text-sm mt-2">
                {bgList.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>{b.kind === 'video' ? '🎞' : '🖼'} {b.name}</span>
                    <button className="glass-btn text-xs" onClick={() => setBgList(removeChurchBg(church.code, b.id))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Tonya's Theme Studio — the whole church's look, push-and-click */}
      <TonyaStudio />

      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">🪪 Create a team account</h2>
        <p className="text-muted text-sm mb-3">
          Create an engineer, musician, or viewer account with a hand-over password YOU choose.
          They must set their own password at first sign-in — it saves only on their device.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="auth-input !w-full" placeholder="Their name" value={mName}
                 onChange={(e) => setMName(e.target.value)} aria-label="Member name" />
          <input className="auth-input !w-full" type="email" placeholder="Their email" value={mEmail}
                 onChange={(e) => setMEmail(e.target.value)} aria-label="Member email" />
          <select className="auth-input !w-full" value={mRole} onChange={(e) => setMRole(e.target.value as Role)}
                  aria-label="Member role">
            <option value="sound">🔊 sound engineer</option>
            <option value="media">🎬 media engineer</option>
            <option value="tempo">🎚 audio-track engineer</option>
            <option value="musician">🎤 musician</option>
            <option value="editor">🎹 editor</option>
            <option value="viewer">🙌 viewer</option>
            <option value="admin">👑 admin (director)</option>
          </select>
          <input className="auth-input !w-full" placeholder="Hand-over password you choose" value={mPass}
                 onChange={(e) => setMPass(e.target.value)} aria-label="Hand-over password" />
        </div>
        <button className="glass-btn primary w-full mt-3" onClick={() => {
          const r = createMemberAccount(mEmail, mName, mRole, mPass);
          setMsg(r.ok
            ? `${mName || mEmail}'s ${mRole} account created — hand them the password; they'll set their own at first sign-in.`
            : (r.error ?? 'Could not create account.'));
          if (r.ok) { setMName(''); setMEmail(''); setMPass(''); }
          bump((n) => n + 1);
        }}>Create account</button>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">🕊 Staff Roster — Pre-Approved</h2>
        <p className="text-muted text-sm mb-4">
          Leadership seats are reserved. Type the person's real email once, tap
          create, and hand them the temporary password — they'll set a personal
          one at first sign-in.
        </p>
        <ul className="space-y-2">
          {STAFF_ROSTER.map((entry, i) => {
            const isSeated = seated.has(entry.name.toLowerCase());
            return (
              <li key={entry.name} className="glass-card p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="font-semibold">{entry.name}</p>
                  <p className="text-muted text-xs">{entry.role} seat</p>
                </div>
                {isSeated ? (
                  <span className="text-sm text-accent font-semibold">✓ Account active</span>
                ) : (
                  <>
                    <input
                      className="auth-input !w-auto text-sm"
                      type="email"
                      placeholder="their real email"
                      value={rosterEmails[i] ?? ''}
                      onChange={(e) => setRosterEmails((m) => ({ ...m, [i]: e.target.value }))}
                      aria-label={`Email for ${entry.name}`}
                    />
                    <button className="glass-btn text-sm" onClick={() => createFromRoster(i)}>
                      Create account
                    </button>
                  </>
                )}
                {handover[i] && !isSeated && (
                  <p className="w-full text-sm">
                    Temporary password to hand over: <strong className="text-accent">{handover[i]}</strong>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
