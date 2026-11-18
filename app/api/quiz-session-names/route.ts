import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSessionName, ownedNameSessionId } from "@/lib/sessionNames";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest, write: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || isSupabaseRecoveryMode()) {
    return NextResponse.json({ error: "名稱同步暫時無法使用，請稍後再試。" }, { status: 503 });
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "登入已失效，請重新登入。" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "格式錯誤。" }, { status: 400 });
  if (!write) {
    if (!Array.isArray(body.ids) || body.ids.length > 100) return NextResponse.json({ error: "一次最多讀取 100 筆。" }, { status: 400 });
    const ids = body.ids.map((id: unknown) => ownedNameSessionId(user.id, id));
    if (ids.some((id: string | null) => id === null)) return NextResponse.json({ error: "紀錄不屬於此帳號。" }, { status: 400 });
    if (!ids.length) return NextResponse.json({ names: [] });
    const { data, error } = await db.from("quiz_session_names").select("session_id,name").eq("user_id", user.id).in("session_id", ids);
    if (error) return NextResponse.json({ error: "無法讀取雲端名稱，請稍後再試。" }, { status: 503 });
    return NextResponse.json({ names: data }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const id = ownedNameSessionId(user.id, body.id);
  const name = normalizeSessionName(body.name);
  if (!id || name === null) return NextResponse.json({ error: "名稱最多 80 字，且只能修改自己的紀錄。" }, { status: 400 });
  // Verify an existing, owned completed result. No answer/settings payload is ever written.
  const { data: result, error: readError } = await db.from("quiz_sessions").select("id,completed_at").eq("user_id", user.id).eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: "無法確認作答紀錄，請稍後再試。" }, { status: 503 });
  if (!result?.completed_at) return NextResponse.json({ error: "請先將這筆完成的作答紀錄同步到雲端，再儲存名稱。" }, { status: 409 });
  const { error } = await db.from("quiz_session_names").upsert({ user_id: user.id, session_id: id, name, updated_at: new Date().toISOString() }, { onConflict: "user_id,session_id" });
  if (error) return NextResponse.json({ error: "名稱尚未儲存，請稍後再試。" }, { status: 503 });
  return NextResponse.json({ name });
}

export function POST(request: NextRequest) { return handle(request, false); }
export function PUT(request: NextRequest) { return handle(request, true); }
