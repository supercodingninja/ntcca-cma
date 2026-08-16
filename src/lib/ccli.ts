// ==========================================================================
// This Area Of Code Is: The CCLI Monthly Report (Excel export, spec #17).
// Explanation: Compiles every tracked field — song, artist, CCLI #, key,
// tempo, duration, lead singer, copyright, each performance date with its
// service type, practice counts, and the name of every user who logged or
// edited — into a real .xlsx workbook generated entirely on-device. Free
// forever: no server, no service, no cookies.
// In Other Words: One tap and the month's CCLI paperwork is done.
// ==========================================================================

import { loadHistory, serviceMeta, type HistoryEntry } from './tracking';
import type { Song } from './music';

// This Area Of Code Is: On-demand Excel engine loading.
// Explanation: The xlsx library is heavy, so I load it ONLY when someone
// actually exports a report — the app opens fast, and the Excel engine
// arrives in the background the moment it's needed.
// In Other Words: The truck only comes when you have something to ship.
// This Area Of Code Is: Report periods (daily / weekly / monthly / all-time).
// Explanation: CCLI asks for monthly numbers, but rehearsals need today's and
// the week needs its own — every variant filters the same history by date.
export type CCLIPeriod = 'day' | 'week' | 'month' | 'all';

export function periodLabel(period: CCLIPeriod): string {
  const now = new Date();
  if (period === 'day') return `Daily — ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
  if (period === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return `Week of ${monday.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }
  if (period === 'month') return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return 'All Time';
}

function periodStart(period: CCLIPeriod): Date | null {
  const now = new Date();
  if (period === 'all') return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - ((now.getDay() + 6) % 7));
  if (period === 'month') start.setDate(1);
  return start;
}

// This Area Of Code Is: Shared report assembly.
// Explanation: Export, AirDrop/Bluetooth share, and Print all need the SAME
// rows, so the table is built once here and each delivery method reuses it.
// In Other Words: One kitchen, three waiters.
export async function buildCCLIRows(songs: Song[], period: CCLIPeriod = 'month') {
  const month = periodLabel(period);
  const since = periodStart(period);
  const history = loadHistory().filter((h) => !since || new Date(h.date) >= since);

  const perfBySong = new Map<string, HistoryEntry[]>();
  const pracBySong = new Map<string, HistoryEntry[]>();
  history.forEach((h) => {
    const map = h.kind === 'performance' ? perfBySong : pracBySong;
    map.set(h.songId, [...(map.get(h.songId) ?? []), h]);
  });

  const rows = songs.map((s) => {
    const perfs = perfBySong.get(s.id) ?? [];
    const pracs = pracBySong.get(s.id) ?? [];
    const editors = [...new Set([...perfs, ...pracs].map((h) => h.byUser))].join(', ');
    return {
      'Song Title': s.title,
      'Artist': s.artist,
      'CCLI #': s.ccliNumber ?? '',
      'Copyright': s.copyrightInfo ?? s.credit,
      'Key': s.key,
      'Tempo (BPM)': s.bpm,
      'Duration': s.duration ?? '',
      'Lead Singer': s.leadSinger ?? '',
      'Times Performed': perfs.length,
      'Times Practiced': pracs.length,
      'Performance Dates & Services': perfs
        .map((p) => `${new Date(p.date).toLocaleDateString()} — ${serviceMeta(p.service).label}${p.dayLabel ? ` (${p.dayLabel})` : ''}`)
        .join('; '),
      'Logged/Edited By': editors,
    };
  });
  return { rows, month };
}

// This Area Of Code Is: The report as a real File (for sharing).
// Explanation: AirDrop and Bluetooth need an actual file object to hand to
// the phone's share sheet — this builds the workbook into a File in memory.
export async function buildCCLIFile(songs: Song[], period: CCLIPeriod = 'month'): Promise<File> {
  const XLSX = await import('xlsx');
  const { rows, month } = await buildCCLIRows(songs, period);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 40 }, { wch: 6 },
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    { wch: 60 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `CCLI ${month}`);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new File([out], `CCLI_Report_${month.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// This Area Of Code Is: AirDrop / Bluetooth sharing (the Find-A-Way).
// Explanation: On iPhone/Android the native share sheet IS AirDrop and
// Bluetooth — the Web Share API hands our Excel file straight to it. If the
// device can't share files, we fall back to a normal download.
// In Other Words: One tap → the phone's own share menu appears.
export async function shareCCLIReport(songs: Song[], period: CCLIPeriod = 'month'): Promise<'shared' | 'downloaded'> {
  const file = await buildCCLIFile(songs, period);
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const payload: ShareData = { files: [file], title: 'CCLI Report', text: 'CCLI usage report from the NTCCA Music App™' };
  if (nav.canShare?.(payload) && nav.share) {
    await nav.share(payload);
    return 'shared';
  }
  // Fallback: plain download.
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// This Area Of Code Is: Print-ready CCLI report.
// Explanation: Opens a clean, ink-friendly table in a new window and calls
// the printer. Print styles hide everything but the report itself.
export async function printCCLIReport(songs: Song[], period: CCLIPeriod = 'month'): Promise<void> {
  const { rows, month } = await buildCCLIRows(songs, period);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>CCLI Report — ${esc(month)}</title>
<style>
  body { font-family: Georgia, serif; color: #1a1a2e; margin: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { font-size: 12px; color: #555; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0ead8; }
  tr:nth-child(even) td { background: #fafaf5; }
</style></head><body>
<h1>NTCCA Music App™ — CCLI Usage Report</h1>
<p class="sub">${esc(month)} · Generated ${esc(new Date().toLocaleString())} · New Testament Christian Church, Graham WA</p>
<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${esc((r as Record<string, unknown>)[h])}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to print.');
  win.document.write(html);
  win.document.close();
}

export async function exportCCLIReport(songs: Song[], period: CCLIPeriod = 'month'): Promise<void> {
  const XLSX = await import('xlsx');
  const { rows, month } = await buildCCLIRows(songs, period);

  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths so the report reads clean in Excel.
  ws['!cols'] = [
    { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 40 }, { wch: 6 },
    { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    { wch: 60 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `CCLI ${month}`);
  XLSX.writeFile(wb, `CCLI_Report_${month.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`);
}
