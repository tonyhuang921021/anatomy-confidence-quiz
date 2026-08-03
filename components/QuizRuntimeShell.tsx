"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegistration } from "@/components/PWARegistration";
import { ThemeModeSync } from "@/components/ThemeModeSync";
import { UserStatusBar } from "@/components/UserStatusBar";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";

export function QuizRuntimeShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PWARegistration />
      <ThemeModeSync />
      <UserStatusBar />
      <VisitorPresenceTracker />
      {children}
    </AuthProvider>
  );
}
