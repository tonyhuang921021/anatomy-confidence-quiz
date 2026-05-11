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
      const mergedSessions = await syncCompletedSessionsForCurrentUser(userId);
      await syncLeaderboardProfileForCurrentUser(effectiveUser, mergedSessions);
      setSyncStatus("ready");
      setSyncVersion((value) => value + 1);
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "同步失敗");
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
          setSyncError(error instanceof Error ? error.message : "同步失敗");
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
