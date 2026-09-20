"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { WrongQuestionPdfExport } from "@/components/WrongQuestionPdfExport";
import type { Question, QuizSession } from "@/types/quiz";

type Context = "results" | "review";
type EntryPosition = { width: number; height: number; button: { x: number; y: number; width: number; height: number } };
type EntryPositions = Record<Context, { desktop: EntryPosition; mobile: EntryPosition }>;

function validPosition(position: EntryPosition | undefined): position is EntryPosition {
  if (!position?.button) return false;
  return [position.width, position.height, position.button.width, position.button.height].every((value) => Number.isFinite(value) && value > 0)
    && [position.button.x, position.button.y].every((value) => Number.isFinite(value) && value >= 0);
}
const CONTEXTS = [
  {
    id: "results", label: "結果頁", title: "這次答錯的題目，直接整理成練習單。",
    description: "入口放在作答結果上方的操作列。打開後預設「本次作答」，選好每題留白就能匯出。"
  },
  {
    id: "review", label: "錯題複習頁", title: "挑好科別、章節與日期，整理歷次錯題。",
    description: "入口放在「開始散題待複習」旁邊。打開後預設歷次錯題，可再選擇科別、章節及作答日期。"
  }
] as const;

export function IntegrationPreview({ questions, currentSession, sessions, initialContext }: {
  questions: Question[];
  currentSession: QuizSession;
  sessions: QuizSession[];
  initialContext: Context;
}) {
  const [context, setContext] = useState<Context>(initialContext);
  const id = useId();
  const [positions, setPositions] = useState<EntryPositions | null>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    let active = true;
    const media = window.matchMedia("(max-width: 639px)");
    const updateDevice = () => setMobile(media.matches);
    updateDevice();
    media.addEventListener("change", updateDevice);
    void fetch("/pdf-preview/entry-positions.json")
      .then((response) => response.ok ? response.json() as Promise<EntryPositions> : null)
      .then((value) => { if (active) setPositions(value); })
      .catch(() => { /* The separate export button remains available if screenshot metadata is absent. */ });
    return () => { active = false; media.removeEventListener("change", updateDevice); };
  }, []);
  const position = positions?.[context]?.[mobile ? "mobile" : "desktop"];
  const hasOverlay = validPosition(position);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = CONTEXTS.find((item) => item.id === context)!;

  function selectContext(next: Context) {
    setContext(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(window.history.state, "", url.toString());
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") nextIndex = (index + 1) % CONTEXTS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = CONTEXTS.length - 1;
    else return;
    event.preventDefault();
    selectContext(CONTEXTS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section aria-label="查看頁面入口">
      <div role="tablist" aria-label="入口位置" className="mb-6 inline-flex max-w-full gap-1 rounded-lg bg-slate-100 p-1">
        {CONTEXTS.map((item, index) => (
          <button key={item.id} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`${id}-${item.id}`} aria-controls={`${id}-panel`} aria-selected={context === item.id} tabIndex={context === item.id ? 0 : -1} onClick={() => selectContext(item.id)} onKeyDown={(event) => handleTabKey(event, index)} className={`min-h-11 rounded-md px-5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${context === item.id ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${context}`} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold leading-7 text-ink">{selected.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{selected.description}</p>
          </div>
          {hasOverlay ? <p className="text-sm leading-6 text-brand-700">點畫面中的「匯出錯題 PDF」試用設定。</p> : (
            <div className="shrink-0">
              <WrongQuestionPdfExport key={context} questions={questions} currentSession={context === "results" ? currentSession : undefined} demoSessions={sessions} demo />
              <p className="mt-1.5 text-xs text-slate-500">可直接試用相同的匯出設定</p>
            </div>
          )}
        </div>
        <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-[color:var(--surface)] px-4 py-3 text-xs text-slate-500">
            <span>{selected.label} · 實際頁面截圖</span>
            <span>示範紀錄<span className="hidden sm:inline"> · 桌機版</span><span className="sm:hidden"> · 手機版</span></span>
          </figcaption>
          <div className="relative">
            <picture>
              <source media="(max-width: 639px)" srcSet={`/pdf-preview/${context}-mobile.png`} />
              <img src={`/pdf-preview/${context}-desktop.png`} alt={`${selected.label}的示範畫面：${selected.description}`} className="block h-auto w-full" />
            </picture>
            {hasOverlay ? (
              <div className="absolute" style={{ left: `${position.button.x / position.width * 100}%`, top: `${position.button.y / position.height * 100}%`, width: `${position.button.width / position.width * 100}%`, height: `${position.button.height / position.height * 100}%` }}>
                <WrongQuestionPdfExport key={context} questions={questions} currentSession={context === "results" ? currentSession : undefined} demoSessions={sessions} demo triggerClassName="h-full w-full cursor-pointer rounded-lg bg-transparent text-transparent transition hover:bg-brand-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 [&_svg]:hidden" />
              </div>
            ) : null}
          </div>
        </figure>
      </div>
    </section>
  );
}
