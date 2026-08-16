// ==========================================================================
// This Area Of Code Is: The Tracking section (MVP items 2,3,4,7).
// Explanation: Log practices and performances per song with service type,
// see color-coded history (bold weekly services, one color per conference),
// and per-song stats: times practiced, times performed, last dates.
// ==========================================================================

import { useMemo, useState } from 'react';
import { type Song } from '../lib/music';
import {
  logEvent, songStats, SERVICE_TYPES, serviceMeta, formatEntry,
  type ServiceType,
} from '../lib/tracking';
import { useAuth } from '../lib/auth';
import { exportCCLIReport, shareCCLIReport, printCCLIReport, type CCLIPeriod } from '../lib/ccli';

export default function HistorySection({ songs }: { songs: Song[] }) {
  const { user, effectiveRole } = useAuth();
  const canEdit = effectiveRole !== 'viewer';
  const [songId, setSongId] = useState(songs[0]?.id ?? '');
  const [service, setService] = useState<ServiceType>('sunday-morning');
  const [kind, setKind] = useState<'practice' | 'performance'>('performance');
  const [day, setDay] = useState('Sunday');
  const [version, setVersion] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [period, setPeriod] = useState<CCLIPeriod>('month');

  // The version counter is in the dependency list on purpose — logging an
  // event bumps it, so the stats and history refresh INSTANTLY on screen.
  const stats = useMemo(() => songStats(songId), [songId, version]);

  const log = () => {
    logEvent(songId, service, kind, user?.name ?? 'unknown',
      service.startsWith('conference') ? day : undefined);
    setVersion((n) => n + 1);
  };

  // CCLI export with visible status — never a silent button again.
  const exportReport = async () => {
    setExportStatus('⏳ Preparing Excel…');
    try {
      await exportCCLIReport(songs, period);
      setExportStatus('✅ Report downloaded — check your Downloads folder.');
    } catch (err) {
      setExportStatus(`⚠️ Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // AirDrop / Bluetooth: hands the Excel file to the phone's own share sheet.
  const shareReport = async () => {
    setExportStatus('⏳ Preparing to share…');
    try {
      const how = await shareCCLIReport(songs, period);
      setExportStatus(how === 'shared'
        ? '✅ Shared — AirDrop / Bluetooth sheet used.'
        : '✅ Sharing not available here — report downloaded instead.');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setExportStatus('Share cancelled.');
      } else {
        setExportStatus(`⚠️ Share failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
  };

  // Print: opens a clean paper-friendly table and calls the printer.
  const printReport = async () => {
    setExportStatus('⏳ Preparing print view…');
    try {
      await printCCLIReport(songs, period);
      setExportStatus('🖨 Print view opened.');
    } catch (err) {
      setExportStatus(`⚠️ Print failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const isConference = service.startsWith('conference');

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="glass-card p-5">
          <h2 className="text-accent font-semibold mb-3">Log Practice / Performance</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <select className="auth-input" value={songId} onChange={(e) => setSongId(e.target.value)} aria-label="Song">
              {songs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <select className="auth-input" value={service} onChange={(e) => setService(e.target.value as ServiceType)} aria-label="Service">
              {SERVICE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className="auth-input" value={kind} onChange={(e) => setKind(e.target.value as 'practice' | 'performance')} aria-label="Kind">
              <option value="performance">Performed in service</option>
              <option value="practice">Practiced</option>
            </select>
            {isConference && (
              <select className="auth-input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Conference day">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                  .map((d) => <option key={d}>{d}</option>)}
              </select>
            )}
          </div>
          <button className="cta-gold px-8 py-2.5 mt-3" onClick={log}>Log it</button>
        </div>
      )}

      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-display text-lg text-accent">
            {songs.find((s) => s.id === songId)?.title}
          </h3>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="auth-input !w-auto text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as CCLIPeriod)}
              aria-label="Report period"
            >
              <option value="day">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="all">All time</option>
            </select>
            <button className="glass-btn text-sm" onClick={() => void exportReport()}>
              📊 Export CCLI Excel
            </button>
            <button className="glass-btn text-sm" onClick={() => void shareReport()}>
              📤 Share / AirDrop
            </button>
            <button className="glass-btn text-sm" onClick={() => void printReport()}>
              🖨 Print
            </button>
          </div>
        </div>
        {exportStatus && <p className="text-sm mb-3">{exportStatus}</p>}
        <div className="flex gap-4 text-sm mb-4 flex-wrap">
          <span>Performed: <strong className="text-accent">{stats.performances}×</strong></span>
          <span>Practiced: <strong className="text-accent">{stats.practices}×</strong></span>
        </div>
        <ul className="space-y-2">
          {stats.recent.map((h) => {
            const meta = serviceMeta(h.service);
            return (
              <li key={h.id} className="flex items-center gap-3 text-sm flex-wrap">
                <span className="service-badge"
                      style={{ color: meta.color, borderColor: meta.color, fontWeight: meta.bold ? 800 : 600 }}>
                  {meta.label}
                </span>
                <span>{formatEntry(h)}</span>
                <span className="text-muted text-xs">· {h.kind} · by {h.byUser}</span>
              </li>
            );
          })}
          {stats.recent.length === 0 && (
            <li className="text-muted text-sm">No history yet for this song.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
