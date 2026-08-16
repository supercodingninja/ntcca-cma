// ==========================================================================
// This Area Of Code Is: UnityMidi.ts — the Web MIDI service (file 3 of 4).
// Explanation: Opens the device's MIDI access (when available), lists
// outputs, and sends tempo/timing events to the worship band's gear. When
// no MIDI hardware exists (most phones), everything degrades gracefully —
// the conductor system still drives the app internally.
// In Other Words: The wire from the app to the band's instruments — and
// when there's no wire, the app keeps conducting anyway.
// ==========================================================================

import type { TempoChange } from './midi';

type MidiAccessLike = {
  outputs: Map<string, { send: (data: Uint8Array, ts?: number) => void; name?: string }>;
  onstatechange: (() => void) | null;
};

export class UnityMidiService {
  private access: MidiAccessLike | null = null;
  available = false;
  outputNames: string[] = [];

  /** Request Web MIDI access. Safe everywhere — resolves false if unsupported. */
  async init(): Promise<boolean> {
    try {
      const nav = navigator as unknown as {
        requestMIDIAccess?: (o?: { sysex?: boolean }) => Promise<MidiAccessLike>;
      };
      if (!nav.requestMIDIAccess) return false;
      this.access = await nav.requestMIDIAccess({ sysex: false });
      this.available = true;
      this.refreshOutputs();
      this.access.onstatechange = () => this.refreshOutputs();
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  private refreshOutputs(): void {
    if (!this.access) return;
    this.outputNames = [...this.access.outputs.values()].map((o) => o.name ?? 'MIDI output');
  }

  /**
   * Broadcast a tempo change as MIDI real-time Timing Clock.
   * MIDI clock = 24 pulses per quarter note (0xF8); we schedule nothing here —
   * the caller pulses at 24 PPQN derived from bpm. We also send Start (0xFA)
   * on first tempo so downstream gear locks in.
   */
  sendTempo(tempo: TempoChange): void {
    if (!this.available || !this.access) return;
    for (const out of this.access.outputs.values()) {
      try { out.send(new Uint8Array([0xfa]), tempo.ts); } catch { /* port busy */ }
    }
  }

  /** One timing-clock pulse — call 24× per beat at current bpm. */
  sendClockPulse(): void {
    if (!this.available || !this.access) return;
    for (const out of this.access.outputs.values()) {
      try { out.send(new Uint8Array([0xf8])); } catch { /* port busy */ }
    }
  }

  sendStop(): void {
    if (!this.available || !this.access) return;
    for (const out of this.access.outputs.values()) {
      try { out.send(new Uint8Array([0xfc])); } catch { /* port busy */ }
    }
  }
}

export const unityMidi = new UnityMidiService();
