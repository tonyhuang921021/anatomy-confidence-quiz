import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type ReorderStudyNotesBody = {
  items?: {
    type?: string;
    id?: string;
  }[];
  orderedIds?: string[];
};

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
      { ok: false, message: "學習筆記排序暫時維護中，先讓登入與同步恢復。" },
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
    const body = (await request.json().catch(() => null)) as ReorderStudyNotesBody | null;
    const rawItems = (body?.items ?? [])
      .map((item) => ({
        type: item.type === "collection" ? "collection" : item.type === "note" ? "note" : "",
        id: item.id?.trim() ?? ""
      }))
      .filter((item) => item.type && item.id);
    if (rawItems.length > 0) {
      const uniqueItems = Array.from(
        new Map(rawItems.map((item) => [`${item.type}:${item.id}`, item] as const)).values()
      );
      const now = new Date().toISOString();
      const updates = uniqueItems.map((item, index) => {
        const table = item.type === "collection" ? "study_note_collections" : "study_notes";
        return supabase
          .from(table)
          .update({
            display_order: (index + 1) * 1000,
            updated_at: now
          })
          .eq("id", item.id)
          .eq("user_id", userData.user.id);
      });

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      return NextResponse.json({ ok: true, updated: uniqueItems.length });
    }

    const orderedIds = (body?.orderedIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean);

    if (orderedIds.length === 0) {
      return NextResponse.json({ ok: false, message: "缺少排序資料。" }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(orderedIds));
    const updates = uniqueIds.map((id, index) =>
      supabase
        .from("study_notes")
        .update({
          display_order: (index + 1) * 1000,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .eq("user_id", userData.user.id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    return NextResponse.json({ ok: true, updated: uniqueIds.length });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "筆記排序更新失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
