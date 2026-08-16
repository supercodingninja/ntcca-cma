// ==========================================================================
// This Area Of Code Is: Stage Lights — REAL wireless light control.
// Explanation: The app speaks to lights people can actually buy:
//   • WLED controllers (ESP32 stage LED tape/pars, ~$20-40 each) — open
//     firmware, plain HTTP JSON over the church WiFi. Industry favorite
//     for theater skits on a budget.
//   • Philips Hue (consumer bulbs + bridge) — the living-room option.
// No cloud, no subscription: the phone talks straight to the light on the
// local network. Scenes are designed per service moment and fired live.
// In Other Words: The phone becomes the light board.
// ==========================================================================

export type LightKind = 'wled' | 'hue';

export interface LightDevice {
  id: string;
  name: string;
  kind: LightKind;
  /** WLED: "192.168.1.50" · Hue: bridge IP, e.g. "192.168.1.2" */
  address: string;
  /** Hue only: the bridge user key + group number */
  hueUser?: string;
  hueGroup?: string;
}

export interface SceneStep {
  label: string;
  /** RGB the light should show */
  color: [number, number, number];
  /** Brightness 1–255 */
  bri: number;
  /** WLED effect id: 0 = solid, 2 = breathe, 12 = ripple, 105 = fire */
  fx: number;
}

// Service & skit moments — tuned for a sanctuary stage.
export const SCENES: Record<string, SceneStep> = {
  verse:       { label: 'Verse',       color: [64, 96, 200],  bri: 110, fx: 2 },
  chorus:      { label: 'Chorus',      color: [255, 200, 90], bri: 220, fx: 2 },
  bridge:      { label: 'Bridge',      color: [150, 80, 220], bri: 150, fx: 12 },
  altar:       { label: 'Altar call',  color: [255, 240, 210], bri: 70, fx: 2 },
  celebration: { label: 'Celebration', color: [255, 120, 40], bri: 255, fx: 105 },
  blackout:    { label: 'Blackout',    color: [0, 0, 0],      bri: 0,   fx: 0 },
};

const STORE_KEY = 'ntcc.stageLights';
const FOLLOW_KEY = 'ntcc.lightsFollow';

export function loadLights(): LightDevice[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as LightDevice[]; }
  catch { return []; }
}
export function saveLights(lights: LightDevice[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(lights));
}

export function followEnabled(): boolean { return localStorage.getItem(FOLLOW_KEY) === '1'; }
export function setFollowEnabled(on: boolean): void { localStorage.setItem(FOLLOW_KEY, on ? '1' : '0'); }

// This Area Of Code Is: The wire protocol.
// Explanation: WLED accepts POST /json/state with {on,bri,seg:[{col,fx}]};
// Hue accepts PUT /api/{user}/groups/{g}/action with HSV. One SceneStep
// translates into both dialects. Every call has a timeout so a dead light
// never hangs the service.
// (The old withTimeout helper was removed: it could never return — every
// path ended in `throw 'unreachable'` — and callers already use
// AbortSignal.timeout directly.)

async function fireWLED(d: LightDevice, s: SceneStep): Promise<void> {
  const res = await fetch(`http://${d.address}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      s.bri === 0
        ? { on: false }
        : { on: true, bri: s.bri, seg: [{ col: [s.color], fx: s.fx, sx: 128, ix: 128 }] }
    ),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`${d.name} answered ${res.status}`);
}

async function fireHue(d: LightDevice, s: SceneStep): Promise<void> {
  const [r, g, b] = s.color.map((v) => v / 255);
  // RGB → Hue's HSV-ish hue/sat/bri
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const dlt = max - min;
  let h = 0;
  if (dlt > 0) {
    if (max === r) h = ((g - b) / dlt) % 6;
    else if (max === g) h = (b - r) / dlt + 2;
    else h = (r - g) / dlt + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  const sat = max === 0 ? 0 : dlt / max;
  const res = await fetch(
    `http://${d.address}/api/${d.hueUser}/groups/${d.hueGroup ?? '0'}/action`,
    {
      method: 'PUT',
      body: JSON.stringify(
        s.bri === 0
          ? { on: false }
          : { on: true, bri: s.bri, hue: Math.round(h / 360 * 65535), sat: Math.round(sat * 254) }
      ),
      signal: AbortSignal.timeout(4000),
    });
  if (!res.ok) throw new Error(`${d.name} answered ${res.status}`);
}

/** Fire one scene across every registered light. Reports per-light results. */
export async function fireScene(sceneKey: keyof typeof SCENES): Promise<string> {
  const lights = loadLights();
  if (lights.length === 0) return 'No lights registered yet — add one below.';
  const scene = SCENES[sceneKey];
  const results = await Promise.allSettled(
    lights.map((d) => (d.kind === 'wled' ? fireWLED(d, scene) : fireHue(d, scene)))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  return ok === lights.length
    ? `💡 ${scene.label} fired on all ${ok} light${ok > 1 ? 's' : ''}.`
    : `⚠️ ${scene.label} reached ${ok}/${lights.length} lights — check the missed ones are powered and on this WiFi.`;
}

/** Follow-the-song hook: SongView section changes can fire matching scenes. */
export function followSection(kind: string): void {
  if (!followEnabled()) return;
  const key = (kind in SCENES ? kind : 'verse') as keyof typeof SCENES;
  void fireScene(key);
}

/** Connection test — asks a WLED light for its info, or a Hue bridge for its config. */
export async function testLight(d: LightDevice): Promise<string> {
  try {
    if (d.kind === 'wled') {
      const res = await fetch(`http://${d.address}/json/info`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(String(res.status));
      const info = await res.json() as { name?: string; ver?: string };
      return `✅ ${d.name} answered — WLED ${info.ver ?? ''} (${info.name ?? 'light'}).`;
    }
    const res = await fetch(`http://${d.address}/api/${d.hueUser}/config`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    return `✅ ${d.name} bridge answered.`;
  } catch {
    return `❌ ${d.name} didn't answer — is it powered on and on the same WiFi as this phone?`;
  }
}
