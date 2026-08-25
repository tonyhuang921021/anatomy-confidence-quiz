"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPlatform = "ios" | "android" | "other";
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function detectInstallPlatform(): InstallPlatform {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "other";
}

function isStandalone() {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function InstallGuideIllustration({ platform }: { platform: "ios" | "android" }) {
  const ios = platform === "ios";
  return (
    <svg
      viewBox="0 0 720 250"
      className="mt-4 h-auto w-full rounded-xl border border-slate-200 bg-[#f8faf9]"
      role="img"
      aria-label={ios ? "iPhone 加入主畫面三步驟示意圖" : "Android 加到主畫面三步驟示意圖"}
    >
      <defs>
        <marker id={`install-arrow-${platform}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#739087" />
        </marker>
      </defs>
      <rect x="20" y="20" width="200" height="210" rx="22" fill="#fff" stroke="#cad6d2" strokeWidth="3" />
      <rect x="260" y="20" width="200" height="210" rx="22" fill="#fff" stroke="#cad6d2" strokeWidth="3" />
      <rect x="500" y="20" width="200" height="210" rx="22" fill="#fff" stroke="#cad6d2" strokeWidth="3" />
      <circle cx="48" cy="48" r="17" fill="#176b57" />
      <circle cx="288" cy="48" r="17" fill="#176b57" />
      <circle cx="528" cy="48" r="17" fill="#176b57" />
      <text x="48" y="54" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">1</text>
      <text x="288" y="54" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">2</text>
      <text x="528" y="54" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">3</text>
      {ios ? (
        <>
          <rect x="60" y="83" width="120" height="105" rx="14" fill="#edf4f1" stroke="#afc4bc" strokeWidth="2" />
          <path d="M120 143V102M105 117l15-15 15 15M91 135v30h58v-30" fill="none" stroke="#176b57" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="120" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">點「分享」</text>
          <rect x="287" y="86" width="146" height="94" rx="14" fill="#edf4f1" stroke="#afc4bc" strokeWidth="2" />
          <rect x="307" y="108" width="32" height="32" rx="7" fill="#fff" stroke="#176b57" strokeWidth="3" />
          <path d="M323 115v18M314 124h18" stroke="#176b57" strokeWidth="3" strokeLinecap="round" />
          <path d="M354 116h58M354 136h44" stroke="#526d64" strokeWidth="4" strokeLinecap="round" />
          <text x="360" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">加入主畫面</text>
          <rect x="548" y="91" width="104" height="82" rx="19" fill="#176b57" />
          <path d="M580 132l16 16 28-34" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <text x="600" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">按「加入」</text>
        </>
      ) : (
        <>
          <rect x="60" y="83" width="120" height="105" rx="14" fill="#edf4f1" stroke="#afc4bc" strokeWidth="2" />
          <circle cx="120" cy="108" r="6" fill="#176b57" />
          <circle cx="120" cy="135" r="6" fill="#176b57" />
          <circle cx="120" cy="162" r="6" fill="#176b57" />
          <text x="120" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">點右上「⋮」</text>
          <rect x="287" y="86" width="146" height="94" rx="14" fill="#edf4f1" stroke="#afc4bc" strokeWidth="2" />
          <path d="M323 108v34M306 125h34" stroke="#176b57" strokeWidth="5" strokeLinecap="round" />
          <path d="M354 116h58M354 136h44" stroke="#526d64" strokeWidth="4" strokeLinecap="round" />
          <text x="360" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">加到主畫面</text>
          <rect x="548" y="91" width="104" height="82" rx="19" fill="#176b57" />
          <path d="M580 132l16 16 28-34" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <text x="600" y="210" textAnchor="middle" fill="#243a34" fontSize="18" fontWeight="700">確認安裝</text>
        </>
      )}
      <path d="M230 125h20M470 125h20" stroke="#739087" strokeWidth="3" markerEnd={`url(#install-arrow-${platform})`} />
    </svg>
  );
}

export function MobileInstallGuide() {
  const [platform, setPlatform] = useState<InstallPlatform | "checking">("checking");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectInstallPlatform());
    setStandalone(isStandalone());
  }, []);

  if (standalone) {
    return (
      <section id="add-to-home-screen" aria-labelledby="install-guide-title" className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
        <div className="flex items-center gap-3 text-emerald-800">
          <CheckCircle2 size={22} aria-hidden="true" />
          <h2 id="install-guide-title" className="font-semibold">已從主畫面開啟</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-800/80">這樣開啟最像 App，也能在 iPhone 使用手機通知。</p>
      </section>
    );
  }

  if (platform === "checking") {
    return <section id="add-to-home-screen" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">正在確認手機類型。</section>;
  }

  if (platform === "other") {
    return (
      <section id="add-to-home-screen" aria-labelledby="install-guide-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 id="install-guide-title" className="text-base font-semibold text-ink">放到手機主畫面</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">請用 iPhone 或 Android 手機開啟這一頁，網站會顯示對應的圖片教學。</p>
      </section>
    );
  }

  const ios = platform === "ios";
  return (
    <section id="add-to-home-screen" aria-labelledby="install-guide-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-xs font-semibold text-brand-700">{ios ? "iPhone・Safari" : "Android・Chrome"}</p>
      <h2 id="install-guide-title" className="mt-1 text-base font-semibold text-ink">放到手機主畫面</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">照圖做一次，以後直接點主畫面圖示就能開啟。</p>
      <InstallGuideIllustration platform={platform} />
      <ol className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 sm:grid-cols-3">
        {ios ? (
          <>
            <li><strong className="text-ink">1.</strong> 用 Safari 點分享圖示。</li>
            <li><strong className="text-ink">2.</strong> 往下選「加入主畫面」。</li>
            <li><strong className="text-ink">3.</strong> 點右上角「加入」。</li>
          </>
        ) : (
          <>
            <li><strong className="text-ink">1.</strong> 用 Chrome 點右上角「⋮」。</li>
            <li><strong className="text-ink">2.</strong> 選「加到主畫面」或「安裝應用程式」。</li>
            <li><strong className="text-ink">3.</strong> 確認安裝即可。</li>
          </>
        )}
      </ol>
    </section>
  );
}
