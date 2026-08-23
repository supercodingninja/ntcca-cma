// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// @ts-ignore — Vite handles .mjs?url; TypeScript has no declaration for it
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ==========================================================================
// This Area Of Code Is: Unified PDF Viewer — pinch-zoom, drag-pan,
// fullscreen, page navigation, zoom controls, and close button.
// Explanation: Replaces both PdfView.tsx and the old PdfViewer.tsx.
//              All custom CSS classes (.pdf-stage, .pdf-bar, etc.) are
//              gone — everything uses Tailwind. Touch gestures work on
//              iPad and Android; wheel zoom works on desktop.
// In Other Words: One reader to rule them all — sheet music, charts,
//                 bulletins, whatever PDF the song carries.
// ==========================================================================

interface Props {
  url: string;
  name?: string;
  onClose?: () => void;
}

export default function PdfViewer({ url, name, onClose }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Load document
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const d = await pdfjsLib.getDocument({ url }).promise;
        if (!dead) {
          setDoc(d);
          setPage(1);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      } catch {
        if (!dead) setErr('Could not open this PDF');
      }
    })();
    return () => { dead = true; };
  }, [url]);

  // Render page at current zoom / fullscreen
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const p = await doc.getPage(page);
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const containerW = (wrapRef.current?.clientWidth ?? 800) - 8;
      const renderScale = (containerW / base.width) * zoom * (full ? 1.35 : 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: renderScale * dpr });
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = `${vp.width / dpr}px`;
      canvas.style.height = `${vp.height / dpr}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
    return () => { cancelled = true; };
  }, [doc, page, zoom, full]);

  // Pinch-zoom + drag-pan + wheel zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinch.current = { d: dist(e.touches), z: zoom };
        e.preventDefault();
      } else if (e.touches.length === 1 && zoom > 1) {
        drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch.current) {
        const newZoom = Math.min(4, Math.max(0.6, pinch.current.z * (dist(e.touches) / pinch.current.d)));
        setZoom(newZoom);
        e.preventDefault();
      } else if (e.touches.length === 1 && drag.current) {
        setPan({
          x: drag.current.px + e.touches[0].clientX - drag.current.x,
          y: drag.current.py + e.touches[0].clientY - drag.current.y,
        });
        e.preventDefault();
      }
    };
    const onTouchEnd = () => { pinch.current = null; drag.current = null; };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || full) {
        setZoom((z) => Math.min(4, Math.max(0.6, z * (e.deltaY < 0 ? 1.1 : 0.9))));
        e.preventDefault();
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoom, pan, full]);

  // Reset pan when zoom drops to ~1
  useEffect(() => {
    if (zoom <= 1.01) setPan({ x: 0, y: 0 });
  }, [zoom]);

  if (err) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center">
        <p className="text-sm font-medium text-red-400">{err}</p>
        <a
          className="mt-2 inline-block text-xs text-amber-400 underline"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          ⬇ Open {name || 'PDF'}
        </a>
      </div>
    );
  }

  const isOverlay = full || !!onClose;
  const containerClass = isOverlay
    ? 'fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-md'
    : 'relative w-full rounded-lg border border-white/10 bg-black/80 flex flex-col overflow-hidden';

  return (
    <div className={containerClass} role={isOverlay ? 'dialog' : undefined} aria-modal={isOverlay ? true : undefined}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-3 py-2">
        <span className="max-w-[50%] truncate text-sm font-medium text-white/80">
          🎼 {name || 'Sheet Music'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
            className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-xs text-white/50">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Zoom in"
          >
            +
          </button>

          {doc && doc.numPages > 1 && (
            <>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="text-xs text-white/50">{page}/{doc.numPages}</span>
              <button
                disabled={page >= doc.numPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label="Next page"
              >
                ›
              </button>
            </>
          )}

          <button
            onClick={() => { setFull((f) => !f); setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="ml-1 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={full ? 'Exit full view' : 'Full view'}
          >
            {full ? '✕' : '⤢'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 rounded p-1 text-red-400 hover:bg-red-500/20"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="flex-1 overflow-auto p-2" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="mx-auto shadow-2xl"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        />
      </div>
    </div>
  );
}
