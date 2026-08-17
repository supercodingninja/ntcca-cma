// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The CCLI monthly reporting engine — generates
// Excel-compatible .xlsx files from usage history for copyright compliance.
// Explanation: CCLI (Christian Copyright Licensing International) requires
// churches to report every song used in services each month. This engine
// reads the usage history from `src/lib/songs.ts`, groups by song, counts
// occurrences, and produces a 12-column Excel file: Song Title, Artist,
// CCLI Number, Copyright, Usage Count, Services Used, Last Used Date,
// Lead Singer, Key, Tempo, Duration, and Reporter Notes. The file is
// generated entirely in the browser using SheetJS (xlsx) — no server needed.
// In Other Words: The church secretary's monthly homework — automated,
// accurate, and ready to email to CCLI in one tap.
// ==========================================================================

import { getSongById, getUsageInRange, groupUsageBySong, type UsageRecord } from './songs';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface CCLIRow {
  'Song Title': string;
  Artist: string;
  'CCLI Number': string;
  Copyright: string;
  'Usage Count': number;
  'Services Used': string;
  'Last Used': string;
  'Lead Singer': string;
  Key: string;
  Tempo: number;
  Duration: string;
  'Reporter Notes': string;
}

// --------------------------------------------------------------------------
// Generate CCLI report for a month (YYYY-MM)
// --------------------------------------------------------------------------
export function generateCCLIReport(month: string): CCLIRow[] {
  // month = "2026-08" → range 2026-08-01 to 2026-08-31
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endDate = new Date(year, mon, 0); // last day of month
  const end = `${month}-${String(endDate.getDate()).padStart(2, '0')}`;

  const usageRecords = getUsageInRange(start, end);
  const grouped = groupUsageBySong(usageRecords);

  const rows: CCLIRow[] = [];
  for (const [songId, records] of grouped) {
    const song = getSongById(songId);
    if (!song) continue;

    const serviceTypes = [...new Set(records.map((r) => r.serviceType))];
    const lastUsed = records.sort((a, b) => b.date.localeCompare(a.date))[0];
    const leadSingers = [...new Set(records.map((r) => r.leadSinger).filter(Boolean))];

    rows.push({
      'Song Title': song.title,
      Artist: song.artist,
      'CCLI Number': song.ccliNumber ?? '',
      Copyright: song.copyrightInfo ?? '',
      'Usage Count': records.length,
      'Services Used': serviceTypes.join(', '),
      'Last Used': lastUsed?.date.slice(0, 10) ?? '',
      'Lead Singer': leadSingers.join(', ') || song.leadSinger ?? '',
      Key: song.key,
      Tempo: song.bpm,
      Duration: song.duration ?? '',
      'Reporter Notes': records.map((r) => r.notes).filter(Boolean).join('; ') || '',
    });
  }

  // Sort by usage count descending, then by title
  rows.sort((a, b) => {
    if (b['Usage Count'] !== a['Usage Count']) {
      return b['Usage Count'] - a['Usage Count'];
    }
    return a['Song Title'].localeCompare(b['Song Title']);
  });

  return rows;
}

// --------------------------------------------------------------------------
// Export to .xlsx (SheetJS)
// --------------------------------------------------------------------------
export async function exportCCLIToExcel(month: string): Promise<Blob> {
  // Dynamic import so SheetJS is only loaded when needed
  const XLSX = await import('xlsx');
  const rows = generateCCLIReport(month);

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths: Record<string, number> = {
    A: 30, B: 20, C: 14, D: 35, E: 12,
    F: 25, G: 12, H: 18, I: 8, J: 8,
    K: 10, L: 30,
  };
  worksheet['!cols'] = Object.entries(colWidths).map(([_, w]) => ({ wch: w }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `CCLI ${month}`);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// --------------------------------------------------------------------------
// Download helper — triggers browser download
// --------------------------------------------------------------------------
export function downloadCCLIReport(month: string): void {
  exportCCLIToExcel(month).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CCLI_Report_${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// --------------------------------------------------------------------------
// Get available months from usage history
// --------------------------------------------------------------------------
export function getAvailableMonths(): string[] {
  const { loadUsageHistory } = require('./songs');
  const records = loadUsageHistory() as UsageRecord[];
  const months = new Set<string>();
  for (const r of records) {
    months.add(r.date.slice(0, 7)); // YYYY-MM
  }
  return Array.from(months).sort().reverse();
}

// --------------------------------------------------------------------------
// Summary stats for dashboard
// --------------------------------------------------------------------------
export interface CCLISummary {
  month: string;
  totalSongsUsed: number;
  totalUsages: number;
  uniqueServices: number;
}

export function getCCLISummaries(): CCLISummary[] {
  const months = getAvailableMonths();
  return months.map((month) => {
    const rows = generateCCLIReport(month);
    const allServices = new Set<string>();
    rows.forEach((r) => r['Services Used'].split(', ').forEach((s) => allServices.add(s)));
    return {
      month,
      totalSongsUsed: rows.length,
      totalUsages: rows.reduce((sum, r) => sum + r['Usage Count'], 0),
      uniqueServices: allServices.size,
    };
  });
}
