"use client";

// Self-hosted PDF viewer (react-pdf / pdf.js). The worker is served from
// /public rather than a CDN so there is no cross-origin fetch and no chance of
// the worker version drifting from the pdfjs-dist we bundle — a mismatch there
// fails at runtime with an unhelpful error.

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

export default function PdfViewer({ file, title }: { file: string; title: string }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Render at the container's width so the page is legible on a phone without
  // horizontal scrolling; scale multiplies on top of that.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth - 32);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback(
    (delta: number) => setPage((p) => Math.min(Math.max(1, p + delta), numPages || 1)),
    [numPages],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 font-tl-mono text-xs text-ash transition-colors hover:border-white/25 hover:text-bone disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nectar";

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-obsidian/60">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => go(-1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[5.5rem] text-center font-tl-mono text-xs tabular-nums text-ash">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <button
            className={btn}
            onClick={() => go(1)}
            disabled={!numPages || page >= numPages}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className={btn}
            onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - 0.2).toFixed(2)))}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="min-w-[3rem] text-center font-tl-mono text-xs tabular-nums text-ash">
            {Math.round(scale * 100)}%
          </span>
          <button
            className={btn}
            onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + 0.2).toFixed(2)))}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <a
            className={`${btn} ml-1 border-nectar/40 text-nectar hover:border-nectar hover:text-nectar`}
            href={file}
            download
          >
            <Download size={13} />
            PDF
          </a>
        </div>
      </div>

      {/* page */}
      <div ref={shellRef} className="max-h-[80vh] overflow-auto bg-void/40 px-4 py-4">
        {error ? (
          <div className="py-16 text-center font-tl-mono text-xs text-ash">
            <p className="mb-3 text-flare">{error}</p>
            <a href={file} download className="text-nectar underline">
              Download the PDF instead
            </a>
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setError(null);
            }}
            onLoadError={(e) =>
              setError(`Couldn't render the PDF in your browser (${e.message}).`)
            }
            loading={
              <div className="flex items-center justify-center gap-2 py-24 font-tl-mono text-xs text-ash">
                <Loader2 size={14} className="animate-spin" /> loading {title}…
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={page}
              width={width > 0 ? width : undefined}
              scale={scale}
              renderAnnotationLayer
              renderTextLayer
              className="shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
