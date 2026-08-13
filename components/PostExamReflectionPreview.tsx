"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  PersonalCumulativeChart,
  SeasonActivityChart,
  SimulationScoreChart,
  downloadPostExamRecapPng
} from "@/components/PostExamCharts";
import { POST_EXAM_SEASON_SNAPSHOT } from "@/data/postExamSeasonSnapshot";
import {
  POST_EXAM_MINIMUM_ATTEMPTS,
  POST_EXAM_SNAPSHOT_VERSION,
  POST_EXAM_SURVEY_ID,
  buildPostExamCumulativePoints,
  getDefaultPostExamSurveyAnswers,
  getPostExamTotalAttempts,
  hasPostExamSurveyErrors,
  isPostExamSnapshotEligible,
  mergePostExamSnapshotWithLocal,
  normalizePostExamPersonalSnapshot,
  summarizeLocalPostExamSessions,
  validatePostExamSurveyAnswers,
  type PostExamPersonalSnapshot,
  type PostExamSurveyAnswers
} from "@/lib/postExamReflection";
import { loadCompletedSessions } from "@/lib/storage";

type RecapResponse = {
  ok?: boolean;
  snapshot?: unknown;
  message?: string;
};

type SurveyResponse = {
  ok?: boolean;
  submitted?: boolean;
  alreadySubmitted?: boolean;
  answers?: PostExamSurveyAnswers | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  message?: string;
  errors?: Partial<Record<keyof PostExamSurveyAnswers, string>>;
};

type StoredSurveyDraft = {
  answers: PostExamSurveyAnswers;
  updatedAt: string;
};

const REQUEST_TIMEOUT_MS = 10_000;
const RECAP_REQUEST_TIMEOUT_MS = 30_000;

function safeReadStorage<T>(key: string): T | null {
  for (const getStorage of [
    () => window.localStorage,
    () => window.sessionStorage
  ]) {
    try {
      const storage = getStorage();
      const raw = storage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // Try the next browser storage when Safari blocks one of them.
    }
  }
  return null;
}

function safeWriteStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

function safeRemoveStorage(key: string) {
  for (const getStorage of [
    () => window.localStorage,
    () => window.sessionStorage
  ]) {
    try {
      getStorage().removeItem(key);
    } catch {
      // Storage cleanup is best effort only.
    }
  }
}

function getSnapshotCacheKey(userId: string) {
  return `acq-post-exam-snapshot:${POST_EXAM_SNAPSHOT_VERSION}:${userId}`;
}

function getSnapshotPendingKey(userId: string) {
  return `acq-post-exam-snapshot-pending:${POST_EXAM_SNAPSHOT_VERSION}:${userId}`;
}

function getSurveyDraftKey(userId: string) {
  return `acq-post-exam-survey-draft:${POST_EXAM_SURVEY_ID}:${userId}`;
}

function getSurveyPendingKey(userId: string) {
  return `acq-post-exam-survey-pending:${POST_EXAM_SURVEY_ID}:${userId}`;
}

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof data.message === "string" ? data.message : "讀取失敗");
    }
    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function hasLocalSurveyContent(value: StoredSurveyDraft | null) {
  if (!value) return false;
  const answers = value.answers;
  return Boolean(
    answers.publicAlias.trim() ||
      answers.med1Score != null ||
      answers.med2Score != null ||
      answers.studyReflection.trim() ||
      answers.encouragement.trim()
  );
}

function SurveyCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 py-2 ${disabled ? "cursor-default opacity-80" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-brand-600"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

export function PostExamReflectionPreview() {
  const { configured, loading: authLoading, user, session } = useAuth();
  const [snapshot, setSnapshot] = useState<PostExamPersonalSnapshot | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [recapPhase, setRecapPhase] = useState("等待登入狀態");
  const [recapError, setRecapError] = useState("");
  const [pngStatus, setPngStatus] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<PostExamSurveyAnswers>(
    getDefaultPostExamSurveyAnswers
  );
  const [surveyHydrated, setSurveyHydrated] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [surveySubmittedAt, setSurveySubmittedAt] = useState<string | null>(null);
  const [surveyStatus, setSurveyStatus] = useState("");
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyErrors, setSurveyErrors] = useState<
    Partial<Record<keyof PostExamSurveyAnswers, string>>
  >({});
  const surveyTouchedRef = useRef(false);
  const surveyRetryRef = useRef(false);

  const accessToken = session?.access_token ?? "";
  const totalAttempts = useMemo(
    () => getPostExamTotalAttempts(snapshot?.sessions ?? []),
    [snapshot?.sessions]
  );
  const isEligible = Boolean(snapshot && isPostExamSnapshotEligible(snapshot));
  const cumulativePoints = useMemo(
    () => buildPostExamCumulativePoints(snapshot?.sessions ?? []),
    [snapshot?.sessions]
  );

  useEffect(() => {
    setSurveyAnswers(getDefaultPostExamSurveyAnswers());
    setSurveyHydrated(false);
    setSurveySubmitted(false);
    setSurveySubmittedAt(null);
    setSurveyStatus("");
    setSurveyErrors({});
    surveyTouchedRef.current = false;
    surveyRetryRef.current = false;
  }, [user?.id]);

  const reconcilePendingSnapshot = useCallback(
    async (userId: string, pending: { sessions: unknown[]; simulations: unknown[] }) => {
      if (!accessToken) return null;
      try {
        const data = (await fetchJsonWithTimeout("/api/post-exam-recap", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(pending)
        })) as RecapResponse;
        const normalized = normalizePostExamPersonalSnapshot(data.snapshot);
        if (!normalized) return null;
        safeWriteStorage(getSnapshotCacheKey(userId), normalized);
        safeRemoveStorage(getSnapshotPendingKey(userId));
        return normalized;
      } catch {
        // The compact additive payload remains local for a later retry.
        return null;
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (authLoading) return;
    setAccessChecked(false);
    if (!configured) {
      setRecapPhase("");
      setRecapError("Supabase 尚未設定，無法建立個人固定快照。");
      setAccessChecked(true);
      return;
    }
    if (!user || !accessToken) {
      setRecapPhase("");
      setSnapshot(null);
      setAccessChecked(true);
      return;
    }

    let active = true;
    const userId = user.id;
    const cacheKey = getSnapshotCacheKey(userId);
    const pendingKey = getSnapshotPendingKey(userId);
    const cached = normalizePostExamPersonalSnapshot(safeReadStorage(cacheKey));
    if (cached) {
      const pending = safeReadStorage<{ sessions: unknown[]; simulations: unknown[] }>(pendingKey);
      const cachedWithPending = pending
        ? mergePostExamSnapshotWithLocal(cached, {
            sessions: pending.sessions as PostExamPersonalSnapshot["sessions"],
            simulations: pending.simulations as PostExamPersonalSnapshot["simulations"]
          })
        : cached;
      setSnapshot(cachedWithPending);
      setRecapError("");
      setRecapPhase("已載入固定快照");

      async function finishCachedSnapshot() {
        const reconciled = pending
          ? await reconcilePendingSnapshot(userId, pending)
          : null;
        if (!active) return;
        if (reconciled) setSnapshot(reconciled);
        setAccessChecked(true);
      }

      void finishCachedSnapshot();
      return () => {
        active = false;
      };
    }

    async function loadSnapshot() {
      try {
        setRecapPhase("讀取雲端固定快照");
        setRecapError("");
        const data = (await fetchJsonWithTimeout(
          "/api/post-exam-recap",
          {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` }
          },
          RECAP_REQUEST_TIMEOUT_MS
        )) as RecapResponse;
        if (!active) return;
        const cloudSnapshot = normalizePostExamPersonalSnapshot(data.snapshot);
        if (!cloudSnapshot) throw new Error("雲端回傳的考後快照格式不完整。");

        setRecapPhase("整合這台裝置的完整紀錄");
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        if (!active) return;
        const local = summarizeLocalPostExamSessions(
          loadCompletedSessions({ includeFullLocalHistory: true })
        );
        const merged = mergePostExamSnapshotWithLocal(cloudSnapshot, local);
        setRecapPhase("已建立固定快照");
        safeWriteStorage(cacheKey, merged);

        let finalSnapshot: PostExamPersonalSnapshot = merged;
        if (
          merged.sessions.length > cloudSnapshot.sessions.length ||
          merged.simulations.length > cloudSnapshot.simulations.length
        ) {
          const pending = { sessions: local.sessions, simulations: local.simulations };
          safeWriteStorage(pendingKey, pending);
          const reconciled = await reconcilePendingSnapshot(userId, pending);
          if (reconciled) finalSnapshot = reconciled;
        }
        if (!active) return;
        setSnapshot(finalSnapshot);
        setAccessChecked(true);
      } catch (error) {
        if (!active) return;
        setRecapPhase("");
        setRecapError(
          error instanceof Error
            ? error.message
            : "個人回顧暫時無法載入，本機紀錄沒有被修改。"
        );
        setAccessChecked(true);
      }
    }

    void loadSnapshot();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, configured, reconcilePendingSnapshot, user?.id]);

  const submitSurveyAnswers = useCallback(
    async (answers: PostExamSurveyAnswers, silent = false) => {
      if (!user?.id || !accessToken) return false;
      const validation = validatePostExamSurveyAnswers(answers);
      setSurveyErrors(validation.errors);
      if (hasPostExamSurveyErrors(validation)) {
        if (!silent) setSurveyStatus("請先修正標示的欄位。");
        return false;
      }

      const pendingKey = getSurveyPendingKey(user.id);
      safeWriteStorage(pendingKey, {
        answers: validation.data,
        updatedAt: new Date().toISOString()
      });
      if (!silent) {
        setSurveySubmitting(true);
        setSurveyStatus("送出中");
      }
      try {
        const data = (await fetchJsonWithTimeout("/api/post-exam-survey", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            answers: validation.data,
            clientMeta: {
              viewport: { width: window.innerWidth, height: window.innerHeight }
            }
          })
        })) as SurveyResponse;
        safeRemoveStorage(pendingKey);
        setSurveyAnswers(
          validatePostExamSurveyAnswers(data.answers ?? validation.data).data
        );
        setSurveySubmitted(true);
        setSurveySubmittedAt(data.updatedAt ?? data.submittedAt ?? new Date().toISOString());
        setSurveyStatus(
          data.alreadySubmitted
            ? "這個帳號已送出回覆，已載入第一次送出的內容。"
            : silent
              ? "先前待補傳的回覆已送出。"
              : "回覆已送出。"
        );
        return true;
      } catch (error) {
        setSurveyStatus(
          error instanceof Error
            ? `${error.message} 草稿與待補傳內容仍在這台裝置。`
            : "送出失敗，草稿與待補傳內容仍在這台裝置。"
        );
        return false;
      } finally {
        if (!silent) setSurveySubmitting(false);
      }
    },
    [accessToken, user?.id]
  );

  useEffect(() => {
    if (
      authLoading ||
      !accessChecked ||
      !isEligible ||
      !user?.id ||
      !accessToken
    ) {
      return;
    }
    let active = true;
    const draftKey = getSurveyDraftKey(user.id);
    const pendingKey = getSurveyPendingKey(user.id);
    const localDraft = safeReadStorage<StoredSurveyDraft>(draftKey);
    const pending = safeReadStorage<StoredSurveyDraft>(pendingKey);
    const preferredLocal = pending ?? localDraft;
    if (preferredLocal?.answers) {
      setSurveyAnswers(validatePostExamSurveyAnswers(preferredLocal.answers).data);
    }

    async function loadSubmission() {
      try {
        const data = (await fetchJsonWithTimeout("/api/post-exam-survey", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` }
        })) as SurveyResponse;
        if (!active) return;
        const submitted = Boolean(data.submitted);
        setSurveySubmitted(submitted);
        setSurveySubmittedAt(data.updatedAt ?? data.submittedAt ?? null);
        if (submitted && data.answers) {
          const normalizedRemote = validatePostExamSurveyAnswers(data.answers).data;
          safeRemoveStorage(pendingKey);
          safeWriteStorage(draftKey, {
            answers: normalizedRemote,
            updatedAt: data.updatedAt ?? data.submittedAt ?? new Date().toISOString()
          } satisfies StoredSurveyDraft);
          setSurveyAnswers(normalizedRemote);
          setSurveyStatus("已載入第一次送出的內容，以下表單為唯讀。");
          return;
        }
        if (data.answers && !surveyTouchedRef.current && !pending) {
          const remoteUpdatedAt = Date.parse(data.updatedAt ?? data.submittedAt ?? "");
          const localUpdatedAt = Date.parse(localDraft?.updatedAt ?? "");
          if (
            !hasLocalSurveyContent(localDraft) ||
            !Number.isFinite(localUpdatedAt) ||
            (Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt >= localUpdatedAt)
          ) {
            setSurveyAnswers(validatePostExamSurveyAnswers(data.answers).data);
          }
        }
        if (pending && !surveyRetryRef.current) {
          surveyRetryRef.current = true;
          await submitSurveyAnswers(pending.answers, true);
        }
      } catch (error) {
        if (!active) return;
        setSurveyStatus(
          error instanceof Error
            ? `${error.message} 仍可先填寫，內容會留在本機。`
            : "問卷暫時無法連線，仍可先填寫。"
        );
      } finally {
        if (active) setSurveyHydrated(true);
      }
    }

    void loadSubmission();
    return () => {
      active = false;
    };
  }, [accessChecked, accessToken, authLoading, isEligible, submitSurveyAnswers, user?.id]);

  useEffect(() => {
    if (!surveyHydrated || !user?.id || !isEligible) return;
    safeWriteStorage(getSurveyDraftKey(user.id), {
      answers: surveyAnswers,
      updatedAt: new Date().toISOString()
    } satisfies StoredSurveyDraft);
  }, [isEligible, surveyAnswers, surveyHydrated, user?.id]);

  function updateSurvey<K extends keyof PostExamSurveyAnswers>(
    key: K,
    value: PostExamSurveyAnswers[K]
  ) {
    if (surveySubmitted || !surveyHydrated) return;
    surveyTouchedRef.current = true;
    setSurveyAnswers((current) => ({ ...current, [key]: value }));
    setSurveyErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSurveySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (surveySubmitted || !surveyHydrated) return;
    await submitSurveyAnswers(surveyAnswers);
  }

  async function handleDownloadPng() {
    if (!snapshot) return;
    try {
      setPngStatus("產生完整回顧圖中");
      await downloadPostExamRecapPng({
        snapshot,
        cumulativePoints,
        seasonDaily: POST_EXAM_SEASON_SNAPSHOT.daily,
        seasonTotalAttempts: POST_EXAM_SEASON_SNAPSHOT.totalAttempts,
        seasonCorrectAttempts: POST_EXAM_SEASON_SNAPSHOT.correctAttempts
      });
      setPngStatus("完整回顧圖已下載");
    } catch (error) {
      setPngStatus(error instanceof Error ? error.message : "PNG 產生失敗");
    }
  }

  if (authLoading) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-[1280px] px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-slate-600">讀取登入狀態中...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-[960px] px-4 py-16 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <p className="eyebrow">Post-exam recap</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">請先登入</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            登入後會讀取固定到 2026/7/17 15:00 的個人回顧資料。
          </p>
          <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-brand-600 px-5 font-semibold text-white">
            返回首頁登入
          </Link>
        </section>
      </main>
    );
  }

  if (!accessChecked) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-[960px] px-4 py-16 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <p className="eyebrow">Post-exam recap</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">正在整理你的考季</h1>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-600" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {recapPhase || "建立固定快照中"}
          </p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-[960px] px-4 py-16 sm:px-6">
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <p className="eyebrow">Post-exam recap</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">個人回顧暫時無法載入</h1>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            {recapError || "請稍後再試；這台裝置的作答紀錄沒有被修改。"}
          </p>
          <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-white px-5 font-semibold text-slate-800">
            返回首頁
          </Link>
        </section>
      </main>
    );
  }

  if (!isEligible) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-[960px] px-4 py-16 sm:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <p className="eyebrow">Post-exam recap</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">這份回顧尚未開放</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            這次開放給截至考試結束累積作答超過 {POST_EXAM_MINIMUM_ATTEMPTS} 題的使用者；目前固定快照收錄 {totalAttempts.toLocaleString("zh-TW")} 題。
          </p>
          <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-slate-100 px-5 font-semibold text-slate-800">
            返回首頁
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-[1280px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="border-b border-slate-200 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="eyebrow">Post-exam recap</p>
            <h1 className="mt-3 text-3xl font-bold text-ink sm:text-5xl">考後回顧與經驗傳承</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
              圖表固定統計到 2026/7/17 15:00。問卷每個帳號限送一次，送出後仍可回來查看。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700">
              返回首頁
            </Link>
            <button
              type="button"
              disabled={!snapshot}
              onClick={() => void handleDownloadPng()}
              className="min-h-12 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              下載完整回顧圖
            </button>
          </div>
        </div>
        {pngStatus ? <p className="mt-3 text-right text-xs font-semibold text-slate-500">{pngStatus}</p> : null}
      </header>

      <section className="border-b border-slate-200 py-10">
        <SeasonActivityChart
          daily={POST_EXAM_SEASON_SNAPSHOT.daily}
          totalAttempts={POST_EXAM_SEASON_SNAPSHOT.totalAttempts}
          correctAttempts={POST_EXAM_SEASON_SNAPSHOT.correctAttempts}
        />
      </section>

      <section className="border-b border-slate-200 py-10">
        <PersonalCumulativeChart points={cumulativePoints} />
      </section>

      <section className="border-b border-slate-200 py-10">
        <SimulationScoreChart results={snapshot.simulations} />
      </section>

      <section className="py-10" aria-labelledby="post-exam-survey-title">
        <div className="mb-7 max-w-3xl">
          <p className="eyebrow">Experience survey</p>
          <h2 id="post-exam-survey-title" className="mt-2 text-2xl font-bold text-ink sm:text-3xl">考後問卷</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            建議與鼓勵為選填；若公開整理，會統一使用你選的暱稱，不顯示帳號資訊。
          </p>
        </div>

        <form onSubmit={handleSurveySubmit} className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
          {surveySubmitted ? (
            <div className="mb-7 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" role="status">
              <strong className="font-bold">問卷已完成。</strong>
              <span className="ml-1">以下保留第一次送出的內容，可繼續查看，但不能修改或再次送出。</span>
            </div>
          ) : null}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-7">
              <div>
                <label htmlFor="post-exam-alias" className="text-sm font-bold text-slate-800">公開暱稱</label>
                <input
                  id="post-exam-alias"
                  type="text"
                  maxLength={20}
                  disabled={surveySubmitted || !surveyHydrated}
                  value={surveyAnswers.publicAlias}
                  onChange={(event) => updateSurvey("publicAlias", event.target.value)}
                  placeholder="留白時顯示匿名考生"
                  className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100"
                />
                <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500">
                  <span>不需唯一；不能填 email、網址或電話。</span>
                  <span>{Array.from(surveyAnswers.publicAlias).length}/20</span>
                </div>
                {surveyErrors.publicAlias ? <p className="mt-2 text-xs font-semibold text-rose-700">{surveyErrors.publicAlias}</p> : null}
              </div>

              <div className="border-t border-slate-200 pt-5">
                <p className="mb-3 text-sm font-bold text-slate-800">國考分數</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    醫學（一）
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      disabled={surveySubmitted || !surveyHydrated}
                      value={surveyAnswers.med1Score ?? ""}
                      onChange={(event) => updateSurvey("med1Score", event.target.value === "" ? null : Number(event.target.value))}
                      className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-4 tabular-nums outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100"
                    />
                    {surveyErrors.med1Score ? <span className="mt-1 block text-xs text-rose-700">{surveyErrors.med1Score}</span> : null}
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    醫學（二）
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      disabled={surveySubmitted || !surveyHydrated}
                      value={surveyAnswers.med2Score ?? ""}
                      onChange={(event) => updateSurvey("med2Score", event.target.value === "" ? null : Number(event.target.value))}
                      className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-4 tabular-nums outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100"
                    />
                    {surveyErrors.med2Score ? <span className="mt-1 block text-xs text-rose-700">{surveyErrors.med2Score}</span> : null}
                  </label>
                </div>
                <div className="mt-4">
                  <SurveyCheckbox
                    checked={surveyAnswers.shareScores}
                    disabled={surveySubmitted || !surveyHydrated}
                    onChange={(checked) => updateSurvey("shareScores", checked)}
                    label="願意匿名分享分數"
                    description="分數將作為日後學弟妹的學習軌跡參考；公開整理時會依照上方填寫的暱稱顯示。"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <label className="block text-sm font-bold text-slate-800">
                建議的讀書方向，或這次準備中可以改進的地方
                <textarea
                  rows={7}
                  maxLength={2000}
                  disabled={surveySubmitted || !surveyHydrated}
                  value={surveyAnswers.studyReflection}
                  onChange={(event) => updateSurvey("studyReflection", event.target.value)}
                  placeholder="選填"
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-4 leading-7 text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100"
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">{surveyAnswers.studyReflection.length}/2000</span>
              </label>
              <label className="block text-sm font-bold text-slate-800">
                有沒有想留給學弟妹的一句鼓勵？
                <textarea
                  rows={5}
                  maxLength={2000}
                  disabled={surveySubmitted || !surveyHydrated}
                  value={surveyAnswers.encouragement}
                  onChange={(event) => updateSurvey("encouragement", event.target.value)}
                  placeholder="選填"
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-4 leading-7 text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-700 disabled:opacity-100"
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">{surveyAnswers.encouragement.length}/2000</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
            <div className="text-xs leading-5 text-slate-500">
              <p>
                {surveySubmitted
                  ? "每個帳號限送一次；這份回覆已鎖定為唯讀。"
                  : "每個帳號限送一次；送出前草稿會留在這台裝置，失敗時保留待補傳內容。"}
              </p>
              {surveySubmittedAt ? (
                <p className="mt-1">送出時間：{new Date(surveySubmittedAt).toLocaleString("zh-TW")}</p>
              ) : null}
              {surveyStatus ? <p className="mt-1 font-semibold text-slate-700">{surveyStatus}</p> : null}
            </div>
            <button
              type="submit"
              disabled={!surveyHydrated || surveySubmitting || surveySubmitted}
              className={`min-h-12 rounded-lg px-6 text-sm font-semibold ${
                surveySubmitted
                  ? "border border-slate-200 bg-slate-100 text-slate-700"
                  : "bg-brand-600 text-white disabled:cursor-not-allowed disabled:opacity-45"
              }`}
            >
              {surveySubmitting ? "儲存中" : surveySubmitted ? "已完成・唯讀" : "送出回覆"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
