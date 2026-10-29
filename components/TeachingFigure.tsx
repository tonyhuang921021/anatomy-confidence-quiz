"use client";

import { useEffect, useRef, useState } from "react";

type TeachingFigureProps = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  originalImageUrl: string;
  licenseName: string;
  licenseUrl: string;
};

function safeHttpsUrl(value: string): string | null {
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
}
function safeImageUrl(value: string): string | null {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : safeHttpsUrl(value);
}

/** The caller supplies a reviewed asset and its verified source and license. */
export function TeachingFigure({ src, alt, caption, credit, sourceUrl, originalImageUrl, licenseName, licenseUrl }: TeachingFigureProps) {
  const assetUrl = safeImageUrl(src);
  const originalUrl = safeHttpsUrl(originalImageUrl);
  const sourceLink = safeHttpsUrl(sourceUrl);
  const licenseLink = safeHttpsUrl(licenseUrl);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const expandedImage = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = priorOverflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!assetUrl) return <p role="status">圖片暫時無法顯示。</p>;

  return (
    <figure className="my-4 min-w-0 max-w-full text-sm leading-6 text-slate-600">
      <button ref={trigger} type="button" aria-label={`放大圖片：${alt}`} onClick={() => { setZoom(1); setOpen(true); }} className="block max-w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
        <img src={assetUrl} alt={alt} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 160, width: "auto", height: "auto" }} />
      </button>
      {originalUrl ? <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline">查看原圖</a> : null}
      <figcaption className="mt-2">{caption} {credit} {sourceLink ? <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="underline">來源</a> : null} {licenseLink ? <>· <a href={licenseLink} target="_blank" rel="noopener noreferrer" className="underline">{licenseName}</a></> : null}</figcaption>
      <dialog ref={dialog} aria-label={`圖片放大：${alt}`} onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)} className="max-h-[90vh] w-[min(95vw,72rem)] max-w-none rounded-xl bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/70">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{alt}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom <= 1} className="rounded-lg px-3 py-2 ring-1 ring-slate-300 disabled:opacity-50">縮小</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} disabled={zoom >= 3} className="rounded-lg px-3 py-2 ring-1 ring-slate-300 disabled:opacity-50">放大</button>
            <button type="button" onClick={() => { const width = scrollArea.current?.getBoundingClientRect().width; const natural = expandedImage.current?.naturalWidth; if (width && natural) setZoom(Math.max(1, natural / width)); }} className="rounded-lg px-3 py-2 ring-1 ring-slate-300">原始大小</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 ring-1 ring-slate-300">關閉</button>
          </div>
        </div>
        <div ref={scrollArea} aria-label="可捲動的放大圖片" tabIndex={0} style={{ maxHeight: "70vh", overflow: "auto" }}>
          <img ref={expandedImage} src={assetUrl} alt={alt} style={{ display: "block", width: `${zoom * 100}%`, maxWidth: "none", height: "auto" }} />
        </div>
      </dialog>
    </figure>
  );
}
