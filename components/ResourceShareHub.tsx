"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  createResourceShareComment,
  loadResourceShareDetail,
  loadResourceShares,
  toggleResourceShareLike,
  uploadResourceShare,
} from "@/lib/resourceShares";
import type { ResourceShare } from "@/types/quiz";

const CATEGORIES = ["總複習", "微生物免疫", "藥理", "生理", "病理", "解剖", "生化", "其他"];

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "文字";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fileKindLabel = (resource: ResourceShare) => {
  if (resource.fileKind === "text") return "文字";
  if (resource.fileKind === "html") return "HTML";
  if (resource.fileKind === "pdf") return "PDF";
  if (resource.fileKind === "image") return "圖片";
  return "檔案";
};

const avatarLabel = (label: string) => label.trim().slice(0, 1) || "學";

export function ResourceShareHub() {
  const { configured, loading: authLoading, session, user } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [resources, setResources] = useState<ResourceShare[]>([]);
  const [selected, setSelected] = useState<ResourceShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canUseResources = configured && Boolean(accessToken) && Boolean(user);
  const canSubmitPost = Boolean(description.trim()) || Boolean(file);

  const refreshResources = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const payload = await loadResourceShares(accessToken, 36);
      setResources(payload.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "資源分享讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (canUseResources) void refreshResources();
  }, [canUseResources, refreshResources]);

  const recentAttachments = useMemo(
    () => resources.filter((resource) => resource.shareType === "file").slice(0, 12),
    [resources]
  );

  const handleFile = (nextFile: File | null) => {
    setFile(nextFile);
    if (nextFile && !title.trim()) {
      setTitle(nextFile.name.replace(/\.[^.]+$/, "").slice(0, 80));
    }
  };

  const resetComposer = () => {
    setTitle("");
    setDescription("");
    setCategory(CATEGORIES[0]);
    setFile(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitUpload = async () => {
    if (!accessToken || !canSubmitPost) return;
    setUploading(true);
    setError("");
    try {
      const payload = await uploadResourceShare({
        accessToken,
        file,
        title: title.trim(),
        description: description.trim(),
        category,
      });
      setResources((prev) => [payload.resource, ...prev.filter((item) => item.id !== payload.resource.id)]);
      setSelected(payload.resource);
      resetComposer();
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分享送出失敗");
    } finally {
      setUploading(false);
    }
  };

  const openDetail = async (resource: ResourceShare) => {
    if (!accessToken) return;
    if (selected?.id === resource.id) {
      setSelected(null);
      return;
    }
    setDetailLoadingId(resource.id);
    setError("");
    try {
      const payload = await loadResourceShareDetail(resource.id, accessToken);
      setSelected(payload.resource);
      setResources((prev) =>
        prev.map((item) =>
          item.id === payload.resource.id
            ? { ...item, likeCount: payload.resource.likeCount, commentCount: payload.resource.commentCount, myLiked: payload.resource.myLiked }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "資源內容讀取失敗");
    } finally {
      setDetailLoadingId(null);
    }
  };

  const toggleLike = async (resource: ResourceShare) => {
    if (!accessToken) return;
    const nextLiked = !resource.myLiked;
    setResources((prev) =>
      prev.map((item) =>
        item.id === resource.id
          ? { ...item, myLiked: nextLiked, likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)) }
          : item
      )
    );
    if (selected?.id === resource.id) {
      setSelected({
        ...selected,
        myLiked: nextLiked,
        likeCount: Math.max(0, selected.likeCount + (nextLiked ? 1 : -1)),
      });
    }
    try {
      const payload = await toggleResourceShareLike({ accessToken, resourceId: resource.id, liked: nextLiked });
      setResources((prev) =>
        prev.map((item) =>
          item.id === resource.id
            ? { ...item, myLiked: payload.myLiked, likeCount: payload.likeCount }
            : item
        )
      );
      if (selected?.id === resource.id) {
        setSelected({ ...selected, myLiked: payload.myLiked, likeCount: payload.likeCount });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "按讚更新失敗");
      void refreshResources();
    }
  };

  const submitComment = async () => {
    if (!accessToken || !selected || !commentDraft.trim()) return;
    setCommentSubmitting(true);
    setError("");
    try {
      const payload = await createResourceShareComment({
        accessToken,
        resourceId: selected.id,
        content: commentDraft.trim(),
      });
      const comments = [...(selected.comments ?? []), payload.comment];
      setSelected({ ...selected, comments, commentCount: comments.length });
      setResources((prev) =>
        prev.map((item) => (item.id === selected.id ? { ...item, commentCount: comments.length } : item))
      );
      setCommentDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "留言送出失敗");
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-6 w-36 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-5 h-28 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!canUseResources) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-700">Resources</p>
        <h1 className="mt-4 text-4xl font-black text-emerald-950">資源分享</h1>
        <p className="mt-4 text-lg font-bold text-slate-600">這裡不匿名，請先登入再進交流區。</p>
      </section>
    );
  }

  return (
    <section className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-700">Board Chat</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black text-emerald-950">國考交流區</h1>
              <p className="mt-3 text-base font-bold leading-7 text-slate-600">
                口訣、考點提醒、講義、圖片都丟這裡。像群組，但比較不會把重點洗掉。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
                不匿名
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600">
                {resources.length} 則
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          {loading && !resources.length ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[1.5rem] border border-slate-100 bg-white shadow-sm" />
            ))
          ) : resources.length ? (
            resources.map((resource) => {
              const isSelected = selected?.id === resource.id;
              const hasAttachment = resource.shareType === "file";
              return (
                <article
                  key={resource.id}
                  className={`rounded-[1.5rem] border bg-white p-5 shadow-sm transition ${
                    isSelected ? "border-emerald-200 ring-2 ring-emerald-100" : "border-slate-100 hover:border-emerald-100"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-base font-black text-emerald-800">
                      {avatarLabel(resource.authorLabel)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-emerald-950">{resource.authorLabel}</span>
                        <span className="text-xs font-black text-slate-400">{formatDate(resource.createdAt)}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                          {resource.category ?? "資源"}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                          {fileKindLabel(resource)}
                        </span>
                      </div>

                      <h2 className="mt-3 break-words text-xl font-black text-slate-950">{resource.title}</h2>
                      {resource.description ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-slate-700">
                          {resource.description}
                        </p>
                      ) : null}

                      {hasAttachment ? (
                        <Link
                          href={`/resources/${resource.id}`}
                          className="mt-4 flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-800">{resource.fileName ?? resource.title}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {fileKindLabel(resource)} · {formatFileSize(resource.fileSizeBytes)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">
                            開附件
                          </span>
                        </Link>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleLike(resource)}
                          className={`rounded-full px-4 py-2 text-sm font-black transition ${
                            resource.myLiked
                              ? "bg-emerald-700 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                          }`}
                        >
                          讚 {resource.likeCount || ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDetail(resource)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-200"
                        >
                          {detailLoadingId === resource.id ? "讀取中" : `留言 ${resource.commentCount || ""}`}
                        </button>
                        <Link
                          href={`/resources/${resource.id}`}
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:-translate-y-0.5"
                        >
                          {hasAttachment ? "閱讀" : "單篇"}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                      <div className="space-y-3">
                        {(selected.comments ?? []).length ? (
                          selected.comments?.map((comment) => (
                            <div key={comment.id} className="rounded-2xl bg-white px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-400">
                                <span className="text-emerald-800">{comment.authorLabel}</span>
                                <span>{formatDate(comment.createdAt)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-700">{comment.content}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500">
                            還沒有人留言，第一句可以很有用，也可以很短。
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-col gap-2 md:flex-row">
                        <input
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-300"
                          placeholder="回覆這則分享"
                          maxLength={1000}
                        />
                        <button
                          type="button"
                          onClick={submitComment}
                          disabled={!commentDraft.trim() || commentSubmitting}
                          className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300"
                        >
                          {commentSubmitting ? "送出中" : "送出"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-500">
              還沒有分享。第一則口訣的位置空著，壓力很有禮貌地坐在旁邊。
            </div>
          )}
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Attachments</p>
              <h2 className="mt-2 text-2xl font-black text-emerald-950">最近附件</h2>
            </div>
            {loading ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">更新中</span> : null}
          </div>
          <div className="mt-5 space-y-3">
            {recentAttachments.length ? (
              recentAttachments.map((resource) => (
                <Link
                  key={resource.id}
                  href={`/resources/${resource.id}`}
                  className="block w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black text-slate-800">{resource.title}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                      {fileKindLabel(resource)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-400">{resource.authorLabel}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                有人附檔案時，會放在這裡方便快速撿。
              </p>
            )}
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-3xl font-black text-white shadow-2xl shadow-emerald-900/20 transition hover:-translate-y-1 hover:bg-emerald-800"
        aria-label="新增分享"
      >
        +
      </button>

      {composerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 p-4 backdrop-blur-sm md:items-center md:justify-center">
          <div className="w-full max-w-2xl rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">New Post</p>
                <h2 className="mt-2 text-2xl font-black text-emerald-950">發到交流區</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  resetComposer();
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600"
              >
                關閉
              </button>
            </div>

            <div
              className={`mt-5 rounded-[1.5rem] border-2 border-dashed p-4 transition ${
                dragging ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                handleFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none focus:border-emerald-300"
                  placeholder="標題，可空"
                  maxLength={90}
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none focus:border-emerald-300"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-3 min-h-[150px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-300"
                placeholder="口訣、考點提醒、補充資訊，或說明這份檔案在幹嘛。"
                maxLength={1800}
              />
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.html,.htm,.xhtml,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/html,application/xhtml+xml,image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
                  >
                    加附件
                  </button>
                  <span className="text-sm font-bold text-slate-500">
                    {file ? `${file.name} · ${formatFileSize(file.size)}` : "可不附檔，PDF / HTML / 圖片 12MB 以內"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!canSubmitPost || uploading}
                  onClick={submitUpload}
                  className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {uploading ? "送出中" : "發一則"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
