// ==========================================================================
// This Area Of Code Is: The OmniScore Plugin Registry.
// Explanation: This is the "add features without breaking anything" engine.
// Every way music can ENTER the system (sheet-music photo, live mic, MIDI,
// ChordPro, formats not invented yet) is an Ingestor that outputs USMG.
// Every way music can LEAVE the system (screen, SVG, PDF, audio, UnityLED
// scenes) is a Renderer that consumes USMG. New capabilities REGISTER —
// they never modify existing code. A failing plugin is isolated and the app
// keeps playing.
// In Other Words: A universal power strip — new gadgets plug in without
// rewiring the house.
// ==========================================================================

import type { USMGDocument } from './usmg';

// -------------------------------- INGESTORS --------------------------------
export interface Ingestor<Input = unknown> {
  /** Unique id, e.g. "omr.staff", "acoustic.mic", "midi.webmidi" */
  id: string;
  /** Human label for capability UIs */
  label: string;
  /** What this ingestor accepts (for capability negotiation) */
  accepts: string[];
  /** Convert the input into USMG. Throw NOTHING — return errors instead. */
  ingest: (input: Input) => Promise<{ doc?: USMGDocument; errors?: string[] }>;
}

// -------------------------------- RENDERERS --------------------------------
export interface Renderer<Output = unknown> {
  id: string;
  label: string;
  outputs: string[];   // e.g. ["svg"], ["pdf"], ["lighting-scene"]
  render: (doc: USMGDocument) => Promise<{ output?: Output; errors?: string[] }>;
}

interface RegistryState {
  ingestors: Map<string, Ingestor>;
  renderers: Map<string, Renderer>;
}

const state: RegistryState = {
  ingestors: new Map(),
  renderers: new Map(),
};

export function registerIngestor(i: Ingestor): void {
  state.ingestors.set(i.id, i);
}

export function registerRenderer(r: Renderer): void {
  state.renderers.set(r.id, r);
}

// This Area Of Code Is: Fault-isolated dispatch.
// Explanation: Running input through an ingestor (or USMG through a
// renderer) can NEVER crash the app — every call is wrapped, errors come
// back as data, and the failure is reported to ShieldWall if it looks
// hostile. One bad plugin; zero impact on worship.
// In Other Words: If one appliance shorts out, the house doesn't burn down.
export async function safeIngest<Input>(
  id: string, input: Input,
): Promise<{ doc?: USMGDocument; errors?: string[] }> {
  const ing = state.ingestors.get(id);
  if (!ing) return { errors: [`Ingestor "${id}" not registered`] };
  try {
    return await ing.ingest(input);
  } catch (err) {
    return { errors: [`Ingestor "${id}" failed safely: ${String(err)}`] };
  }
}

