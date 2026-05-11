"use client";

import { useEffect } from "react";
import { trackVisitorPresence } from "@/lib/cloudSync";
import { useAuth } from "@/components/AuthProvider";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function VisitorPresenceTracker() {
  const { user, configured } = useAuth();

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    async function sendHeartbeat() {
      if (cancelled || document.hidden) return;

      try {
        await trackVisitorPresence(user?.id ?? null);
      } catch {
        // Ignore lightweight presence failures.
      }
    }

    void sendHeartbeat();

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
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [configured, user?.id]);

  return null;
}
