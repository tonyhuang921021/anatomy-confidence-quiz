"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PWARegistration } from "@/components/PWARegistration";

const QuizRuntimeShell = dynamic(
  () => import("@/components/QuizRuntimeShell").then((module) => module.QuizRuntimeShell)
);

function isStandaloneCourseRoute(pathname: string) {
  return pathname === "/courses/laozhao-anatomy" || pathname.startsWith("/courses/laozhao-anatomy/");
}

export function AppRuntimeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isStandaloneCourseRoute(pathname)) {
    return (
      <>
        <PWARegistration cleanupOnly />
        {children}
      </>
    );
  }

  return <QuizRuntimeShell>{children}</QuizRuntimeShell>;
}
