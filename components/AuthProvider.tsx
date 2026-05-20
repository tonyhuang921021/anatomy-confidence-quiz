"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  syncCompletedSessionsForCurrentUser,
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

const SYNC_RETRY_DELAYS_MS = [0, 400, 1200];

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<AuthContextValue["syncStatus"]>("idle");
  const [syncVersion, setSyncVersion] = useState(0);
  const [syncError, setSyncError] = useState("");

  const refreshCloudData = useCallback(async (targetUserId?: string, targetUser?: User | null) => {
    const userId = targetUserId || user?.id;
    const effectiveUser = targetUser ?? user;
    if (!configured || !userId || !effectiveUser) return;

    try {
      setSyncStatus("syncing");
      setSyncError("");
      const {
        data: { session: liveSession }
      } = await getSupabaseBrowserClient().auth.getSession();

      if (!liveSession?.access_token) {
        setSyncStatus("idle");
        return;
      }

      let lastError: unknown = null;

      for (const delayMs of SYNC_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
        }

        try {
          const {
            data: { session: retrySession }
          } = await getSupabaseBrowserClient().auth.getSession();

          if (!retrySession?.access_token) {
            lastError = new Error("尚未取得登入 session，稍後再試一次。");
            continue;
          }

          const mergedSessions = await syncCompletedSessionsForCurrentUser(userId);
          await syncLeaderboardProfileForCurrentUser(effectiveUser, mergedSessions);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        throw lastError;
      }

      setSyncStatus("ready");
      setSyncVersion((value) => value + 1);
    } catch (error) {
      setSyncStatus("error");
      setSyncError(getErrorMessage(error));
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

    async function bootstrap() {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setActiveStorageUser(initialSession?.user?.id);

      if (initialSession?.user) {
        try {
          await refreshCloudData(initialSession.user.id, initialSession.user);
        } catch (error) {
          setSyncStatus("error");
          setSyncError(getErrorMessage(error));
        }
      }

      setLoading(false);
    }

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
