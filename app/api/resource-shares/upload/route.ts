import { NextRequest, NextResponse } from "next/server";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import {
  ALLOWED_RESOURCE_MIME_TYPES,
  RESOURCE_SHARE_BUCKET,
  RESOURCE_SHARE_MAX_FILE_SIZE,
  extensionForResourceMimeType,
  getResourceAccessToken,
  getResourceShareServiceClient,
  getVerifiedResourceUser,
  mapResourceShare,
  normalizeResourceMimeType,
  sanitizeResourceFileName,
} from "../shared";

const trimText = (value: FormDataEntryValue | null, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, error: "資源上傳暫時整理中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

  const supabase = getResourceShareServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const accessToken = getResourceAccessToken(request, trimText(formData.get("accessToken"), 4000));
    const title = trimText(formData.get("title"), 90);
    const description = trimText(formData.get("description"), 800);
    const category = trimText(formData.get("category"), 40);
    const file = formData.get("file");
    const verifiedUser = await getVerifiedResourceUser(supabase, accessToken);

    if (!verifiedUser) {
      return NextResponse.json({ ok: false, error: "請先登入。" }, { status: 401 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: "請替資源取個標題。" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "請選擇要分享的檔案。" }, { status: 400 });
    }

    const mimeType = normalizeResourceMimeType(file);
    if (!ALLOWED_RESOURCE_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { ok: false, error: "目前支援 PDF、HTML、PNG、JPEG、WebP、GIF。" },
        { status: 400 }
      );
    }
    if (file.size > RESOURCE_SHARE_MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "檔案請壓到 12MB 以內。" }, { status: 400 });
    }

    const safeFileName = sanitizeResourceFileName(file.name);
    const extension = extensionForResourceMimeType(mimeType, safeFileName);
    const month = new Date().toISOString().slice(0, 7);
    const objectPath = `${verifiedUser.id}/${month}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await withServerTimeout(
      supabase.storage.from(RESOURCE_SHARE_BUCKET).upload(objectPath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      }),
      8000,
      "檔案上傳逾時"
    );
    if (uploadError) throw uploadError;

    const { data: inserted, error: insertError } = (await withServerTimeout(
      supabase
        .from("resource_shares")
        .insert({
          title,
          description: description || null,
          category: category || null,
          file_name: safeFileName,
          file_path: objectPath,
          file_mime_type: mimeType,
          file_size_bytes: file.size,
          author_label: verifiedUser.label,
          author_email: verifiedUser.email ?? null,
          user_id: verifiedUser.id,
        })
        .select("*")
        .single(),
      3500,
      "資源資料寫入逾時"
    )) as { data?: any | null; error?: unknown };

    if (insertError || !inserted) throw insertError ?? new Error("資源資料寫入失敗");

    return NextResponse.json({ ok: true, resource: mapResourceShare(inserted) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "資源上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
