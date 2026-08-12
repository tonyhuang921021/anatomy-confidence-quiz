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

  return (
    <AuthProvider>
      <PWARegistration />
      <ThemeModeSync />
      <div className={`app-frame ${focusMode ? "app-frame-focus" : ""}`}>
        <UserStatusBar />
        <div className="app-content">
          <VisitorPresenceTracker />
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
