import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { withServerTimeout } from "@/lib/serverTimeout";
import type { ResourceShare, ResourceShareComment, ResourceShareFileKind } from "@/types/quiz";

export const RESOURCE_SHARE_BUCKET = "resource-share-files";
export const RESOURCE_SHARE_MAX_FILE_SIZE = 12 * 1024 * 1024;
export const RESOURCE_SHARE_SIGNED_URL_SECONDS = 60 * 30;

export const ALLOWED_RESOURCE_MIME_TYPES = new Set([
  "application/pdf",
  "text/html",
  "application/xhtml+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

type VerifiedResourceUser = {
  id: string;
  email?: string;
  label: string;
};

type SupabaseClientLike = any;

export const getResourceAccessToken = (request: NextRequest, fallback?: string | null) => {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || fallback?.trim() || "";
};

export const getResourceShareServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const getVerifiedResourceUser = async (
  supabase: SupabaseClientLike,
  accessToken?: string | null
): Promise<VerifiedResourceUser | null> => {
  if (!accessToken) return null;
  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(accessToken),
      1500,
      "登入狀態驗證逾時"
    )) as {
      data?: {
        user?: {
          id?: string;
          email?: string;
          user_metadata?: Record<string, unknown>;
        } | null;
      };
      error?: unknown;
    };
    const user = data?.user;
    if (error || !user?.id) return null;
    const metadata = user.user_metadata ?? {};
    const rawLabel =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : typeof metadata.nickname === "string"
            ? metadata.nickname
            : "";
    const label = rawLabel.trim() || user.email?.split("@")[0] || "同學";
    return { id: user.id, email: user.email, label };
  } catch {
    return null;
  }
};

export const getResourceShareFileKind = (mimeType: string, filePath?: string | null): ResourceShareFileKind => {
  if (!filePath) return "text";
  if (mimeType === "text/html" || mimeType === "application/xhtml+xml") return "html";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
};

export const extensionForResourceMimeType = (mimeType: string, fileName?: string) => {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/html" || mimeType === "application/xhtml+xml") return "html";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  const match = fileName?.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] ?? "bin";
};

export const normalizeResourceMimeType = (file: File) => {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "text/html";
  if (lowerName.endsWith(".xhtml")) return "application/xhtml+xml";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
  return "";
};

export const sanitizeResourceFileName = (fileName: string) => {
  const base = fileName.trim().replace(/[/\\]/g, "_").replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
  return base.slice(0, 120) || "resource";
};

export const mapResourceShareComment = (row: any): ResourceShareComment => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  content: String(row.content ?? ""),
  authorLabel: String(row.author_label ?? "同學"),
  authorEmail: typeof row.author_email === "string" ? row.author_email : undefined,
  createdAt: String(row.created_at ?? new Date().toISOString()),
});

export const mapResourceShare = (
  row: any,
  options: {
    likeCount?: number;
    commentCount?: number;
    myLiked?: boolean;
    fileUrl?: string;
    comments?: ResourceShareComment[];
  } = {}
): ResourceShare => ({
  id: String(row.id),
  title: String(row.title ?? "未命名資源"),
  description: typeof row.description === "string" && row.description.trim() ? row.description : undefined,
  category: typeof row.category === "string" && row.category.trim() ? row.category : undefined,
  shareType: row.share_type === "text" || !row.file_path ? "text" : "file",
  fileName: typeof row.file_name === "string" && row.file_name.trim() ? row.file_name : undefined,
  filePath: typeof row.file_path === "string" ? row.file_path : undefined,
  fileUrl: options.fileUrl,
  fileMimeType: typeof row.file_mime_type === "string" && row.file_mime_type.trim() ? row.file_mime_type : undefined,
  fileKind: getResourceShareFileKind(String(row.file_mime_type ?? ""), row.file_path),
  fileSizeBytes: Number(row.file_size_bytes ?? 0),
  authorLabel: String(row.author_label ?? "同學"),
  authorEmail: typeof row.author_email === "string" ? row.author_email : undefined,
  createdAt: String(row.created_at ?? new Date().toISOString()),
  updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  likeCount: options.likeCount ?? 0,
  commentCount: options.commentCount ?? 0,
  myLiked: Boolean(options.myLiked),
  comments: options.comments,
});

export const createResourceSignedUrl = async (supabase: SupabaseClientLike, filePath: string) => {
  const { data, error } = (await withServerTimeout(
    supabase.storage.from(RESOURCE_SHARE_BUCKET).createSignedUrl(filePath, RESOURCE_SHARE_SIGNED_URL_SECONDS),
    2500,
    "檔案連結產生逾時"
  )) as { data?: { signedUrl?: string } | null; error?: Error | null };
  if (error || !data?.signedUrl) throw error ?? new Error("檔案連結產生失敗");
  return data.signedUrl;
};
