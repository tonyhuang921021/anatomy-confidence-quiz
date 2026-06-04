import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { StudyNoteCollection, SubjectName } from "@/types/quiz";

type StudyNoteCollectionRow = {
  id: string;
  name: string;
  subject?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

type CollectionBody = {
  id?: string;
  name?: string;
  subject?: string;
  description?: string;
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

async function getAuthedUser(request: NextRequest, supabase: ServiceSupabaseClient) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 }) };
  }

  return { userId: data.user.id, error: null };
}

function mapCollection(row: StudyNoteCollectionRow): StudyNoteCollection {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject ? (row.subject as SubjectName) : undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject")?.trim();

    const { data, error: collectionError } = await supabase
      .from("study_note_collections")
      .select("id, name, subject, description, created_at, updated_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (collectionError) throw collectionError;
    const rows = ((data ?? []) as StudyNoteCollectionRow[]).filter((row) =>
      subject ? !row.subject || row.subject === subject : true
    );

    return NextResponse.json({
      ok: true,
      collections: rows.map(mapCollection)
    });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "資料夾載入失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const body = (await request.json().catch(() => null)) as CollectionBody | null;
    const name = body?.name?.trim() ?? "";
    const subject = body?.subject?.trim() || null;
    const description = body?.description?.trim() || null;

    if (!name) {
      return NextResponse.json({ ok: false, message: "請輸入資料夾名稱。" }, { status: 400 });
    }

    const { data, error: insertError } = await supabase
      .from("study_note_collections")
      .insert({
        user_id: userId,
        name,
        subject,
        description,
        updated_at: new Date().toISOString()
      })
      .select("id, name, subject, description, created_at, updated_at")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, collection: mapCollection(data as StudyNoteCollectionRow) });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "資料夾建立失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const body = (await request.json().catch(() => null)) as CollectionBody | null;
    const id = body?.id?.trim() ?? "";
    const name = body?.name?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ ok: false, message: "缺少資料夾 ID。" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ ok: false, message: "請輸入資料夾名稱。" }, { status: 400 });
    }

    const { data, error: updateError } = await supabase
      .from("study_note_collections")
      .update({
        name,
        description: body?.description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, name, subject, description, created_at, updated_at")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, collection: mapCollection(data as StudyNoteCollectionRow) });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "資料夾更新失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
