// ==========================================================================
// This Area Of Code Is: The score reader — full-viewport, pinch-zoomable.
// Explanation: A sheet-music page must be READABLE: one tap fills the
// whole screen, pinch with two fingers to zoom (also +/− and mouse
// wheel), drag to pan while zoomed, page arrows to turn. Built on pdf.js
// canvas rendering — no browser plugin quirks, works on every device.
// In Other Words: Sunday morning, no squinting. Ever.
// ==========================================================================
import { useEffect, useRef, useState } from 'react';

export default function PdfView({ url, name }: { url: string; name: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Load the document once
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const d = await pdfjs.getDocument({ url }).promise;
        if (!dead) setDoc(d as unknown as typeof doc);
      } catch { if (!dead) setErr('Could not open this PDF'); }
    })();
    return () => { dead = true; };
  }, [url]);

  // Render the current page at current zoom
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const p = await doc.getPage(page);
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const containerW = (wrapRef.current?.clientWidth ?? 800) - 8;
      const scale = (containerW / base.width) * zoom * (full ? 1.35 : 1);
      const vp = p.getViewport({ scale: scale * Math.min(window.devicePixelRatio || 1, 2) });
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = `${vp.width / Math.min(window.devicePixelRatio || 1, 2)}px`;
      canvas.style.height = `${vp.height / Math.min(window.devicePixelRatio || 1, 2)}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => { cancelled = true; };
  }, [doc, page, zoom, full]);

  // Pinch-to-zoom + drag-to-pan (touch), wheel zoom (desktop)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e: TouchEvent) => {
      if (e.touches.length === 2) { pinch.current = { d: dist(e.touches), z: zoom }; e.preventDefault(); }
      else if (e.touches.length === 1 && zoom > 1) {
        drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
      }
    };
    const tm = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch.current) {
        const z = Math.min(4, Math.max(0.6, pinch.current.z * (dist(e.touches) / pinch.current.d)));
        setZoom(z); e.preventDefault();
      } else if (e.touches.length === 1 && drag.current) {
        setPan({ x: drag.current.px + e.touches[0].clientX - drag.current.x, y: drag.current.py + e.touches[0].clientY - drag.current.y });
        e.preventDefault();
      }
    };
    const te = () => { pinch.current = null; drag.current = null; };
    const wh = (e: WheelEvent) => { if (e.ctrlKey || full) { setZoom((z) => Math.min(4, Math.max(0.6, z * (e.deltaY < 0 ? 1.1 : 0.9)))); e.preventDefault(); } };
    el.addEventListener('touchstart', ts, { passive: false });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('wheel', wh, { passive: false });
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wh); };
  }, [zoom, pan, full]);

  // Reset pan when zoom returns to 1
  useEffect(() => { if (zoom <= 1.01) setPan({ x: 0, y: 0 }); }, [zoom]);

  if (err) return <a className="text-gold underline" href={url} target="_blank" rel="noreferrer">⬇ Open {name}</a>;

  return (
    <div className={`pdf-stage ${full ? 'pdf-full' : ''}`}>
      <div className="pdf-bar">
        <span className="pdf-title">🎼 {name}</span>
        <span className="pdf-controls">
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))} aria-label="Zoom out">−</button>
          <span className="pdf-zoom">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in">+</button>
          <button onClick={() => { setFull((f) => !f); setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label={full ? 'Exit full view' : 'Full view'}>
            {full ? '✕' : '⤢'}
          </button>
          {doc && doc.numPages > 1 && (
            <>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">‹</button>
              <span className="pdf-zoom">{page}/{doc.numPages}</span>
              <button disabled={page >= doc.numPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">›</button>
            </>
          )}
        </span>
      </div>
      <div ref={wrapRef} className="pdf-canvas-wrap" style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }} />
      </div>
    </div>
  );
}
