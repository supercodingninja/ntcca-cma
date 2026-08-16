// ==========================================================================
// This Area Of Code Is: UnityConductor.ts — the integration layer
// (Unity Solution™ file 2 of 4).
// Explanation: One tempo, everywhere. Whatever sets the tempo (conductor
// blinks, tap tempo, MIDI clock), the conductor distributes it: the
// metronome follows, UnityLED scenes pulse on the beat, MIDI gear receives
// timing clock, and every other device running this app syncs over
// BroadcastChannel.
//
// SATELLITE SYNC — the fix we agreed on: remote phones/tablets acting as
// satellite light/tempo nodes drifted because each device trusted its own
// clock. The cure is a coordinated-timing HANDSHAKE between one master and
// its satellites, modeled on NTP: a satellite pings the master with its
// send-time; the master answers with both its receive-time and answer-time;
// the satellite computes clock offset = ((t1 - t0) + (t2 - t3)) / 2 and
// round-trip delay, then stamps every future tempo/beat event on the
// MASTER'S clock. Satellites that drift beyond tolerance re-handshake
// automatically. The master is elected deterministically (lowest node id),
// and if the master goes silent, the lowest surviving satellite takes over
// — the mesh heals itself.
// In Other Words: One leader blinks, every phone in the room shakes hands
// to agree on what time it is, and then every screen, light, and
// instrument marches to the same heartbeat — even if their own clocks are
// wrong.
// ==========================================================================

import type { TempoChange } from './midi';
import { unityMidi } from './UnityMidi';

type Listener = (t: TempoChange) => void;
type SyncListener = (s: SyncState) => void;

const CHANNEL = 'ntcca.unity.tempo';
const SYNC_CHANNEL = 'ntcca.unity.sync';
const SYNC_INTERVAL_MS = 2000;      // handshake cadence
const MASTER_TIMEOUT_MS = 6000;     // master considered dead after this
const RESYNC_TOLERANCE_MS = 40;     // re-handshake if offset drifts past this

export interface SyncState {
  role: 'master' | 'satellite' | 'standalone';
  nodeId: string;
  masterId: string | null;
  offsetMs: number;        // satellite's clock offset from master
  rttMs: number;           // last handshake round-trip time
  satellites: number;      // how many nodes the master can see
  synced: boolean;
}

// Wire messages for the sync handshake.
interface PingMsg { kind: 'ping'; from: string; t0: number; }
interface PongMsg { kind: 'pong'; to: string; from: string; t0: number; t1: number; t2: number; }
interface HeartbeatMsg { kind: 'heartbeat'; from: string; at: number; }
type SyncMsg = PingMsg | PongMsg | HeartbeatMsg;

class UnityConductorService {
  private listeners: Listener[] = [];
  private syncListeners: SyncListener[] = [];
  private channel: BroadcastChannel | null = null;
  private syncChannel: BroadcastChannel | null = null;
  private clockTimer: number | null = null;
  private syncTimer: number | null = null;
  current: TempoChange | null = null;

  // Mesh identity and state
  private nodeId = crypto.randomUUID();
  private masterId: string | null = null;
  private lastMasterBeat = 0;
  private offsetMs = 0;
  private rttMs = 0;
  private peers = new Map<string, number>(); // nodeId -> last seen

  constructor() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<TempoChange>) => {
        // Accept tempo only from the elected master (or when we ARE master).
        if (!this.masterId || this.isMaster()) this.apply(e.data, false);
      };
      this.syncChannel = new BroadcastChannel(SYNC_CHANNEL);
      this.syncChannel.onmessage = (e: MessageEvent<SyncMsg>) => this.onSyncMsg(e.data);
      this.startMesh();
    }
    void unityMidi.init();
  }

  // ── Mesh election + handshake ─────────────────────────────────────────

  private isMaster(): boolean { return this.masterId === this.nodeId; }

  private startMesh(): void {
    // Announce ourselves; election = lowest node id among live peers.
    this.peers.set(this.nodeId, Date.now());
    this.heartbeat();
    this.syncTimer = window.setInterval(() => {
      this.pruneDead();
      this.elect();
      if (this.isMaster()) this.heartbeat();
      else this.handshake();
      this.emitSync();
    }, SYNC_INTERVAL_MS);
  }

  private heartbeat(): void {
    this.lastMasterBeat = Date.now();
    this.syncChannel?.postMessage({ kind: 'heartbeat', from: this.nodeId, at: Date.now() } as HeartbeatMsg);
  }

  private pruneDead(): void {
    const now = Date.now();
    for (const [id, seen] of this.peers) if (now - seen > MASTER_TIMEOUT_MS) this.peers.delete(id);
  }

  private elect(): void {
    const alive = [...this.peers.keys()].sort();
    const top = alive[0] ?? this.nodeId;
    if (this.masterId !== top) {
      this.masterId = top;
      this.offsetMs = 0; // master changed — must re-handshake
    }
    // If master went quiet and we are next in line, election promotes us.
    if (!this.isMaster() && Date.now() - this.lastMasterBeat > MASTER_TIMEOUT_MS) {
      const survivors = [...this.peers.keys()].sort();
      this.masterId = survivors[0] ?? this.nodeId;
    }
  }

  private handshake(): void {
    // Satellite → master ping; master answers; offset math happens in onSyncMsg.
    this.syncChannel?.postMessage({ kind: 'ping', from: this.nodeId, t0: Date.now() } as PingMsg);
  }

  private onSyncMsg(m: SyncMsg): void {
    const now = Date.now();
    if (m.kind === 'heartbeat') {
      this.peers.set(m.from, now);
      if (m.from === this.masterId) this.lastMasterBeat = now;
      return;
    }
    if (m.kind === 'ping') {
      this.peers.set(m.from, now);
      if (this.isMaster()) {
        this.syncChannel?.postMessage({
          kind: 'pong', to: m.from, from: this.nodeId,
          t0: m.t0, t1: now, t2: Date.now(),
        } as PongMsg);
      }
      return;
    }
    // pong — only the addressed satellite consumes it
    if (m.to !== this.nodeId) return;
    const t3 = Date.now();
    const offset = ((m.t1 - m.t0) + (m.t2 - t3)) / 2;
    const rtt = (t3 - m.t0) - (m.t2 - m.t1);
    // Accept immediately if unsynced; afterward only correct real drift.
    if (Math.abs(offset - this.offsetMs) > RESYNC_TOLERANCE_MS || this.offsetMs === 0) {
      this.offsetMs = offset;
    }
    this.rttMs = Math.max(0, rtt);
  }

  /** Master-clock time — every beat stamp in the mesh uses THIS. */
  masterNow(): number { return Date.now() + this.offsetMs; }

  private emitSync(): void {
    const s: SyncState = {
      role: this.isMaster() ? 'master' : (this.masterId ? 'satellite' : 'standalone'),
      nodeId: this.nodeId,
      masterId: this.masterId,
      offsetMs: Math.round(this.offsetMs),
      rttMs: Math.round(this.rttMs),
      satellites: Math.max(0, this.peers.size - 1),
      synced: this.isMaster() || this.offsetMs !== 0,
    };
    this.syncListeners.forEach((fn) => fn(s));
  }

  onSync(fn: SyncListener): void { this.syncListeners.push(fn); }

  // ── Tempo distribution ────────────────────────────────────────────────

  onTempo(fn: Listener): void { this.listeners.push(fn); }

  /** Called by any tempo source (blink service, tap button, MIDI). */
  publish(t: TempoChange): void {
    this.apply(t, true);
  }

  private apply(t: TempoChange, rebroadcast: boolean): void {
    this.current = t;
    this.listeners.forEach((fn) => fn(t));
    if (rebroadcast) this.channel?.postMessage(t);

    // Drive MIDI timing clock at 24 PPQN.
    if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
    unityMidi.sendTempo(t);
    const pulseMs = (60 / t.bpm) / 24 * 1000;
    this.clockTimer = window.setInterval(() => unityMidi.sendClockPulse(), pulseMs);
  }

  stopClock(): void {
    if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
    this.clockTimer = null;
    unityMidi.sendStop();
  }

  destroy(): void {
    if (this.syncTimer !== null) window.clearInterval(this.syncTimer);
    this.stopClock();
  }
}

export const unityConductor = new UnityConductorService();
