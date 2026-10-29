"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { reviewedImageSource } from "@/lib/reviewedImageSource";

type Reader = { id: string; title: string; shortHtml: string; html: string; version: string; imageCount: number };
const cache = new Map<string, Promise<Reader>>();
function loadReader(id: string) {
  let promise = cache.get(id);
  if (!promise) {
    promise = fetch(`/reviewed-explanations/${encodeURIComponent(id)}.json`).then(async (response) => {
      if (!response.ok) throw new Error("詳解暫時讀取失敗");
      const reader = await response.json() as Reader;
      if (reader.id !== id || !reader.html || !reader.shortHtml) throw new Error("詳解資料不完整");
      return reader;
    }).catch((error) => { cache.delete(id); throw error; });
    cache.set(id, promise);
  }
  return promise;
}

/** Keep the source HTML stable while the image dialog changes state. */
const ReviewedHtml = memo(function ReviewedHtml({ html, onOpen }: { html: string; onOpen: (src: string, trigger: HTMLImageElement) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const enhanced: Array<{ element: HTMLImageElement; tabIndex: string | null; role: string | null; label: string | null }> = [];
    element.querySelectorAll<HTMLImageElement>(".reviewed-image-frame img").forEach((image) => {
      if (!reviewedImageSource(image.getAttribute("src"), window.location.origin)) return;
      enhanced.push({ element: image, tabIndex: image.getAttribute("tabindex"), role: image.getAttribute("role"), label: image.getAttribute("aria-label") });
      image.setAttribute("tabindex", "0");
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `放大圖片：${image.alt || "已審詳解圖片"}`);
      image.dataset.reviewedZoom = "true";
    });
    return () => enhanced.forEach(({ element: image, tabIndex, role, label }) => {
      for (const [name, value] of [["tabindex", tabIndex], ["role", role], ["aria-label", label]] as const) {
        if (value === null) image.removeAttribute(name); else image.setAttribute(name, value);
      }
      delete image.dataset.reviewedZoom;
    });
  }, [html]);

  function setImageState(target: EventTarget, state: "ready" | "error") {
    if (!(target instanceof HTMLImageElement)) return;
    const frame = target.closest<HTMLElement>(".reviewed-image-frame");
    if (frame) frame.dataset.imageState = state;
  }
  function openImage(target: EventTarget): boolean {
    if (!(target instanceof HTMLImageElement) || !root.current?.contains(target) || !target.closest(".reviewed-image-frame")) return false;
    const src = reviewedImageSource(target.getAttribute("src"), window.location.origin);
    if (!src) return false;
    onOpen(src, target);
    return true;
  }
  return <div ref={root} onLoadCapture={(event) => setImageState(event.target, "ready")} onErrorCapture={(event) => setImageState(event.target, "error")} onClick={(event) => { if (openImage(event.target)) event.preventDefault(); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && openImage(event.target)) { event.preventDefault(); event.stopPropagation(); } }} dangerouslySetInnerHTML={{ __html: html }} />;
});

export function ReviewedExplanation({ questionId }: { questionId: string }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [image, setImage] = useState<{ src: string; alt: string; trigger: HTMLImageElement } | null>(null);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const expandedImage = useRef<HTMLImageElement>(null);
  const panelId = useId();
  const toggleAnchor = useRef<{ element: HTMLButtonElement; top: number } | null>(null);
  function toggleDetail(next: boolean, element: HTMLButtonElement) {
    toggleAnchor.current = { element, top: element.getBoundingClientRect().top };
    setDetailed(next);
  }
  useLayoutEffect(() => {
    const anchor = toggleAnchor.current;
    toggleAnchor.current = null;
    if (anchor?.element.isConnected) {
      const delta = anchor.element.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
    }
  }, [detailed]);
  useEffect(() => {
    let cancelled = false;
    toggleAnchor.current = null;
    setReader(null); setDetailed(false); setError(""); setImage(null);
    loadReader(questionId).then((value) => { if (!cancelled) setReader(value); })
      .catch(() => { if (!cancelled) setError("詳解暫時讀取失敗，請再試一次。"); });
    return () => { cancelled = true; };
  }, [questionId, retry]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !image) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = oldOverflow;
      if (image.trigger.isConnected) image.trigger.focus({ preventScroll: true });
    };
  }, [image]);
  const openImage = useCallback((src: string, trigger: HTMLImageElement) => {
    setZoom(1);
    setImage({ src, alt: trigger.alt || "已審詳解圖片", trigger });
  }, []);
  const current = reader?.id === questionId ? reader : null;
  return (
    <section className="reviewed-explanation" aria-label="已核對圖文詳解" data-reviewed-question={questionId}>
      <div className="reviewed-explanation-controls" role="group" aria-label="詳解閱讀方式">
        <button type="button" aria-pressed={!detailed} aria-controls={panelId} onClick={(event) => toggleDetail(false, event.currentTarget)}>簡解</button>
        <button type="button" aria-pressed={detailed} aria-controls={panelId} onClick={(event) => toggleDetail(true, event.currentTarget)}>詳解</button>
      </div>
      {error ? <p role="alert">{error} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>重新讀取</button></p> : null}
      {!current && !error ? <p role="status">正在讀取詳解…</p> : null}
      {current ? (
        <div id={panelId} className="reviewed-reader study-disclosure" data-reader-mode={detailed ? "detailed" : "short"}>
          {!detailed ? <h3>{current.title}</h3> : null}
          {/* HTML is generated only from hash-pinned accepted sources by the strict allowlist importer. */}
          <ReviewedHtml html={detailed ? current.html : current.shortHtml} onOpen={openImage} />
        </div>
      ) : null}
      <dialog ref={dialogRef} aria-label={`圖片放大：${image?.alt ?? "已審詳解圖片"}`} onCancel={(event) => { event.preventDefault(); setImage(null); }} onClose={() => setImage(null)} className="max-h-[90vh] w-[min(95vw,72rem)] max-w-none rounded-xl bg-white p-4 text-slate-900 shadow-xl backdrop:bg-black/70">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words font-semibold">{image?.alt}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))} disabled={zoom <= 0.25} className="rounded-lg px-3 py-2 ring-1 ring-slate-300 disabled:opacity-50">縮小</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} disabled={zoom >= 3} className="rounded-lg px-3 py-2 ring-1 ring-slate-300 disabled:opacity-50">放大</button>
            <button type="button" onClick={() => { const width = scrollArea.current?.getBoundingClientRect().width; const natural = expandedImage.current?.naturalWidth; if (width && natural) setZoom(natural / width); }} className="rounded-lg px-3 py-2 ring-1 ring-slate-300">原始大小</button>
            <button type="button" onClick={() => setImage(null)} className="rounded-lg px-3 py-2 ring-1 ring-slate-300">關閉</button>
          </div>
        </div>
        <div ref={scrollArea} aria-label="可捲動的放大圖片" tabIndex={0} style={{ maxHeight: "70vh", overflow: "auto" }}>
          {image ? <img ref={expandedImage} src={image.src} alt={image.alt} style={{ display: "block", width: `${zoom * 100}%`, maxWidth: "none", height: "auto" }} /> : null}
        </div>
      </dialog>
    </section>
  );
}
