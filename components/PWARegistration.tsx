"use client";

import { useEffect } from "react";
import { ensureFeedbackPushWorker } from "@/lib/feedbackPushClient";

async function clearPwaCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("pwa-")).map((key) => caches.delete(key)));
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function PWARegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const setup = async () => {
      try {
        await clearPwaCaches();
        const registration = await ensureFeedbackPushWorker();
        await registration.update();
      } catch (error) {
        // The site remains usable when background push is unsupported or registration fails.
        console.error("Push service worker setup failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void setup();
      return;
    }

    const onLoad = () => {
      void setup();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
