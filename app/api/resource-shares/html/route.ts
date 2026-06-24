import { NextRequest, NextResponse } from "next/server";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import {
  getResourceAccessToken,
  getResourceShareFileKind,
  getResourceShareServiceClient,
  getVerifiedResourceUser,
  RESOURCE_SHARE_BUCKET,
} from "../shared";

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, error: "資源分享暫時整理中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

  const supabase = getResourceShareServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 尚未設定。" }, { status: 500 });
  }

  const accessToken = getResourceAccessToken(request);
  const verifiedUser = await getVerifiedResourceUser(supabase, accessToken);
  if (!verifiedUser) {
    return NextResponse.json({ ok: false, error: "請先登入。" }, { status: 401 });
  }

  const resourceId = request.nextUrl.searchParams.get("resourceId")?.trim();
  if (!resourceId) {
    return NextResponse.json({ ok: false, error: "缺少資源編號。" }, { status: 400 });
  }

  try {
    const { data: row, error } = (await withServerTimeout(
      supabase
        .from("resource_shares")
        .select("id, file_path, file_mime_type")
        .eq("id", resourceId)
        .maybeSingle(),
      2500,
      "HTML 資源讀取逾時"
    )) as { data?: { file_path?: string | null; file_mime_type?: string | null } | null; error?: unknown };

    if (error) throw error;
    if (!row?.file_path) {
      return NextResponse.json({ ok: false, error: "找不到這份 HTML 資源。" }, { status: 404 });
    }

    const fileKind = getResourceShareFileKind(String(row.file_mime_type ?? ""), row.file_path);
    if (fileKind !== "html") {
      return NextResponse.json({ ok: false, error: "這份資源不是 HTML 檔。" }, { status: 415 });
    }

    const { data: blob, error: downloadError } = (await withServerTimeout(
      supabase.storage.from(RESOURCE_SHARE_BUCKET).download(row.file_path),
      4000,
      "HTML 檔案下載逾時"
    )) as { data?: Blob | null; error?: Error | null };

    if (downloadError || !blob) throw downloadError ?? new Error("HTML 檔案下載失敗");
    const html = await blob.text();

    return NextResponse.json(
      { ok: true, html },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "HTML 資源讀取失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
