"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { loadResourceShareDetail } from "@/lib/resourceShares";
import type { ResourceShare } from "@/types/quiz";

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export function ResourceShareViewer({ resourceId }: { resourceId: string }) {
  const { configured, loading: authLoading, session, user } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [resource, setResource] = useState<ResourceShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured || !user || !accessToken || !resourceId) return;
    let alive = true;
    setLoading(true);
    setError("");
    loadResourceShareDetail(resourceId, accessToken)
      .then((payload) => {
        if (alive) setResource(payload.resource);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "資源讀取失敗");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accessToken, configured, resourceId, user]);

  if (authLoading || loading) {
    return (
      <section className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 h-[60vh] animate-pulse rounded-3xl bg-slate-100" />
      </section>
    );
  }

  if (!configured || !user || !accessToken) {
    return (
      <section className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black text-emerald-950">請先登入</h1>
        <p className="mt-3 font-bold text-slate-600">資源分享區不匿名，也不開放訪客讀取。</p>
      </section>
    );
  }

  if (error || !resource) {
    return (
      <section className="rounded-[2rem] border border-rose-100 bg-rose-50 p-8 shadow-sm">
        <h1 className="text-3xl font-black text-rose-800">資源讀取失敗</h1>
        <p className="mt-3 font-bold text-rose-700">{error || "找不到這份資源。"}</p>
        <Link href="/resources" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
          回資源分享
        </Link>
      </section>
    );
  }

  const hasAttachment = resource.shareType === "file" && Boolean(resource.fileUrl);
  const metaText = hasAttachment
    ? `${resource.authorLabel} · ${resource.fileName ?? "附件"} · ${formatFileSize(resource.fileSizeBytes)}`
    : `${resource.authorLabel} · 文字分享`;

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <Link href="/resources" className="text-sm font-black text-slate-500 hover:text-emerald-800">
          ← 回資源分享
        </Link>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Resource</p>
            <h1 className="mt-2 break-words text-3xl font-black text-emerald-950 md:text-4xl">{resource.title}</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {metaText}
            </p>
          </div>
          {hasAttachment ? (
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-black text-white"
            >
              新分頁開啟
            </a>
          ) : null}
        </div>
        {resource.description ? <p className="mt-4 whitespace-pre-wrap font-bold leading-7 text-slate-700">{resource.description}</p> : null}
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        {!hasAttachment ? (
          <div className="p-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700">Text Share</p>
            <p className="mt-3 whitespace-pre-wrap text-lg font-bold leading-8 text-slate-700">
              {resource.description || "這則分享沒有附件，也沒有留下更多文字。"}
            </p>
          </div>
        ) : resource.fileKind === "image" ? (
          <div className="bg-slate-50 p-4">
            <img src={resource.fileUrl} alt={resource.title} className="mx-auto max-h-[78vh] max-w-full rounded-2xl object-contain" />
          </div>
        ) : resource.fileKind === "pdf" ? (
          <iframe src={resource.fileUrl} title={resource.title} className="h-[78vh] w-full bg-slate-50" />
        ) : resource.fileKind === "html" ? (
          <iframe
            src={resource.fileUrl}
            title={resource.title}
            sandbox="allow-forms allow-popups allow-scripts"
            className="h-[78vh] w-full bg-white"
          />
        ) : (
          <div className="p-8 text-center">
            <p className="font-bold text-slate-600">這個檔案格式不支援站內預覽。</p>
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              開啟檔案
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
