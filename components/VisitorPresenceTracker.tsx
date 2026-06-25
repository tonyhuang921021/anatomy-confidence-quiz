"use client";

import { useEffect } from "react";
import { trackVisitorPresence } from "@/lib/cloudSync";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_HEARTBEAT_DELAY_MS = 15 * 1000;
const HEARTBEAT_THROTTLE_KEY = "quiz-visitor-presence-last-sent";

function getHeartbeatThrottleKey(userId?: string | null) {
  return userId ? `${HEARTBEAT_THROTTLE_KEY}:${userId}` : HEARTBEAT_THROTTLE_KEY;
}

function canSendHeartbeat(userId?: string | null) {
  if (typeof window === "undefined") return false;
  if (!userId) return false;
  if (document.hidden || navigator.onLine === false) return false;

  const lastSent = Number(window.localStorage.getItem(getHeartbeatThrottleKey(userId)) ?? "0");
  return !Number.isFinite(lastSent) || Date.now() - lastSent >= HEARTBEAT_INTERVAL_MS;
}

function markHeartbeatSent(userId?: string | null) {
  if (typeof window === "undefined") return;
  if (!userId) return;
  window.localStorage.setItem(getHeartbeatThrottleKey(userId), String(Date.now()));
}

export function VisitorPresenceTracker() {
  const { user, session, configured } = useAuth();

  useEffect(() => {
    if (isSupabaseRecoveryMode()) return;
    if (!configured || !user?.id || !session?.access_token) return;

    let cancelled = false;

    async function sendHeartbeat() {
      if (cancelled || !canSendHeartbeat(user?.id)) return;

      try {
        await trackVisitorPresence(user, session?.access_token ?? null);
        markHeartbeatSent(user?.id);
      } catch {
        // Ignore lightweight presence failures.
      }
    }

    const initialTimeoutId = window.setTimeout(() => {
      void sendHeartbeat();
    }, INITIAL_HEARTBEAT_DELAY_MS);
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 60 * 1000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [configured, session?.access_token, user]);

  return null;
}
