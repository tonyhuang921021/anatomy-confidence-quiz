"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PHARMACOLOGY_FLASHCARDS } from "@/data/pharmacologyFlashcards";

const REVIEW_STATS_STORAGE_KEY = "pharmacology-review-stats-v1";
const DESKTOP_SWIPE_THRESHOLD = 92;
const MIN_MOBILE_SWIPE_THRESHOLD = 54;
const MAX_MOBILE_SWIPE_THRESHOLD = 76;
const FAST_SWIPE_VELOCITY = 0.42;
const SWIPE_OUT_MS = 240;
const MIN_REVIEW_FLOOR_RATIO = 0.18;

type ReviewDirection = "known" | "unknown";

type DrugReviewStats = {
  known: number;
  unknown: number;
  seen: number;
  lastSeenAt: number | null;
};

type DrugReviewStatsMap = Record<string, DrugReviewStats>;

const EMPTY_REVIEW_STATS: DrugReviewStats = {
  known: 0,
  unknown: 0,
  seen: 0,
  lastSeenAt: null
};

const LEVEL_META = {
  A: {
    label: "A 級高頻",
    hint: "最常考，抽到機率最高",
    className: "border-rose-200 bg-rose-100 text-rose-800"
  },
  B: {
    label: "B 級常考",
    hint: "常見考點，建議熟",
    className: "border-amber-200 bg-amber-100 text-amber-800"
  },
  C: {
    label: "C 級會考",
    hint: "有機會出現，刷到就補",
    className: "border-sky-200 bg-sky-100 text-sky-800"
  },
  D: {
    label: "D 級低頻",
    hint: "低頻但保留複習",
    className: "border-slate-200 bg-slate-100 text-slate-700"
  },
  E: {
    label: "E 級備用",
    hint: "低優先，考前時間不足時最後處理",
    className: "border-zinc-200 bg-zinc-100 text-zinc-600"
  }
} as const;

function getDrugKey(item: (typeof PHARMACOLOGY_FLASHCARDS)[number]) {
  return `${item.name}__${item.category}`;
}

function getReviewStats(statsMap: DrugReviewStatsMap, item: (typeof PHARMACOLOGY_FLASHCARDS)[number]) {
  return statsMap[getDrugKey(item)] ?? EMPTY_REVIEW_STATS;
}

function getReviewWeight(item: (typeof PHARMACOLOGY_FLASHCARDS)[number], stats: DrugReviewStats) {
  const baseWeight = Math.max(item.drawWeight, 1);
  const difficultGap = Math.max(stats.unknown - stats.known, 0);
  const knownGap = Math.max(stats.known - stats.unknown, 0);
  const weaknessBoost = 1 + stats.unknown * 0.85 + difficultGap * 0.45;
  const masteryDiscount = 1 / (1 + knownGap * 0.2);
  const daysSinceSeen = stats.lastSeenAt ? Math.max((Date.now() - stats.lastSeenAt) / 86400000, 0) : null;
  const minutesSinceSeen = stats.lastSeenAt ? Math.max((Date.now() - stats.lastSeenAt) / 60000, 0) : null;
  const recentCooldown =
    minutesSinceSeen === null
      ? 1
      : minutesSinceSeen < 2
        ? 0.08
        : minutesSinceSeen < 10
          ? 0.2
          : minutesSinceSeen < 60
            ? 0.48
            : 1;
  const spacingBoost = daysSinceSeen === null ? 1.18 : Math.min(1.55, 1 + daysSinceSeen / 21);
  const weightedScore = baseWeight * weaknessBoost * masteryDiscount * spacingBoost * recentCooldown;
  const floorScore = Math.max(0.65, baseWeight * MIN_REVIEW_FLOOR_RATIO);

  return Math.max(floorScore, weightedScore);
}

function getWeaknessScore(item: (typeof PHARMACOLOGY_FLASHCARDS)[number], stats: DrugReviewStats) {
  const baseWeight = Math.max(item.drawWeight, 1);
  const missRate = stats.seen > 0 ? stats.unknown / stats.seen : 0;

  return stats.unknown * 2.4 + Math.max(stats.unknown - stats.known, 0) * 1.15 + missRate * 2 + baseWeight * 0.08;
}

function pickWeightedIndex(statsMap: DrugReviewStatsMap = {}, currentIndex?: number) {
  const totalWeight = PHARMACOLOGY_FLASHCARDS.reduce((sum, item, index) => {
    const weight = getReviewWeight(item, getReviewStats(statsMap, item));
    return sum + (index === currentIndex && PHARMACOLOGY_FLASHCARDS.length > 1 ? weight * 0.12 : weight);
  }, 0);
  let cursor = Math.random() * totalWeight;

  for (let index = 0; index < PHARMACOLOGY_FLASHCARDS.length; index += 1) {
    const item = PHARMACOLOGY_FLASHCARDS[index];
    if (!item) continue;
    const weight = getReviewWeight(item, getReviewStats(statsMap, item));
    cursor -= index === currentIndex && PHARMACOLOGY_FLASHCARDS.length > 1 ? weight * 0.12 : weight;
    if (cursor <= 0) {
      return index;
    }
  }

  return Math.max(PHARMACOLOGY_FLASHCARDS.length - 1, 0);
}

function loadReviewStats(): DrugReviewStatsMap {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(REVIEW_STATS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};

    return parsed as DrugReviewStatsMap;
  } catch {
    return {};
  }
}

function saveReviewStats(statsMap: DrugReviewStatsMap) {
  try {
    window.localStorage.setItem(REVIEW_STATS_STORAGE_KEY, JSON.stringify(statsMap));
  } catch {
    // Keep swipe review usable even when browser storage is full or blocked.
  }
}

function recordReviewResult(
  statsMap: DrugReviewStatsMap,
  item: (typeof PHARMACOLOGY_FLASHCARDS)[number],
  direction: ReviewDirection
) {
  const key = getDrugKey(item);
  const previous = statsMap[key] ?? EMPTY_REVIEW_STATS;
  const next: DrugReviewStats = {
    known: previous.known + (direction === "known" ? 1 : 0),
    unknown: previous.unknown + (direction === "unknown" ? 1 : 0),
    seen: previous.seen + 1,
    lastSeenAt: Date.now()
  };

  return {
    ...statsMap,
    [key]: next
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSwipeThreshold(cardWidth: number) {
  if (cardWidth < 560) {
    return clamp(cardWidth * 0.17, MIN_MOBILE_SWIPE_THRESHOLD, MAX_MOBILE_SWIPE_THRESHOLD);
  }

  return DESKTOP_SWIPE_THRESHOLD;
}

function isSwipeComplete(distance: number, elapsedMs: number, threshold: number) {
  const absoluteDistance = Math.abs(distance);
  const velocity = elapsedMs > 0 ? absoluteDistance / elapsedMs : 0;
  const fastEnough = velocity >= FAST_SWIPE_VELOCITY && absoluteDistance >= threshold * 0.45;

  return absoluteDistance >= threshold || fastEnough;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function PharmacologyReviewPage() {
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRevealedClass, setHasRevealedClass] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewStats, setReviewStats] = useState<DrugReviewStatsMap>({});
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [swipeResult, setSwipeResult] = useState<ReviewDirection | null>(null);
  const [showWeakList, setShowWeakList] = useState(false);
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number; startedAt: number; cardWidth: number } | null>(
    null
  );
  const dragXRef = useRef(0);
  const swipeTimerRef = useRef<number | null>(null);

  const card = PHARMACOLOGY_FLASHCARDS[cardIndex] ?? PHARMACOLOGY_FLASHCARDS[0];
  const levelMeta = LEVEL_META[card.examLevel] ?? LEVEL_META.D;
  const cardStats = getReviewStats(reviewStats, card);
  const reviewWeight = getReviewWeight(card, cardStats);
  const previewDistance = typeof window === "undefined" ? DESKTOP_SWIPE_THRESHOLD : getSwipeThreshold(window.innerWidth);
  const knownOpacity = clamp(-dragX / previewDistance, 0, 1);
  const unknownOpacity = clamp(dragX / previewDistance, 0, 1);
  const cardSwipeStyle = {
    transform: `translate3d(${dragX}px, 0, 0) rotate(${clamp(dragX / 18, -13, 13)}deg)`,
    transition: isDragging ? "none" : `transform ${SWIPE_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
  } satisfies CSSProperties;
  const sameCategoryCards = PHARMACOLOGY_FLASHCARDS.filter((item) => item.category === card.category).sort(
    (first, second) => second.drawWeight - first.drawWeight || first.name.localeCompare(second.name)
  );
  const weakestCards = useMemo(
    () =>
      PHARMACOLOGY_FLASHCARDS.map((item, index) => {
        const stats = getReviewStats(reviewStats, item);
        return {
          item,
          index,
          stats,
          score: getWeaknessScore(item, stats)
        };
      })
        .filter(({ stats }) => stats.unknown > 0)
        .sort((first, second) => second.score - first.score || second.item.drawWeight - first.item.drawWeight)
        .slice(0, 12),
    [reviewStats]
  );

  useEffect(() => {
    const storedStats = loadReviewStats();
    setReviewStats(storedStats);
    setCardIndex(pickWeightedIndex(storedStats));

    return () => {
      if (swipeTimerRef.current) {
        window.clearTimeout(swipeTimerRef.current);
      }
    };
  }, []);

  const resetCardState = () => {
    setIsFlipped(false);
    setHasRevealedClass(false);
    setCopied(false);
  };

  const flipCard = () => {
    if (isLeaving) return;

    setIsFlipped((value) => {
      const nextValue = !value;
      if (nextValue) {
        setHasRevealedClass(true);
      }
      return nextValue;
    });
  };

  const jumpToDrug = (index: number, reveal = true) => {
    setCardIndex(index);
    setIsFlipped(reveal);
    setHasRevealedClass(reveal);
    setCopied(false);
    setDragX(0);
    dragXRef.current = 0;
    setSwipeResult(null);
    setShowWeakList(false);
  };

  const finishSwipe = (direction: ReviewDirection) => {
    if (isLeaving) return;

    const nextStats = recordReviewResult(reviewStats, card, direction);
    setReviewStats(nextStats);
    saveReviewStats(nextStats);
    setSwipeResult(direction);
    setIsDragging(false);
    setIsLeaving(true);
    const nextDragX = direction === "known" ? -window.innerWidth * 1.08 : window.innerWidth * 1.08;
    dragXRef.current = nextDragX;
    setDragX(nextDragX);

    swipeTimerRef.current = window.setTimeout(() => {
      resetCardState();
      setCardIndex(pickWeightedIndex(nextStats, cardIndex));
      setIsLeaving(false);
      setSwipeResult(null);
      dragXRef.current = 0;
      setDragX(0);
    }, SWIPE_OUT_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isLeaving) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a")) return;

    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: Date.now(),
      cardWidth: event.currentTarget.getBoundingClientRect().width
    };
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId || isLeaving) return;

    const nextDragX = event.clientX - start.x;
    const verticalDelta = Math.abs(event.clientY - start.y);
    const horizontalDelta = Math.abs(nextDragX);
    const hasHorizontalIntent = horizontalDelta > 7 && horizontalDelta > verticalDelta * 0.75;
    if (!hasHorizontalIntent && verticalDelta > 10) return;
    if (hasHorizontalIntent) {
      event.preventDefault();
    }

    dragXRef.current = nextDragX;
    setDragX(nextDragX);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId || isLeaving) return;

    pointerStartRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const finalDragX = dragXRef.current;
    const threshold = getSwipeThreshold(start.cardWidth);
    const elapsedMs = Date.now() - start.startedAt;
    if (Math.abs(finalDragX) < 9) {
      setDragX(0);
      dragXRef.current = 0;
      flipCard();
      return;
    }

    if (isSwipeComplete(finalDragX, elapsedMs, threshold)) {
      finishSwipe(finalDragX > 0 ? "unknown" : "known");
      return;
    }

    dragXRef.current = 0;
    setDragX(0);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current?.pointerId === event.pointerId) {
      pointerStartRef.current = null;
      setIsDragging(false);
      dragXRef.current = 0;
      setDragX(0);
    }
  };

  const copyDrugName = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await copyText(card.name);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Pharmacology Cards</p>
            <h1 className="display-title mt-3 text-4xl sm:text-6xl">藥理複習</h1>
            <p className="body-soft mt-3 max-w-2xl text-base leading-8">
              隨機抽一個藥名，點卡片翻面看分類、機轉、適應症、國考考點、副作用禁忌、口訣和官方出現考期。左滑代表會，右滑代表不會，抽卡會依照重要度和你的不熟程度自動調整。
            </p>
          </div>
          <Link href="/" className="secondary-pill">
            回首頁
          </Link>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="surface-card-muted p-4">
            <p className="text-xs font-black text-brand-700">左滑</p>
            <p className="mt-2 text-lg font-black text-ink">會這個藥</p>
            <p className="body-soft mt-1 text-sm leading-6">降低近期權重，但仍保留最低複習率。</p>
          </div>
          <div className="surface-card-muted p-4">
            <p className="text-xs font-black text-rose-700">右滑</p>
            <p className="mt-2 text-lg font-black text-ink">不會這個藥</p>
            <p className="body-soft mt-1 text-sm leading-6">提高長期機率，但剛刷過會先冷卻。</p>
          </div>
          <div className="surface-card-muted p-4">
            <p className="text-xs font-black text-sky-800">目前權重</p>
            <p className="mt-2 text-lg font-black text-ink">{reviewWeight.toFixed(1)}</p>
            <p className="body-soft mt-1 text-sm leading-6">重要度 × 不熟次數 × 間隔冷卻。</p>
          </div>
          <div className="surface-card-muted p-4">
            <p className="text-xs font-black text-amber-800">這張紀錄</p>
            <p className="mt-2 text-lg font-black text-ink">
              會 {cardStats.known} / 不會 {cardStats.unknown}
            </p>
            <p className="body-soft mt-1 text-sm leading-6">點卡翻面，看完再左右滑。</p>
          </div>
        </div>

        <div className="surface-card p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">
              口訣來自國防國考藥訣 4.2 demo
            </p>
            <p className="body-soft text-xs font-bold">抓住卡片滑動：左會、右不會</p>
          </div>

          <div
            role="button"
            tabIndex={0}
            className={`drug-flip-card ${isFlipped ? "is-flipped" : ""}`}
            style={cardSwipeStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerCancel}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flipCard();
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                finishSwipe("known");
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                finishSwipe("unknown");
              }
            }}
            aria-label="翻轉藥理複習卡"
          >
            <span
              className="pointer-events-none absolute left-5 top-5 z-30 rounded-full border border-emerald-200 bg-emerald-50/95 px-4 py-2 text-sm font-black text-emerald-800 shadow-lg"
              style={{ opacity: knownOpacity }}
            >
              會
            </span>
            <span
              className="pointer-events-none absolute right-5 top-5 z-30 rounded-full border border-rose-200 bg-rose-50/95 px-4 py-2 text-sm font-black text-rose-800 shadow-lg"
              style={{ opacity: unknownOpacity }}
            >
              不會
            </span>
            <span className="drug-flip-inner">
              <span className="drug-flip-face drug-flip-front">
                <span className="rounded-full bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-700">
                  Today's Random Drug
                </span>
                <span className="mt-10 block max-w-full text-center font-serif text-[clamp(2rem,11vw,4.8rem)] font-bold leading-[1.02] tracking-[-0.04em] text-ink [overflow-wrap:anywhere] sm:text-[clamp(3rem,7vw,6.2rem)]">
                  {card.name}
                </span>
                <span className="body-soft mt-8 block text-center text-sm font-semibold">點一下看機轉；手機短滑或快甩也能換卡</span>
                {swipeResult ? (
                  <span className="mt-5 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
                    {swipeResult === "known" ? "這張收下，換下一張" : "這張先記仇，等等再來"}
                  </span>
                ) : null}
              </span>

              <span className="drug-flip-face drug-flip-back">
                <span className="grid gap-4 text-left">
                  <span className="flex flex-wrap items-start justify-between gap-3">
                    <span>
                      <span className="eyebrow text-[10px]">藥物</span>
                      <span className="mt-1 block text-3xl font-black tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">{card.name}</span>
                    </span>
                    <span className={`rounded-full border px-3 py-2 text-xs font-black ${levelMeta.className}`}>
                      {levelMeta.label}
                    </span>
                  </span>
                  <span className="rounded-[1.1rem] border border-slate-100 bg-white/60 px-4 py-3 text-xs font-bold text-slate-600">
                    {levelMeta.hint}
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">分類</span>
                    <span className="mt-2 block text-sm font-bold leading-7 text-slate-700">{card.category}</span>
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">機轉</span>
                    <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.mechanism}</span>
                  </span>
                  <span className="grid gap-4 sm:grid-cols-2">
                    <span className="rounded-[1.4rem] bg-emerald-50/90 p-4">
                      <span className="text-xs font-black text-brand-700">作用 / 國考考點</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.effects}</span>
                    </span>
                    <span className="rounded-[1.4rem] bg-sky-50/90 p-4">
                      <span className="text-xs font-black text-sky-800">適應症</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.indications}</span>
                    </span>
                  </span>
                  <span className="grid gap-4 sm:grid-cols-2">
                    <span className="rounded-[1.4rem] bg-rose-50/90 p-4">
                      <span className="text-xs font-black text-rose-800">副作用 / 禁忌（高頻）</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.adverseEffects}</span>
                    </span>
                    <span className="rounded-[1.4rem] bg-violet-50/90 p-4">
                      <span className="text-xs font-black text-violet-800">官方出現考期</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.officialExamPeriods}</span>
                    </span>
                  </span>
                  <span className="rounded-[1.4rem] bg-amber-50/90 p-4">
                    <span className="text-xs font-black text-amber-800">口訣</span>
                    <span className="mt-2 block whitespace-pre-line text-sm font-semibold leading-7 text-amber-950">{card.mnemonic}</span>
                  </span>
                </span>
              </span>
            </span>

            <span className="absolute bottom-4 right-4 z-20">
              <button
                type="button"
                onClick={copyDrugName}
                onPointerDown={(event) => event.stopPropagation()}
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5"
              >
                複製藥名
              </button>
            </span>
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
              <span className="rounded-full bg-white/70 px-4 py-2 text-center text-xs font-black text-slate-600">
                已看 {cardStats.seen}
              </span>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-center text-xs font-black text-emerald-800">
                會 {cardStats.known}
              </span>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-center text-xs font-black text-rose-800">
                不會 {cardStats.unknown}
              </span>
            </div>
            {copied ? (
              <div className="rounded-full bg-slate-950/86 px-4 py-2 text-xs font-bold text-white shadow-lg sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
                已複製
              </div>
            ) : null}
          </div>
        </div>

        {hasRevealedClass ? (
          <aside className="surface-card-muted p-5">
            <p className="eyebrow">Same Class</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">同分類藥物</h2>
            <p className="body-soft mt-2 text-sm leading-6">{card.category}</p>
            <div className="mt-5 max-h-[560px] overflow-auto rounded-[1.4rem] border border-slate-200 bg-white/72">
              <table className="w-full min-w-[1320px] text-left text-sm">
                <thead className="sticky top-0 bg-emerald-50 text-xs font-black text-brand-700">
                  <tr>
                    <th className="px-4 py-3">藥名</th>
                    <th className="px-4 py-3">等級</th>
                    <th className="px-4 py-3">機轉</th>
                    <th className="px-4 py-3">適應症</th>
                    <th className="px-4 py-3">作用 / 國考考點</th>
                    <th className="px-4 py-3">副作用 / 禁忌（高頻）</th>
                    <th className="px-4 py-3">口訣</th>
                    <th className="px-4 py-3">官方出現考期</th>
                  </tr>
                </thead>
                <tbody>
                  {sameCategoryCards.map((item, index) => {
                    const itemLevelMeta = LEVEL_META[item.examLevel] ?? LEVEL_META.D;
                    const targetIndex = PHARMACOLOGY_FLASHCARDS.findIndex(
                      (candidate) => getDrugKey(candidate) === getDrugKey(item)
                    );

                    return (
                      <tr key={`${item.category}-${item.name}-${index}`} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => jumpToDrug(targetIndex >= 0 ? targetIndex : cardIndex)}
                            className="text-left font-black text-ink underline decoration-brand-200 underline-offset-4 transition hover:text-brand-700"
                          >
                            {item.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${itemLevelMeta.className}`}>
                            {item.examLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.mechanism}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.indications}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.effects}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.adverseEffects}</td>
                        <td className="whitespace-pre-line px-4 py-3 font-semibold leading-6 text-slate-600">{item.mnemonic}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.officialExamPeriods}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => setShowWeakList((value) => !value)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-2xl transition hover:-translate-y-0.5 sm:bottom-8 sm:right-8"
      >
        最不會的藥
      </button>

      {showWeakList ? (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl rounded-[1.6rem] border border-slate-200 bg-white/96 p-4 shadow-2xl backdrop-blur sm:bottom-24 sm:right-8 sm:left-auto sm:mx-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-[10px]">Weakest Drugs</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">最不會的藥</h2>
              <p className="body-soft mt-1 text-xs font-semibold">依不會次數、不會比例和重要度排序。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeakList(false)}
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
            >
              關閉
            </button>
          </div>
          <div className="mt-4 max-h-[52vh] space-y-2 overflow-auto pr-1">
            {weakestCards.length > 0 ? (
              weakestCards.map(({ item, index, stats, score }) => {
                const itemLevelMeta = LEVEL_META[item.examLevel] ?? LEVEL_META.D;

                return (
                  <button
                    key={`${item.name}-${item.category}-${index}`}
                    type="button"
                    onClick={() => jumpToDrug(index)}
                    className="block w-full rounded-[1.1rem] border border-slate-100 bg-slate-50/80 p-3 text-left transition hover:-translate-y-0.5 hover:bg-emerald-50"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-ink">{item.name}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${itemLevelMeta.className}`}>
                        {item.examLevel}
                      </span>
                    </span>
                    <span className="body-soft mt-1 block text-xs font-semibold leading-5">{item.category}</span>
                    <span className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">不會 {stats.unknown}</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">會 {stats.known}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">弱點分 {score.toFixed(1)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[1.2rem] bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-600">
                先滑幾張，這裡就會開始長出你的藥理黑名單。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
