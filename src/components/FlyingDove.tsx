// ==========================================================================
// This Area Of Code Is: The Flying Dove.
// Explanation: On a holy schedule, the dove literally leaves the emblem,
// lifts off, and flies across the whole viewport the way real birds fly —
// never a straight line: sine-wave wander, a gentle climb, banking into
// its turns, flapping wings with sudden glides. It fades into glory off
// the far edge, then returns to the emblem… until the next flight.
// Saints under Calm / No-Flash / reduced-motion receive a resting dove.
// In Other Words: The Spirit doesn't stay in the logo — He moves.
// ==========================================================================
import { useEffect, useRef } from 'react';

export default function FlyingDove() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const still = () =>
      document.documentElement.dataset.calm === 'on' ||
      document.documentElement.dataset.noFlash === 'on';
    if (reduced) return;

    let raf = 0;
    let flying = false;
    let alive = true; // false only when the component unmounts — kills the loop cleanly

    const launch = () => {
      if (flying || still()) return;
      flying = true;
      const emblem = document.querySelector('.brand-emblem, .brand-morph')?.getBoundingClientRect();
      const startX = emblem ? emblem.left + emblem.width / 2 : window.innerWidth / 2;
      const startY = emblem ? emblem.top + emblem.height / 2 : 120;

      // Random flight plan — like a real bird choosing its sky
      const dir = Math.random() < 0.5 ? 1 : -1;               // exits left or right
      const T = 5200 + Math.random() * 1800;                  // flight duration
      const A1 = 30 + Math.random() * 40;                     // big lazy swoops
      const A2 = 10 + Math.random() * 14;                     // small feather trembles
      const f1 = (1 + Math.random()) / 1000;
      const f2 = (2.2 + Math.random() * 2) / 1000;
      const p1 = Math.random() * Math.PI * 2;
      const p2 = Math.random() * Math.PI * 2;
      const climb = 60 + Math.random() * 140;                 // birds rise as they go
      const travel = window.innerWidth + 480;

      el.style.display = 'block';
      el.style.opacity = '1';
      const img = el.querySelector('img');
      if (img) { img.style.animationPlayState = 'running'; }
      let glideUntil = 0;
      const t0 = performance.now();

      const frame = (now: number) => {
        if (!alive) return;
        const t = now - t0;
        const k = Math.min(t / T, 1);
        if (k >= 1) {
          el.style.transition = 'opacity 700ms ease';
          el.style.opacity = '0';
          window.setTimeout(() => { el.style.display = 'none'; el.style.transition = ''; flying = false; }, 720);
          return; // flight complete — the emblem books the next one
        }
        const x = startX + dir * (k * travel) - 40;
        const y = startY - climb * k
          + A1 * Math.sin(2 * Math.PI * f1 * t + p1)
          + A2 * Math.sin(2 * Math.PI * f2 * t + p2);
        // Bank into the turn — rotation follows the slope of flight
        const slope = (-climb / travel) * dir
          + (A1 * 2 * Math.PI * f1 * Math.cos(2 * Math.PI * f1 * t + p1)
           + A2 * 2 * Math.PI * f2 * Math.cos(2 * Math.PI * f2 * t + p2)) / (travel / T) * 60;
        const bank = Math.max(-26, Math.min(26, slope * dir * 24));
        // Grow slightly as it nears the viewer, settle as it departs
        const scale = 0.55 + Math.sin(Math.PI * k) * 0.85;
        el.style.transform =
          `translate(${x}px, ${y}px) rotate(${bank}deg) scale(${scale}) scaleX(${dir})`;

        // Flap… then glide… then flap again — pure bird
        if (img) {
          if (now > glideUntil && Math.random() < 0.012) {
            glideUntil = now + 700 + Math.random() * 800;
            img.style.animationPlayState = 'paused';
          } else if (now > glideUntil) {
            img.style.animationPlayState = 'running';
          }
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    // The dove flies ONLY when the emblem's Act IV calls for him
    const onLaunch = () => launch();
    document.addEventListener('ntcc:dove-launch', onLaunch);

    return () => { alive = false; document.removeEventListener('ntcc:dove-launch', onLaunch); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={ref} className="flying-dove" aria-hidden="true" style={{ display: 'none' }}>
      <img src="/dove-fly.png" alt="" draggable={false} />
    </div>
  );
}
