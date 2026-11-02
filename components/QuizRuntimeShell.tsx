"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegistration } from "@/components/PWARegistration";
import { ThemeModeSync } from "@/components/ThemeModeSync";
import { isAppFocusPath, UserStatusBar } from "@/components/UserStatusBar";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";
import { SiteMotionRuntime } from "@/components/SiteMotionRuntime";
import { useSurfaceTransition } from "@/components/useSurfaceTransition";

export function QuizRuntimeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const focusMode = isAppFocusPath(pathname);
  const pageRef = useSurfaceTransition(pathname);

  return (
    <AuthProvider>
      <PWARegistration />
      <ThemeModeSync />
      <SiteMotionRuntime />
      <div className={`app-frame study-flow site-motion ${focusMode ? "app-frame-focus" : ""}`}>
        <UserStatusBar />
        <div ref={pageRef} className="app-content" data-motion-page>
          <VisitorPresenceTracker />
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
