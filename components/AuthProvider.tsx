"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  syncLocalCompletedSessionsForCurrentUser,
  syncCurrentSessionForCurrentUser,
  syncLeaderboardProfileForCurrentUser
} from "@/lib/cloudSync";
import {
  freeLocalStorageSpaceForAuth,
  loadPendingCompletedSessionUploadsForUser,
  setActiveStorageUser
} from "@/lib/storage";
import {
  clearSupabaseBrowserAuthStorage,
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { AUTH_RELOGIN_MESSAGE, authReauthenticationError, isTerminalAuthError, isUsableAuthSession, resolveLiveAuthSessionForOwner } from "@/lib/authSessionRecovery";

export type CloudRefreshResult =
  | { status: "completed"; userId: string; historyHydrated: boolean; historyMode?: "simulation" }
  | { status: "failed"; userId?: string; retryAt: number; message?: string }
  | { status: "skipped"; reason: string; retryAt?: number; pending?: Promise<CloudRefreshResult> };

export type AuthSyncStatus = "idle" | "syncing" | "ready" | "error";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  passwordRecovery: boolean;
  loading: boolean;
  configured: boolean;
  syncStatus: AuthSyncStatus;
  syncVersion: number;
  syncError: string;
  pendingCompletedUploadCount: number;
  applyAuthSession: (nextSession: Session | null) => void;
  finishPasswordRecovery: () => void;
  refreshCloudData: (options?: RefreshCloudDataOptions) => Promise<CloudRefreshResult>;
  signOut: () => Promise<void>;
};

type RefreshCloudDataOptions = {
  hydrateRemoteHistory?: boolean;
  automatic?: boolean;
  uploadAllPending?: boolean;
  historyHydration?: boolean;
  force?: boolean;
  readRemoteOnly?: boolean;
  historyMode?: "simulation";
};

const AuthContext = createContext<AuthContextValue | null>(null);
const CLOUD_RESUME_BACKGROUND_NOTICE_MS = 6500;
const CLOUD_MANUAL_RESUME_BACKGROUND_NOTICE_MS = 10000;
const AUTOMATIC_CLOUD_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const HISTORY_CLOUD_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const HISTORY_CLOUD_SYNC_ATTEMPT_COOLDOWN_MS = 90 * 1000;
const AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS = 3500;
const AUTH_SESSION_REFRESH_TIMEOUT_MS = 6000;
const AUTH_SESSION_REFRESH_LEEWAY_MS = 90_000;
const AUTH_SESSION_RESUME_COOLDOWN_MS = 15_000;
const AUTH_SIGN_OUT_TIMEOUT_MS = 2500;
const AUTOMATIC_CLOUD_SYNC_START_DELAY_MS = 800;
const AUTOMATIC_CLOUD_SYNC_IDLE_TIMEOUT_MS = 3000;
const AUTH_SESSION_SNAPSHOT_KEY = "medQuizAuthSessionSnapshot";
const CLOUD_FALLBACK_MESSAGE = "暫用本機，稍後補傳。雲端同步暫時連不上，作答會先留在這台裝置。";
const AUTH_FALLBACK_MESSAGE = "暫用本機，稍後補傳。登入狀態讀取逾時，如果剛剛已登入，稍後可再同步。";
const AUTH_REFRESH_FALLBACK_MESSAGE = "暫用本機，稍後補傳。登入狀態刷新逾時，切回網站時會再試一次。";
const RECOVERY_MODE_MESSAGE = "暫用本機，稍後補傳。雲端登入與同步維護中，作答不會被登入流程卡住。";
const SAFARI_AUTO_SYNC_DEFERRED_MESSAGE =
  "暫用本機，稍後補傳。雲端紀錄同步排程中，作答完成也會補傳。";
const AUTOMATIC_CLOUD_SYNC_MARKER_PREFIX = "medQuizAutomaticCloudSync:";
const HISTORY_CLOUD_SYNC_MARKER_PREFIX = "medQuizHistoryCloudSync:";
const HISTORY_CLOUD_SYNC_ATTEMPT_MARKER_PREFIX = "medQuizHistoryCloudSyncAttempt:";

function getErrorMessage(error: unknown) {
  if (isTerminalAuthError(error)) return AUTH_RELOGIN_MESSAGE;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const maybeMessage =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "details" in error && typeof error.details === "string"
          ? error.details
          : "hint" in error && typeof error.hint === "string"
            ? error.hint
            : "";
    return maybeMessage || JSON.stringify(error);
  }
  return typeof error === "string" ? error : "同步失敗";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function hasInFlightSync(syncRef: { current: Promise<CloudRefreshResult> | null }) {
  return syncRef.current !== null;
}

function isPasswordRecoveryRoute() {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname === "/reset-password" ||
    window.location.hash.includes("type=recovery") ||
    window.location.search.includes("type=recovery")
  );
}

function shouldDeferAutomaticCloudSync() {
  return false;
}

function safeGetStorage(storage: Storage | undefined, key: string) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(storage: Storage | undefined, key: string, value: string) {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveStorage(storage: Storage | undefined, key: string) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore browsers that block storage access.
  }
}

function getAutomaticCloudSyncMarkerKey(userId: string) {
  return `${AUTOMATIC_CLOUD_SYNC_MARKER_PREFIX}${userId}`;
}

function getHistoryCloudSyncMarkerKey(userId: string) {
  return `${HISTORY_CLOUD_SYNC_MARKER_PREFIX}${userId}`;
}

function getHistoryCloudSyncAttemptMarkerKey(userId: string) {
  return `${HISTORY_CLOUD_SYNC_ATTEMPT_MARKER_PREFIX}${userId}`;
}

function readCloudSyncMarker(key: string) {
  if (typeof window === "undefined") return 0;
  const raw = safeGetStorage(window.localStorage, key);
  const value = Number(raw ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function writeCloudSyncMarker(key: string, timestamp = Date.now()) {
  if (typeof window === "undefined") return;
  safeSetStorage(window.localStorage, key, String(timestamp));
}

function readAutomaticCloudSyncMarker(userId: string) {
  return readCloudSyncMarker(getAutomaticCloudSyncMarkerKey(userId));
}

function readHistoryCloudSyncMarker(userId: string) {
  return readCloudSyncMarker(getHistoryCloudSyncMarkerKey(userId));
}

function readHistoryCloudSyncAttemptMarker(userId: string) {
  return readCloudSyncMarker(getHistoryCloudSyncAttemptMarkerKey(userId));
}

function writeAutomaticCloudSyncMarker(userId: string, timestamp = Date.now()) {
  writeCloudSyncMarker(getAutomaticCloudSyncMarkerKey(userId), timestamp);
}

function writeHistoryCloudSyncMarker(userId: string, timestamp = Date.now()) {
  writeCloudSyncMarker(getHistoryCloudSyncMarkerKey(userId), timestamp);
}

function writeHistoryCloudSyncAttemptMarker(userId: string, timestamp = Date.now()) {
  writeCloudSyncMarker(getHistoryCloudSyncAttemptMarkerKey(userId), timestamp);
}

function clearHistoryCloudSyncAttemptMarker(userId: string) {
  if (typeof window === "undefined") return;
  safeRemoveStorage(window.localStorage, getHistoryCloudSyncAttemptMarkerKey(userId));
}

function shouldSkipAutomaticCloudSync(userId: string, now = Date.now()) {
  const lastStartedAt = readAutomaticCloudSyncMarker(userId);
  return lastStartedAt > 0 && now - lastStartedAt < AUTOMATIC_CLOUD_SYNC_COOLDOWN_MS;
}

function shouldSkipHistoryCloudSync(userId: string, now = Date.now()) {
  const lastStartedAt = readHistoryCloudSyncMarker(userId);
  return lastStartedAt > 0 && now - lastStartedAt < HISTORY_CLOUD_SYNC_COOLDOWN_MS;
}

function shouldSkipRecentHistoryCloudSyncAttempt(userId: string, now = Date.now()) {
  const lastStartedAt = readHistoryCloudSyncAttemptMarker(userId);
  return lastStartedAt > 0 && now - lastStartedAt < HISTORY_CLOUD_SYNC_ATTEMPT_COOLDOWN_MS;
}

function isAuthSessionExpiring(session: Session | null, leewayMs = 30_000) {
  return !isUsableAuthSession(session, leewayMs);
}

function loadAuthSessionSnapshot(options: { allowExpiring?: boolean } = {}): Session | null {
  if (typeof window === "undefined") return null;
  const raw =
    safeGetStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY) ??
    safeGetStorage(window.sessionStorage, AUTH_SESSION_SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;
    if (!session?.user?.id || !session.access_token) return null;
    if (!options.allowExpiring && isAuthSessionExpiring(session)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function refreshAuthSessionIfNeeded(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  candidateSession: Session | null
) {
  if (!candidateSession) return null;
  if (!isAuthSessionExpiring(candidateSession, AUTH_SESSION_REFRESH_LEEWAY_MS)) {
    return candidateSession;
  }

  try {
    const { data, error } = await withTimeout(
      // Let the SDK use its current, locked session. A saved snapshot can hold
      // a rotated refresh token and must never overwrite the SDK's newer token.
      supabase.auth.refreshSession(),
      AUTH_SESSION_REFRESH_TIMEOUT_MS,
      AUTH_REFRESH_FALLBACK_MESSAGE
    );

    if (error) throw error;
    if (!isUsableAuthSession(data.session)) throw authReauthenticationError();
    return data.session;
  } catch (error) {
    if (isTerminalAuthError(error)) throw authReauthenticationError();
    // A transient network error may retain an unexpired session, never an
    // expired one. Local quiz storage is not changed by this decision.
    if (isUsableAuthSession(candidateSession)) return candidateSession;
    throw error;
  }
}

async function resolveBrowserAuthSession(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  timeoutMs: number,
  timeoutMessage: string
) {
  try {
    const {
      data: { session: storedSession }, error
    } = await withTimeout(supabase.auth.getSession(), timeoutMs, timeoutMessage);

    if (error) throw error;
    // A completed SDK lookup returning no session is authoritative. Do not
    // resurrect a snapshot after sign-out or refresh-token rejection.
    if (!storedSession) return null;
    return refreshAuthSessionIfNeeded(supabase, storedSession);
  } catch (error) {
    if (isTerminalAuthError(error)) throw authReauthenticationError();
    const recoveredSession = loadAuthSessionSnapshot();
    if (recoveredSession) return recoveredSession;
    throw error;
  }
}

function saveAuthSessionSnapshot(nextSession: Session | null) {
  if (typeof window === "undefined") return;

  if (!nextSession?.user?.id || !nextSession.access_token) {
    safeRemoveStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY);
    safeRemoveStorage(window.sessionStorage, AUTH_SESSION_SNAPSHOT_KEY);
    return;
  }

  const serialized = JSON.stringify(nextSession);
  if (
    !safeSetStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY, serialized) &&
    (freeLocalStorageSpaceForAuth() === 0 ||
      !safeSetStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY, serialized))
  ) {
    safeSetStorage(window.sessionStorage, AUTH_SESSION_SNAPSHOT_KEY, serialized);
  } else {
    safeRemoveStorage(window.sessionStorage, AUTH_SESSION_SNAPSHOT_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const recoveryMode = isSupabaseRecoveryMode();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<AuthContextValue["syncStatus"]>("idle");
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncError, setSyncError] = useState("");
  const [pendingCompletedUploadCount, setPendingCompletedUploadCount] = useState(0);
  const syncInFlightRef = useRef<Promise<CloudRefreshResult> | null>(null);
  const historyReadInFlightRef = useRef<Promise<CloudRefreshResult> | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const resumeRefreshAtRef = useRef(0);
  const automaticSyncTimerRef = useRef<
    { kind: "idle" | "timeout"; id: number } | null
  >(null);

  useEffect(() => {
    const updatePendingCount = () => {
      const pendingSessions = user?.id
        ? [
            ...loadPendingCompletedSessionUploadsForUser(user.id),
            ...loadPendingCompletedSessionUploadsForUser("guest")
          ]
        : [];
      setPendingCompletedUploadCount(
        new Set(
          pendingSessions.map((pendingSession) =>
            pendingSession.id.replace(/^user-[^:]+:/, "")
          )
        ).size
      );
    };

    updatePendingCount();
    window.addEventListener("completed-sessions-change", updatePendingCount);
    window.addEventListener("storage", updatePendingCount);
    return () => {
      window.removeEventListener("completed-sessions-change", updatePendingCount);
      window.removeEventListener("storage", updatePendingCount);
    };
  }, [syncVersion, user?.id]);

  const cancelScheduledAutomaticCloudSync = useCallback(() => {
    const pending = automaticSyncTimerRef.current;
    if (!pending) return;
    const cancelIdleCallback = window.cancelIdleCallback;
    if (pending.kind === "idle" && typeof cancelIdleCallback === "function") {
      cancelIdleCallback.call(window, pending.id);
    } else {
      window.clearTimeout(pending.id);
    }
    automaticSyncTimerRef.current = null;
  }, []);

  const scheduleAutomaticCloudSync = useCallback((task: () => void) => {
    cancelScheduledAutomaticCloudSync();
    const runTask = () => {
      automaticSyncTimerRef.current = null;
      task();
    };
    const requestIdleCallback = window.requestIdleCallback;
    if (typeof requestIdleCallback === "function") {
      automaticSyncTimerRef.current = {
        kind: "idle",
        id: requestIdleCallback.call(window, runTask, {
          timeout: AUTOMATIC_CLOUD_SYNC_IDLE_TIMEOUT_MS
        })
      };
      return;
    }
    automaticSyncTimerRef.current = {
      kind: "timeout",
      id: window.setTimeout(runTask, AUTOMATIC_CLOUD_SYNC_START_DELAY_MS)
    };
  }, [cancelScheduledAutomaticCloudSync]);

  function markLocalSyncFallback(error: unknown) {
    setSyncStatus("ready");
    setSyncError(getErrorMessage(error) || CLOUD_FALLBACK_MESSAGE);
    setSyncVersion((value) => value + 1);
  }

  const refreshCloudData = useCallback(async (
    targetUserIdOrOptions?: string | RefreshCloudDataOptions,
    targetUser?: User | null,
    options: RefreshCloudDataOptions = {}
  ): Promise<CloudRefreshResult> => {
    if (recoveryMode) {
      setSyncStatus("ready");
      setSyncError(RECOVERY_MODE_MESSAGE);
      return { status: "skipped", reason: "recovery" };
    }

    const explicitOptions =
      typeof targetUserIdOrOptions === "object" && targetUserIdOrOptions !== null
        ? targetUserIdOrOptions
        : options;
    const targetUserId =
      typeof targetUserIdOrOptions === "string" ? targetUserIdOrOptions : undefined;
    const userId = targetUserId || user?.id;
    const effectiveUser = targetUser ?? user;
    if (!configured || !userId || !effectiveUser) return { status: "skipped", reason: "unavailable" };

    const now = Date.now();
    const isHistoryHydration = explicitOptions.historyHydration === true;
    const forceSync = explicitOptions.force === true;
    const readRemoteOnly = explicitOptions.readRemoteOnly === true;
    // A stalled/unknown write must stay locked, but must not prevent a separate
    // read-only history recovery. Reads never clear or replay the write task.
    const activeSyncRef = readRemoteOnly ? historyReadInFlightRef : syncInFlightRef;
    const backgroundNoticeMs = explicitOptions.uploadAllPending || isHistoryHydration
      ? CLOUD_MANUAL_RESUME_BACKGROUND_NOTICE_MS
      : CLOUD_RESUME_BACKGROUND_NOTICE_MS;

    if (activeSyncRef.current) {
      if (!readRemoteOnly) { setSyncStatus("syncing"); setSyncError(""); }
      if (readRemoteOnly || !forceSync) return { status: "skipped", reason: "in-flight", pending: activeSyncRef.current };

      const previousSyncTask = activeSyncRef.current;
      await previousSyncTask.catch(() => undefined);
      if (hasInFlightSync(activeSyncRef)) return { status: "skipped", reason: "in-flight", pending: activeSyncRef.current! };
    }

    if (
      !forceSync &&
      explicitOptions.automatic &&
      isHistoryHydration &&
      shouldSkipHistoryCloudSync(userId, now)
    ) {
      return { status: "skipped", reason: "history-cooldown", retryAt: readHistoryCloudSyncMarker(userId) + HISTORY_CLOUD_SYNC_COOLDOWN_MS };
    }

    if (
      !forceSync &&
      explicitOptions.automatic &&
      isHistoryHydration &&
      shouldSkipRecentHistoryCloudSyncAttempt(userId, now)
    ) {
      return { status: "skipped", reason: "attempt-cooldown", retryAt: readHistoryCloudSyncAttemptMarker(userId) + HISTORY_CLOUD_SYNC_ATTEMPT_COOLDOWN_MS };
    }

    if (
      !forceSync &&
      explicitOptions.automatic &&
      !isHistoryHydration &&
      shouldSkipAutomaticCloudSync(userId, now)
    ) {
      return { status: "skipped", reason: "automatic-cooldown", retryAt: readAutomaticCloudSyncMarker(userId) + AUTOMATIC_CLOUD_SYNC_COOLDOWN_MS };
    }

    if (explicitOptions.automatic) {
      writeAutomaticCloudSyncMarker(userId, now);
      if (isHistoryHydration) {
        writeHistoryCloudSyncAttemptMarker(userId, now);
      }
    }

    if (!readRemoteOnly) { setSyncStatus("syncing"); setSyncError(""); }

    const uploadAllPending = explicitOptions.uploadAllPending === true;
    const hydrateRemoteHistory = explicitOptions.hydrateRemoteHistory ?? !uploadAllPending;

    let syncTask: Promise<CloudRefreshResult> | null = null;
    syncTask = (async (): Promise<CloudRefreshResult> => {
      try {
        const liveSession = await resolveLiveAuthSessionForOwner(getSupabaseBrowserClient(), userId);
        // A sign-out/account switch during the SDK wait must not start work for
        // the old owner or restore that old account into React/local storage.
        if (sessionRef.current?.user.id !== userId) {
          return { status: "skipped", reason: "owner-changed" };
        }
        sessionRef.current = liveSession;
        setSession(liveSession);
        setUser(liveSession.user);
        saveAuthSessionSnapshot(liveSession);
        const completedSessions = await syncLocalCompletedSessionsForCurrentUser(userId, {
          hydrateRemoteHistory,
          uploadAllPending,
          readRemoteOnly,
          historyMode: explicitOptions.historyMode
        });

        if (sessionRef.current?.user.id !== userId) return { status: "skipped", reason: "owner-changed" };
        if (!readRemoteOnly) {
          void syncLeaderboardProfileForCurrentUser(effectiveUser, completedSessions).catch((error) => {
            console.error("Leaderboard sync skipped:", error);
          });
          await syncCurrentSessionForCurrentUser(userId);
        }

        if (explicitOptions.automatic && isHistoryHydration) {
          writeHistoryCloudSyncMarker(userId);
          clearHistoryCloudSyncAttemptMarker(userId);
        }
        if (sessionRef.current?.user.id === userId) {
          if (!readRemoteOnly) { setSyncError(""); setSyncStatus("ready"); }
          setSyncVersion((value) => value + 1);
        }
        return { status: "completed", userId, historyHydrated: hydrateRemoteHistory, historyMode: explicitOptions.historyMode };
      } catch (error) {
        if (sessionRef.current?.user.id === userId) {
          if (readRemoteOnly) setSyncVersion((value) => value + 1);
          else markLocalSyncFallback(error);
        }
        return { status: "failed", userId, retryAt: Date.now() + HISTORY_CLOUD_SYNC_ATTEMPT_COOLDOWN_MS, message: getErrorMessage(error) };
      } finally {
        if (syncTask && activeSyncRef.current === syncTask) {
          activeSyncRef.current = null;
        }
      }
    })();

    activeSyncRef.current = syncTask;
    try {
      return await withTimeout(
        syncTask,
        backgroundNoticeMs,
        "雲端同步仍在背景整理，可先使用本機紀錄。"
      );
    } catch (error) {
      if (!readRemoteOnly && activeSyncRef.current === syncTask && sessionRef.current?.user.id === userId) {
        setSyncStatus("syncing");
        setSyncError(getErrorMessage(error));
      }
      return { status: "skipped", reason: "background", pending: syncTask };
    }
  }, [configured, recoveryMode, user?.id]);

  const applyAuthSession = useCallback((nextSession: Session | null, options: { automaticSync?: boolean } = {}) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setActiveStorageUser(nextSession?.user?.id);
    saveAuthSessionSnapshot(nextSession);

    if (nextSession?.user) {
      // Renewing this account's token is not a request to upload its queue.
      // Keep an ongoing write's status/error intact during read-only recovery.
      if (options.automaticSync === false) return;
      setSyncStatus("ready");
      setSyncError("");
      if (shouldDeferAutomaticCloudSync()) {
        setSyncError(SAFARI_AUTO_SYNC_DEFERRED_MESSAGE);
        return;
      }
      scheduleAutomaticCloudSync(() => {
        void refreshCloudData(nextSession.user.id, nextSession.user, {
          hydrateRemoteHistory: false,
          automatic: true
        });
      });
    } else {
      cancelScheduledAutomaticCloudSync();
      setPasswordRecovery(false);
      setSyncStatus("idle");
      setSyncError("");
    }
  }, [cancelScheduledAutomaticCloudSync, refreshCloudData, scheduleAutomaticCloudSync]);

  const finishPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!configured) return;

    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setActiveStorageUser();
    saveAuthSessionSnapshot(null);
    setPasswordRecovery(false);
    setSyncStatus("idle");
    setSyncError("");
    cancelScheduledAutomaticCloudSync();
    clearSupabaseBrowserAuthStorage();

    if (recoveryMode) {
      setSyncStatus("ready");
      setSyncError(RECOVERY_MODE_MESSAGE);
      return;
    }

    void withTimeout(
      getSupabaseBrowserClient().auth.signOut({ scope: "local" }),
      AUTH_SIGN_OUT_TIMEOUT_MS,
      "登出回應逾時，已先清除本機登入狀態。"
    ).catch(() => {
      clearSupabaseBrowserAuthStorage();
    });
  }, [cancelScheduledAutomaticCloudSync, configured, recoveryMode]);

  useEffect(() => {
    if (!configured || recoveryMode) {
      setActiveStorageUser();
      sessionRef.current = null;
      setSession(null);
      setUser(null);
      setPasswordRecovery(false);
      setSyncStatus(recoveryMode ? "ready" : "idle");
      setSyncError(recoveryMode ? RECOVERY_MODE_MESSAGE : "");
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function bootstrap() {
      try {
        const recoveredSession = await resolveBrowserAuthSession(
          supabase,
          AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS,
          AUTH_FALLBACK_MESSAGE
        );

        if (cancelled) return;

        sessionRef.current = recoveredSession;
        setSession(recoveredSession);
        setUser(recoveredSession?.user ?? null);
        setPasswordRecovery(Boolean(recoveredSession?.user && isPasswordRecoveryRoute()));
        setActiveStorageUser(recoveredSession?.user?.id);
        saveAuthSessionSnapshot(recoveredSession);
        setLoading(false);

        if (recoveredSession?.user) {
          if (shouldDeferAutomaticCloudSync()) {
            setSyncStatus("ready");
            setSyncError(SAFARI_AUTO_SYNC_DEFERRED_MESSAGE);
            return;
          }
          scheduleAutomaticCloudSync(() => {
            void refreshCloudData(recoveredSession.user.id, recoveredSession.user, {
              hydrateRemoteHistory: false,
              automatic: true
            });
          });
        }
      } catch (error) {
        if (cancelled) return;
        const recoveredSession = isTerminalAuthError(error) ? null : loadAuthSessionSnapshot();
        sessionRef.current = recoveredSession;
        setSession(recoveredSession);
        setUser(recoveredSession?.user ?? null);
        setPasswordRecovery(false);
        setActiveStorageUser(recoveredSession?.user?.id);
        setSyncStatus("ready");
        setSyncError(getErrorMessage(error) || AUTH_FALLBACK_MESSAGE);
        setLoading(false);
        if (recoveredSession?.user) {
          if (shouldDeferAutomaticCloudSync()) {
            setSyncStatus("ready");
            setSyncError(SAFARI_AUTO_SYNC_DEFERRED_MESSAGE);
            return;
          }
          scheduleAutomaticCloudSync(() => {
            void refreshCloudData(recoveredSession.user.id, recoveredSession.user, {
              hydrateRemoteHistory: false,
              automatic: true
            });
          });
        }
      }
    }

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") return;
      setPasswordRecovery(event === "PASSWORD_RECOVERY" || Boolean(nextSession?.user && isPasswordRecoveryRoute()));
      if (event === "SIGNED_OUT") {
        saveAuthSessionSnapshot(null);
      }
      const sameOwnerRefresh = event === "TOKEN_REFRESHED" &&
        nextSession?.user?.id === sessionRef.current?.user.id;
      applyAuthSession(nextSession, { automaticSync: !sameOwnerRefresh });
    });

    async function refreshSessionAfterResume() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - resumeRefreshAtRef.current < AUTH_SESSION_RESUME_COOLDOWN_MS) return;
      resumeRefreshAtRef.current = now;

      try {
        const refreshedSession = await resolveBrowserAuthSession(
          supabase,
          AUTH_SESSION_REFRESH_TIMEOUT_MS,
          AUTH_REFRESH_FALLBACK_MESSAGE
        );
        if (cancelled) return;
        if (!refreshedSession?.user?.id) {
          if (sessionRef.current?.user) {
            setSyncStatus("ready");
            setSyncError(AUTH_RELOGIN_MESSAGE);
          }
          return;
        }

        const currentSession = sessionRef.current;
        if (
          currentSession?.access_token !== refreshedSession.access_token ||
          currentSession?.user?.id !== refreshedSession.user.id
        ) {
          applyAuthSession(refreshedSession, { automaticSync: false });
        } else {
          saveAuthSessionSnapshot(refreshedSession);
        }
      } catch (error) {
        if (!cancelled && sessionRef.current?.user) {
          setSyncStatus("ready");
          setSyncError(getErrorMessage(error) || AUTH_REFRESH_FALLBACK_MESSAGE);
        }
      }
    }

    window.addEventListener("focus", refreshSessionAfterResume);
    window.addEventListener("pageshow", refreshSessionAfterResume);
    document.addEventListener("visibilitychange", refreshSessionAfterResume);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSessionAfterResume);
      window.removeEventListener("pageshow", refreshSessionAfterResume);
      document.removeEventListener("visibilitychange", refreshSessionAfterResume);
      cancelScheduledAutomaticCloudSync();
      subscription.unsubscribe();
    };
  }, [cancelScheduledAutomaticCloudSync, configured, recoveryMode, scheduleAutomaticCloudSync]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      passwordRecovery,
      loading,
      configured,
      syncStatus,
      syncVersion,
      syncError,
      pendingCompletedUploadCount,
      applyAuthSession,
      finishPasswordRecovery,
      refreshCloudData,
      signOut: handleSignOut
    }),
    [applyAuthSession, configured, finishPasswordRecovery, handleSignOut, loading, passwordRecovery, pendingCompletedUploadCount, refreshCloudData, session, syncError, syncStatus, syncVersion, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
