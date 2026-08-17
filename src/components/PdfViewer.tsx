// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// ==========================================================================
// This Area Of Code Is: PDF Viewer Component
// Explanation: Renders PDF pages to canvas using pdfjs-dist v5. Supports
//              page navigation, zoom, and dark-theme chrome. Accepts any
//              URL: external, blob, or base64 data URI. The worker is bundled
//              via Vite's ?url import so the PWA stays offline-capable.
// In Other Words: The sheet-music reader — open any PDF attachment.
// ==========================================================================

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  url: string;          // PDF URL, blob URL, or data URI
  onClose?: () => void;
}

export default function PdfViewer({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPageNum(1);
    setNumPages(0);

    pdfjsLib.getDocument({ url }).promise
      .then((pdf) => {
        if (cancelled) return;
        setDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load PDF');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  // Render current page
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const render = async () => {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
    };

    render().catch((err) => {
      if (err?.name !== 'RenderingCancelledException') {
        setError(err?.message || 'Render error');
      }
    });

    return () => {
      renderTask?.cancel();
    };
  }, [doc, pageNum, scale]);

  const prev = useCallback(() => setPageNum((p) => Math.max(1, p - 1)), []);
  const next = useCallback(() => setPageNum((p) => Math.min(numPages, p + 1)), [numPages]);
  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.5, s - 0.25)), []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-label="PDF viewer"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">
            Page {pageNum} / {numPages || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center text-sm text-white/70">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="mx-2 h-6 w-px bg-white/10" />
          <button
            onClick={prev}
            disabled={pageNum <= 1}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={next}
            disabled={pageNum >= numPages}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-30"
          >
            Next →
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-white/50 animate-pulse">Loading PDF…</div>
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="text-red-400 font-medium">Could not load PDF</p>
              <p className="mt-1 text-sm text-white/50">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="shadow-2xl"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
