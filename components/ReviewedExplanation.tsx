"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
  function setImageState(target: EventTarget, state: "ready" | "error") {
    if (!(target instanceof HTMLImageElement)) return;
    const frame = target.closest<HTMLElement>(".reviewed-image-frame");
    if (frame) frame.dataset.imageState = state;
  }
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
          <div onLoadCapture={(event) => setImageState(event.target, "ready")} onErrorCapture={(event) => setImageState(event.target, "error")} dangerouslySetInnerHTML={{ __html: detailed ? current.html : current.shortHtml }} />
        </div>
      ) : null}
    </section>
  );
}
