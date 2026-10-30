"use client";

import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

/** Enhance trusted reader images in place, without replacing the source HTML. */
const ReviewedHtml = memo(function ReviewedHtml({ html }: { html: string }) {
  const root = useRef<HTMLDivElement>(null);
  const imageAnchors = useRef(new WeakMap<HTMLImageElement, number>());
  const cancelPositionRestore = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelPositionRestore.current?.(), []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const enhanced: Array<{ element: HTMLImageElement; tabIndex: string | null; role: string | null; label: string | null; expanded: string | null; title: string | null }> = [];
    element.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (!reviewedImageSource(image.getAttribute("src"), window.location.origin)) return;
      enhanced.push({ element: image, tabIndex: image.getAttribute("tabindex"), role: image.getAttribute("role"), label: image.getAttribute("aria-label"), expanded: image.getAttribute("aria-expanded"), title: image.getAttribute("title") });
      image.setAttribute("tabindex", "0");
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `放大圖片：${image.alt || "已審詳解圖片"}`);
      image.dataset.reviewedZoom = "true";
      image.setAttribute("aria-expanded", "false");
      image.title = "點圖片直接放大，再點縮小";
      // Cached images may finish before React attaches its load listener.
      if (image.complete) setImageState(image, image.naturalWidth > 0 ? "ready" : "error");
    });
    return () => enhanced.forEach(({ element: image, tabIndex, role, label, expanded, title }) => {
      for (const [name, value] of [["tabindex", tabIndex], ["role", role], ["aria-label", label], ["aria-expanded", expanded], ["title", title]] as const) {
        if (value === null) image.removeAttribute(name); else image.setAttribute(name, value);
      }
      delete image.dataset.reviewedZoom;
      delete image.closest<HTMLElement>(".reviewed-image-frame")?.dataset.reviewedExpanded;
    });
  }, [html]);

  function setImageState(target: EventTarget, state: "ready" | "error") {
    if (!(target instanceof HTMLImageElement)) return;
    const frame = target.closest<HTMLElement>(".reviewed-image-frame");
    if (frame) frame.dataset.imageState = state;
  }
  function toggleImage(target: EventTarget): boolean {
    if (!(target instanceof HTMLImageElement) || !root.current?.contains(target)) return false;
    const src = reviewedImageSource(target.getAttribute("src"), window.location.origin);
    if (!src) return false;
    cancelPositionRestore.current?.();
    // Cancel an in-flight smooth scroll before measuring the reading position.
    window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: "instant" });
    const expanding = target.getAttribute("aria-expanded") !== "true";
    const top = target.getBoundingClientRect().top;
    if (expanding) imageAnchors.current.set(target, top);
    const documentRoot = document.documentElement;
    const previousAnchor = documentRoot.style.overflowAnchor;
    documentRoot.style.overflowAnchor = "none";
    target.setAttribute("aria-expanded", String(expanding));
    target.setAttribute("aria-label", `${expanding ? "縮小" : "放大"}圖片：${target.alt || "已審詳解圖片"}`);
    target.title = expanding ? "點圖片縮小" : "點圖片直接放大，再點縮小";
    const frame = target.closest<HTMLElement>(".reviewed-image-frame");
    if (frame) frame.dataset.reviewedExpanded = String(expanding);
    target.focus({ preventScroll: true });
    // Return to the thumbnail's reading position even after scrolling a tall image.
    const anchorTop = expanding ? top : (imageAnchors.current.get(target) ?? Math.max(0, top));
    let animationFrame = 0;
    const restorePosition = () => {
      if (!target.isConnected) return;
      const delta = target.getBoundingClientRect().top - anchorTop;
      if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: "instant" });
    };
    const finish = () => {
      window.cancelAnimationFrame(animationFrame);
      documentRoot.style.overflowAnchor = previousAnchor;
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
        window.removeEventListener(event, finish, true);
      }
      if (cancelPositionRestore.current === finish) cancelPositionRestore.current = null;
    };
    cancelPositionRestore.current = finish;
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
      window.addEventListener(event, finish, { capture: true, passive: true });
    }
    restorePosition();
    // WebKit/Chromium may clamp scroll after the height-changing layout. Correct
    // after layout as well; never fight a subsequent deliberate user scroll.
    animationFrame = window.requestAnimationFrame(() => {
      restorePosition();
      animationFrame = window.requestAnimationFrame(() => { restorePosition(); finish(); });
    });
    if (!expanding) imageAnchors.current.delete(target);
    return true;
  }
  return <div ref={root} onLoadCapture={(event) => setImageState(event.target, "ready")} onErrorCapture={(event) => setImageState(event.target, "error")} onClick={(event) => { if (toggleImage(event.target)) event.preventDefault(); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && toggleImage(event.target)) { event.preventDefault(); event.stopPropagation(); } }} dangerouslySetInnerHTML={{ __html: html }} />;
});

export function ReviewedExplanation({ questionId }: { questionId: string }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
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
    setReader(null); setDetailed(false); setError("");
    loadReader(questionId).then((value) => { if (!cancelled) setReader(value); })
      .catch(() => { if (!cancelled) setError("詳解暫時讀取失敗，請再試一次。"); });
    return () => { cancelled = true; };
  }, [questionId, retry]);
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
          <ReviewedHtml html={detailed ? current.html : current.shortHtml} />
        </div>
      ) : null}

    </section>
  );
}
