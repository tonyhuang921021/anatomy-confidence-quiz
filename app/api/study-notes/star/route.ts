import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type ToggleStudyNoteStarBody = {
  noteId?: string;
  starred?: boolean;
};

type ServiceSupabaseClient = any;

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "學習筆記打星暫時維護中，先讓登入與同步恢復。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as ToggleStudyNoteStarBody | null;
    const noteId = body?.noteId?.trim() ?? "";
    const starred = Boolean(body?.starred);

    if (!noteId) {
      return NextResponse.json({ ok: false, message: "缺少筆記 ID。" }, { status: 400 });
    }

    const { data: noteRow, error: noteError } = await supabase
      .from("study_notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (noteError) throw noteError;
    if (!noteRow) {
      return NextResponse.json({ ok: false, message: "找不到這篇學習筆記。" }, { status: 404 });
    }

    if (starred) {
      const { error: upsertError } = await supabase
        .from("study_note_stars")
        .upsert(
          {
            note_id: noteId,
            user_id: userData.user.id
          },
          { onConflict: "note_id,user_id" }
        );
      if (upsertError) throw upsertError;
    } else {
      const { error: deleteError } = await supabase
        .from("study_note_stars")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", userData.user.id);
      if (deleteError) throw deleteError;
    }

    return NextResponse.json({ ok: true, starred });
  } catch (rawError) {
    const errorCode = typeof rawError === "object" && rawError && "code" in rawError ? String(rawError.code) : "";
    const rawMessage = rawError instanceof Error ? rawError.message : "";
    const message = errorCode === "42P01" || rawMessage.includes("study_note_stars")
      ? "星號資料表尚未建立，請先執行更新後的 supabase/schema.sql。"
      : rawMessage || "筆記星號更新失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
