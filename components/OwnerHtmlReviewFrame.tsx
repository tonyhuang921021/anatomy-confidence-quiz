"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type OwnerHtmlReviewFrameProps = {
  apiPath: string;
  title: string;
  loadingText: string;
  errorFallback: string;
};

function getAllowedEmails() {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

function FullPageMessage({ children }: { children: string }) {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-white p-6 text-center text-sm font-semibold text-slate-600">
      {children}
    </main>
  );
}

export function OwnerHtmlReviewFrame({
  apiPath,
  title,
  loadingText,
  errorFallback
}: OwnerHtmlReviewFrameProps) {
  const { configured, loading, session, user } = useAuth();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loadingHtml, setLoadingHtml] = useState(false);
  const allowed = useMemo(() => isAllowedEmail(user?.email), [user?.email]);
  const hasAllowlist = getAllowedEmails().length > 0;

  useEffect(() => {
    async function loadReviewHtml() {
      if (!allowed || !session?.access_token) return;
      setLoadingHtml(true);
      setError("");

      try {
        const response = await fetch(apiPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessToken: session.access_token
          })
        });

        const text = await response.text();
        if (!response.ok) {
          const payload = JSON.parse(text) as { message?: string };
          throw new Error(payload.message || errorFallback);
        }

        setHtml(text);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : errorFallback);
      } finally {
        setLoadingHtml(false);
      }
    }

    void loadReviewHtml();
  }, [allowed, apiPath, errorFallback, session?.access_token]);

  if (!configured) {
    return <FullPageMessage>請先完成 Supabase 設定。</FullPageMessage>;
  }

  if (loading) {
    return <FullPageMessage>正在確認登入狀態...</FullPageMessage>;
  }

  if (!hasAllowlist) {
    return <FullPageMessage>請先設定 `NEXT_PUBLIC_ADMIN_EMAILS`。</FullPageMessage>;
  }

  if (!allowed) {
    return <FullPageMessage>這頁是管理員私有內容，請先用白名單帳號登入。</FullPageMessage>;
  }

  if (error) {
    return <FullPageMessage>{error}</FullPageMessage>;
  }

  if (loadingHtml || !html) {
    return <FullPageMessage>{loadingText}</FullPageMessage>;
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-white">
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-forms allow-modals allow-scripts"
        className="block h-[calc(100vh-3.5rem)] min-h-[720px] w-full border-0 bg-white"
      />
    </main>
  );
}
