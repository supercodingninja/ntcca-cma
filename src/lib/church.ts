// ==========================================================================
// This Area Of Code Is: The Church Subdomain System (graham.praises.team).
// Explanation: Every church gets its own front door — graham.praises.team,
// tacoma.praises.team, and so on. The app reads the subdomain from the
// browser address and becomes THAT church's app: its name on the login
// screen, its own accounts, its own stream. No subdomain (demo file,
// localhost)? The director sets the church code once in Admin, or you can
// test with ?church=graham in the address. Per-church data is namespaced
// so 100+ churches never see each other's things.
// In Other Words: One app, a hundred church doors — the address tells the
// app whose sanctuary you just walked into.
// ==========================================================================

export interface ChurchProfile {
  /** subdomain code, e.g. "graham" ("ntcca" = the organization door) */
  code: string;
  /** display name, e.g. "NTCC Graham, WA" */
  name: string;
  /** the church's default live stream link (YouTube Live / MP4) */
  streamUrl: string;
  /** where musicians email their Saturday practice reports */
  reportEmail: string;
}

const PROFILE_KEY = 'ntcc.church.profile';

import { findChurch } from './churches';

/** Read the church code from the browser address.
 *  graham.praises.team → "graham" · praises.team → "ntcca" (the org door)
 *  · ?church=graham → "graham" · else '' (demo file / localhost). */
export function subdomainChurchCode(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('church');
    if (q) {
      const clean = q.toLowerCase().replace(/[^a-z0-9-]/g, '');
      // Real church codes are short city names ("graham", "tacoma"). A long
      // gibberish string is a corrupted value — ignore it, don't display it.
      if (clean && clean.length <= 24) return clean;
    }
    const host = window.location.hostname; // '' for file://
    if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return '';
    // Church doors exist ONLY under praises.team — never trust any other
    // host (preview URLs carry random labels that are NOT churches).
    if (host === 'praises.team' || host === 'www.praises.team') return 'ntcca';
    if (host.endsWith('.praises.team')) return host.split('.')[0].toLowerCase();
  } catch { /* fall through */ }
  return '';
}

export function loadChurchProfile(): ChurchProfile {
  try {
    // A viewer invite link can carry the church's stream once (?stream=...):
    // the device keeps it, so from then on the viewer just opens the app.
    const incoming = new URLSearchParams(window.location.search).get('stream');
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as ChurchProfile;
      const sub = subdomainChurchCode();
      let changed = false;
      // Older profiles may predate reportEmail — heal it without a duplicate key.
      let next: ChurchProfile = { ...p, reportEmail: p.reportEmail ?? '' };
      // Heal a corrupted code saved by an older build (random preview hosts
      // leaked in as 30+ character gibberish). Unknown long codes can never
      // be real church doors — reset to the default Graham door.
      if (!findChurch(next.code) && next.code.length > 24) {
        const door = sub || 'graham';
        next = { ...next, code: door, name: findChurch(door)?.name ?? `NTCC ${cap(door)}` };
        changed = true;
      }
      // Heal any corrupted name: the registry name ALWAYS wins.
      const known = findChurch(next.code);
      if (known && next.name !== known.name) { next = { ...next, name: known.name }; changed = true; }
      // The subdomain ALWAYS wins — the address is the church.
      if (sub && sub !== next.code) {
        next = { ...next, code: sub, name: findChurch(sub)?.name ?? next.name ?? `NTCC ${cap(sub)}` };
        changed = true;
      }
      if (incoming && incoming !== next.streamUrl) { next = { ...next, streamUrl: incoming }; changed = true; }
      if (changed) { saveChurchProfile(next); return next; }
      return next;
    }
  } catch { /* fall through */ }
  const sub = subdomainChurchCode() || 'graham';
  const entry = findChurch(sub);
  // A previously-corrupted name (random preview hosts) heals here: the
  // registry name ALWAYS wins when we know the church.
  const incoming = new URLSearchParams(window.location.search).get('stream') ?? '';
  return {
    code: sub,
    name: entry?.name ?? `NTCC ${cap(sub)}`,
    streamUrl: incoming,
    reportEmail: '',
  };
}

export function saveChurchProfile(p: ChurchProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Namespaced storage key so each church's data stays its own. */
