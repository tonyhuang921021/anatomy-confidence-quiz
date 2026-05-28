"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getThemeModePreference } from "@/lib/accountPreferences";
import { loadThemeMode, type ThemeMode } from "@/lib/storage";

function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
}

export function ThemeModeSync() {
  const { user } = useAuth();

  useEffect(() => {
    applyThemeMode(getThemeModePreference(user?.user_metadata) ?? loadThemeMode());

    function handleThemeModeChange(event: Event) {
      const detail = (event as CustomEvent<ThemeMode>).detail;
      applyThemeMode(detail === "dark" ? "dark" : "light");
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key?.includes("anatomy-confidence-theme-mode")) {
        applyThemeMode(loadThemeMode());
      }
    }

    window.addEventListener("theme-mode-change", handleThemeModeChange as EventListener);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("theme-mode-change", handleThemeModeChange as EventListener);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user?.id, user?.user_metadata]);

  return null;
}
