"use client";

import { useEffect } from "react";
import { trackVisitorPresence } from "@/lib/cloudSync";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;
const INITIAL_HEARTBEAT_DELAY_MS = 45 * 1000;
const HEARTBEAT_THROTTLE_KEY = "quiz-visitor-presence-last-sent";

function canSendHeartbeat() {
  if (typeof window === "undefined") return false;
  if (document.hidden || navigator.onLine === false) return false;

  const lastSent = Number(window.localStorage.getItem(HEARTBEAT_THROTTLE_KEY) ?? "0");
  return !Number.isFinite(lastSent) || Date.now() - lastSent >= HEARTBEAT_INTERVAL_MS;
}

function markHeartbeatSent() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HEARTBEAT_THROTTLE_KEY, String(Date.now()));
}

export function VisitorPresenceTracker() {
  const { user, configured } = useAuth();

  useEffect(() => {
    if (isSupabaseRecoveryMode()) return;
    if (!configured) return;

    let cancelled = false;

    async function sendHeartbeat() {
      if (cancelled || !canSendHeartbeat()) return;

      try {
        await trackVisitorPresence(user?.id ?? null);
        markHeartbeatSent();
      } catch {
        // Ignore lightweight presence failures.
      }
    }

    const initialTimeoutId = window.setTimeout(() => {
      void sendHeartbeat();
    }, INITIAL_HEARTBEAT_DELAY_MS);

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    function handleVisibilityChange() {
      if (!document.hidden) {
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
  }, [configured, user?.id]);

  return null;
}
