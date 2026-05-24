import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegistration } from "@/components/PWARegistration";
import { UserStatusBar } from "@/components/UserStatusBar";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://anatomy-confidence-quiz.vercel.app"),
  title: "一階醫師國考刷題測驗",
  description: "用答題結果、信心程度與完成度，找出你的一階醫師國考弱點。",
  applicationName: "國考刷題測驗",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "國考刷題測驗"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" }
    ]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f3ea"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <AuthProvider>
          <PWARegistration />
          <UserStatusBar />
          <VisitorPresenceTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
