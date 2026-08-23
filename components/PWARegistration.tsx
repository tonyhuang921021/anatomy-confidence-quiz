"use client";

import { useEffect } from "react";

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

    const disableServiceWorker = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // Ignore unregister failures.
      }
      await clearPwaCaches();
    };

    const cleanup = async () => {
      try {
        await disableServiceWorker();
      } catch (error) {
        console.error("Service worker cleanup failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void cleanup();
      return;
    }

    const onLoad = () => {
      void cleanup();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
