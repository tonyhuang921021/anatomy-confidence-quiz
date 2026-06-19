import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

const BUCKET = "question-supplement-attachments";
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function getVerifiedUser(supabase: any, accessToken?: string | null) {
  if (!accessToken) return null;
  try {
    const { data, error } = (await withServerTimeout(
      supabase.auth.getUser(accessToken),
      1500,
      "登入狀態驗證逾時"
    )) as { data?: { user?: { id?: string } | null }; error?: unknown };
    if (error || !data?.user?.id) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "補充卡片圖片暫時維護中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const accessToken = typeof formData.get("accessToken") === "string" ? String(formData.get("accessToken")) : "";
    const questionId = typeof formData.get("questionId") === "string" ? String(formData.get("questionId")).trim() : "";
    const file = formData.get("file");
    const verifiedUser = await getVerifiedUser(supabase, accessToken);

    if (!verifiedUser) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "請選擇圖片檔。" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, message: "只支援 PNG、JPEG、WebP 圖片。" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, message: "圖片請壓到 3MB 以內。" }, { status: 400 });
    }

    const extension = extensionForMimeType(file.type);
    const safeQuestionId = questionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const objectPath = `${verifiedUser.id}/${safeQuestionId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, arrayBuffer, {
      contentType: file.type,
      upsert: false
    });

    if (error) throw error;

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    return NextResponse.json({ ok: true, url: publicUrl, path: objectPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
