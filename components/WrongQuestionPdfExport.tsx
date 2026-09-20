"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Printer, X } from "lucide-react";
import { loadCompletedSessions } from "@/lib/storage";
import {
  buildWrongQuestionPdfHtml,
  collectWrongQuestionPdfItems,
  EMPTY_PDF_FILTERS,
  type WrongQuestionPdfItem,
  type WrongQuestionPdfFilters,
  type WrongQuestionPdfScope
} from "@/lib/wrongQuestionPdf";
import type { Question, QuizSession } from "@/types/quiz";

const FIELD_CLASS = "mt-1.5 w-full min-h-11 rounded-lg border border-slate-200 appearance-none bg-white px-3 pr-9 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const EMPTY_ITEMS: WrongQuestionPdfItem[] = [];

type WorkspaceProps = {
  questions: Question[];
  currentSession?: QuizSession | null;
  sessions: QuizSession[];
  initialScope?: WrongQuestionPdfScope;
  demo?: boolean;
};

async function preparePrintWindow(printWindow: Window) {
  const doc = printWindow.document;
  const button = doc.getElementById("print-button") as HTMLButtonElement | null;
  const status = doc.getElementById("print-status");
  const toolbar = doc.querySelector<HTMLElement>(".print-toolbar");
  if (toolbar) toolbar.style.display = "block";
  const showReady = async () => {
    const images = Array.from(doc.images);
    const results = await Promise.all(images.map((img) => new Promise<boolean>((resolve) => {
      if (img.complete) { resolve(img.naturalWidth > 0); return; }
      const timeout = window.setTimeout(() => finish(false), 20000);
      const finish = (loaded: boolean) => {
        window.clearTimeout(timeout);
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        resolve(loaded);
      };
      const onLoad = () => finish(true);
      const onError = () => finish(false);
      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
    })));
    await doc.fonts.ready;
    if (printWindow.closed) return;
    const failed = results.filter((loaded) => !loaded).length + doc.querySelectorAll(".image-error").length;
    if (failed) {
      if (status) status.textContent = `${failed} 張圖片未載入，請關閉此視窗並重試，以免漏印題目。`;
      return;
    }
    // Oversized questions must be able to continue on another page.
    for (const question of Array.from(doc.querySelectorAll<HTMLElement>(".question"))) {
      if (question.getBoundingClientRect().height > 975) {
        question.style.breakInside = "auto";
        question.style.pageBreakInside = "auto";
      }
    }
    if (button) {
      button.disabled = false;
      button.onclick = () => { printWindow.focus(); printWindow.print(); };
    }
    if (status) status.textContent = "選擇 A4、縮放 100%，關閉瀏覽器頁首與頁尾，再另存為 PDF。";
    printWindow.focus();
    printWindow.print();
  };
  await showReady();
}

export function WrongQuestionPdfWorkspace({ questions, currentSession, sessions, initialScope = "history", demo = false }: WorkspaceProps) {
  const id = useId();
  const [scope, setScope] = useState<WrongQuestionPdfScope>(currentSession ? initialScope : "history");
  const [filters, setFilters] = useState<WrongQuestionPdfFilters>({ ...EMPTY_PDF_FILTERS });
  const [spacing, setSpacing] = useState(2);
  const [notice, setNotice] = useState("");
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
  const sourceSessions = useMemo(() => scope === "current" && currentSession
    ? [currentSession]
    : currentSession ? [...sessions.filter((item) => item.id !== currentSession.id), currentSession] : sessions,
  [scope, sessions, currentSession]);
  const available = useMemo(() => collectWrongQuestionPdfItems(sourceSessions, questions), [sourceSessions, questions]);
  const subjects = useMemo(() => [...new Set(available.items.map(({ question }) => question.subject))], [available]);
  const chapters = useMemo(() => [...new Set(available.items.filter(({ question }) => !filters.subject || question.subject === filters.subject).map((item) => item.chapter))].sort((a, b) => a.localeCompare(b, "zh-Hant")), [available, filters.subject]);
  const dateInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const result = useMemo(() => collectWrongQuestionPdfItems(sourceSessions, questions, filters), [sourceSessions, questions, filters]);
  const items = dateInvalid ? EMPTY_ITEMS : result.items;
  const subjectCount = new Set(items.map(({ question }) => question.subject)).size;
  const dateLabel = filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "最早紀錄"} 至 ${filters.dateTo || "最近紀錄"}` : "全部作答日期";
  const html = useMemo(() => buildWrongQuestionPdfHtml({
    items, spacingCm: spacing, scopeLabel: scope === "current" ? "本次作答錯題" : "歷次作答錯題", dateLabel, baseUrl
  }), [items, spacing, scope, dateLabel, baseUrl]);

  function updateFilter<K extends keyof WrongQuestionPdfFilters>(key: K, value: WrongQuestionPdfFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "subject" ? { chapter: "" } : {}) }));
  }
  function handlePrint() {
    setNotice("");
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setNotice("請允許開啟彈出式視窗，再按一次匯出。"); return; }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    void preparePrintWindow(printWindow).catch(() => setNotice("列印視窗未完成準備，請關閉後重試。"));
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="min-w-0">
        {currentSession ? (
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-semibold text-ink">匯出範圍</legend>
            <div className="flex rounded-lg bg-slate-100 p-1">
              {([ ["current", "本次作答"], ["history", "歷次錯題"] ] as const).map(([value, label]) => (
                <label key={value} className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 ${scope === value ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-slate-500"}`}>
                  <input type="radio" name={`${id}-scope`} value={value} checked={scope === value} onChange={() => { setScope(value); setFilters({ ...EMPTY_PDF_FILTERS }); }} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-ink" htmlFor={`${id}-subject`}>科別</label>
            <span className="relative block"><select id={`${id}-subject`} className={FIELD_CLASS} value={filters.subject} onChange={(event) => updateFilter("subject", event.target.value)}>
              <option value="">全部科別</option>
              {subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /></span>
          </div>
          <div><label className="block text-sm font-medium text-ink" htmlFor={`${id}-chapter`}>章節</label>
            <span className="relative block"><select id={`${id}-chapter`} className={FIELD_CLASS} value={filters.chapter} onChange={(event) => updateFilter("chapter", event.target.value)}>
              <option value="">全部章節</option>
              {chapters.map((chapter) => <option key={chapter}>{chapter}</option>)}
            </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /></span>
          </div>
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
          <fieldset>
            <legend className="text-sm font-medium text-ink">每題筆記留白</legend>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[0, 2, 4, 6].map((value) => (
                <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 ${spacing === value ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}>
                  <input type="radio" name={`${id}-spacing`} value={value} checked={spacing === value} onChange={() => setSpacing(value)} className="sr-only" />
                  {value} cm
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-ink" aria-live="polite">共 {items.length} 題 · {subjectCount} 科</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">依科別、章節排列，同一題只收一次。保留題目與附圖，不附答案。</p>
          {scope === "history" ? <p className="mt-2 text-xs leading-5 text-slate-500">包含已完成的散題、模擬考及自訂卷。曾答錯即列入，即使後來答對。{!demo ? "依目前已載入的作答紀錄匯出。" : ""}</p> : null}
          {dateInvalid ? <p className="mt-3 text-sm text-rose-700" role="alert">結束日期需晚於或等於開始日期。</p> : null}
          {result.missingQuestionCount > 0 ? <p className="mt-3 text-sm text-amber-800" role="status">另有 {result.missingQuestionCount} 題找不到題目內容，未列入匯出。</p> : null}
          {result.unknownDateCount > 0 ? <p className="mt-3 text-sm text-amber-800">{result.unknownDateCount} 題缺少作答日期，未列入此日期範圍。</p> : null}
          <button type="button" disabled={items.length === 0 || dateInvalid || !baseUrl} onClick={handlePrint} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"><Printer size={16} aria-hidden="true" />列印／另存 PDF</button>
          <p className="mt-2 text-xs leading-5 text-slate-500">開啟列印視窗後，將目的地選為「另存為 PDF」。紙張選 A4，關閉頁首與頁尾。</p>
          {notice ? <p className="mt-3 text-sm text-rose-700" role="alert">{notice}</p> : null}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>A4 直式預覽</span><span>實際分頁以列印預覽為準</span></div>
        <div ref={previewContainerRef} className="overflow-hidden rounded-lg border border-slate-200 bg-[#e8e9e6]" style={{ height: Math.max(420, 920 * scale) }}>
          {baseUrl ? <iframe title="錯題 A4 列印稿預覽" sandbox="allow-same-origin" srcDoc={html} width="794" height={Math.max(920, 420 / scale)} style={{ display: "block", width: 794, maxWidth: "none", border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} /> : null}
        </div>
      </div>
    </div>
  );
}

export function WrongQuestionPdfExport({ questions, currentSession }: { questions: Question[]; currentSession?: QuizSession | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  useEffect(() => {
    if (!open) return;
    const refresh = () => setSessions(loadCompletedSessions({ includeFullLocalHistory: true }));
    refresh();
    window.addEventListener("completed-sessions-change", refresh);
    window.addEventListener("completed-question-history-change", refresh);
    return () => {
      window.removeEventListener("completed-sessions-change", refresh);
      window.removeEventListener("completed-question-history-change", refresh);
    };
  }, [open]);
  function close() { dialogRef.current?.close(); setOpen(false); triggerRef.current?.focus(); }
  return <>
    <button ref={triggerRef} type="button" onClick={() => { setOpen(true); dialogRef.current?.showModal(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Printer size={16} aria-hidden="true" />匯出錯題 PDF</button>
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={close} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} className="m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[1120px] overflow-y-auto rounded-xl border border-slate-200 bg-[color:var(--surface)] p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-3"><div><h2 id={titleId} className="text-xl font-semibold">匯出錯題 PDF</h2><p className="mt-1 text-sm text-slate-500">把錯題整理成一份能手寫訂正的練習單。</p></div><button type="button" aria-label="關閉匯出設定" onClick={close} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-slate-100"><X size={20} /></button></div>
      {open ? <WrongQuestionPdfWorkspace questions={questions} currentSession={currentSession} sessions={sessions} initialScope={currentSession ? "current" : "history"} /> : null}
    </dialog>
  </>;
}
