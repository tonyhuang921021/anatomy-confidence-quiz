"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PharmacologyExamPeriodSummary } from "@/components/PharmacologyExamPeriodSummary";
import { PharmacologyExamQuestions } from "@/components/PharmacologyExamQuestions";
import type { PharmacologyDrugCard } from "@/data/pharmacologyFlashcards";
import {
  normalizePharmacologyLibraryQuery,
  type PharmacologyLibraryIndex,
  type PharmacologyLibraryIndexItem
} from "@/lib/pharmacologyLibrary";

const INDEX_URL = "/data/pharmacology-library/index.json";

export type SameClassDrugEntry = {
  card: PharmacologyDrugCard;
  cardIndex: number;
};

function getDrugKey(card: PharmacologyDrugCard) {
  return `${card.name}__${card.category}`;
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-3">
      <p className="text-xs font-black text-brand-800">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-700 [overflow-wrap:anywhere]">{children}</p>
    </div>
  );
}

export function PharmacologySameClassList({
  category,
  entries,
  currentDrugKey,
  onJumpToDrug
}: {
  category: string;
  entries: SameClassDrugEntry[];
  currentDrugKey: string;
  onJumpToDrug: (index: number) => void;
}) {
  const [libraryIndex, setLibraryIndex] = useState<PharmacologyLibraryIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expandedKey, setExpandedKey] = useState("");

  useEffect(() => {
    setExpandedKey("");
  }, [currentDrugKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(INDEX_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PharmacologyLibraryIndex>;
      })
      .then(setLibraryIndex)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const libraryDrugByName = useMemo(() => {
    const map = new Map<string, PharmacologyLibraryIndexItem>();
    for (const item of libraryIndex?.drugs ?? []) {
      map.set(normalizePharmacologyLibraryQuery(item.name), item);
      for (const alias of item.aliases) {
        const key = normalizePharmacologyLibraryQuery(alias);
        if (!map.has(key)) map.set(key, item);
      }
    }
    return map;
  }, [libraryIndex]);

  return (
    <aside className="surface-card-muted overflow-hidden" aria-labelledby="same-class-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="eyebrow">Same Class</p>
          <h2 id="same-class-heading" className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">同分類藥物</h2>
          <p className="body-soft mt-1 break-words text-sm leading-6">{category}</p>
        </div>
        <p className="text-sm font-black tabular-nums text-slate-500">{entries.length} 種</p>
      </div>

      <div role="list" aria-label="同分類藥物列表">
        {entries.map(({ card, cardIndex }) => {
          const key = getDrugKey(card);
          const expanded = expandedKey === key;
          const libraryDrug = libraryDrugByName.get(normalizePharmacologyLibraryQuery(card.name));
          const exams = libraryDrug?.exams ?? [];
          const isCurrent = key === currentDrugKey;

          return (
            <article key={key} role="listitem" className="border-b border-slate-200 last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`same-class-detail-${cardIndex}`}
                onClick={() => setExpandedKey((current) => current === key ? "" : key)}
                className={`flex min-h-[84px] w-full items-start justify-between gap-4 px-4 py-4 text-left transition focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-5 ${
                  expanded ? "bg-white" : "hover:bg-white/70"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-lg font-black text-ink [overflow-wrap:anywhere]">{card.name}</span>
                    <span className="text-xs font-black text-brand-700">{card.examLevel} 級</span>
                    {isCurrent ? <span className="text-[11px] font-bold text-slate-500">目前這張</span> : null}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{card.effects}</span>
                  <PharmacologyExamPeriodSummary exams={exams} />
                </span>
                <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {expanded ? (
                <div id={`same-class-detail-${cardIndex}`} className="border-t border-slate-100 bg-white px-4 pb-5 pt-4 sm:px-5">
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <Fact label="機轉">{card.mechanism}</Fact>
                    <Fact label="用途">{card.indications}</Fact>
                    <Fact label="國考考點">{card.effects}</Fact>
                    <Fact label="副作用／禁忌">{card.adverseEffects}</Fact>
                  </div>

                  {card.mnemonic && card.mnemonic !== "這筆藥物目前沒有對應口訣。" ? (
                    <div className="mt-4 border-l-2 border-amber-400 pl-4">
                      <p className="text-xs font-black text-amber-900">口訣</p>
                      <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-amber-950">{card.mnemonic}</p>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    {loadError ? (
                      <p className="text-sm font-semibold text-slate-500">考題連結暫時載入失敗，藥物資料仍可正常使用。</p>
                    ) : !libraryIndex ? (
                      <p className="text-sm font-semibold text-slate-500" role="status">正在整理考題考期…</p>
                    ) : (
                      <PharmacologyExamQuestions exams={exams} showEmpty />
                    )}
                  </div>

                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => onJumpToDrug(cardIndex)}
                      className="mt-4 min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                      切到這張複習卡
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
