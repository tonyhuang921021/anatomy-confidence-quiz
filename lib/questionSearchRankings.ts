import type { QuestionSearchRanking } from "@/lib/questionSearch";

type QuestionSearchRankingPayload = {
  rankings: Record<string, QuestionSearchRanking>;
  degraded: boolean;
  message?: string;
};

const CACHE_KEY = "anatomy-confidence-question-search-rankings-v2";
const CACHE_TTL_MS = 15 * 60 * 1000;
let memoryCache: { savedAt: number; payload: QuestionSearchRankingPayload } | null = null;
let requestInFlight: Promise<QuestionSearchRankingPayload> | null = null;

function readSessionCache() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? "") as {
      savedAt?: number;
      payload?: QuestionSearchRankingPayload;
    };
    if (!parsed.savedAt || !parsed.payload || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return { savedAt: parsed.savedAt, payload: parsed.payload };
  } catch {
    return null;
  }
}

function writeCache(payload: QuestionSearchRankingPayload) {
  const entry = { savedAt: Date.now(), payload };
  memoryCache = entry;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // The in-memory cache still avoids duplicate requests in this tab.
  }
}

export async function loadQuestionSearchRankings() {
  if (memoryCache && Date.now() - memoryCache.savedAt <= CACHE_TTL_MS) {
    return memoryCache.payload;
  }
  const stored = readSessionCache();
  if (stored) {
    memoryCache = stored;
    return stored.payload;
  }
  if (requestInFlight) return requestInFlight;

  requestInFlight = (async () => {
    const response = await fetch("/api/question-search-rankings");
    const raw = (await response.json().catch(() => null)) as {
      ok?: boolean;
      rankings?: Array<[string, number, number, number]>;
      degraded?: boolean;
      message?: string;
    } | null;
    if (!response.ok || !raw?.ok) {
      throw new Error(raw?.message || "搜尋排名載入失敗");
    }
    const payload = {
      rankings: Object.fromEntries(
        (raw.rankings ?? []).map(([questionId, totalAttempts, correctRate, chaosCount]) => [
          questionId,
          { questionId, totalAttempts, correctRate, chaosCount }
        ])
      ),
      degraded: raw.degraded === true,
      message: raw.message
    };
    if (!payload.degraded) writeCache(payload);
    return payload;
  })();

  try {
    return await requestInFlight;
  } finally {
    requestInFlight = null;
  }
}
