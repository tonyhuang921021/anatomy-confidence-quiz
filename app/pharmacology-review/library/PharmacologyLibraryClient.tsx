"use client";

import { ChevronDown, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PharmacologyExamPeriodSummary } from "@/components/PharmacologyExamPeriodSummary";
import {
  ALL_PHARMACOLOGY_LIBRARY_SCOPES,
  filterPharmacologyLibraryItems,
  type PharmacologyLibraryBatch,
  type PharmacologyLibraryDrug,
  type PharmacologyLibraryIndex,
  type PharmacologyLibraryIndexItem,
  type PharmacologyLibrarySource,
  type PharmacologyLibraryStatement
} from "@/lib/pharmacologyLibrary";

const PharmacologyExamQuestions = dynamic(
  () => import("@/components/PharmacologyExamQuestions").then((module) => module.PharmacologyExamQuestions),
  {
    ssr: false,
    loading: () => <p className="text-sm font-bold text-slate-500" role="status">正在整理國考題目…</p>
  }
);

const INDEX_URL = "/data/pharmacology-library/index.json";
const INITIAL_RESULT_COUNT = 30;

type SourceMap = Map<string, PharmacologyLibrarySource>;

function SourceLinks({ sourceIds, sourceMap }: { sourceIds: string[]; sourceMap: SourceMap }) {
  const sources = [...new Set(sourceIds)].flatMap((sourceId) => {
    const source = sourceMap.get(sourceId);
    return source ? [source] : [];
  });

  if (sources.length === 0) return null;

  return (
    <span className="ml-1 inline-flex flex-wrap gap-x-1 align-baseline text-[11px] font-bold text-brand-700">
      {sources.map((source, index) => (
        <a
          key={source.sourceId}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-brand-300 underline-offset-2 hover:text-brand-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          aria-label={`查看資料來源：${source.title}`}
          title={source.publisher ? `${source.title}｜${source.publisher}` : source.title}
        >
          {sources.length === 1 ? "來源" : `來源${index + 1}`}
        </a>
      ))}
    </span>
  );
}

function StatementList({
  statements,
  sourceMap,
  showSources = true
}: {
  statements: PharmacologyLibraryStatement[];
  sourceMap: SourceMap;
  showSources?: boolean;
}) {
  return (
    <ul className="space-y-2 text-[15px] leading-7 text-ink sm:text-base">
      {statements.map((statement, index) => (
        <li key={`${statement.text}-${index}`} className="pl-4 before:-ml-4 before:mr-2 before:text-brand-600 before:content-['•']">
          {statement.text}
          {showSources ? <SourceLinks sourceIds={statement.sourceIds} sourceMap={sourceMap} /> : null}
        </li>
      ))}
    </ul>
  );
}

function DrugDetails({ drug }: { drug: PharmacologyLibraryDrug }) {
  const sourceMap = useMemo(
    () => new Map(drug.sources.map((source) => [source.sourceId, source])),
    [drug.sources]
  );

  return (
    <div className="border-t border-slate-200 bg-[var(--surface-muted)] px-4 py-5 sm:px-6">
      <div className="mb-6">
        <PharmacologyExamQuestions exams={drug.exams} showEmpty />
      </div>

      {drug.summarySections.length > 0 ? (
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          {drug.summarySections.map((section) => (
            <section key={section.key} aria-labelledby={`${drug.id}-${section.key}`}>
              <h3 id={`${drug.id}-${section.key}`} className="mb-2 text-sm font-black text-brand-800">
                {section.label}
              </h3>
              <StatementList statements={section.items} sourceMap={sourceMap} />
            </section>
          ))}
        </div>
      ) : null}

      {drug.mnemonics.length > 0 ? (
        <section className="mt-5 border-l-2 border-brand-400 pl-4" aria-labelledby={`${drug.id}-mnemonic`}>
          <h3 id={`${drug.id}-mnemonic`} className="mb-2 text-sm font-black text-brand-800">
            口訣
          </h3>
          <StatementList statements={drug.mnemonics} sourceMap={sourceMap} showSources={false} />
        </section>
      ) : null}

      <details className="group mt-5 border-t border-slate-300/80 pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-ink focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 [&::-webkit-details-marker]:hidden">
          查看完整資料
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-4 space-y-6">
          {drug.detailGroups.map((group) => (
            <section key={group.key} aria-labelledby={`${drug.id}-detail-${group.key}`}>
              <h3 id={`${drug.id}-detail-${group.key}`} className="mb-2 text-sm font-black text-brand-800">
                {group.label}
              </h3>
              <StatementList statements={group.statements} sourceMap={sourceMap} />
            </section>
          ))}

          {drug.categories.length > 0 ? (
            <section aria-labelledby={`${drug.id}-categories`}>
              <h3 id={`${drug.id}-categories`} className="mb-2 text-sm font-black text-brand-800">
                分類
              </h3>
              <ul className="space-y-1 text-sm leading-6 text-ink">
                {drug.categories.map((category) => (
                  <li key={category.path}>
                    {category.path}
                    <SourceLinks sourceIds={category.sourceIds} sourceMap={sourceMap} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function ResultRow({
  item,
  expanded,
  drug,
  loading,
  error,
  onToggle
}: {
  item: PharmacologyLibraryIndexItem;
  expanded: boolean;
  drug: PharmacologyLibraryDrug | null;
  loading: boolean;
  error: string | null;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`drug-detail-${item.id}`}
        className="flex min-h-[76px] w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-[var(--surface-muted)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-6"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg font-black text-ink">{item.name}</span>
            {item.level ? <span className="text-xs font-black text-brand-700">{item.level} 級</span> : null}
            {item.directExamCount > 0 ? (
              <span className="text-xs font-bold text-slate-500">國考 {item.directExamCount} 題</span>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-sm font-bold text-slate-500">
            {item.scopes.join(" · ") || item.categories[0] || "藥理資料"}
          </span>
          <PharmacologyExamPeriodSummary exams={item.exams ?? []} />
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {expanded ? (
        <div id={`drug-detail-${item.id}`}>
          {loading ? (
            <p className="border-t border-slate-200 px-4 py-5 text-sm font-bold text-slate-500" role="status">
              載入資料中…
            </p>
          ) : error ? (
            <p className="border-t border-slate-200 px-4 py-5 text-sm font-bold text-rose-700" role="alert">
              {error}
            </p>
          ) : drug ? (
            <DrugDetails drug={drug} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function PharmacologyLibraryClient() {
  const [index, setIndex] = useState<PharmacologyLibraryIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<string>(ALL_PHARMACOLOGY_LIBRARY_SCOPES);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [batchCache, setBatchCache] = useState<Record<string, PharmacologyLibraryBatch>>({});
  const [loadingBatch, setLoadingBatch] = useState<string | null>(null);
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch(INDEX_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PharmacologyLibraryIndex>;
      })
      .then(setIndex)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("資料暫時載入失敗，請重新整理後再試一次。");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setVisibleCount(INITIAL_RESULT_COUNT);
    setExpandedId(null);
  }, [query, scope]);

  const filteredItems = useMemo(
    () => filterPharmacologyLibraryItems(index?.drugs ?? [], query, scope),
    [index?.drugs, query, scope]
  );
  const visibleItems = filteredItems.slice(0, visibleCount);

  const toggleDrug = async (item: PharmacologyLibraryIndexItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    if (batchCache[item.batch] || loadingBatch === item.batch) return;

    setLoadingBatch(item.batch);
    setBatchErrors((current) => ({ ...current, [item.batch]: "" }));
    try {
      const response = await fetch(`/data/pharmacology-library/batches/${item.batch}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const batch = (await response.json()) as PharmacologyLibraryBatch;
      setBatchCache((current) => ({ ...current, [item.batch]: batch }));
    } catch {
      setBatchErrors((current) => ({ ...current, [item.batch]: "這筆資料暫時載入失敗，請再點一次。" }));
    } finally {
      setLoadingBatch((current) => (current === item.batch ? null : current));
    }
  };

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Pharmacology Library</p>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">藥理資料</h1>
            <p className="body-soft mt-3 max-w-2xl text-base leading-7">
              搜藥名或考點；考期會先列出來，點開可直接看站內考題，答案預設隱藏。
            </p>
          </div>
          <Link href="/pharmacology-review" className="secondary-pill">
            回藥理複習
          </Link>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-200/80 pt-5 md:grid-cols-[minmax(0,1fr)_13rem]">
          <label className="relative block" htmlFor="pharmacology-library-search">
            <span className="sr-only">搜尋藥理資料</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              id="pharmacology-library-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋藥名、分類或考點"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base font-bold text-ink outline-none transition placeholder:font-medium placeholder:text-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200"
            />
          </label>
          <label htmlFor="pharmacology-library-scope" className="sr-only">
            複習範圍
          </label>
          <select
            id="pharmacology-library-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-ink outline-none transition focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            <option value={ALL_PHARMACOLOGY_LIBRARY_SCOPES}>{ALL_PHARMACOLOGY_LIBRARY_SCOPES}</option>
            {(index?.scopes ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="surface-card mt-5 overflow-hidden" aria-labelledby="pharmacology-library-results">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 id="pharmacology-library-results" className="text-base font-black text-ink">
            搜尋結果
          </h2>
          <p className="text-sm font-bold text-slate-500" aria-live="polite">
            {index ? `${filteredItems.length} 種藥` : "載入中…"}
          </p>
        </div>

        {loadError ? (
          <p className="px-4 py-8 text-center text-sm font-bold text-rose-700" role="alert">
            {loadError}
          </p>
        ) : !index ? (
          <p className="px-4 py-8 text-center text-sm font-bold text-slate-500" role="status">
            正在載入藥理資料…
          </p>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-base font-black text-ink">找不到符合的藥物</p>
            <p className="body-soft mt-2 text-sm">試著縮短關鍵字，或切回全部範圍。</p>
          </div>
        ) : (
          <>
            <ul>
              {visibleItems.map((item) => {
                const batch = batchCache[item.batch];
                const drug = batch?.drugs.find((candidate) => candidate.id === item.id) ?? null;
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    drug={drug}
                    loading={expandedId === item.id && loadingBatch === item.batch && !drug}
                    error={batchErrors[item.batch] || null}
                    onToggle={() => void toggleDrug(item)}
                  />
                );
              })}
            </ul>
            {visibleCount < filteredItems.length ? (
              <div className="border-t border-slate-200 p-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + INITIAL_RESULT_COUNT)}
                  className="secondary-pill min-h-11"
                >
                  顯示更多
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
