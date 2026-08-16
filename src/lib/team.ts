// ==========================================================================
// This Area Of Code Is: The Choir & Band Roster (director-kept).
// Explanation: The safest place for names is the DIRECTOR'S device — not a
// server. The director enters choir member names, divides them into
// sections (Soprano / Alto / Tenor / Bass) with section leads, and lists
// the band. Members may sing/play more than one part. Musicians pick their
// own parts from this roster on their own devices; the director always
// knows who is who.
// In Other Words: One seating chart, kept by the director, readable by
// every stand.
// ==========================================================================

export const CHOIR_SECTIONS = ['Soprano', 'Alto', 'Tenor', 'Bass'] as const;
export type ChoirSection = (typeof CHOIR_SECTIONS)[number];

export interface ChoirMember {
  id: string;
  name: string;                 // as the director knows them
  sections: ChoirSection[];     // multi-part allowed
  isLead: boolean;              // section lead
}

export interface BandMember {
  id: string;
  name: string;
  instruments: string[];        // e.g. ['Keys','Organ'] — multi allowed
}

export interface TeamRoster {
  choir: ChoirMember[];
  band: BandMember[];
}

const ROSTER_KEY = 'ntcc.team.roster';

export function loadRoster(): TeamRoster {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (raw) return JSON.parse(raw) as TeamRoster;
  } catch { /* fall through */ }
  return { choir: [], band: [] };
}

export function saveRoster(r: TeamRoster): void {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(r));
}

const uid = () => `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function addChoirMember(name: string, sections: ChoirSection[] = [], isLead = false): TeamRoster {
  const r = loadRoster();
  r.choir.push({ id: uid(), name: name.trim(), sections, isLead });
  saveRoster(r);
  return r;
}

export function updateChoirMember(id: string, patch: Partial<ChoirMember>): TeamRoster {
  const r = loadRoster();
  r.choir = r.choir.map((m) => (m.id === id ? { ...m, ...patch } : m));
  saveRoster(r);
  return r;
}

export function removeChoirMember(id: string): TeamRoster {
  const r = loadRoster();
  r.choir = r.choir.filter((m) => m.id !== id);
  saveRoster(r);
  return r;
}

export function addBandMember(name: string, instruments: string[] = []): TeamRoster {
  const r = loadRoster();
  r.band.push({ id: uid(), name: name.trim(), instruments });
  saveRoster(r);
  return r;
}

export function updateBandMember(id: string, patch: Partial<BandMember>): TeamRoster {
  const r = loadRoster();
  r.band = r.band.map((m) => (m.id === id ? { ...m, ...patch } : m));
  saveRoster(r);
  return r;
}

export function removeBandMember(id: string): TeamRoster {
  const r = loadRoster();
  r.band = r.band.filter((m) => m.id !== id);
  saveRoster(r);
  return r;
}

/** Roster portability: director exports the seating chart as a file and
 *  loads it on any of his devices (his screen, his choice). */
export function exportRoster(): void {
  const blob = new Blob([JSON.stringify(loadRoster(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ntcca-team-roster.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importRoster(text: string): TeamRoster | null {
  try {
    const r = JSON.parse(text) as TeamRoster;
    if (Array.isArray(r.choir) && Array.isArray(r.band)) {
      saveRoster(r);
      return r;
    }
  } catch { /* not a roster */ }
  return null;
}
