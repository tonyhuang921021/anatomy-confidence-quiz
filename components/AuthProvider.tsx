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
  syncCompletedSessionsForCurrentUser,
  syncCurrentSessionForCurrentUser,
  syncLeaderboardProfileForCurrentUser
} from "@/lib/cloudSync";
import { setActiveStorageUser } from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  passwordRecovery: boolean;
  loading: boolean;
  configured: boolean;
  syncStatus: "idle" | "syncing" | "ready" | "error";
  syncVersion: number;
  syncError: string;
  applyAuthSession: (nextSession: Session | null) => void;
  finishPasswordRecovery: () => void;
  refreshCloudData: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const CLOUD_RESUME_SYNC_TIMEOUT_MS = 4500;
const AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS = 3500;
const AUTH_SESSION_SNAPSHOT_KEY = "medQuizAuthSessionSnapshot";
const CLOUD_FALLBACK_MESSAGE = "雲端同步暫時連不上，先使用本機紀錄；稍後可再按一次同步。";
const AUTH_FALLBACK_MESSAGE = "登入狀態讀取逾時，先以本機模式使用；如果剛剛已登入，請稍後再按一次同步。";
const RECOVERY_MODE_MESSAGE = "雲端登入與同步維護中，先使用本機紀錄；作答不會被登入流程卡住。";

function getErrorMessage(error: unknown) {
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

function isPasswordRecoveryRoute() {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname === "/reset-password" ||
    window.location.hash.includes("type=recovery") ||
    window.location.search.includes("type=recovery")
  );
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

function loadAuthSessionSnapshot(): Session | null {
  if (typeof window === "undefined") return null;
  const raw =
    safeGetStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY) ??
    safeGetStorage(window.sessionStorage, AUTH_SESSION_SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;
    if (!session?.user?.id || !session.access_token) return null;
    if (typeof session.expires_at === "number" && session.expires_at * 1000 <= Date.now() + 30_000) {
      return null;
    }
    return session;
  } catch {
    return null;
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
  if (!safeSetStorage(window.localStorage, AUTH_SESSION_SNAPSHOT_KEY, serialized)) {
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
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  function markLocalSyncFallback(error: unknown) {
    setSyncStatus("ready");
    setSyncError(getErrorMessage(error) || CLOUD_FALLBACK_MESSAGE);
    setSyncVersion((value) => value + 1);
  }

  const refreshCloudData = useCallback(async (targetUserId?: string, targetUser?: User | null) => {
    if (recoveryMode) {
      setSyncStatus("ready");
      setSyncError(RECOVERY_MODE_MESSAGE);
      setSyncVersion((value) => value + 1);
      return;
    }

    const userId = targetUserId || user?.id;
    const effectiveUser = targetUser ?? user;
    if (!configured || !userId || !effectiveUser) return;

    if (syncInFlightRef.current) {
      await withTimeout(
        syncInFlightRef.current,
        CLOUD_RESUME_SYNC_TIMEOUT_MS,
        "雲端續寫同步仍在背景整理，先使用本機紀錄。"
      ).catch(markLocalSyncFallback);
      return;
    }

    setSyncStatus("syncing");
    setSyncError("");

    const syncTask = syncCompletedSessionsForCurrentUser(userId)
      .then((completedSessions) => {
        void syncLeaderboardProfileForCurrentUser(effectiveUser, completedSessions).catch((error) => {
          console.error("Leaderboard sync skipped:", error);
        });
        return syncCurrentSessionForCurrentUser(userId);
      })
      .then(() => {
        setSyncStatus("ready");
        setSyncVersion((value) => value + 1);
      })
      .catch((error) => {
        markLocalSyncFallback(error);
      })
      .finally(() => {
        if (syncInFlightRef.current === syncTask) {
          syncInFlightRef.current = null;
        }
      });

    syncInFlightRef.current = syncTask;
    try {
      await withTimeout(
        syncTask,
        CLOUD_RESUME_SYNC_TIMEOUT_MS,
        "雲端續寫同步逾時，先使用本機紀錄。"
      );
    } catch (error) {
      markLocalSyncFallback(error);
    }
  }, [configured, recoveryMode, user?.id]);

  const applyAuthSession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setActiveStorageUser(nextSession?.user?.id);
    saveAuthSessionSnapshot(nextSession);

    if (nextSession?.user) {
      setSyncStatus("ready");
      setSyncError("");
      void refreshCloudData(nextSession.user.id, nextSession.user);
    } else {
      setPasswordRecovery(false);
      setSyncStatus("idle");
      setSyncError("");
    }
  }, [refreshCloudData]);

  const finishPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!configured) return;
    if (recoveryMode) {
      setSession(null);
      setUser(null);
      setActiveStorageUser();
      saveAuthSessionSnapshot(null);
      setSyncStatus("ready");
      setSyncError(RECOVERY_MODE_MESSAGE);
      return;
    }
    await getSupabaseBrowserClient().auth.signOut();
  }, [configured, recoveryMode]);

  useEffect(() => {
    if (!configured || recoveryMode) {
      setActiveStorageUser();
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
        const {
          data: { session: initialSession }
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS,
          AUTH_FALLBACK_MESSAGE
        );

        if (cancelled) return;

        const recoveredSession = initialSession ?? loadAuthSessionSnapshot();

        setSession(recoveredSession);
        setUser(recoveredSession?.user ?? null);
        setPasswordRecovery(Boolean(recoveredSession?.user && isPasswordRecoveryRoute()));
        setActiveStorageUser(recoveredSession?.user?.id);
        saveAuthSessionSnapshot(recoveredSession);
        setLoading(false);

        if (recoveredSession?.user) {
          void refreshCloudData(recoveredSession.user.id, recoveredSession.user);
        }
      } catch (error) {
        if (cancelled) return;
        const recoveredSession = loadAuthSessionSnapshot();
        setSession(recoveredSession);
        setUser(recoveredSession?.user ?? null);
        setPasswordRecovery(false);
        setActiveStorageUser(recoveredSession?.user?.id);
        setSyncStatus("ready");
        setSyncError(getErrorMessage(error) || AUTH_FALLBACK_MESSAGE);
        setLoading(false);
        if (recoveredSession?.user) {
          void refreshCloudData(recoveredSession.user.id, recoveredSession.user);
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
      applyAuthSession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, recoveryMode]);

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
      applyAuthSession,
      finishPasswordRecovery,
      refreshCloudData,
      signOut: handleSignOut
    }),
    [applyAuthSession, configured, finishPasswordRecovery, handleSignOut, loading, passwordRecovery, refreshCloudData, session, syncError, syncStatus, syncVersion, user]
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
