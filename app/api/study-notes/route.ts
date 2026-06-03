import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeStudyNoteMarkdown } from "@/lib/studyNotes";
import type {
  StudyNoteDetail,
  StudyNoteQuestionLink,
  StudyNoteSummary,
  StudyNoteTag,
  SubjectName
} from "@/types/quiz";

type StudyNoteRow = {
  id: string;
  user_id: string;
  collection_id?: string | null;
  title: string;
  raw_markdown: string;
  summary?: string | null;
  subject?: string | null;
  chapter?: string | null;
  section?: string | null;
  source?: string | null;
  display_order?: number | null;
  created_at: string;
  updated_at: string;
};

type StudyNoteCollectionRow = {
  id: string;
  name: string;
};

type StudyNoteTagRow = {
  id: string | number;
  note_id: string;
  tag: string;
  tag_type: string;
  source?: string | null;
};

type StudyNoteQuestionLinkRow = {
  id: string | number;
  note_id: string;
  question_id: string;
  relation_type: string;
  confidence?: number | null;
  reason?: string | null;
};

type StudyNoteStarRow = {
  note_id: string;
};

type CreateStudyNoteBody = {
  id?: string;
  title?: string;
  rawMarkdown?: string;
  summary?: string;
  subject?: string;
  chapter?: string;
  section?: string;
  collectionName?: string;
  tags?: StudyNoteTag[];
  questionLinks?: StudyNoteQuestionLink[];
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

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function includesSearchText(value: string | null | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search);
}

function mapTagRow(row: StudyNoteTagRow): StudyNoteTag {
  return {
    id: String(row.id),
    noteId: row.note_id,
    tag: row.tag,
    tagType: row.tag_type as StudyNoteTag["tagType"],
    source: (row.source as StudyNoteTag["source"]) ?? "manual"
  };
}

function mapQuestionLinkRow(row: StudyNoteQuestionLinkRow): StudyNoteQuestionLink {
  return {
    id: String(row.id),
    noteId: row.note_id,
    questionId: row.question_id,
    relationType: row.relation_type as StudyNoteQuestionLink["relationType"],
    confidence: row.confidence === null ? undefined : Number(row.confidence),
    reason: row.reason ?? undefined
  };
}

function mapNoteSummary(
  row: StudyNoteRow,
  tags: StudyNoteTag[],
  questionLinkCount: number,
  collection?: StudyNoteCollectionRow,
  starredNoteIds = new Set<string>()
): StudyNoteSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? undefined,
    subject: row.subject ? (row.subject as SubjectName) : undefined,
    chapter: row.chapter ?? undefined,
    section: row.section ?? undefined,
    source: row.source ?? undefined,
    collectionId: row.collection_id ?? undefined,
    collectionName: collection?.name,
    tags,
    questionLinkCount,
    displayOrder: typeof row.display_order === "number" ? row.display_order : undefined,
    isStarred: starredNoteIds.has(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getNextDisplayOrder(
  supabase: ServiceSupabaseClient,
  userId: string,
  subject?: string
) {
  let query = supabase
    .from("study_notes")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1);

  const normalizedSubject = normalizeOptionalText(subject);
  query = normalizedSubject ? query.eq("subject", normalizedSubject) : query.is("subject", null);

  const { data, error } = await query;
  if (error) throw error;

  const current = Number(((data ?? [])[0] as { display_order?: number } | undefined)?.display_order ?? 0);
  return current + 1000;
}

async function loadTagsByNoteId(supabase: ServiceSupabaseClient, userId: string, noteIds: string[]) {
  if (noteIds.length === 0) return new Map<string, StudyNoteTag[]>();

  const { data, error } = await supabase
    .from("study_note_tags")
    .select("id, note_id, tag, tag_type, source")
    .eq("user_id", userId)
    .in("note_id", noteIds);

  if (error) throw error;

  const map = new Map<string, StudyNoteTag[]>();
  for (const row of (data ?? []) as StudyNoteTagRow[]) {
    const bucket = map.get(row.note_id) ?? [];
    bucket.push(mapTagRow(row));
    map.set(row.note_id, bucket);
  }
  return map;
}

async function loadQuestionLinksByNoteId(
  supabase: ServiceSupabaseClient,
  userId: string,
  noteIds: string[]
) {
  if (noteIds.length === 0) return new Map<string, StudyNoteQuestionLink[]>();

  const { data, error } = await supabase
    .from("study_note_question_links")
    .select("id, note_id, question_id, relation_type, confidence, reason")
    .eq("user_id", userId)
    .in("note_id", noteIds);

  if (error) throw error;

  const map = new Map<string, StudyNoteQuestionLink[]>();
  for (const row of (data ?? []) as StudyNoteQuestionLinkRow[]) {
    const bucket = map.get(row.note_id) ?? [];
    bucket.push(mapQuestionLinkRow(row));
    map.set(row.note_id, bucket);
  }
  return map;
}

async function loadCollectionsById(
  supabase: ServiceSupabaseClient,
  userId: string,
  collectionIds: string[]
) {
  if (collectionIds.length === 0) return new Map<string, StudyNoteCollectionRow>();

  const { data, error } = await supabase
    .from("study_note_collections")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", collectionIds);

  if (error) throw error;

  return new Map(((data ?? []) as StudyNoteCollectionRow[]).map((row) => [row.id, row] as const));
}

async function loadStarredNoteIds(supabase: ServiceSupabaseClient, userId: string, noteIds: string[]) {
  if (noteIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from("study_note_stars")
    .select("note_id")
    .eq("user_id", userId)
    .in("note_id", noteIds);

  if (error) {
    if (error.code === "42P01" || String(error.message ?? "").includes("study_note_stars")) {
      return new Set<string>();
    }
    throw error;
  }

  return new Set(((data ?? []) as StudyNoteStarRow[]).map((row) => row.note_id));
}

async function getOrCreateCollectionId(
  supabase: ServiceSupabaseClient,
  userId: string,
  collectionName?: string
) {
  const name = collectionName?.trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("study_note_collections")
    .upsert(
      {
        user_id: userId,
        name,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,name" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data?.id ?? null;
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
    const noteId = searchParams.get("id")?.trim();
    const search = searchParams.get("search")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const tag = searchParams.get("tag")?.trim();

    let query = supabase
      .from("study_notes")
      .select("id, user_id, collection_id, title, raw_markdown, summary, subject, chapter, section, source, display_order, created_at, updated_at")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (noteId) {
      query = query.eq("id", noteId).limit(1);
    }
    if (subject) {
      query = query.eq("subject", subject);
    }
    const { data, error: noteError } = await query;
    if (noteError) throw noteError;

    let noteRows = ((data ?? []) as StudyNoteRow[]);
    const noteIds = noteRows.map((row) => row.id);
    const tagsByNoteId = await loadTagsByNoteId(supabase, userId, noteIds);
    const linksByNoteId = await loadQuestionLinksByNoteId(supabase, userId, noteIds);
    const starredNoteIds = await loadStarredNoteIds(supabase, userId, noteIds);
    const collectionMap = await loadCollectionsById(
      supabase,
      userId,
      Array.from(new Set(noteRows.map((row) => row.collection_id).filter((id): id is string => Boolean(id))))
    );

    if (tag) {
      const normalizedTag = tag.toLowerCase();
      noteRows = noteRows.filter((row) =>
        (tagsByNoteId.get(row.id) ?? []).some((item) => item.tag.toLowerCase().includes(normalizedTag))
      );
    }
    if (search) {
      const normalizedSearch = search.toLowerCase();
      noteRows = noteRows.filter((row) => {
        const tagMatch = (tagsByNoteId.get(row.id) ?? []).some((item) =>
          item.tag.toLowerCase().includes(normalizedSearch)
        );
        return (
          tagMatch ||
          includesSearchText(row.title, normalizedSearch) ||
          includesSearchText(row.summary, normalizedSearch) ||
          includesSearchText(row.raw_markdown, normalizedSearch) ||
          includesSearchText(row.chapter, normalizedSearch) ||
          includesSearchText(row.section, normalizedSearch)
        );
      });
    }

    if (noteId) {
      const row = noteRows[0];
      if (!row) {
        return NextResponse.json({ ok: false, message: "找不到這篇學習筆記。" }, { status: 404 });
      }
      const note: StudyNoteDetail = {
        ...mapNoteSummary(
          row,
          tagsByNoteId.get(row.id) ?? [],
          linksByNoteId.get(row.id)?.length ?? 0,
          row.collection_id ? collectionMap.get(row.collection_id) : undefined,
          starredNoteIds
        ),
        rawMarkdown: row.raw_markdown,
        questionLinks: linksByNoteId.get(row.id) ?? []
      };
      return NextResponse.json({ ok: true, note });
    }

    const notes = noteRows.map((row) =>
      mapNoteSummary(
        row,
        tagsByNoteId.get(row.id) ?? [],
        linksByNoteId.get(row.id)?.length ?? 0,
        row.collection_id ? collectionMap.get(row.collection_id) : undefined,
        starredNoteIds
      )
    );

    return NextResponse.json({ ok: true, notes });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "學習筆記載入失敗";
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
    const body = (await request.json().catch(() => null)) as CreateStudyNoteBody | null;
    const title = body?.title?.trim() ?? "";
    const rawMarkdown = normalizeStudyNoteMarkdown(body?.rawMarkdown?.trim() ?? "");

    if (!title) {
      return NextResponse.json({ ok: false, message: "請輸入筆記標題。" }, { status: 400 });
    }
    if (!rawMarkdown) {
      return NextResponse.json({ ok: false, message: "請貼上學習資料。" }, { status: 400 });
    }

    const collectionId = await getOrCreateCollectionId(supabase, userId, body?.collectionName);
    const displayOrder = await getNextDisplayOrder(supabase, userId, body?.subject);
    const now = new Date().toISOString();
    const { data: insertedNote, error: insertError } = await supabase
      .from("study_notes")
      .insert({
        user_id: userId,
        collection_id: collectionId,
        title,
        raw_markdown: rawMarkdown,
        summary: normalizeOptionalText(body?.summary),
        subject: normalizeOptionalText(body?.subject),
        chapter: normalizeOptionalText(body?.chapter),
        section: normalizeOptionalText(body?.section),
        source: "manual",
        display_order: displayOrder,
        updated_at: now
      })
      .select("id, user_id, collection_id, title, raw_markdown, summary, subject, chapter, section, source, display_order, created_at, updated_at")
      .single();

    if (insertError) throw insertError;

    const noteId = insertedNote.id as string;
    const tagRows = (body?.tags ?? [])
      .map((item) => ({
        note_id: noteId,
        user_id: userId,
        tag: item.tag?.trim(),
        tag_type: item.tagType ?? "misc",
        source: item.source ?? "manual"
      }))
      .filter((item) => item.tag);

    if (tagRows.length > 0) {
      const deduped = Array.from(
        new Map(tagRows.map((row) => [`${row.tag_type}::${row.tag}`, row] as const)).values()
      );
      const { error: tagError } = await supabase
        .from("study_note_tags")
        .insert(deduped);
      if (tagError) throw tagError;
    }

    const linkRows = (body?.questionLinks ?? [])
      .map((item) => ({
        note_id: noteId,
        user_id: userId,
        question_id: item.questionId?.trim(),
        relation_type: item.relationType ?? "related",
        confidence: item.confidence ?? null,
        reason: normalizeOptionalText(item.reason)
      }))
      .filter((item) => item.question_id);

    if (linkRows.length > 0) {
      const deduped = Array.from(
        new Map(linkRows.map((row) => [`${row.question_id}::${row.relation_type}`, row] as const)).values()
      );
      const { error: linkError } = await supabase
        .from("study_note_question_links")
        .insert(deduped);
      if (linkError) throw linkError;
    }

    const tagsByNoteId = await loadTagsByNoteId(supabase, userId, [noteId]);
    const linksByNoteId = await loadQuestionLinksByNoteId(supabase, userId, [noteId]);
    const starredNoteIds = await loadStarredNoteIds(supabase, userId, [noteId]);
    const collectionMap = await loadCollectionsById(supabase, userId, collectionId ? [collectionId] : []);
    const row = insertedNote as StudyNoteRow;
    const note: StudyNoteDetail = {
      ...mapNoteSummary(
        row,
        tagsByNoteId.get(noteId) ?? [],
        linksByNoteId.get(noteId)?.length ?? 0,
        collectionId ? collectionMap.get(collectionId) : undefined,
        starredNoteIds
      ),
      rawMarkdown: row.raw_markdown,
      questionLinks: linksByNoteId.get(noteId) ?? []
    };

    return NextResponse.json({ ok: true, note });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "學習筆記建立失敗";
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
    const body = (await request.json().catch(() => null)) as CreateStudyNoteBody | null;
    const noteId = body?.id?.trim() ?? "";
    const title = body?.title?.trim() ?? "";
    const rawMarkdown = normalizeStudyNoteMarkdown(body?.rawMarkdown?.trim() ?? "");

    if (!noteId) {
      return NextResponse.json({ ok: false, message: "缺少筆記 ID。" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, message: "請輸入筆記標題。" }, { status: 400 });
    }
    if (!rawMarkdown) {
      return NextResponse.json({ ok: false, message: "請貼上學習資料。" }, { status: 400 });
    }

    const collectionId = await getOrCreateCollectionId(supabase, userId, body?.collectionName);
    const { data: updatedNote, error: updateError } = await supabase
      .from("study_notes")
      .update({
        collection_id: collectionId,
        title,
        raw_markdown: rawMarkdown,
        summary: normalizeOptionalText(body?.summary),
        subject: normalizeOptionalText(body?.subject),
        chapter: normalizeOptionalText(body?.chapter),
        section: normalizeOptionalText(body?.section),
        updated_at: new Date().toISOString()
      })
      .eq("id", noteId)
      .eq("user_id", userId)
      .select("id, user_id, collection_id, title, raw_markdown, summary, subject, chapter, section, source, display_order, created_at, updated_at")
      .single();

    if (updateError) throw updateError;

    if (body?.tags) {
      const { error: deleteTagError } = await supabase
        .from("study_note_tags")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", userId);
      if (deleteTagError) throw deleteTagError;

      const tagRows = body.tags
        .map((item) => ({
          note_id: noteId,
          user_id: userId,
          tag: item.tag?.trim(),
          tag_type: item.tagType ?? "misc",
          source: item.source ?? "manual"
        }))
        .filter((item) => item.tag);

      if (tagRows.length > 0) {
        const deduped = Array.from(
          new Map(tagRows.map((row) => [`${row.tag_type}::${row.tag}`, row] as const)).values()
        );
        const { error: tagError } = await supabase
          .from("study_note_tags")
          .insert(deduped);
        if (tagError) throw tagError;
      }
    }

    if (body?.questionLinks) {
      const { error: deleteLinkError } = await supabase
        .from("study_note_question_links")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", userId);
      if (deleteLinkError) throw deleteLinkError;

      const linkRows = body.questionLinks
        .map((item) => ({
          note_id: noteId,
          user_id: userId,
          question_id: item.questionId?.trim(),
          relation_type: item.relationType ?? "related",
          confidence: item.confidence ?? null,
          reason: normalizeOptionalText(item.reason)
        }))
        .filter((item) => item.question_id);

      if (linkRows.length > 0) {
        const deduped = Array.from(
          new Map(linkRows.map((row) => [`${row.question_id}::${row.relation_type}`, row] as const)).values()
        );
        const { error: linkError } = await supabase
          .from("study_note_question_links")
          .insert(deduped);
        if (linkError) throw linkError;
      }
    }

    const tagsByNoteId = await loadTagsByNoteId(supabase, userId, [noteId]);
    const linksByNoteId = await loadQuestionLinksByNoteId(supabase, userId, [noteId]);
    const starredNoteIds = await loadStarredNoteIds(supabase, userId, [noteId]);
    const collectionMap = await loadCollectionsById(supabase, userId, collectionId ? [collectionId] : []);
    const row = updatedNote as StudyNoteRow;
    const note: StudyNoteDetail = {
      ...mapNoteSummary(
        row,
        tagsByNoteId.get(noteId) ?? [],
        linksByNoteId.get(noteId)?.length ?? 0,
        collectionId ? collectionMap.get(collectionId) : undefined,
        starredNoteIds
      ),
      rawMarkdown: row.raw_markdown,
      questionLinks: linksByNoteId.get(noteId) ?? []
    };

    return NextResponse.json({ ok: true, note });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "學習筆記更新失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 500 });
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id")?.trim() ?? "";

    if (!noteId) {
      return NextResponse.json({ ok: false, message: "缺少筆記 ID。" }, { status: 400 });
    }

    const { error: deleteLinkError } = await supabase
      .from("study_note_question_links")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", userId);
    if (deleteLinkError) throw deleteLinkError;

    const { error: deleteTagError } = await supabase
      .from("study_note_tags")
      .delete()
      .eq("note_id", noteId)
      .eq("user_id", userId);
    if (deleteTagError) throw deleteTagError;

    const { data: deletedNote, error: deleteNoteError } = await supabase
      .from("study_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (deleteNoteError) throw deleteNoteError;

    return NextResponse.json({ ok: true, deletedId: deletedNote.id });
  } catch (rawError) {
    const message = rawError instanceof Error ? rawError.message : "學習筆記刪除失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
