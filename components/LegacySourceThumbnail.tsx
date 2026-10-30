"use client";

import { useRef } from "react";

/** Compact source preview for newly imported legacy papers only. */
export function LegacySourceThumbnail({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} aria-label="放大官方原題" className="mt-3 block max-w-full rounded-lg border border-slate-200 bg-white p-1 text-left">
      <img src={src} alt={alt} loading="lazy" className="max-h-24 max-w-full rounded object-contain" />
      <span className="block px-1 pt-1 text-xs text-slate-500">點圖放大官方原題</span>
    </button>
    <dialog ref={dialog} aria-label="官方原題大圖" className="max-h-[92vh] w-[96vw] max-w-5xl overflow-auto rounded-xl bg-white p-3 shadow-xl backdrop:bg-black/60" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="sticky top-0 flex justify-end bg-white/95 pb-2"><button type="button" autoFocus onClick={() => dialog.current?.close()} className="rounded-lg border px-3 py-2 text-sm">關閉</button></div>
      <img src={src} alt={alt} className="h-auto w-full" />
    </dialog>
  </>;
}
