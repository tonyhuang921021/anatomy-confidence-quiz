"use client";

import Link from "next/link";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PHARMACOLOGY_FLASHCARDS } from "@/data/pharmacologyFlashcards";

const REVIEW_STATS_STORAGE_KEY = "pharmacology-review-stats-v1";
const CLOUD_SYNC_DEBOUNCE_MS = 1600;
const DESKTOP_SWIPE_THRESHOLD = 128;
const MIN_MOBILE_SWIPE_THRESHOLD = 92;
const MAX_MOBILE_SWIPE_THRESHOLD = 118;
const CARD_RELEASE_RATIO = 0.32;
const SWIPE_OUT_MS = 220;
const MIN_REVIEW_FLOOR_RATIO = 0.18;

type ReviewDirection = "known" | "unknown";

type DrugReviewStats = {
  known: number;
  unknown: number;
  seen: number;
  lastSeenAt: number | null;
  updatedAt: number | null;
};

type DrugReviewStatsMap = Record<string, DrugReviewStats>;
type CloudSyncStatus = "idle" | "syncing" | "synced" | "queued" | "error";

const EMPTY_REVIEW_STATS: DrugReviewStats = {
  known: 0,
  unknown: 0,
  seen: 0,
  lastSeenAt: null,
  updatedAt: null
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
  return normalizeReviewStats(statsMap[getDrugKey(item)]);
}

function normalizeReviewStats(value: Partial<DrugReviewStats> | undefined): DrugReviewStats {
  if (!value || typeof value !== "object") return EMPTY_REVIEW_STATS;

  return {
    known: Math.max(0, Math.floor(Number(value.known) || 0)),
    unknown: Math.max(0, Math.floor(Number(value.unknown) || 0)),
    seen: Math.max(0, Math.floor(Number(value.seen) || 0)),
    lastSeenAt: typeof value.lastSeenAt === "number" && Number.isFinite(value.lastSeenAt) ? value.lastSeenAt : null,
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : null
  };
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

    return normalizeReviewStatsMap(parsed as DrugReviewStatsMap);
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
    lastSeenAt: Date.now(),
    updatedAt: Date.now()
  };

  return {
    ...statsMap,
    [key]: next
  };
}

function normalizeReviewStatsMap(statsMap: DrugReviewStatsMap) {
  return Object.fromEntries(
    Object.entries(statsMap)
      .filter(([key]) => typeof key === "string" && key.includes("__"))
      .map(([key, value]) => [key, normalizeReviewStats(value)])
  ) as DrugReviewStatsMap;
}

function mergeReviewStatsMaps(localStats: DrugReviewStatsMap, cloudStats: DrugReviewStatsMap) {
  const merged: DrugReviewStatsMap = {};
  const keys = new Set([...Object.keys(localStats), ...Object.keys(cloudStats)]);

  keys.forEach((key) => {
    const local = normalizeReviewStats(localStats[key]);
    const cloud = normalizeReviewStats(cloudStats[key]);
    merged[key] = {
      known: Math.max(local.known, cloud.known),
      unknown: Math.max(local.unknown, cloud.unknown),
      seen: Math.max(local.seen, cloud.seen),
      lastSeenAt: Math.max(local.lastSeenAt ?? 0, cloud.lastSeenAt ?? 0) || null,
      updatedAt: Math.max(local.updatedAt ?? 0, cloud.updatedAt ?? 0) || null
    };
  });

  return merged;
}

function serializeReviewStats(statsMap: DrugReviewStatsMap) {
  return PHARMACOLOGY_FLASHCARDS.map((item) => {
    const key = getDrugKey(item);
    const stats = normalizeReviewStats(statsMap[key]);
    if (!stats.seen && !stats.known && !stats.unknown) return null;

    return {
      drugKey: key,
      name: item.name,
      category: item.category,
      known: stats.known,
      unknown: stats.unknown,
      seen: stats.seen,
      lastSeenAt: stats.lastSeenAt,
      updatedAt: stats.updatedAt ?? stats.lastSeenAt ?? Date.now()
    };
  }).filter(Boolean);
}

async function fetchCloudReviewStats(accessToken: string): Promise<DrugReviewStatsMap> {
  const response = await fetch("/api/pharmacology-review-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, action: "fetch" })
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; rows?: Array<{ drugKey: string; known: number; unknown: number; seen: number; lastSeenAt: number | null; updatedAt: number | null }>; message?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "藥理雲端紀錄讀取失敗。");
  }

  const statsMap: DrugReviewStatsMap = {};
  payload.rows?.forEach((row) => {
    if (!row.drugKey) return;
    statsMap[row.drugKey] = normalizeReviewStats({
      known: row.known,
      unknown: row.unknown,
      seen: row.seen,
      lastSeenAt: row.lastSeenAt,
      updatedAt: row.updatedAt
    });
  });

  return statsMap;
}

async function pushCloudReviewStats(accessToken: string, statsMap: DrugReviewStatsMap) {
  const rows = serializeReviewStats(statsMap);
  if (rows.length === 0) return;

  const response = await fetch("/api/pharmacology-review-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, action: "sync", rows })
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "藥理雲端紀錄同步失敗。");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSwipeThreshold(cardWidth: number) {
  if (cardWidth < 560) {
    return clamp(cardWidth * CARD_RELEASE_RATIO, MIN_MOBILE_SWIPE_THRESHOLD, MAX_MOBILE_SWIPE_THRESHOLD);
  }

  return DESKTOP_SWIPE_THRESHOLD;
}

function getPointerClientX(event: PointerEvent<HTMLDivElement>) {
  const nativeEvent = event.nativeEvent;
  const coalescedEvents = typeof nativeEvent.getCoalescedEvents === "function" ? nativeEvent.getCoalescedEvents() : [];
  const latestEvent = coalescedEvents.at(-1);

  return latestEvent?.clientX ?? event.clientX;
}

function getPointerClientY(event: PointerEvent<HTMLDivElement>) {
  const nativeEvent = event.nativeEvent;
  const coalescedEvents = typeof nativeEvent.getCoalescedEvents === "function" ? nativeEvent.getCoalescedEvents() : [];
  const latestEvent = coalescedEvents.at(-1);

  return latestEvent?.clientY ?? event.clientY;
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
  const { configured, session } = useAuth();
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRevealedClass, setHasRevealedClass] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewStats, setReviewStats] = useState<DrugReviewStatsMap>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [swipeResult, setSwipeResult] = useState<ReviewDirection | null>(null);
  const [showWeakList, setShowWeakList] = useState(false);
  const [, setCloudSyncStatus] = useState<CloudSyncStatus>("idle");
  const cardElementRef = useRef<HTMLDivElement | null>(null);
  const knownBadgeRef = useRef<HTMLSpanElement | null>(null);
  const unknownBadgeRef = useRef<HTMLSpanElement | null>(null);
  const pointerStartRef = useRef<{ pointerId: number | null; x: number; y: number; cardWidth: number } | null>(null);
  const dragIntentRef = useRef<"horizontal" | "vertical" | null>(null);
  const dragXRef = useRef(0);
  const pendingDragXRef = useRef(0);
  const dragFrameRef = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const latestReviewStatsRef = useRef<DrugReviewStatsMap>({});
  const accessTokenRef = useRef<string>("");

  const card = PHARMACOLOGY_FLASHCARDS[cardIndex] ?? PHARMACOLOGY_FLASHCARDS[0];
  const levelMeta = LEVEL_META[card.examLevel] ?? LEVEL_META.D;
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
    latestReviewStatsRef.current = storedStats;
    setReviewStats(storedStats);
    setCardIndex(pickWeightedIndex(storedStats));

    return () => {
      if (swipeTimerRef.current) {
        window.clearTimeout(swipeTimerRef.current);
      }
      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
      if (cloudSyncTimerRef.current) {
        window.clearTimeout(cloudSyncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? "";
  }, [session?.access_token]);

  const syncStatsToCloud = useCallback(async (statsMap: DrugReviewStatsMap) => {
    if (!configured || !accessTokenRef.current) {
      setCloudSyncStatus(Object.keys(statsMap).length ? "queued" : "idle");
      return;
    }

    setCloudSyncStatus("syncing");
    try {
      await pushCloudReviewStats(accessTokenRef.current, statsMap);
      setCloudSyncStatus("synced");
    } catch {
      setCloudSyncStatus("error");
    }
  }, [configured]);

  const queueCloudSync = useCallback((statsMap: DrugReviewStatsMap) => {
    latestReviewStatsRef.current = statsMap;

    if (!configured || !accessTokenRef.current) {
      setCloudSyncStatus(Object.keys(statsMap).length ? "queued" : "idle");
      return;
    }

    setCloudSyncStatus("queued");
    if (cloudSyncTimerRef.current) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }
    cloudSyncTimerRef.current = window.setTimeout(() => {
      void syncStatsToCloud(latestReviewStatsRef.current);
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }, [configured, syncStatsToCloud]);

  useEffect(() => {
    if (!configured || !session?.access_token) return;

    let cancelled = false;
    const accessToken = session.access_token;

    async function hydrateCloudStats() {
      setCloudSyncStatus("syncing");
      try {
        const cloudStats = await fetchCloudReviewStats(accessToken);
        if (cancelled) return;
        const mergedStats = mergeReviewStatsMaps(loadReviewStats(), cloudStats);
        latestReviewStatsRef.current = mergedStats;
        setReviewStats(mergedStats);
        saveReviewStats(mergedStats);
        setCloudSyncStatus("synced");
        queueCloudSync(mergedStats);
      } catch {
        if (!cancelled) {
          setCloudSyncStatus("error");
        }
      }
    }

    void hydrateCloudStats();

    return () => {
      cancelled = true;
    };
  }, [configured, queueCloudSync, session?.access_token]);

  const applyDragVisual = (nextDragX: number, animated = false) => {
    const cardElement = cardElementRef.current;
    if (!cardElement) return;

    const cardWidth = cardElement.getBoundingClientRect().width || window.innerWidth;
    const previewDistance = getSwipeThreshold(cardWidth);
    cardElement.style.transition = animated ? `transform ${SWIPE_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
    cardElement.style.transform = `translate3d(${nextDragX}px, 0, 0) rotate(${clamp(nextDragX / 16, -15, 15)}deg)`;

    if (knownBadgeRef.current) {
      knownBadgeRef.current.style.opacity = String(clamp(-nextDragX / previewDistance, 0, 1));
    }
    if (unknownBadgeRef.current) {
      unknownBadgeRef.current.style.opacity = String(clamp(nextDragX / previewDistance, 0, 1));
    }
  };

  const scheduleDragVisual = (nextDragX: number) => {
    pendingDragXRef.current = nextDragX;
    if (dragFrameRef.current !== null) return;

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applyDragVisual(pendingDragXRef.current);
    });
  };

  const settleDrag = (finalDragX: number, cardWidth: number, shouldFlipOnTap = true) => {
    const threshold = getSwipeThreshold(cardWidth);
    if (Math.abs(finalDragX) < 9) {
      dragXRef.current = 0;
      pendingDragXRef.current = 0;
      applyDragVisual(0, true);
      if (shouldFlipOnTap) flipCard();
      return;
    }

    if (Math.abs(finalDragX) >= threshold) {
      finishSwipe(finalDragX > 0 ? "unknown" : "known");
      return;
    }

    dragXRef.current = 0;
    pendingDragXRef.current = 0;
    applyDragVisual(0, true);
  };

  const resetActiveDrag = () => {
    pointerStartRef.current = null;
    dragIntentRef.current = null;
    setIsDragging(false);
    dragXRef.current = 0;
    pendingDragXRef.current = 0;
    applyDragVisual(0, true);
  };

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
    dragXRef.current = 0;
    pendingDragXRef.current = 0;
    applyDragVisual(0);
    setSwipeResult(null);
    setShowWeakList(false);
  };

  const finishSwipe = (direction: ReviewDirection) => {
    if (isLeaving) return;

    const nextStats = recordReviewResult(reviewStats, card, direction);
    latestReviewStatsRef.current = nextStats;
    setReviewStats(nextStats);
    saveReviewStats(nextStats);
    queueCloudSync(nextStats);
    setSwipeResult(direction);
    setIsDragging(false);
    setIsLeaving(true);
    const nextDragX = direction === "known" ? -window.innerWidth * 1.08 : window.innerWidth * 1.08;
    dragXRef.current = nextDragX;
    applyDragVisual(nextDragX, true);

    swipeTimerRef.current = window.setTimeout(() => {
      resetCardState();
      setCardIndex(pickWeightedIndex(nextStats, cardIndex));
      setIsLeaving(false);
      setSwipeResult(null);
      dragXRef.current = 0;
      pendingDragXRef.current = 0;
      window.requestAnimationFrame(() => applyDragVisual(0));
    }, SWIPE_OUT_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isLeaving) return;
    if (event.pointerType === "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a")) return;

    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: getPointerClientX(event),
      y: getPointerClientY(event),
      cardWidth: event.currentTarget.getBoundingClientRect().width
    };
    dragXRef.current = 0;
    dragIntentRef.current = null;
    pendingDragXRef.current = 0;
    applyDragVisual(0);
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId === null || start.pointerId !== event.pointerId || isLeaving) return;

    const nextDragX = getPointerClientX(event) - start.x;
    const verticalDelta = Math.abs(getPointerClientY(event) - start.y);
    const horizontalDelta = Math.abs(nextDragX);
    const hasHorizontalIntent = horizontalDelta > 12 && horizontalDelta > verticalDelta * 1.08;
    if (!hasHorizontalIntent && verticalDelta > 10 && verticalDelta > horizontalDelta) return;
    if (hasHorizontalIntent) event.preventDefault();

    dragXRef.current = nextDragX;
    scheduleDragVisual(nextDragX);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId === null || start.pointerId !== event.pointerId || isLeaving) return;

    pointerStartRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    settleDrag(dragXRef.current, start.cardWidth);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current?.pointerId === event.pointerId) {
      resetActiveDrag();
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (isLeaving) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a")) return;
    const touch = event.touches[0];
    if (!touch) return;

    pointerStartRef.current = {
      pointerId: null,
      x: touch.clientX,
      y: touch.clientY,
      cardWidth: event.currentTarget.getBoundingClientRect().width
    };
    dragXRef.current = 0;
    dragIntentRef.current = null;
    pendingDragXRef.current = 0;
    applyDragVisual(0);
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== null || isLeaving) return;
    const touch = event.touches[0];
    if (!touch) return;

    const nextDragX = touch.clientX - start.x;
    const verticalDelta = Math.abs(touch.clientY - start.y);
    const horizontalDelta = Math.abs(nextDragX);

    if (dragIntentRef.current === null) {
      if (verticalDelta > 10 && verticalDelta > horizontalDelta * 1.15) {
        dragIntentRef.current = "vertical";
        setIsDragging(false);
        return;
      }
      if (horizontalDelta > 12 && horizontalDelta > verticalDelta * 1.08) {
        dragIntentRef.current = "horizontal";
      } else {
        return;
      }
    }

    if (dragIntentRef.current !== "horizontal") return;

    event.preventDefault();
    dragXRef.current = nextDragX;
    scheduleDragVisual(nextDragX);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== null || isLeaving) return;

    const touch = event.changedTouches[0];
    const finalDragX = touch ? touch.clientX - start.x : dragXRef.current;
    const wasHorizontalDrag = dragIntentRef.current === "horizontal";
    dragXRef.current = finalDragX;
    pointerStartRef.current = null;
    dragIntentRef.current = null;
    setIsDragging(false);
    if (!wasHorizontalDrag && Math.abs(finalDragX) >= 9) return;
    settleDrag(finalDragX, start.cardWidth);
  };

  const handleTouchCancel = () => {
    if (pointerStartRef.current?.pointerId === null) {
      resetActiveDrag();
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
              隨機抽一個藥名，點卡片翻面看分類、機轉、適應症、國考考點、副作用禁忌、口訣和官方出現考期。拖到左邊代表會、拖到右邊代表不會，抽卡會依照重要度和你的不熟程度自動調整。
            </p>
          </div>
          <Link href="/" className="secondary-pill">
            回首頁
          </Link>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        <div className="hidden gap-3 sm:grid sm:grid-cols-2">
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
            ref={cardElementRef}
            className={`drug-flip-card ${isFlipped ? "is-flipped" : ""} ${isDragging ? "is-dragging" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handlePointerEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
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
              ref={knownBadgeRef}
              className="pointer-events-none absolute left-5 top-5 z-30 rounded-full border border-emerald-200 bg-emerald-50/95 px-4 py-2 text-sm font-black text-emerald-800 shadow-lg"
              style={{ opacity: 0 }}
            >
              會
            </span>
            <span
              ref={unknownBadgeRef}
              className="pointer-events-none absolute right-5 top-5 z-30 rounded-full border border-rose-200 bg-rose-50/95 px-4 py-2 text-sm font-black text-rose-800 shadow-lg"
              style={{ opacity: 0 }}
            >
              不會
            </span>
            <span className="drug-flip-inner">
              <span className="drug-flip-face drug-flip-front">
                <span className="rounded-full bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-700">
                  Today's Random Drug
                </span>
                <span className="mt-10 block max-w-full text-center font-serif text-[clamp(2rem,11vw,4.8rem)] font-bold leading-[1.02] tracking-[-0.02em] text-ink [overflow-wrap:break-word] [word-break:normal] sm:text-[clamp(3rem,7vw,6.2rem)]">
                  {card.name}
                </span>
                <span className="body-soft mt-8 block text-center text-sm font-semibold">點一下看機轉；抓住卡片拖到旁邊放手</span>
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
                      <span className="mt-1 block text-3xl font-black tracking-[-0.02em] text-ink [overflow-wrap:break-word] [word-break:normal]">{card.name}</span>
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

          {copied ? (
            <div className="mt-4 flex justify-end">
              <div className="rounded-full bg-slate-950/86 px-4 py-2 text-xs font-bold text-white shadow-lg">已複製</div>
            </div>
          ) : null}
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
