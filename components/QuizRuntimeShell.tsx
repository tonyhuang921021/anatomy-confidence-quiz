"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegistration } from "@/components/PWARegistration";
import { ThemeModeSync } from "@/components/ThemeModeSync";
import { isAppFocusPath, UserStatusBar } from "@/components/UserStatusBar";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";

export function QuizRuntimeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const focusMode = isAppFocusPath(pathname);
  // Public study screens share motion; admin, auth and print flows keep their behavior.
  const studyFlow = ["/", "/start", "/quiz", "/simulation", "/results", "/simulation-results",
    "/review", "/simulation-review", "/search", "/progress", "/saved-questions", "/custom-papers",
    "/pharmacology-review", "/resources", "/notes"].some((route) =>
      pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
    );

  return (
    <AuthProvider>
      <PWARegistration />
      <ThemeModeSync />
      <div className={`app-frame ${studyFlow ? "study-flow" : ""} ${focusMode ? "app-frame-focus" : ""}`}>
        <UserStatusBar />
        <div className="app-content">
          <VisitorPresenceTracker />
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
