"use client";

import { useEffect } from "react";

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(userAgent);
}

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

    const register = async () => {
      try {
        if (isSafariBrowser()) {
          await disableServiceWorker();
          return;
        }

        await navigator.serviceWorker.register("/sw.js?v=2", { scope: "/" });
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    const onLoad = () => {
      void register();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
