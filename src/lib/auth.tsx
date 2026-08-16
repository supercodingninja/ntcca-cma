// ==========================================================================
// This Area Of Code Is: The Role & Auth Universe (Admin / Editor / Viewer).
// Explanation: Local-first authentication — the app works even when Supabase
// sleeps, so no one ever sees "Load failed" again. Roles get distinct looks,
// the SCN super-admin can manage anyone, other admins need a second admin to
// remove an admin. New users sign up with their role's default password and
// are forced to set a personal one on first login. Admin/Editor can drop
// into "View as Viewer" mode to prevent mistakes, then toggle back.
// In Other Words: Three doors into the same church — each door paints the
// whole building a different way, and only the right keys open each door.
// ==========================================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Staff roles: the ministry team + the three engineer seats.
// sound = front-of-house sound engineer · media = media/screens engineer ·
// tempo = audio-track & tempo engineer. Engineers edit; they do not admin.
export type Role = 'admin' | 'editor' | 'sound' | 'media' | 'tempo' | 'musician' | 'viewer';

export interface User {
  email: string;
  name: string;
  role: Role;
  mustResetPassword: boolean;
  isSuperAdmin?: boolean;
}

interface StoredUser extends User {
  password: string;
}

// Role signup codewords per the Director's spec — simple words each role
// knows: viewers "view", musicians "NxtGen", engineers "sound"/"media"/"track".
// First login forces a personal password, saved only on their own device.
const ROLE_DEFAULT_PASSWORDS: Record<Role, string> = {
  admin: '!r0N M1k3',
  editor: '3d1t',
  sound: 'sound',
  media: 'media',
  tempo: 'track',
  musician: 'NxtGen',
  viewer: 'view',
};

// This Area Of Code Is: The pre-approved Staff Roster.
// Explanation: Leadership names are known, but their personal emails are NOT
// — and guessing an email would lock real people out of their own accounts.
// So the roster lives here as pre-approved names + roles; an admin types the
// person's real email once, and the account is born with a temporary
// hand-over password that forces a personal password on first login.
// In Other Words: The seats are reserved with name cards — each person
// claims their own seat when they arrive.
export interface RosterEntry { name: string; role: Role }
export const STAFF_ROSTER: RosterEntry[] = [
  { name: 'JP Rev.', role: 'admin' },
  { name: 'Tonya Keel', role: 'admin' },
  { name: 'Rev. Michael Keel', role: 'admin' },
  { name: 'Rev. Philip Kinston', role: 'editor' },
  { name: 'Rev. George Keys', role: 'editor' },
  { name: 'Robin Schiller', role: 'editor' },
];

// Seed accounts: the SCN super-admin + the three demo accounts.
const SEED_USERS: StoredUser[] = [
  { email: 'frederickdthomasjr@gmail.com', name: 'SCN', role: 'admin', password: 'ShowBiz-Pizza82', mustResetPassword: false, isSuperAdmin: true },
  { email: 'ad@demo.go', name: 'Demo Admin', role: 'admin', password: '1', mustResetPassword: false },
  { email: 'editor@ntcc-cma.demo', name: 'Demo Editor', role: 'editor', password: '1234', mustResetPassword: false },
  { email: 'viewer@ntcc-cma.demo', name: 'Demo Viewer', role: 'viewer', password: '1234', mustResetPassword: false },
  { email: 'sound@ntcc-cma.demo', name: 'Demo Sound Engineer', role: 'sound', password: '1234', mustResetPassword: false },
  { email: 'media@ntcc-cma.demo', name: 'Demo Media Engineer', role: 'media', password: '1234', mustResetPassword: false },
  { email: 'tempo@ntcc-cma.demo', name: 'Demo Tempo Engineer', role: 'tempo', password: '1234', mustResetPassword: false },
  { email: 'musician@ntcc-cma.demo', name: 'Demo Musician', role: 'musician', password: '1234', mustResetPassword: false },
];

interface AuthCtx {
  user: User | null;
  /** The role the UI is currently painted for (view-as can lower it) */
  effectiveRole: Role;
  /** Admin's look-through-their-eyes: preview the app as ANY role. */
  viewAsRole: Role | null;
  setViewAsRole: (r: Role | null) => void;
  login: (email: string, password: string) => { ok: boolean; error?: string; mustReset?: boolean };
  signup: (email: string, name: string, role: Role, password: string) => { ok: boolean; error?: string; mustReset?: boolean };
  resetPassword: (newPassword: string) => void;
  logout: () => void;
  /** Director creates any member account with a hand-over password he chooses. */
  createMemberAccount: (email: string, name: string, role: Role, password: string) => { ok: boolean; error?: string };
  allUsers: () => User[];
  deleteUser: (email: string) => { ok: boolean; error?: string };
  changeRole: (email: string, role: Role) => void;
  /** Create a roster member's account from their real email; returns the temp password to hand over. */
  createStaffAccount: (rosterIndex: number, email: string) => { ok: boolean; error?: string; tempPassword?: string };
  /** Wipe all app data on this device and reseed (the "fresh start" button). */
  resetAppData: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORE_KEY = 'ntcc.users';
const SESSION_KEY = 'ntcc.session';

function loadUsers(): StoredUser[] {
  // This Area Of Code Is: Self-healing user store.
  // Explanation: Older app versions may have left a stale user list on the
  // device. Instead of trusting storage blindly, I MERGE the seed accounts
  // into whatever is stored — demo accounts and the SCN super-admin always
  // exist with their correct passwords, no matter what an old version left
  // behind. Users created later are never touched.
  // In Other Words: The master keys are always under the mat, even if an
  // old copy of the app moved the mat.
  let stored: StoredUser[] = [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) stored = JSON.parse(raw) as StoredUser[];
  } catch { stored = []; }

  let changed = false;
  const merged = [...stored];
  SEED_USERS.forEach((seed) => {
    const i = merged.findIndex((u) => u.email.toLowerCase() === seed.email.toLowerCase());
    if (i === -1) {
      merged.push(seed);
      changed = true;
    } else if (merged[i].password !== seed.password && merged[i].mustResetPassword === false) {
      // Stale/wrong seed password from an old build — restore it.
      merged[i] = { ...merged[i], password: seed.password, role: seed.role, isSuperAdmin: seed.isSuperAdmin };
      changed = true;
    }
  });
  if (changed || stored.length === 0) saveUsers(merged);
  return merged;
}

/** Wipe all app data on this device and reseed (the "fresh start" button). */
export function resetAppData(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('ntcc.'))
    .forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
  saveUsers(SEED_USERS);
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

// How many admins co-signed this deletion request (non-SCN path needs 2).
function adminDeleteApprovals(): string[] {
  try { return JSON.parse(localStorage.getItem('ntcc.adminDeleteVotes') ?? '[]') as string[]; }
  catch { return []; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  });
  const [viewAsRole, setViewAsRole] = useState<Role | null>(null);

  useEffect(() => {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  }, [user]);

  const strip = (u: StoredUser): User => {
    const { password: _pw, ...rest } = u;
    void _pw;
    return rest;
  };

  const login: AuthCtx['login'] = (email, password) => {
    const users = loadUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { ok: false, error: 'No account found for that email.' };
    if (found.password !== password) return { ok: false, error: 'Incorrect password.' };
    setUser(strip(found));
    return { ok: true, mustReset: found.mustResetPassword };
  };

  const signup: AuthCtx['signup'] = (email, name, role, password) => {
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'That email already has an account.' };
    }
    // First signup uses the role default, then must set a personal password.
    if (password !== ROLE_DEFAULT_PASSWORDS[role]) {
      return { ok: false, error: 'Use the signup password given by your church admin.' };
    }
    const nu: StoredUser = { email, name, role, password, mustResetPassword: true };
    users.push(nu);
    saveUsers(users);
    setUser(strip(nu));
    return { ok: true, mustReset: true };
  };

  const resetPassword: AuthCtx['resetPassword'] = (newPassword) => {
    if (!user) return;
    const users = loadUsers().map((u) =>
      u.email === user.email ? { ...u, password: newPassword, mustResetPassword: false } : u);
    saveUsers(users);
    setUser({ ...user, mustResetPassword: false });
  };

  const logout = () => { setUser(null); setViewAsRole(null); };

  // This Area Of Code Is: Director-minted member accounts.
  // Explanation: The director creates a sound/media/track engineer (or any
  // member) with a password HE chooses; they must replace it with their own
  // on first login, and it lives only on their own device.
  const createMemberAccount: AuthCtx['createMemberAccount'] = (email, name, role, password) => {
    if (!user || user.role !== 'admin') return { ok: false, error: 'Directors only.' };
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
    if (!password.trim()) return { ok: false, error: 'Give them a hand-over password.' };
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: 'That email already has an account.' };
    }
    users.push({ email: clean, name: name.trim() || clean.split('@')[0], role, password, mustResetPassword: true });
    saveUsers(users);
    return { ok: true };
  };

  const allUsers = () => loadUsers().map(strip);

  const deleteUser: AuthCtx['deleteUser'] = (email) => {
    if (!user) return { ok: false, error: 'Not signed in.' };
    const users = loadUsers();
    const target = users.find((u) => u.email === email);
    if (!target) return { ok: false, error: 'User not found.' };
    if (target.isSuperAdmin) return { ok: false, error: 'The app creator cannot be removed.' };

    // SCN can remove anyone, alone. Other admins need a second admin vote.
    const needsVote = target.role === 'admin' && !user.isSuperAdmin;
    if (needsVote) {
      const votes = adminDeleteApprovals();
      const key = `${email}:${user.email}`;
      if (!votes.includes(key)) {
        votes.push(key);
        localStorage.setItem('ntcc.adminDeleteVotes', JSON.stringify(votes));
        return { ok: false, error: 'Admin removal recorded. A second admin must confirm.' };
      }
      const distinct = new Set(votes.filter((v) => v.startsWith(`${email}:`)).map((v) => v.split(':')[1]));
      if (distinct.size < 2) return { ok: false, error: 'Waiting on a second admin to confirm.' };
    }
    saveUsers(users.filter((u) => u.email !== email));
    return { ok: true };
  };

  const changeRole: AuthCtx['changeRole'] = (email, role) => {
    if (!user || user.role !== 'admin') return;
    saveUsers(loadUsers().map((u) => (u.email === email ? { ...u, role } : u)));
  };

  // This Area Of Code Is: One-tap staff account creation.
  // Explanation: Admin supplies the roster member's real email; we mint the
  // account with a readable temporary password ("Ntcc-XXXXXX") that MUST be
  // changed at first login, so the hand-over word is never the real key.
  const createStaffAccount: AuthCtx['createStaffAccount'] = (rosterIndex, email) => {
    if (!user || user.role !== 'admin') return { ok: false, error: 'Admins only.' };
    const entry = STAFF_ROSTER[rosterIndex];
    if (!entry) return { ok: false, error: 'Unknown roster entry.' };
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: 'That email already has an account.' };
    }
    const tempPassword = `Ntcc-${Math.random().toString(36).slice(2, 8)}`;
    users.push({ email: clean, name: entry.name, role: entry.role, password: tempPassword, mustResetPassword: true });
    saveUsers(users);
    return { ok: true, tempPassword };
  };

  const effectiveRole: Role = viewAsRole ?? user?.role ?? 'viewer';

  return (
    <Ctx.Provider value={{
      user, effectiveRole, viewAsRole, setViewAsRole,
      login, signup, resetPassword, logout, allUsers, deleteUser, changeRole, createStaffAccount, createMemberAccount, resetAppData,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
