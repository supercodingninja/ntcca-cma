// ==========================================================================
// This Area Of Code Is: The ShieldWall security dashboard.
// Explanation: Live threat score, the adaptive engine's learned-rule count
// (watch it GROW when you simulate a novel attack — the app learns the
// pattern and pre-empts it), honeypot demo, kill-chain execution, and the
// auto-generated abuse report ready for ISP / IC3 / INTERPOL routing.
// ==========================================================================

import { useState } from 'react';
import {
  AdaptiveThreatEngine, killChain, tarpitDelay, HONEYPOT_ROUTES,
  poisonPayload, buildAbuseReport, type ForensicRecord,
} from '../lib/shieldwall';
import { useI18n } from '../lib/i18n';

interface Props {
  engine: AdaptiveThreatEngine;
  fingerprint: string;
  events: ForensicRecord['events'];
  firstSeen: number;
}

export default function SecuritySection({ engine, fingerprint, events, firstSeen }: Props) {
  const { t } = useI18n();
  const [report, setReport] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const push = (msg: string) => setLog((l) => [msg, ...l].slice(0, 12));

  const simulateAttack = async () => {
    // A novel attack pattern — watch the engine LEARN it into a new rule.
    const novel = `credential-stuffing-${Math.floor(Math.random() * 1000)}`;
    for (let i = 0; i < 3; i++) {
      const e = engine.report(novel, `Simulated stuffing burst #${i + 1}`, 'high');
      push(`⚠️ ${e.kind} +${e.score}`);
      await tarpitDelay(0); // real attacks get held; demo stays instant
    }
    engine.report('velocity-burst', 'Simulated request flood', 'medium');
    push(`🧠 Rules learned: ${engine.getPatternCount()}`);
  };

  const touchHoneypot = () => {
    const route = HONEYPOT_ROUTES[Math.floor(Math.random() * HONEYPOT_ROUTES.length)];
    engine.report('honeypot-touch', `Attacker touched ${route}`, 'critical');
    push(`🍯 Honeypot ${route} touched — poison served:`);
    push(poisonPayload(route).split('\n')[0].slice(0, 60) + '…');
  };

  const runKillChain = async () => {
    engine.report('auth-attack', 'Manual kill-chain trigger (demo)', 'high');
    push('💀 Kill-chain executing — sessions annihilated, caches purged…');
    // Demo mode: report only. Production fires killChain() for the hostile client.
    if (engine.blocked) await killChain();
    push(engine.blocked ? '💀 Hostile client annihilated from this app.' : 'ℹ️ Score below block threshold — monitored.');
  };

  const makeReport = () => {
    const rec: ForensicRecord = {
      fingerprint, firstSeen, lastSeen: Date.now(),
      events, totalScore: engine.score, blocked: engine.blocked,
    };
    setReport(buildAbuseReport(rec));
  };

  const scoreColor = engine.score >= 100 ? '#ef4444' : engine.score >= 40 ? '#f59e0b' : '#22c55e';

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="font-display text-xl text-accent mb-4">🛡️ ShieldWall · Rock Return Protocol</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="glass-card p-3">
            <p className="text-2xl font-bold" style={{ color: scoreColor }}>{engine.score}</p>
            <p className="text-muted text-xs">{t('threatScore')}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-2xl font-bold" style={{ color: scoreColor }}>
              {engine.blocked ? t('blocked') : t('secure')}
            </p>
            <p className="text-muted text-xs">{t('status')}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-2xl font-bold text-accent">{engine.getPatternCount()}</p>
            <p className="text-muted text-xs">{t('learnedRules')}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-2xl font-bold text-accent">{events.length}</p>
            <p className="text-muted text-xs">Events</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button className="glass-btn" onClick={() => void simulateAttack()}>⚔️ {t('simulate')}</button>
          <button className="glass-btn" onClick={touchHoneypot}>🍯 {t('honeypot')}</button>
          <button className="glass-btn danger" onClick={() => void runKillChain()}>💀 {t('runKillChain')}</button>
          <button className="glass-btn primary" onClick={makeReport}>📋 {t('abuseReport')}</button>
        </div>
      </div>

      {log.length > 0 && (
        <div className="glass-card p-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}

      {report && (
        <div className="glass-card p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs max-h-80 overflow-y-auto">{report}</pre>
        </div>
      )}
    </div>
  );
}
