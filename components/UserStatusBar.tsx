"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bookmark,
  BookOpenText,
  ChevronDown,
  Cloud,
  FileClock,
  Home,
  Library,
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  NotebookTabs,
  Pill,
  Settings,
  Trophy,
  UserRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ClientSectionBoundary } from "@/components/ClientSectionBoundary";
import { LazyAuthPanel } from "@/components/LazyAuthPanel";
import { getSyncStatusText, getSyncStatusTone } from "@/components/syncStatusText";
import { VisitorStatsPanel } from "@/components/VisitorStatsPanel";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matches?: (pathname: string) => boolean;
};

const PRIMARY_NAV: NavItem[] = [
  {
    href: "/",
    label: "首頁",
    icon: Home,
    matches: (pathname) => pathname === "/"
  },
  {
    href: "/progress",
    label: "進度總覽",
    icon: BarChart3,
    matches: (pathname) => pathname.startsWith("/progress")
  },
  {
    href: "/results",
    label: "作答紀錄",
    icon: FileClock,
    matches: (pathname) =>
      pathname === "/results" ||
      pathname.startsWith("/simulation-results") ||
      pathname.startsWith("/simulation-review")
  },
  {
    href: "/saved-questions",
    label: "儲存題目",
    icon: Bookmark,
    matches: (pathname) => pathname.startsWith("/saved-questions")
  }
];

const MORE_LINKS: NavItem[] = [
  { href: "/notes", label: "學習筆記", icon: NotebookTabs },
  { href: "/resources", label: "資源分享", icon: Library },
  { href: "/pharmacology-review", label: "藥理複習", icon: Pill },
  { href: "/leaderboard", label: "刷題榜", icon: Trophy },
  { href: "/post-exam", label: "考後回顧", icon: BookOpenText }
];

const FEEDBACK_NAV: NavItem = {
  href: "/#feedback",
  label: "留言板",
  icon: MessageSquareText,
  matches: (pathname) => pathname.startsWith("/feedback")
};

const DRAWER_NAV = [...PRIMARY_NAV, FEEDBACK_NAV];

const FOCUS_PATHS = [
  "/quiz",
  "/owner/parasitology-review",
  "/owner/bacteria-review",
  "/owner/virus-review",
  "/owner/biochemistry-review"
];

export function isAppFocusPath(pathname: string) {
  return FOCUS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getAccountLabel(email?: string | null, nickname?: unknown) {
  if (typeof nickname === "string" && nickname.trim()) return nickname.trim();
  if (email) return email.split("@")[0] || email;
  return "訪客模式";
}

function getInitials(label: string) {
  const clean = label.trim();
  if (!clean || clean === "訪客模式") return "訪";
  return clean.slice(0, 2).toUpperCase();
}

export function UserStatusBar() {
  const pathname = usePathname();
  const {
    configured,
    loading,
    user,
    syncStatus,
    syncError,
    pendingCompletedUploadCount,
    signOut
  } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activePanelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusMode = isAppFocusPath(pathname);
  const accountLabel = getAccountLabel(user?.email, user?.user_metadata?.display_name);
  const syncTone = getSyncStatusTone(
    syncStatus,
    Boolean(syncError),
    pendingCompletedUploadCount
  );
  const syncLabel = getSyncStatusText(
    syncStatus,
    Boolean(syncError),
    pendingCompletedUploadCount
  );
  const activePrimary = useMemo(
    () => PRIMARY_NAV.find((item) => item.matches?.(pathname))?.href ?? "",
    [pathname]
  );
  const secondaryNavigationActive = useMemo(
    () => FEEDBACK_NAV.matches?.(pathname) || MORE_LINKS.some((item) => pathname.startsWith(item.href)),
    [pathname]
  );

  useEffect(() => {
    setShellReady(true);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setMoreExpanded(false);
    setAccountOpen(false);
    setAccountPanelOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountOpen]);

  useEffect(() => {
    const overlayOpen = navOpen || accountPanelOpen;
    if (!overlayOpen) return;
    previousFocusRef.current = accountPanelOpen
      ? accountTriggerRef.current
      : (document.activeElement as HTMLElement | null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      activePanelRef.current
        ?.querySelector<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")
        ?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAccountPanelOpen(false);
        setMoreExpanded(false);
        setNavOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panel = activePanelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
        )
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = previousFocusRef.current;
      if (focusTarget?.isConnected) {
        focusTarget.focus();
      } else {
        menuTriggerRef.current?.focus();
      }
    };
  }, [accountPanelOpen, navOpen]);

  useEffect(() => {
    if (!accountOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [accountOpen]);

  return (
    <>
      <a href="#main-content" className="app-skip-link">
        跳到主要內容
      </a>

      <header
        className={`app-topbar ${focusMode ? "app-topbar-focus" : ""}`}
        data-shell-ready={shellReady ? "true" : "false"}
      >
        <div className="app-topbar-brand">
          {!focusMode ? (
            <button
              ref={menuTriggerRef}
              type="button"
              className="app-menu-trigger"
              onClick={() => {
                setMoreExpanded(secondaryNavigationActive);
                setNavOpen(true);
              }}
              aria-label="開啟導覽"
              aria-expanded={navOpen}
              aria-controls="app-navigation-drawer"
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
          ) : null}
          <Link href="/" className="app-brand-link">
            一階醫師國考刷題測驗
          </Link>
        </div>

        <div className="app-topbar-actions">
          {!focusMode && configured ? <VisitorStatsPanel compact /> : null}
          {configured && user ? (
            <span
              className={`app-sync-state app-sync-${syncTone}`}
              title={syncError || undefined}
            >
              <Cloud size={15} strokeWidth={1.8} />
              <span>{syncLabel}</span>
            </span>
          ) : null}
          <div ref={accountRef} className="app-account-wrap">
            <button
              ref={accountTriggerRef}
              type="button"
              className="app-account-trigger"
              onClick={() => setAccountOpen((current) => !current)}
              aria-expanded={accountOpen}
              aria-controls="app-account-popover"
              aria-label="開啟帳號選單"
            >
              <span className="app-account-avatar" aria-hidden="true">
                {getInitials(accountLabel)}
              </span>
              <span className="app-account-name">{loading ? "讀取中" : accountLabel}</span>
              <ChevronDown size={16} strokeWidth={1.8} />
            </button>

            {accountOpen ? (
              <div id="app-account-popover" className="app-account-popover">
                <div className="app-account-summary">
                  <span className="app-account-avatar app-account-avatar-large" aria-hidden="true">
                    {getInitials(accountLabel)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{accountLabel}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {user?.email ?? "本機訪客紀錄"}
                    </p>
                  </div>
                </div>
                {configured && user ? (
                  <div className={`app-account-sync app-account-sync-${syncTone}`}>
                    <Cloud size={15} strokeWidth={1.8} />
                    <span>{syncLabel}</span>
                  </div>
                ) : null}
                <div className="app-account-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      setAccountPanelOpen(true);
                    }}
                  >
                    {user ? <Settings size={18} strokeWidth={1.8} /> : <UserRound size={18} strokeWidth={1.8} />}
                    <span>{user ? "帳號與設定" : "登入與同步"}</span>
                  </button>
                  {user ? (
                    <button
                      type="button"
                      className="app-account-signout"
                      onClick={() => {
                        setAccountOpen(false);
                        void signOut();
                      }}
                    >
                      <LogOut size={18} strokeWidth={1.8} />
                      <span>登出</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {!focusMode ? (
        <nav className="app-mobile-nav" aria-label="手機主要導覽">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = activePrimary === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label.replace("總覽", "")}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMoreExpanded(true);
              setNavOpen(true);
            }}
            className={secondaryNavigationActive ? "is-active" : undefined}
            aria-expanded={navOpen && moreExpanded}
            aria-controls="app-navigation-drawer"
          >
            <MoreHorizontal size={21} strokeWidth={1.8} />
            <span>更多</span>
          </button>
        </nav>
      ) : null}

      {navOpen ? (
        <div className="app-overlay app-mobile-drawer-overlay" role="presentation">
          <button
            type="button"
            className="app-overlay-dismiss"
            onClick={() => setNavOpen(false)}
            aria-label="關閉導覽"
          />
          <aside
            ref={activePanelRef}
            id="app-navigation-drawer"
            className="app-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="主要導覽"
          >
            <div className="app-drawer-header">
              <div>
                <p>網站導覽</p>
                <span>需要時再打開，不佔用閱讀空間</span>
              </div>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="關閉導覽">
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
            <nav className="app-drawer-links">
              {DRAWER_NAV.map((item) => {
                const Icon = item.icon;
                const active = item.matches?.(pathname) ?? pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? "is-active" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setNavOpen(false)}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="app-drawer-divider" aria-hidden="true" />
              <button
                type="button"
                className="app-drawer-more-trigger"
                onClick={() => setMoreExpanded((current) => !current)}
                aria-expanded={moreExpanded}
                aria-controls="app-drawer-more-content"
              >
                <MoreHorizontal size={21} strokeWidth={1.8} />
                <span>更多</span>
                <ChevronDown
                  className="app-drawer-more-chevron"
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
              {moreExpanded ? (
                <div id="app-drawer-more-content" className="app-drawer-more-content">
                  <div className="app-drawer-subnav">
                    {MORE_LINKS.map((item) => {
                      const Icon = item.icon;
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={active ? "is-active" : undefined}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setNavOpen(false)}
                        >
                          <Icon size={19} strokeWidth={1.8} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <section className="app-about-section">
                    <p className="app-sheet-label">關於本站</p>
                    <p>
                      整理醫師國考作答、錯題與複習進度的個人專案。
                    </p>
                    <a
                      href="https://www.instagram.com/yphe_uc?igsh=OWJqZjJqd2o2cGpi&utm_source=qr"
                      target="_blank"
                      rel="noreferrer"
                    >
                      聯絡 @yphe_uc
                    </a>
                    <Link
                      href="/courses/laozhao-anatomy"
                      className="app-secondary-course-link"
                      onClick={() => setNavOpen(false)}
                    >
                      老趙解剖學整理預覽
                    </Link>
                  </section>
                </div>
              ) : null}
            </nav>
          </aside>
        </div>
      ) : null}

      {accountPanelOpen ? (
        <div className="app-overlay app-modal-overlay" role="presentation">
          <button
            type="button"
            className="app-overlay-dismiss"
            onClick={() => setAccountPanelOpen(false)}
            aria-label="關閉帳號設定"
          />
          <section
            ref={activePanelRef}
            className="app-modal-panel app-account-panel"
            role="dialog"
            aria-modal="true"
            aria-label="帳號與設定"
          >
            <div className="app-drawer-header">
              <div>
                <p>{user ? "帳號設定" : "登入與同步"}</p>
                <span>{user ? "管理身分、同步與作答偏好" : "在不同裝置保留完整紀錄"}</span>
              </div>
              <button
                type="button"
                onClick={() => setAccountPanelOpen(false)}
                aria-label="關閉帳號設定"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
            <div className="app-modal-content">
              <div className={`app-account-center ${user ? "" : "is-guest"}`}>
                <aside className="app-account-center-summary">
                  <span className="app-account-avatar app-account-center-avatar" aria-hidden="true">
                    {getInitials(accountLabel)}
                  </span>
                  <p className="app-account-center-kicker">{user ? "已登入" : "訪客模式"}</p>
                  <h2>{accountLabel}</h2>
                  <p className="app-account-center-email">
                    {user?.email ?? "目前紀錄只保存在這台裝置"}
                  </p>
                  <div className="app-account-center-status">
                    <div>
                      <Cloud size={17} strokeWidth={1.8} />
                      <span>同步狀態</span>
                      <strong>{configured && user ? syncLabel : "本機保存"}</strong>
                    </div>
                    {user ? (
                      <div>
                        <FileClock size={17} strokeWidth={1.8} />
                        <span>紀錄保存</span>
                        <strong>本機先存</strong>
                      </div>
                    ) : null}
                  </div>
                  <p className="app-account-center-note">
                    作答會先安全保存在目前裝置；登入後可再同步到其他裝置。
                  </p>
                </aside>
                <div className="app-account-center-settings">
                  <ClientSectionBoundary title="帳號與設定">
                    <LazyAuthPanel eager compactHeader={Boolean(user)} />
                  </ClientSectionBoundary>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

    </>
  );
}
