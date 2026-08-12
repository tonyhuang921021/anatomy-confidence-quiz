import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppRuntimeBoundary } from "@/components/AppRuntimeBoundary";
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
  themeColor: "#e9edeb"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;var ua=navigator.userAgent;var isSafari=/Safari\\//.test(ua)&&!/Chrome|Chromium|CriOS|FxiOS|Edg\\//.test(ua);if(isSafari)d.dataset.browser='safari';var s=window.localStorage;var u=s.getItem('anatomy-confidence-active-user-id')||'guest';var t=s.getItem('anatomy-confidence-theme-mode:'+u)||s.getItem('anatomy-confidence-theme-mode:guest')||s.getItem('anatomy-confidence-theme-mode');if(t==='dark'||t==='light')d.dataset.theme=t}catch(e){}"
          }}
        />
      </head>
      <body>
        <AppRuntimeBoundary>{children}</AppRuntimeBoundary>
      </body>
    </html>
  );
}
