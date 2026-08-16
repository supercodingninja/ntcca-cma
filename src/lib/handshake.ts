// ==========================================================================
// This Area Of Code Is: The Viewport Handshake Protocol.
// Explanation: Before the app shows anything, it SHAKES HANDS with the
// device: it reads the browser's true viewport, pixel ratio, orientation,
// and safe-area, then declares one device class (phone / tablet / desktop /
// tv) and one EM scale on <body> — so every card, pill, and lyric renders
// correctly on THAT screen, always. The handshake re-fires on rotate and
// resize, and once per second for the first 5 seconds (mobile browsers lie
// about their height until the URL bar settles).
// In Other Words: The app asks the device "who are you?" — and dresses for
// exactly that device, every single time.
// ==========================================================================

export type DeviceClass = 'phone' | 'tablet' | 'desktop' | 'tv';

export interface Handshake {
  device: DeviceClass;
  width: number;
  height: number;
  ratio: number;
  orientation: 'portrait' | 'landscape';
  scale: number;   // root EM scale multiplier
  touch: boolean;
}

export function shakeHands(): Handshake {
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  const orientation: Handshake['orientation'] = width >= height ? 'landscape' : 'portrait';
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const short = Math.min(width, height);
  const device: DeviceClass =
    short < 600 ? 'phone' :
    short < 1024 ? 'tablet' :
    width >= 1920 && !touch ? 'tv' : 'desktop';

  // EM scale: phones breathe, tablets settle, desktops tighten.
  const scale =
    device === 'phone' ? Math.min(1.18, Math.max(0.94, width / 390)) :
    device === 'tablet' ? Math.min(1.12, Math.max(1.0, width / 820)) :
    1;

  return { device, width, height, ratio, orientation, scale, touch };
}

export function applyHandshake(h: Handshake): void {
  const b = document.body;
  b.dataset.viewportClass = h.device;
  b.dataset.orientation = h.orientation;
  b.style.setProperty('--vscale', String(h.scale));
  document.documentElement.style.fontSize = `${16 * h.scale}px`;
  // True viewport height unit for mobile URL-bar drift
  document.documentElement.style.setProperty('--vh', `${h.height * 0.01}px`);
}

/** Fire the handshake now and keep it honest. */
export function startHandshake(): () => void {
  const run = () => applyHandshake(shakeHands());
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  window.visualViewport?.addEventListener('resize', run);
  // Mobile browsers lie at first — re-shake briefly.
  const early = window.setInterval(run, 1000);
  window.setTimeout(() => window.clearInterval(early), 5000);
  return () => {
    window.removeEventListener('resize', run);
    window.removeEventListener('orientationchange', run);
    window.visualViewport?.removeEventListener('resize', run);
    window.clearInterval(early);
  };
}
