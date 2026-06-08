"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { isYangmingModeEnabled, setYangmingModeEnabled } from "@/lib/yangmingMode";

const REQUIRED_TAPS = 50;
const TAP_WINDOW_MS = 12_000;
const TOAST_DURATION_MS = 1800;

export function HiddenYangmingModeSwitch() {
  const { session } = useAuth();
  const tapTimesRef = useRef<number[]>([]);
  const toastTimeoutRef = useRef<number | null>(null);
  const [showToast, setShowToast] = useState(false);

  function showEnabledToast() {
    setShowToast(true);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false);
    }, TOAST_DURATION_MS);
  }

  async function recordActivation() {
    try {
      const response = await fetch("/api/yangming-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: session?.access_token ?? null,
          visitorId: getOrCreateVisitorId()
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function handleSecretTap() {
    if (!session?.access_token) {
      tapTimesRef.current = [];
      return;
    }

    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter((time) => now - time <= TAP_WINDOW_MS), now];

    if (tapTimesRef.current.length < REQUIRED_TAPS) return;

    tapTimesRef.current = [];
    const recorded = await recordActivation();
    if (!recorded) return;

    if (!isYangmingModeEnabled(session.user.id)) {
      setYangmingModeEnabled(true, session.user.id);
    }
    showEnabledToast();
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={handleSecretTap}
        className="home-hidden-mode-trigger"
      >
        <span className="home-pulse-dot" />
      </button>
      {showToast ? (
        <span className="pointer-events-none absolute right-0 top-7 whitespace-nowrap rounded-full bg-slate-900/75 px-3 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          已開啟
        </span>
      ) : null}
    </span>
  );
}
