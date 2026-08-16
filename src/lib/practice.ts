// ==========================================================================
// This Area Of Code Is: The Practice Ledger (serverless accountability).
// Explanation: Musicians press "Begin Practice" / "End Practice" and every
// session is stamped and stored ONLY on their own device (localStorage) —
// the app keeps no user data, so there is nothing to leak and no liability.
// Reports are due Saturday 8:00 AM; the musician hands the report file to
// the director through their device's own share sheet (email, AirDrop,
// Bluetooth). The director imports everyone's files and the app aggregates
// them into one accountability table and a CCLI-style combined report.
// In Other Words: Each musician carries their own practice diary; on
// Saturday morning they hand a copy to the director, who binds them into
// one book — the church never keeps the diaries.
// ==========================================================================

export interface PracticeSession {
  id: string;
  startedAt: number;          // epoch ms
  endedAt: number | null;     // null while practicing
  minutes: number;            // computed at end
  focus: string;              // what they practiced (song/part — optional)
}

export interface PracticeIdentity {
  /** Voluntary: "First name + last initial" (e.g. "Frederick T.") or an
   *  appropriate alias the director recognizes. */
  label: string;
  parts: string[];            // e.g. ['Soprano'], ['Keys','Bass'] — multi-part OK
  directorEmail: string;      // where the Saturday report goes
}

export interface PracticeReport {
  kind: 'ntcc-practice-report';
  version: 1;
  label: string;
  parts: string[];
  weekOf: string;             // ISO date of the Sunday starting the week
  generatedAt: number;
  sessions: PracticeSession[];
  totalMinutes: number;
  sessionCount: number;
  /** Login-token stamp: proves the report came from a signed-in device,
   *  protecting both church and musician legally. */
  stamp: string;
}

const SESSIONS_KEY = 'ntcc.practice.sessions';
const IDENTITY_KEY = 'ntcc.practice.identity';

// ---------- identity ----------
export function loadIdentity(): PracticeIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) return JSON.parse(raw) as PracticeIdentity;
  } catch { /* fall through */ }
  // Default the report destination to the church's director email
  // (set by the director in Admin → This Church), so reports "just go".
  let directorEmail = '';
  try {
    const cp = localStorage.getItem('ntcc.church.profile');
    if (cp) directorEmail = (JSON.parse(cp) as { reportEmail?: string }).reportEmail ?? '';
  } catch { /* fall through */ }
  return { label: '', parts: [], directorEmail };
}
export function saveIdentity(id: PracticeIdentity): void {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
}

// ---------- sessions ----------
export function loadSessions(): PracticeSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw) as PracticeSession[];
  } catch { /* fall through */ }
  return [];
}
function saveSessions(s: PracticeSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

export function activeSession(): PracticeSession | null {
  return loadSessions().find((s) => s.endedAt === null) ?? null;
}

export function beginPractice(focus = ''): PracticeSession {
  const s: PracticeSession = {
    id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    startedAt: Date.now(),
    endedAt: null,
    minutes: 0,
    focus,
  };
  saveSessions([...loadSessions(), s]);
  return s;
}

export function endPractice(): PracticeSession | null {
  const all = loadSessions();
  const open = all.find((s) => s.endedAt === null);
  if (!open) return null;
  open.endedAt = Date.now();
  open.minutes = Math.max(1, Math.round((open.endedAt - open.startedAt) / 60000));
  saveSessions(all);
  return open;
}

// ---------- the week (Sunday → Saturday, due Saturday 8:00 AM) ----------
export function weekStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

export function weekSessions(now = new Date()): PracticeSession[] {
  const start = weekStart(now).getTime();
  return loadSessions().filter((s) => s.startedAt >= start && s.endedAt !== null);
}

/** Is the Saturday 8 AM deadline close (or past) with an unsent report? */
export function reportDueState(now = new Date()): 'ok' | 'due-soon' | 'overdue' {
  const day = now.getDay();               // 0 Sun … 6 Sat
  const hour = now.getHours();
  if (day === 6 && hour >= 8) return 'overdue';
  if (day === 6 || (day === 5 && hour >= 18)) return 'due-soon';
  return 'ok';
}

function stamp(identity: PracticeIdentity): string {
  return `${identity.label || 'anonymous'} · ${new Date().toISOString()} · device-signed`;
}

export function buildReport(): PracticeReport {
  const identity = loadIdentity();
  const sessions = weekSessions();
  const totalMinutes = sessions.reduce((n, s) => n + s.minutes, 0);
  return {
    kind: 'ntcc-practice-report',
    version: 1,
    label: identity.label || 'Anonymous',
    parts: identity.parts,
    weekOf: weekStart().toISOString().slice(0, 10),
    generatedAt: Date.now(),
    sessions,
    totalMinutes,
    sessionCount: sessions.length,
    stamp: stamp(identity),
  };
}

/** Download the report file so the device can email/AirDrop it to the director. */
export function downloadReport(): void {
  const r = buildReport();
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `practice-report-${r.label.replace(/\s+/g, '') || 'musician'}-${r.weekOf}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Open the device's own email app addressed to the director. The report
 *  file is downloaded first; the musician attaches it before sending. */
export function emailReport(): void {
  const identity = loadIdentity();
  const r = buildReport();
  downloadReport();
  const subject = encodeURIComponent(`Practice Report — ${r.label} — week of ${r.weekOf}`);
  const body = encodeURIComponent(
    `Hi Director,\n\nAttached is my practice report for the week of ${r.weekOf}.\n` +
    `Total: ${r.totalMinutes} minutes across ${r.sessionCount} session(s).\n\n` +
    `(Attach the file that just downloaded — then press send.)\n\n— ${r.label}\n${r.stamp}`);
  const to = encodeURIComponent(identity.directorEmail || '');
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

/** Share through the device share sheet (AirDrop / Bluetooth / Messages). */
export async function shareReport(): Promise<boolean> {
  const r = buildReport();
  const file = new File([JSON.stringify(r, null, 2)],
    `practice-report-${r.label.replace(/\s+/g, '') || 'musician'}-${r.weekOf}.json`,
    { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Practice Report' });
      return true;
    }
  } catch { /* user cancelled or unsupported */ }
  downloadReport();
  return false;
}

// ---------- director side: import & aggregate ----------
export function parseReport(text: string): PracticeReport | null {
  try {
    const r = JSON.parse(text) as PracticeReport;
    if (r.kind === 'ntcc-practice-report' && Array.isArray(r.sessions)) return r;
  } catch { /* not a report */ }
  return null;
}

export interface AggregateRow {
  label: string;
  parts: string[];
  sessions: number;
  totalMinutes: number;
  weekOf: string;
  stamp: string;
}

export function aggregateReports(reports: PracticeReport[]): AggregateRow[] {
  return reports
    .map((r) => ({
      label: r.label, parts: r.parts, sessions: r.sessionCount,
      totalMinutes: r.totalMinutes, weekOf: r.weekOf, stamp: r.stamp,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** Combined CCLI-style text report the director can save/download/print. */
export function combinedReportText(reports: PracticeReport[]): string {
  const rows = aggregateReports(reports);
  const week = reports[0]?.weekOf ?? weekStart().toISOString().slice(0, 10);
  const lines = [
    'NTCCA MUSIC APP™ — WEEKLY PRACTICE ACCOUNTABILITY REPORT',
    `Week of ${week} · Generated ${new Date().toLocaleString()}`,
    'Due: Saturday 8:00 AM · Reports collected on the director\'s own device',
    '—'.repeat(60),
    `${'MUSICIAN'.padEnd(24)}${'PART(S)'.padEnd(20)}${'SESSIONS'.padStart(9)}${'MINUTES'.padStart(9)}`,
    '—'.repeat(60),
    ...rows.map((r) =>
      `${r.label.padEnd(24)}${(r.parts.join(', ') || '—').padEnd(20)}` +
      `${String(r.sessions).padStart(9)}${String(r.totalMinutes).padStart(9)}`),
    '—'.repeat(60),
    `TOTAL: ${rows.reduce((n, r) => n + r.sessions, 0)} sessions · ` +
    `${rows.reduce((n, r) => n + r.totalMinutes, 0)} minutes · ${rows.length} musician(s)`,
    '',
    'Stamps (device-signed login tokens):',
    ...rows.map((r) => `  · ${r.label}: ${r.stamp}`),
  ];
  return lines.join('\n');
}

export function downloadCombinedReport(reports: PracticeReport[]): void {
  const blob = new Blob([combinedReportText(reports)], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `combined-practice-report-${reports[0]?.weekOf ?? 'week'}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
