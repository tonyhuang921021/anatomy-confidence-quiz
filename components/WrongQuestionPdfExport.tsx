"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, LoaderCircle, X } from "lucide-react";
import { loadCompletedSessions } from "@/lib/storage";
import {
  buildWrongQuestionPdfHtml,
  collectWrongQuestionPdfItems,
  EMPTY_PDF_FILTERS,
  getWrongQuestionPdfYearLabel,
  type WrongQuestionPdfHistoryScope,
  type WrongQuestionPdfItem,
  type WrongQuestionPdfFilters
} from "@/lib/wrongQuestionPdf";
import type { Question, QuizSession } from "@/types/quiz";

const FIELD_CLASS = "mt-1.5 w-full min-h-11 rounded-lg border border-slate-200 appearance-none bg-white px-3 pr-9 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const EMPTY_ITEMS: WrongQuestionPdfItem[] = [];

type WorkspaceProps = {
  questions: Question[];
  currentSession?: QuizSession | null;
  sessions: QuizSession[];
  historyScope?: WrongQuestionPdfHistoryScope;
  demo?: boolean;
};

export function WrongQuestionPdfWorkspace({ questions, currentSession, sessions, historyScope, demo = false }: WorkspaceProps) {
  const id = useId();
  const scope = currentSession ? "current" : "history";
  const activeHistoryScope = currentSession ? undefined : historyScope;
  const scopeLabel = currentSession ? "本次作答錯題" : activeHistoryScope?.label ?? "歷次作答錯題";
  const yearLabel = getWrongQuestionPdfYearLabel(activeHistoryScope?.yearRange);
  const pageSubjectLabel = activeHistoryScope?.subjects?.length ? activeHistoryScope.subjects.join("、") : "全部科目";
  const [filters, setFilters] = useState<WrongQuestionPdfFilters>({ ...EMPTY_PDF_FILTERS });
  const [spacing, setSpacing] = useState(2);
  const [recentCountInput, setRecentCountInput] = useState("");
  const recentCount = recentCountInput.trim() ? Number(recentCountInput) : undefined;
  const recentCountInvalid = recentCount !== undefined && (!Number.isSafeInteger(recentCount) || recentCount < 1);
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const exportControllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => exportControllerRef.current?.abort(), []);
  const [baseUrl, setBaseUrl] = useState("");
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setBaseUrl(window.location.origin); }, []);
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 794)));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const sourceSessions = useMemo(() => currentSession ? [currentSession] : sessions, [sessions, currentSession]);
  const available = useMemo(() => collectWrongQuestionPdfItems(sourceSessions, questions, EMPTY_PDF_FILTERS, activeHistoryScope), [sourceSessions, questions, activeHistoryScope]);
  const subjects = useMemo(() => [...new Set(available.items.map(({ question }) => question.subject))], [available]);
  const chapters = useMemo(() => [...new Set(available.items.filter(({ question }) => !filters.subject || question.subject === filters.subject).map((item) => item.chapter))].sort((a, b) => a.localeCompare(b, "zh-Hant")), [available, filters.subject]);
  const dateInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const result = useMemo(() => collectWrongQuestionPdfItems(sourceSessions, questions, { ...filters, recentCount: recentCountInvalid ? undefined : recentCount }, activeHistoryScope), [sourceSessions, questions, filters, recentCount, recentCountInvalid, activeHistoryScope]);
  const items = dateInvalid || recentCountInvalid ? EMPTY_ITEMS : result.items;
  const subjectCount = new Set(items.map(({ question }) => question.subject)).size;
  const dateLabel = filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "最早紀錄"} 至 ${filters.dateTo || "最近紀錄"}` : "全部作答日期";
  const selectedSubjectLabel = filters.subject || (activeHistoryScope?.subjects?.length ? `所選 ${activeHistoryScope.subjects.length} 科` : "全部科目");
  const selectionLabel = [activeHistoryScope ? yearLabel : "", selectedSubjectLabel, dateLabel, recentCount && !recentCountInvalid ? `最近 ${recentCount} 題` : ""].filter(Boolean).join(" · ");
  const html = useMemo(() => buildWrongQuestionPdfHtml({
    items, spacingCm: spacing, scopeLabel, dateLabel: selectionLabel, baseUrl
  }), [items, spacing, scopeLabel, selectionLabel, baseUrl]);

  function clearExportStatus() { setNotice(""); setExportProgress(""); }
  function updateFilter<K extends keyof WrongQuestionPdfFilters>(key: K, value: WrongQuestionPdfFilters[K]) {
    clearExportStatus();
    setFilters((current) => ({ ...current, [key]: value, ...(key === "subject" ? { chapter: "" } : {}) }));
  }
  async function handleDownload() {
    if (exportControllerRef.current || items.length === 0 || dateInvalid || recentCountInvalid) return;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    setNotice("");
    setIsExporting(true);
    setExportProgress("正在準備 PDF…");
    try {
      const { downloadWrongQuestionPdf } = await import("@/lib/wrongQuestionPdfDownload");
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());
      await downloadWrongQuestionPdf({
        items, spacingCm: spacing,
        scopeLabel,
        dateLabel: selectionLabel, filename: `錯題練習單_${scope === "current" ? "本次" : "歷次"}_${today}.pdf`,
        signal: controller.signal, onProgress: setExportProgress
      });
      if (!controller.signal.aborted) setExportProgress("PDF 已準備完成，請到下載項目查看。");
    } catch (error) {
      if (!controller.signal.aborted) {
        setExportProgress("");
        setNotice(error instanceof Error ? error.message : "PDF 產生失敗，請稍後重試。");
      }
    } finally {
      exportControllerRef.current = null;
      if (!controller.signal.aborted) setIsExporting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <fieldset disabled={isExporting} className="min-w-0">
        {scope === "history" ? <div className="mb-4 space-y-1 text-sm" aria-label="PDF 匯出範圍">
          <p className="font-semibold text-ink">{scopeLabel}</p>
          <p className="leading-6 text-slate-600">{yearLabel} · {pageSubjectLabel}</p>
          <p className="text-xs leading-5 text-slate-500">所選範圍的歷次曾答錯，包含後來答對的題目。</p>
        </div> : null}
        <div className="mb-5 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-ink" aria-live="polite">共 {items.length} 題 · {subjectCount} 科</p>
          {dateInvalid ? <p className="mt-3 text-sm text-rose-700" role="alert">結束日期需晚於或等於開始日期。</p> : null}
          {recentCountInvalid ? <p className="mt-3 text-sm text-rose-700" role="alert">題數請填入大於 0 的整數。</p> : null}
          {result.missingQuestionCount > 0 ? <p className="mt-3 text-sm text-amber-800" role="status">另有 {result.missingQuestionCount} 題找不到題目內容，未列入匯出。</p> : null}
          {result.unknownDateCount > 0 ? <p className="mt-3 text-sm text-amber-800">{result.unknownDateCount} 題缺少作答日期，未列入此篩選結果。</p> : null}
          <button type="button" disabled={isExporting || items.length === 0 || dateInvalid || recentCountInvalid || !baseUrl} aria-busy={isExporting} onClick={() => void handleDownload()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">{isExporting ? <LoaderCircle size={16} aria-hidden="true" className="animate-spin" /> : <Download size={16} aria-hidden="true" />}{isExporting ? "正在產生 PDF…" : "另存 PDF"}</button>
          <p className="mt-2 text-xs leading-5 text-slate-500">直接下載 A4 PDF，可儲存到電腦或手機。</p>
          {exportProgress ? <p className="mt-2 text-xs leading-5 text-slate-500" role="status" aria-live="polite">{exportProgress}</p> : null}
          {notice ? <p className="mt-3 text-sm text-rose-700" role="alert">{notice}</p> : null}
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-ink" htmlFor={`${id}-subject`}>科別</label>
            <span className="relative block"><select id={`${id}-subject`} className={FIELD_CLASS} value={filters.subject} onChange={(event) => updateFilter("subject", event.target.value)}>
              <option value="">{activeHistoryScope?.subjects?.length ? "頁面所選科目" : "全部科別"}</option>
              {subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /></span>
          </div>
          <div><label className="block text-sm font-medium text-ink" htmlFor={`${id}-chapter`}>章節</label>
            <span className="relative block"><select id={`${id}-chapter`} className={FIELD_CLASS} value={filters.chapter} onChange={(event) => updateFilter("chapter", event.target.value)}>
              <option value="">全部章節</option>
              {chapters.map((chapter) => <option key={chapter}>{chapter}</option>)}
            </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /></span>
          </div>
          {scope === "history" ? <div>
            <label className="block text-sm font-medium text-ink" htmlFor={`${id}-recent-count`}>最近錯題</label>
            <div className="relative">
              <input id={`${id}-recent-count`} type="number" min="1" step="1" inputMode="numeric" placeholder="不限題數" value={recentCountInput} aria-invalid={recentCountInvalid} aria-describedby={`${id}-recent-help`} className={FIELD_CLASS} onChange={(event) => { clearExportStatus(); setRecentCountInput(event.target.value); }} />
              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">題</span>
            </div>
            <p id={`${id}-recent-help`} className="mt-1.5 text-xs leading-5 text-slate-500">從符合條件的錯題中，取最近答錯的 N 題；留空為全部。</p>
          </div> : null}
          <fieldset>
            <legend className="text-sm font-medium text-ink">每題筆記留白</legend>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[0, 2, 4, 6].map((value) => (
                <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 ${spacing === value ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}>
                  <input type="radio" name={`${id}-spacing`} value={value} checked={spacing === value} onChange={() => { clearExportStatus(); setSpacing(value); }} className="sr-only" />
                  {value} cm
                </label>
              ))}
            </div>
          </fieldset>
          <details className="border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">{scope === "history" ? "作答日期與匯出說明" : "匯出說明"}</summary>
            <div className="mt-4 space-y-3">
              {scope === "history" ? (
                <fieldset>
                  <legend className="text-sm font-medium text-ink">作答日期</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-500">開始日期<input type="date" aria-label="開始日期" value={filters.dateFrom} max={filters.dateTo || undefined} className={`${FIELD_CLASS} min-w-0 px-2`} onChange={(event) => updateFilter("dateFrom", event.target.value)} /></label>
                    <label className="text-xs text-slate-500">結束日期<input type="date" aria-label="結束日期" value={filters.dateTo} min={filters.dateFrom || undefined} className={`${FIELD_CLASS} min-w-0 px-2`} onChange={(event) => updateFilter("dateTo", event.target.value)} /></label>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">留空為全部日期；依臺灣時間，包含起訖日。</p>
                </fieldset>
              ) : null}
              <p className="mt-1 text-xs leading-5 text-slate-500">依預設科目順序排列，同卷按原題號排序，保留章節標示。同一題只收一次，含附圖、不附答案。</p>
              {scope === "history" ? <p className="text-xs leading-5 text-slate-500">只收曾答錯的題目，不含僅沒信心的答對題，也不受目前分頁或已完成狀態限制。{!activeHistoryScope ? "來源包含散題、模擬考及自訂卷。" : "來源、考題年份及科目沿用頁面範圍；可在此再縮小科別或章節。"}{!demo ? "依目前已載入的作答紀錄匯出。" : ""}</p> : null}
            </div>
          </details>
        </div>
      </fieldset>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>A4 直式預覽</span><span>實際分頁以 PDF 檔案為準</span></div>
        <div ref={previewContainerRef} className="overflow-hidden rounded-lg border border-slate-200 bg-[#e8e9e6]" style={{ height: Math.max(420, 920 * scale) }}>
          {baseUrl ? <iframe title="錯題 A4 PDF 版面預覽" sandbox="allow-same-origin" srcDoc={html} width="794" height={Math.max(920, 420 / scale)} style={{ display: "block", width: 794, maxWidth: "none", border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} /> : null}
        </div>
      </div>
    </div>
  );
}

export function WrongQuestionPdfExport({ questions, currentSession, demoSessions, demo = false, triggerClassName, historyScope }: {
  questions: Question[];
  currentSession?: QuizSession | null;
  demoSessions?: QuizSession[];
  demo?: boolean;
  triggerClassName?: string;
  historyScope?: WrongQuestionPdfHistoryScope;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  useEffect(() => {
    if (!open || currentSession || demoSessions !== undefined) return;
    const refresh = () => setSessions(loadCompletedSessions({ includeFullLocalHistory: true }));
    refresh();
    window.addEventListener("completed-sessions-change", refresh);
    window.addEventListener("completed-question-history-change", refresh);
    return () => {
      window.removeEventListener("completed-sessions-change", refresh);
      window.removeEventListener("completed-question-history-change", refresh);
    };
  }, [open, currentSession, demoSessions]);
  function close() { dialogRef.current?.close(); setOpen(false); triggerRef.current?.focus(); }
  return <>
    <button ref={triggerRef} type="button" onClick={() => { setOpen(true); dialogRef.current?.showModal(); }} className={triggerClassName ?? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"}><Download size={16} aria-hidden="true" />匯出錯題 PDF</button>
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={close} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} className="m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[1120px] overflow-y-auto rounded-xl border border-slate-200 bg-[color:var(--surface-float)] p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-3"><div><h2 id={titleId} className="text-xl font-semibold">匯出錯題 PDF</h2><p className="mt-1 text-sm text-slate-500">{currentSession ? "匯出本次錯題，留白手寫訂正。" : historyScope ? "依頁面範圍匯出，可再縮小條件。" : "依科別、章節、日期與最近題數篩選歷次錯題。"}</p></div><button type="button" aria-label="關閉匯出設定" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-slate-100"><X size={20} /></button></div>
      {open ? <WrongQuestionPdfWorkspace questions={questions} currentSession={currentSession} sessions={demoSessions ?? sessions} historyScope={historyScope} demo={demo || demoSessions !== undefined} /> : null}
    </dialog>
  </>;
}
