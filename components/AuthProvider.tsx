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

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  syncStatus: "idle" | "syncing" | "ready" | "error";
  syncVersion: number;
  syncError: string;
  refreshCloudData: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const CLOUD_RESUME_SYNC_TIMEOUT_MS = 4500;
const AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS = 3500;
const CLOUD_FALLBACK_MESSAGE = "雲端同步暫時連不上，先使用本機紀錄；稍後可再按一次同步。";
const AUTH_FALLBACK_MESSAGE = "登入狀態讀取逾時，先以本機模式使用；如果剛剛已登入，請稍後再按一次同步。";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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
  }, [configured, user?.id]);

  const handleSignOut = useCallback(async () => {
    if (!configured) return;
    await getSupabaseBrowserClient().auth.signOut();
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setActiveStorageUser();
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

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setActiveStorageUser(initialSession?.user?.id);
        setLoading(false);

        if (initialSession?.user) {
          void refreshCloudData(initialSession.user.id, initialSession.user);
        }
      } catch (error) {
        if (cancelled) return;
        setSession(null);
        setUser(null);
        setActiveStorageUser();
        setSyncStatus("ready");
        setSyncError(getErrorMessage(error) || AUTH_FALLBACK_MESSAGE);
        setLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setActiveStorageUser(nextSession?.user?.id);

      if (nextSession?.user) {
        void refreshCloudData(nextSession.user.id, nextSession.user);
      } else {
        setSyncStatus("idle");
        setSyncError("");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      configured,
      syncStatus,
      syncVersion,
      syncError,
      refreshCloudData,
      signOut: handleSignOut
    }),
    [configured, handleSignOut, loading, refreshCloudData, session, syncError, syncStatus, syncVersion, user]
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
