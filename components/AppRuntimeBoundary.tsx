"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const QuizRuntimeShell = dynamic(
  () => import("@/components/QuizRuntimeShell").then((module) => module.QuizRuntimeShell)
);

export function AppRuntimeBoundary({ children }: { children: ReactNode }) {
  return <QuizRuntimeShell>{children}</QuizRuntimeShell>;
}
