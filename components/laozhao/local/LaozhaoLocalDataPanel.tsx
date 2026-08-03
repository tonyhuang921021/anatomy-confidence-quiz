"use client";

import { Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getLaoZhaoLocalStorageStatus,
  subscribeToLaoZhaoLocalStorageStatus
} from "@/lib/laozhao/local";
import { useLaoZhaoLocalData } from "./useLaozhaoLocalData";

type LaoZhaoLocalDataPanelProps = {
  className?: string;
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function LaozhaoLocalDataPanel({ className }: LaoZhaoLocalDataPanelProps) {
  const { bookmarks, notes, isLoading, error, exportData, clearAll } = useLaoZhaoLocalData();
  const [storageStatus, setStorageStatus] = useState(getLaoZhaoLocalStorageStatus);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(
    () => subscribeToLaoZhaoLocalStorageStatus(setStorageStatus),
    []
  );

  async function handleExport() {
    setIsExporting(true);
    setMessage("");
    try {
      const payload = await exportData();
      downloadJson("laozhao-anatomy-learning.json", payload);
      setMessage("匯出檔已建立。");
    } catch {
      setMessage("匯出失敗，沒有建立不完整的檔案；原有資料仍保留。");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleClear() {
    if (!window.confirm("確定要刪除這台裝置上的老趙影片進度、書籤與筆記嗎？")) return;
    setIsClearing(true);
    setMessage("");
    try {
      await clearAll();
      setMessage("這台裝置的影片學習資料已刪除。");
    } catch {
      setMessage("刪除失敗，沒有執行部分刪除；原有資料仍保留。");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <section className={className} aria-labelledby="laozhao-local-data-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="laozhao-local-data-heading" className="text-lg font-black text-[var(--ink-main)]">匯出或刪除</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            目前有 {bookmarks.length} 個書籤、{notes.length} 則筆記。
          </p>
        </div>
        {isLoading ? <span className="text-sm font-semibold text-[var(--ink-soft)]">讀取中</span> : null}
      </div>

      {storageStatus.mode === "memory" ? (
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-amber-800" role="status">
          {storageStatus.message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 border-l-2 border-rose-500 pl-3 text-sm leading-6 text-rose-700" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || isLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line-soft)] bg-white/70 px-3 py-2 text-sm font-bold hover:border-[var(--brand-main)] hover:text-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download aria-hidden="true" size={17} strokeWidth={2} />
          {isExporting ? "匯出中" : "匯出 JSON"}
        </button>
        <button
          type="button"
          onClick={() => void handleClear()}
          disabled={isClearing || isLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 aria-hidden="true" size={17} strokeWidth={2} />
          {isClearing ? "刪除中" : "刪除全部"}
        </button>
      </div>
      <p className="mt-3 min-h-5 text-sm font-semibold text-[var(--brand-deep)]" aria-live="polite">{message}</p>
    </section>
  );
}
