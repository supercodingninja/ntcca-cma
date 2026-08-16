// ==========================================================================
// This Area Of Code Is: The Tracking Core — practice history, usage history,
// and service-type color coding (17-point MVP items 2,3,4,7 + spec #2).
// Explanation: Every practice and every performance is logged per song with
// a service type. Service types carry fixed colors; conferences get ONE
// color for all their services (morning listed above evening). All data is
// local-first (localStorage) so history never depends on a server.
// In Other Words: A perfect memory of what we sang, when we sang it, and
// when we practiced it — color-coded like the bulletin board.
// ==========================================================================

export type ServiceType =
  | 'sunday-morning' | 'sunday-evening' | 'thursday-midweek'
  | 'conference-spring' | 'conference-fall' | 'conference-regional'
  | 'practice';

export interface ServiceMeta {
  id: ServiceType;
  label: string;
  color: string;   // badge color — one per service, one per conference
  bold?: boolean;  // core weekly services render bold per spec
}

export const SERVICE_TYPES: ServiceMeta[] = [
  { id: 'sunday-morning', label: 'Sunday Morning Service', color: '#d4af37', bold: true },
  { id: 'sunday-evening', label: 'Sunday Evening Service', color: '#7851a9', bold: true },
  { id: 'thursday-midweek', label: 'Thursday Midweek Evening Service', color: '#2e8b8b', bold: true },
  { id: 'conference-spring', label: 'Spring Conference', color: '#e06666' },
  { id: 'conference-fall', label: 'Fall Conference', color: '#e69138' },
  { id: 'conference-regional', label: 'Regional Conference', color: '#6fa8dc' },
  { id: 'practice', label: 'Practice', color: '#8e8e93' },
];

export function serviceMeta(id: ServiceType): ServiceMeta {
  return SERVICE_TYPES.find((s) => s.id === id) ?? SERVICE_TYPES[0];
}

export interface HistoryEntry {
  id: string;
  songId: string;
  service: ServiceType;
  /** Day label for conferences: "Monday" … "Saturday" + morning/evening note */
  dayLabel?: string;
  date: string; // ISO
  byUser: string; // who logged it (tagged on CCLI report)
  kind: 'practice' | 'performance';
}

const KEY = 'ntcc.history';

export function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as HistoryEntry[]; }
  catch { return []; }
}

export function logEvent(
  songId: string, service: ServiceType, kind: 'practice' | 'performance',
  byUser: string, dayLabel?: string,
): HistoryEntry {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(), songId, service, kind, byUser,
    dayLabel, date: new Date().toISOString(),
  };
  const all = [entry, ...loadHistory()];
  localStorage.setItem(KEY, JSON.stringify(all));
  return entry;
}

/** Usage counts per song: performances, practices, last dates of each. */
export function songStats(songId: string): {
  performances: number; practices: number;
  lastPerformed?: HistoryEntry; lastPracticed?: HistoryEntry;
  recent: HistoryEntry[];
} {
  const mine = loadHistory().filter((h) => h.songId === songId);
  const perf = mine.filter((h) => h.kind === 'performance');
  const prac = mine.filter((h) => h.kind === 'practice');
  return {
    performances: perf.length,
    practices: prac.length,
    lastPerformed: perf[0],
    lastPracticed: prac[0],
    recent: mine.slice(0, 8),
  };
}

/** Format a history line per spec: bold service name + date, conference day above. */
export function formatEntry(e: HistoryEntry): string {
  const d = new Date(e.date).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const day = e.dayLabel ? `${e.dayLabel} — ` : '';
  return `${day}${d}`;
}
