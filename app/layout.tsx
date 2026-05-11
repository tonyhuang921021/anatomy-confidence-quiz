import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { UserStatusBar } from "@/components/UserStatusBar";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "一階醫師國考刷題測驗",
  description: "用答題結果、信心程度與完成度，找出你的一階醫師國考弱點。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <AuthProvider>
          <UserStatusBar />
          <VisitorPresenceTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
