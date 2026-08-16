// ==========================================================================
// This Area Of Code Is: The Accurate Rotating Globe.
// Explanation: A REAL Earth, drawn live on canvas with true orthographic
// (globe-from-space) projection of Natural Earth coastlines — every
// continent, real proportions, rotating west-to-east the way the planet
// actually turns, with ocean depth shading, a soft night-day terminator,
// and stars behind. No static sprite, no CSS trick: the math is the same
// math a 3D engine uses. Reduced-motion users get the resting globe.
// In Other Words: The world, accurate, turning the way the world turns.
// ==========================================================================

import { useEffect, useRef } from 'react';
import { WORLD_LAND } from '../lib/worldLand';

const D2R = Math.PI / 180;

export default function EarthOrb({ size = 40 }: { size?: number; tiltDeg?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = size * dpr;
    cv.width = S; cv.height = S;
    const R = S * 0.44, cx = S / 2, cy = S / 2;

    // Pre-rotate every coastline point to 3D unit vectors once.
    const rings = WORLD_LAND.map((ring) =>
      ring.map(([lon, lat]) => {
        const la = lat * D2R, lo = lon * D2R;
        return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)] as const;
      }));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let rot = 0;                       // radians of planetary rotation
    const start = performance.now();

    // A handful of stars, fixed per render.
    const stars = Array.from({ length: 26 }, (_, i) => ({
      x: ((i * 73) % 100) / 100, y: ((i * 41 + 17) % 100) / 100,
      r: (i % 3 === 0 ? 1.4 : 0.8) * dpr, a: 0.35 + ((i * 29) % 60) / 100,
    }));

    const draw = (now: number) => {
      // ~6° per second — calm, stately, true direction (west → east).
      if (!reduced) rot = ((now - start) / 1000) * 6 * D2R;
      const cr = Math.cos(rot), sr = Math.sin(rot);

      ctx.clearRect(0, 0, S, S);

      // Stars
      for (const st of stars) {
        ctx.globalAlpha = st.a;
        ctx.fillStyle = '#cdd7ff';
        ctx.beginPath(); ctx.arc(st.x * S, st.y * S, st.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ocean sphere — deep blue with a lit limb.
      const og = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      og.addColorStop(0, '#1e5ba8');
      og.addColorStop(0.7, '#123a6e');
      og.addColorStop(1, '#081c3a');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

      // Land — project each ring; draw only the visible hemisphere segments.
      ctx.fillStyle = '#3f8f4f';
      ctx.strokeStyle = '#2c6b3a';
      ctx.lineWidth = 0.6 * dpr;
      for (const ring of rings) {
        let open = false;
        ctx.beginPath();
        for (const [x0, y0, z0] of ring) {
          // Rotate around the vertical (Y) axis.
          const x = x0 * cr + z0 * sr;
          const z = -x0 * sr + z0 * cr;
          if (z <= 0.02) { open = false; continue; }   // far side — hidden
          const px = cx + x * R, py = cy - y0 * R;
          if (!open) { ctx.moveTo(px, py); open = true; } else ctx.lineTo(px, py);
        }
        ctx.fill();
      }

      // Soft night shadow on the trailing limb — depth, like the real thing.
      const sg = ctx.createRadialGradient(cx + R * 0.55, cy + R * 0.2, R * 0.2, cx, cy, R * 1.05);
      sg.addColorStop(0, 'rgba(0,0,20,0.45)');
      sg.addColorStop(0.6, 'rgba(0,0,20,0.12)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

      // Atmosphere rim.
      ctx.strokeStyle = 'rgba(140,190,255,0.55)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <span className="earth-orb" style={{ width: size, height: size }} role="img" aria-label="Rotating earth — accurate continents">
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block', borderRadius: '50%' }} aria-hidden="true" />
    </span>
  );
}
