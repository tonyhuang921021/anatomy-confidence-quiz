"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StudyNoteMarkdown } from "@/components/StudyNoteMarkdown";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { subjectRegistry } from "@/data/subjectRegistry";
import { isNoteSubject } from "@/lib/noteSubjects";
import {
  filterMicrobiologyImmunologyNotes,
  isMicrobiologyImmunologySubject,
  MICROBIOLOGY_IMMUNOLOGY_CATEGORIES
} from "@/lib/noteSubjectCategories";
import {
  createStudyNoteCollection,
  deleteStudyNoteCollection,
  loadStudyNote,
  loadStudyNoteCollections,
  loadStudyNotes,
  reorderStudyNoteOutline,
  reorderStudyNotes,
  toggleStudyNoteStar,
  updateStudyNote,
  updateStudyNoteCollection
} from "@/lib/studyNotes";
import type { Question, StudyNoteCollection, StudyNoteDetail, SubjectName } from "@/types/quiz";

function buildQuestionMap(): Map<string, Question> {
  return new Map(
    getCanonicalQuestionBank()
      .filter((question) => question.sourceType !== "AI_GENERATED")
      .map((question) => [question.id, question] as const)
  );
}

type OutlineGroup = {
  id: string;
  name: string;
  collection?: StudyNoteCollection;
  notes: StudyNoteDetail[];
};

type OutlineRootItem =
  | { type: "note"; id: string; note: StudyNoteDetail }
  | { type: "collection"; id: string; group: OutlineGroup };

type OutlineDragPayload =
  | { type: "note"; id: string }
  | { type: "collection"; id: string };

function getAutoCategoryFolderPrefixes(category?: string | null) {
  if (category === "virus") return ["病毒學", "病毒", "virology"];
  if (category === "bacteria") return ["細菌學", "細菌", "bacteriology"];
  if (category === "immunity") return ["免疫學", "免疫", "immunology"];
  return [];
}

function isAutoCategoryFolderName(name: string | undefined, category?: string | null) {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) return false;
  return getAutoCategoryFolderPrefixes(category).some((prefix) => {
    const normalizedPrefix = prefix.toLowerCase();
    return (
      normalizedName.startsWith(`${normalizedPrefix} /`) ||
      normalizedName.startsWith(`${normalizedPrefix}/`) ||
      normalizedName.startsWith(`${normalizedPrefix} ／`) ||
      normalizedName.startsWith(`${normalizedPrefix}／`)
    );
  });
}

function isAutoMetadataFolderName(name: string | undefined, category?: string | null) {
  const normalizedName = name?.trim();
  if (!normalizedName) return false;
  return isAutoCategoryFolderName(normalizedName, category) || /\s*[\/／]\s*/.test(normalizedName);
}

function flattenAutoMetadataFolder(note: StudyNoteDetail, category?: string | null): StudyNoteDetail {
  if (!isAutoMetadataFolderName(note.collectionName, category)) return note;
  return {
    ...note,
    collectionId: undefined,
    collectionName: undefined
  };
}

export default function SubjectNotesPage() {
  const params = useParams<{ subject: string }>();
  const searchParams = useSearchParams();
  const subject = decodeURIComponent(params.subject ?? "");
  const category = searchParams.get("category");
  const { configured, session, user } = useAuth();
  const [notes, setNotes] = useState<StudyNoteDetail[]>([]);
  const [collections, setCollections] = useState<StudyNoteCollection[]>([]);
  const [outlineEditMode, setOutlineEditMode] = useState(false);
  const [draggingNoteId, setDraggingNoteId] = useState("");
  const [dragOverNoteId, setDragOverNoteId] = useState("");
  const [draggingCollectionId, setDraggingCollectionId] = useState("");
  const [dragOverCollectionId, setDragOverCollectionId] = useState("");
  const [activeQuestionNoteId, setActiveQuestionNoteId] = useState("");
  const [currentNoteId, setCurrentNoteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [error, setError] = useState("");
  const validSubject = isNoteSubject(subject);
  const subjectName = subject as SubjectName;
  const subjectItem = validSubject ? subjectRegistry[subjectName] : null;
  const isMicrobiology = isMicrobiologyImmunologySubject(subject);
  const categoryItem = isMicrobiology
    ? MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.find((item) => item.id === category)
    : undefined;
  const notesRef = useRef<StudyNoteDetail[]>([]);
  const collectionsRef = useRef<StudyNoteCollection[]>([]);
  const rootOutlineItemsRef = useRef<OutlineRootItem[]>([]);
  const originalOrderRef = useRef<string[]>([]);
  const originalRootOrderRef = useRef<string[]>([]);
  const lastPreviewTargetRef = useRef("");

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  useEffect(() => {
    if (!configured || !session?.access_token || !validSubject) {
      setNotes([]);
      setCollections([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      loadStudyNotes({ accessToken: session.access_token, subject }),
      loadStudyNoteCollections({ accessToken: session.access_token, subject })
    ])
      .then(async ([nextNotes, nextCollections]) => {
        const visibleCollections = nextCollections.filter((collection) => !isAutoMetadataFolderName(collection.name, category));
        if (!cancelled) setCollections(visibleCollections);
        return nextNotes;
      })
      .then(async (nextNotes) => {
        const details = await Promise.all(
          nextNotes.map((note) => loadStudyNote(note.id, session.access_token))
        );
        const filteredDetails = isMicrobiology ? filterMicrobiologyImmunologyNotes(details, category) : details;
        const visibleDetails = filteredDetails.map((note) => flattenAutoMetadataFolder(note, category));
        if (!cancelled) setNotes(visibleDetails);
      })
      .catch((rawError) => {
        if (!cancelled) {
          setError(rawError instanceof Error ? rawError.message : "筆記載入失敗");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, configured, isMicrobiology, session?.access_token, subject, validSubject]);

  const questionMap = useMemo(() => buildQuestionMap(), []);
  const currentNote = notes.find((note) => note.id === currentNoteId) ?? notes[0];
  const outlineGroups = useMemo(() => {
    const collectionMap = new Map<string, StudyNoteCollection>();
    collections.forEach((collection) => {
      collectionMap.set(collection.id, collection);
    });
    notes.forEach((note) => {
      if (note.collectionId && note.collectionName && !collectionMap.has(note.collectionId)) {
        collectionMap.set(note.collectionId, {
          id: note.collectionId,
          name: note.collectionName,
          subject: note.subject,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
        });
      }
    });

    const grouped: OutlineGroup[] = Array.from(collectionMap.values())
      .sort((left, right) => {
        const orderDiff = (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return left.name.localeCompare(right.name, "zh-Hant");
      })
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        collection,
        notes: notes.filter((note) => note.collectionId === collection.id)
      }));

    return grouped;
  }, [collections, notes]);
  const rootNotes = useMemo(() => notes.filter((note) => !note.collectionId), [notes]);
  const rootOutlineItems = useMemo<OutlineRootItem[]>(() => {
    const items: OutlineRootItem[] = [
      ...rootNotes.map((note) => ({ type: "note" as const, id: note.id, note })),
      ...outlineGroups.map((group) => ({ type: "collection" as const, id: group.id, group }))
    ];
    return items.sort((left, right) => {
      const leftOrder = left.type === "note" ? left.note.displayOrder ?? 0 : left.group.collection?.displayOrder ?? 0;
      const rightOrder = right.type === "note" ? right.note.displayOrder ?? 0 : right.group.collection?.displayOrder ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      const leftLabel = left.type === "note" ? left.note.title : left.group.name;
      const rightLabel = right.type === "note" ? right.note.title : right.group.name;
      return leftLabel.localeCompare(rightLabel, "zh-Hant");
    });
  }, [outlineGroups, rootNotes]);
  const hasOutlineItems = rootOutlineItems.length > 0;

  useEffect(() => {
    rootOutlineItemsRef.current = rootOutlineItems;
  }, [rootOutlineItems]);
  const currentRelatedQuestionCount = currentNote?.questionLinks
    .filter((link) => questionMap.has(link.questionId))
    .length ?? 0;
  const activeQuestionNote = notes.find((note) => note.id === activeQuestionNoteId);
  const activeRelatedQuestions = useMemo(() => {
    if (!activeQuestionNote) return [];
    return activeQuestionNote.questionLinks
      .map((link) => ({
        link,
        question: questionMap.get(link.questionId)
      }))
      .filter((item): item is { link: typeof item.link; question: Question } => Boolean(item.question));
  }, [activeQuestionNote, questionMap]);

  useEffect(() => {
    if (notes.length === 0) {
      setCurrentNoteId("");
      return;
    }

    if (!currentNoteId || !notes.some((note) => note.id === currentNoteId)) {
      setCurrentNoteId(notes[0].id);
    }
  }, [currentNoteId, notes]);

  useEffect(() => {
    if (notes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        const noteId = visibleEntry?.target.getAttribute("data-note-id");
        if (noteId) setCurrentNoteId(noteId);
      },
      {
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0, 0.25, 0.5]
      }
    );

    notes.forEach((note) => {
      const element = document.getElementById(`note-${note.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [notes]);

  async function persistOrder(nextNotes: StudyNoteDetail[]) {
    if (!session?.access_token) return;
    try {
      await reorderStudyNotes({
        accessToken: session.access_token,
        orderedIds: nextNotes.map((note) => note.id)
      });
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記排序更新失敗");
    }
  }

  async function persistRootOutlineOrder(nextItems: OutlineRootItem[]) {
    if (!session?.access_token) return;
    try {
      await reorderStudyNoteOutline({
        accessToken: session.access_token,
        items: nextItems.map((item) => ({ type: item.type, id: item.id }))
      });
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記欄排序更新失敗");
    }
  }

  function getOrderKey(targetNotes: StudyNoteDetail[]) {
    return targetNotes.map((note) => note.id).join(",");
  }

  function getRootItemKey(item: Pick<OutlineRootItem, "type" | "id">) {
    return `${item.type}:${item.id}`;
  }

  function getRootOrderKey(items: OutlineRootItem[]) {
    return items.map(getRootItemKey).join(",");
  }

  function getDraggingRootItemKey() {
    if (draggingCollectionId) return `collection:${draggingCollectionId}`;
    if (draggingNoteId && rootOutlineItemsRef.current.some((item) => item.type === "note" && item.id === draggingNoteId)) {
      return `note:${draggingNoteId}`;
    }
    return "";
  }

  function applyRootOutlineOrder(nextItems: OutlineRootItem[]) {
    rootOutlineItemsRef.current = nextItems;
    const orderByKey = new Map(nextItems.map((item, index) => [getRootItemKey(item), (index + 1) * 1000] as const));

    setNotes((currentNotes) => {
      const nextNotes = currentNotes.map((note) => {
        const nextOrder = orderByKey.get(`note:${note.id}`);
        return nextOrder ? { ...note, displayOrder: nextOrder } : note;
      });
      notesRef.current = nextNotes;
      return nextNotes;
    });

    setCollections((currentCollections) => {
      const nextCollections = currentCollections.map((collection) => {
        const nextOrder = orderByKey.get(`collection:${collection.id}`);
        return nextOrder ? { ...collection, displayOrder: nextOrder } : collection;
      });
      collectionsRef.current = nextCollections;
      return nextCollections;
    });
  }

  function readDragPayload(dataTransfer: DataTransfer): OutlineDragPayload | null {
    const rawPayload = dataTransfer.getData("application/json") || dataTransfer.getData("text/plain");
    try {
      const parsed = JSON.parse(rawPayload) as OutlineDragPayload;
      if (parsed.type === "note" || parsed.type === "collection") return parsed;
    } catch {
      if (rawPayload) return { type: "note", id: rawPayload };
    }
    return null;
  }

  function beginNoteDrag(noteId: string, dataTransfer: DataTransfer, scope: "root" | "nested" = "nested") {
    if (!outlineEditMode) return;
    setDraggingNoteId(noteId);
    setDragOverNoteId(noteId);
    if (scope === "root") {
      originalRootOrderRef.current = rootOutlineItemsRef.current.map(getRootItemKey);
    } else {
      originalOrderRef.current = notesRef.current.map((note) => note.id);
    }
    lastPreviewTargetRef.current = "";
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("application/json", JSON.stringify({ type: "note", id: noteId } satisfies OutlineDragPayload));
    dataTransfer.setData("text/plain", noteId);
  }

  function beginCollectionDrag(collectionId: string, dataTransfer: DataTransfer) {
    if (!outlineEditMode) return;
    setDraggingCollectionId(collectionId);
    setDragOverCollectionId(collectionId);
    originalRootOrderRef.current = rootOutlineItemsRef.current.map(getRootItemKey);
    lastPreviewTargetRef.current = "";
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("application/json", JSON.stringify({ type: "collection", id: collectionId } satisfies OutlineDragPayload));
    dataTransfer.setData("text/plain", collectionId);
  }

  function previewDraggedRootItem(targetKey: string) {
    if (!outlineEditMode) return;
    const sourceKey = getDraggingRootItemKey();
    if (!sourceKey || sourceKey === targetKey || lastPreviewTargetRef.current === targetKey) return;

    const currentItems = rootOutlineItemsRef.current;
    const fromIndex = currentItems.findIndex((item) => getRootItemKey(item) === sourceKey);
    const toIndex = currentItems.findIndex((item) => getRootItemKey(item) === targetKey);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextItems = [...currentItems];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    lastPreviewTargetRef.current = targetKey;
    applyRootOutlineOrder(nextItems);

    if (targetKey.startsWith("note:")) {
      setDragOverNoteId(targetKey.slice("note:".length));
      setDragOverCollectionId("");
    } else {
      setDragOverCollectionId(targetKey.slice("collection:".length));
      setDragOverNoteId("");
    }
  }

  function previewDraggedNote(targetNoteId: string) {
    if (!outlineEditMode) return;
    if (!draggingNoteId || draggingNoteId === targetNoteId) return;
    setNotes((currentNotes) => {
      const fromIndex = currentNotes.findIndex((note) => note.id === draggingNoteId);
      const toIndex = currentNotes.findIndex((note) => note.id === targetNoteId);
      if (fromIndex < 0 || toIndex < 0) return currentNotes;

      const nextNotes = [...currentNotes];
      const [movedNote] = nextNotes.splice(fromIndex, 1);
      nextNotes.splice(toIndex, 0, movedNote);
      notesRef.current = nextNotes;
      return nextNotes;
    });
    setDragOverNoteId(targetNoteId);
  }

  function finishDrag() {
    if (!outlineEditMode) return;
    const originalOrderKey = originalOrderRef.current.join(",");
    const nextOrderKey = getOrderKey(notesRef.current);
    setDraggingNoteId("");
    setDragOverNoteId("");
    originalOrderRef.current = [];
    if (originalOrderKey && originalOrderKey !== nextOrderKey) {
      void persistOrder(notesRef.current);
    }
  }

  function finishRootDrag() {
    if (!outlineEditMode) return;
    const originalOrderKey = originalRootOrderRef.current.join(",");
    const nextOrderKey = getRootOrderKey(rootOutlineItemsRef.current);
    setDraggingNoteId("");
    setDragOverNoteId("");
    setDraggingCollectionId("");
    setDragOverCollectionId("");
    originalRootOrderRef.current = [];
    lastPreviewTargetRef.current = "";
    if (originalOrderKey && originalOrderKey !== nextOrderKey) {
      void persistRootOutlineOrder(rootOutlineItemsRef.current);
    }
  }

  function handleDropOnFolder(event: React.DragEvent<HTMLElement>, collection?: StudyNoteCollection) {
    if (!outlineEditMode) return;
    event.preventDefault();
    const payload = readDragPayload(event.dataTransfer);
    if (!payload) return;

    if (payload.type === "note") {
      const note = notesRef.current.find((item) => item.id === payload.id);
      if (note) void handleMoveNoteToCollection(note, collection?.name);
      if (originalRootOrderRef.current.length > 0) {
        finishRootDrag();
      } else {
        finishDrag();
      }
      return;
    }

    if (payload.type === "collection" && collection) {
      finishRootDrag();
    }
  }

  function handleDropOnRoot(event: React.DragEvent<HTMLElement>) {
    if (!outlineEditMode) return;
    event.preventDefault();
    const payload = readDragPayload(event.dataTransfer);
    if (payload?.type !== "note") return;
    const note = notesRef.current.find((item) => item.id === payload.id);
    if (note) void handleMoveNoteToCollection(note, undefined);
    if (originalRootOrderRef.current.length > 0) {
      finishRootDrag();
    } else {
      finishDrag();
    }
  }

  async function handleToggleStar(noteId: string) {
    if (!session?.access_token) return;
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    const nextStarred = !note.isStarred;

    setNotes((currentNotes) =>
      currentNotes.map((item) => (item.id === noteId ? { ...item, isStarred: nextStarred } : item))
    );
    setError("");

    try {
      await toggleStudyNoteStar({
        accessToken: session.access_token,
        noteId,
        starred: nextStarred
      });
    } catch (rawError) {
      setNotes((currentNotes) =>
        currentNotes.map((item) => (item.id === noteId ? { ...item, isStarred: !nextStarred } : item))
      );
      setError(rawError instanceof Error ? rawError.message : "筆記星號更新失敗");
    }
  }

  async function handleCreateCollection() {
    if (!session?.access_token || outlineSaving) return;
    const name = window.prompt("新增資料夾名稱");
    const normalizedName = name?.trim();
    if (!normalizedName) return;

    setOutlineSaving(true);
    setError("");
    try {
      const collection = await createStudyNoteCollection({
        accessToken: session.access_token,
        name: normalizedName,
        subject
      });
      setCollections((currentCollections) => {
        const nextMap = new Map(currentCollections.map((item) => [item.id, item] as const));
        nextMap.set(collection.id, collection);
        return Array.from(nextMap.values());
      });
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "資料夾建立失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleRenameCollection(collection: StudyNoteCollection) {
    if (!session?.access_token || outlineSaving) return;
    const name = window.prompt("更改資料夾名稱", collection.name);
    const normalizedName = name?.trim();
    if (!normalizedName || normalizedName === collection.name) return;

    setOutlineSaving(true);
    setError("");
    try {
      const updated = await updateStudyNoteCollection({
        accessToken: session.access_token,
        id: collection.id,
        name: normalizedName,
        subject: collection.subject
      });
      setCollections((currentCollections) =>
        currentCollections.map((item) => (item.id === updated.id ? updated : item))
      );
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.collectionId === updated.id ? { ...note, collectionName: updated.name } : note
        )
      );
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "資料夾更新失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleDeleteCollection(collection: StudyNoteCollection) {
    if (!session?.access_token || outlineSaving) return;
    const childCount = notes.filter((note) => note.collectionId === collection.id).length;
    const confirmed = window.confirm(
      childCount > 0
        ? `確定刪除「${collection.name}」？裡面的 ${childCount} 篇筆記會移到未分類，不會被刪掉。`
        : `確定刪除「${collection.name}」？`
    );
    if (!confirmed) return;

    setOutlineSaving(true);
    setError("");
    try {
      await deleteStudyNoteCollection(collection.id, session.access_token);
      setCollections((currentCollections) =>
        currentCollections.filter((item) => item.id !== collection.id)
      );
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.collectionId === collection.id
            ? { ...note, collectionId: undefined, collectionName: undefined }
            : note
        )
      );
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "資料夾刪除失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleRenameNote(note: StudyNoteDetail) {
    if (!session?.access_token || outlineSaving) return;
    const title = window.prompt("更改筆記名稱", note.title);
    const normalizedTitle = title?.trim();
    if (!normalizedTitle || normalizedTitle === note.title) return;

    setOutlineSaving(true);
    setError("");
    try {
      const updated = await updateStudyNote({
        accessToken: session.access_token,
        id: note.id,
        title: normalizedTitle,
        rawMarkdown: note.rawMarkdown,
        summary: note.summary,
        subject: note.subject,
        chapter: note.chapter,
        section: note.section,
        collectionName: note.collectionName,
        tags: note.tags,
        questionLinks: note.questionLinks
      });
      setNotes((currentNotes) =>
        currentNotes.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記名稱更新失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleMoveNoteToCollection(note: StudyNoteDetail, collectionName?: string) {
    if (!session?.access_token || outlineSaving) return;
    setOutlineSaving(true);
    setError("");
    try {
      const updated = await updateStudyNote({
        accessToken: session.access_token,
        id: note.id,
        title: note.title,
        rawMarkdown: note.rawMarkdown,
        summary: note.summary,
        subject: note.subject,
        chapter: note.chapter,
        section: note.section,
        collectionName,
        tags: note.tags,
        questionLinks: note.questionLinks
      });
      setNotes((currentNotes) =>
        currentNotes.map((item) => (item.id === updated.id ? updated : item))
      );
      const updatedCollectionId = updated.collectionId;
      const updatedCollectionName = updated.collectionName;
      if (updatedCollectionId && updatedCollectionName) {
        setCollections((currentCollections) => {
          if (currentCollections.some((collection) => collection.id === updatedCollectionId)) {
            return currentCollections;
          }
          return [
            ...currentCollections,
            {
              id: updatedCollectionId,
              name: updatedCollectionName,
              subject: updated.subject,
              createdAt: updated.createdAt,
              updatedAt: updated.updatedAt
            }
          ];
        });
      }
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記資料夾更新失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderOutlineNote(note: StudyNoteDetail, nested = false) {
    const rootKey = `note:${note.id}`;
    return (
      <div
        key={note.id}
        onDragEnter={() => {
          if (nested) {
            previewDraggedNote(note.id);
          } else {
            previewDraggedRootItem(rootKey);
          }
        }}
        onDragOver={(event) => {
          if (!outlineEditMode) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!nested) {
            previewDraggedRootItem(rootKey);
          }
        }}
        onDrop={(event) => {
          if (!outlineEditMode) return;
          event.preventDefault();
          if (nested) {
            finishDrag();
          } else {
            finishRootDrag();
          }
        }}
        data-dragging={draggingNoteId === note.id}
        data-drop-target={dragOverNoteId === note.id && draggingNoteId !== note.id}
        className={`note-outline-item group rounded-2xl px-2 py-2 hover:bg-teal-50 ${
          outlineEditMode
            ? "grid grid-cols-[28px_minmax(0,1fr)] gap-2"
            : "grid grid-cols-[minmax(0,1fr)]"
        } ${nested ? "" : "bg-white/70"}`}
      >
        {outlineEditMode ? (
          <button
            type="button"
            draggable
            onDragStart={(event) => beginNoteDrag(note.id, event.dataTransfer, nested ? "nested" : "root")}
            onDragEnd={nested ? finishDrag : finishRootDrag}
            aria-label={`拖曳排序：${note.title}`}
            className="grid h-8 w-7 cursor-grab place-items-center rounded-xl text-slate-300 transition hover:bg-white hover:text-teal-700 active:cursor-grabbing"
          >
            <span className="leading-none">⠿</span>
          </button>
        ) : null}
        <div className="min-w-0">
          <a
            href={`#note-${note.id}`}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm font-bold text-slate-700 group-hover:text-teal-800"
          >
            <span className="min-w-0 truncate">{note.title}</span>
            <span className={note.isStarred ? "text-amber-500" : "text-slate-300"} aria-label={note.isStarred ? "已打星" : "未打星"}>
              {note.isStarred ? "★" : "☆"}
            </span>
          </a>
          {outlineEditMode ? (
            <button
              type="button"
              onClick={() => void handleRenameNote(note)}
              disabled={outlineSaving}
              className="mt-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
            >
              改筆記名
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="shell max-w-[1600px]">
      <section className="surface-card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Subject Document</p>
            <h1 className="display-title mt-3 break-words text-4xl sm:text-5xl">
              {subjectItem?.label ?? "學習筆記"}{categoryItem ? `｜${categoryItem.label}` : ""}
            </h1>
            <p className="body-soft mt-4 max-w-3xl leading-7">
              {categoryItem
                ? `${categoryItem.description}。左邊顯示筆記名稱，抓住六點把手可以調整順序。`
                : "這裡會把同一科的筆記串成一份大文件。左邊顯示筆記名稱，抓住六點把手可以調整順序。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/notes" className="secondary-pill">
              回十科
            </Link>
            {isMicrobiology ? (
              MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.map((item) => (
                <Link
                  key={item.id}
                  href={`/notes/subject/${encodeURIComponent(subject)}?category=${item.id}`}
                  className={item.id === category ? "primary-pill" : "secondary-pill"}
                >
                  {item.label}
                </Link>
              ))
            ) : null}
            <Link href="/notes/new" className="primary-pill">
              新增筆記
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {!configured ? (
          <div className="surface-card p-6"><p className="body-soft">Supabase 尚未設定，學習筆記需要雲端儲存才能使用。</p></div>
        ) : !user ? (
          <div className="surface-card p-6"><p className="body-soft">請先在首頁登入，才能讀取自己的學習筆記。</p></div>
        ) : !validSubject ? (
          <div className="surface-card p-6"><p className="body-soft">找不到這個科目的筆記頁。</p></div>
        ) : (
          <div className="relative">
            <aside className="note-outline-drawer" data-editing={outlineEditMode}>
              <div className="note-outline-handle" aria-hidden="true">
                筆記
              </div>
              <div className="note-outline-panel surface-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Notes</p>
                    {outlineEditMode ? (
                      <p className="mt-1 text-[11px] font-semibold text-teal-700">
                        編輯中：可拖曳、改名、分資料夾
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {outlineEditMode ? (
                      <button
                        type="button"
                        onClick={() => void handleCreateCollection()}
                        disabled={outlineSaving}
                        className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50"
                      >
                        新增資料夾
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOutlineEditMode((value) => !value)}
                      className={outlineEditMode ? "rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-700" : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"}
                    >
                      {outlineEditMode ? "完成" : "編輯"}
                    </button>
                  </div>
                </div>
                <div
                  className="mt-4 grid gap-2"
                  onDragOver={(event) => {
                    if (!outlineEditMode || !draggingNoteId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={handleDropOnRoot}
                >
                  {hasOutlineItems ? (
                    <>
                      {rootOutlineItems.map((item) => {
                        if (item.type === "note") return renderOutlineNote(item.note);
                        const group = item.group;
                        const groupKey = `collection:${group.id}`;
                        return (
                      <section
                        key={group.id}
                        className="rounded-2xl border border-slate-100 bg-white/80 p-2"
                        data-drop-target={dragOverCollectionId === group.id && draggingCollectionId !== group.id}
                        onDragEnter={(event) => {
                          if (!outlineEditMode || !group.collection) return;
                          previewDraggedRootItem(groupKey);
                        }}
                        onDragOver={(event) => {
                          if (!outlineEditMode) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          if (group.collection) previewDraggedRootItem(groupKey);
                        }}
                        onDrop={(event) => handleDropOnFolder(event, group.collection)}
                      >
                        <div
                          className="group flex items-center gap-2 rounded-xl px-2 py-2 text-slate-700 transition hover:bg-teal-50"
                          draggable={outlineEditMode && Boolean(group.collection)}
                          onDragStart={(event) => {
                            if (group.collection) beginCollectionDrag(group.collection.id, event.dataTransfer);
                          }}
                          onDragEnd={finishRootDrag}
                        >
                          {outlineEditMode && group.collection ? (
                            <span className="grid h-7 w-7 cursor-grab place-items-center rounded-lg text-slate-300 transition group-hover:bg-white group-hover:text-teal-700">
                              ⠿
                            </span>
                          ) : (
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-xs font-black text-teal-700">
                              ▸
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-800">{group.name}</p>
                            <p className="text-[11px] font-semibold text-slate-400">{group.notes.length} 篇筆記</p>
                          </div>
                          {outlineEditMode && group.collection ? (
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (group.collection) void handleRenameCollection(group.collection);
                                }}
                                disabled={outlineSaving}
                                className="rounded-full px-2 py-1 text-[11px] font-bold text-teal-700 transition hover:bg-white disabled:opacity-50"
                              >
                                改名
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (group.collection) void handleDeleteCollection(group.collection);
                                }}
                                disabled={outlineSaving}
                                className="rounded-full px-2 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                              >
                                刪除
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="ml-5 mt-1 grid gap-1 border-l border-slate-100 pl-3">
                          {group.notes.length > 0 ? (
                            group.notes.map((note) => renderOutlineNote(note, true))
                          ) : (
                            <p className="px-2 py-2 text-xs font-semibold text-slate-400">這個資料夾還沒有筆記。</p>
                          )}
                        </div>
                      </section>
                        );
                      })}
                    </>
                  ) : (
                    <p className="body-soft text-sm">目前還沒有筆記。</p>
                  )}
                </div>
              </div>
            </aside>

            <article className="surface-card min-w-0 overflow-hidden p-5 sm:p-8 lg:p-12">
              {loading ? <p className="body-soft">正在載入這科的大文件...</p> : null}
              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {!loading && notes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                  <p className="font-bold text-slate-950">這科還沒有筆記。</p>
                  <p className="body-soft mt-2 text-sm">新增筆記並選擇這個科目後，就會出現在這份大文件裡。</p>
                </div>
              ) : null}

              <div className="grid min-w-0 gap-10">
                {notes.map((note) => (
                    <article key={note.id} id={`note-${note.id}`} data-note-id={note.id} className="min-w-0 overflow-hidden scroll-mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="break-words text-3xl font-black text-slate-950">{note.title}</h2>
                          {note.summary ? <p className="body-soft mt-2 leading-7">{note.summary}</p> : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleStar(note.id)}
                            className={note.isStarred ? "secondary-pill border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700" : "secondary-pill px-4 py-2 text-sm"}
                            aria-pressed={Boolean(note.isStarred)}
                            aria-label={note.isStarred ? `取消 ${note.title} 的星號` : `幫 ${note.title} 打星號`}
                          >
                            <span aria-hidden="true">{note.isStarred ? "★" : "☆"}</span>
                            {note.isStarred ? "已打星" : "打星星"}
                          </button>
                          <Link href={`/notes/${note.id}`} className="secondary-pill px-4 py-2 text-sm">
                            編輯 / 詳情
                          </Link>
                        </div>
                      </div>
                      <div className="mt-6">
                        <StudyNoteMarkdown
                          markdown={note.rawMarkdown}
                          questionMap={questionMap}
                          questionLinks={note.questionLinks}
                        />
                      </div>
                    </article>
                ))}
              </div>
            </article>

            {currentNote ? (
              <button
                type="button"
                onClick={() => setActiveQuestionNoteId(currentNote.id)}
                className="fixed right-5 top-1/2 z-30 -translate-y-1/2 rounded-3xl border border-white/20 bg-slate-950 px-4 py-5 text-sm font-bold leading-5 text-white shadow-2xl shadow-slate-900/20 transition hover:bg-teal-700 sm:right-6"
                aria-label={`打開 ${currentNote.title} 的考古題`}
              >
                <span className="block [writing-mode:vertical-rl]">
                  考古題 {currentRelatedQuestionCount}
                </span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={scrollToTop}
              className="fixed bottom-5 right-5 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 text-lg font-black text-slate-800 shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-teal-700 hover:text-white sm:bottom-6 sm:right-6"
              aria-label="回到頁面頂端"
              title="回頂"
            >
              ↑
            </button>

            <button
              type="button"
              className="note-question-backdrop"
              data-open={Boolean(activeQuestionNote)}
              onClick={() => setActiveQuestionNoteId("")}
              aria-label="收合考古題抽屜"
            />

            <aside className="note-question-drawer" data-open={Boolean(activeQuestionNote)}>
              <button
                type="button"
                onClick={() => setActiveQuestionNoteId("")}
                className="note-question-close-tab"
              >
                收合
              </button>
              <div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Linked Questions</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    {activeQuestionNote?.title ?? "考古題"}
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                {activeRelatedQuestions.length > 0 ? activeRelatedQuestions.map(({ link, question }) => (
                  <article key={`${question.id}-${link.relationType}`} className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="font-bold text-slate-950">{question.id}</span>
                      <span>{question.subject}</span>
                      <span>{question.chapter}</span>
                      <span>{question.section}</span>
                    </div>
                    <p className="mt-3 break-words font-bold text-slate-950">{question.stem}</p>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(question.options)
                        .filter(([, value]) => Boolean(value))
                        .map(([key, value]) => (
                          <p key={key} className="break-words rounded-2xl bg-slate-50 px-3 py-2 text-slate-700">
                            <span className="font-bold text-slate-950">{key}. </span>
                            {value}
                          </p>
                        ))}
                    </div>
                    {link.reason ? <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{link.reason}</p> : null}
                    <details className="mt-3">
                      <summary className="secondary-pill cursor-pointer list-none px-4 py-2 text-sm">
                        看答案與詳解
                      </summary>
                      <div className="mt-3 min-w-0 overflow-hidden break-words rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-7 text-white">
                        <p className="font-bold">答案：{question.answer}</p>
                        <p className="mt-2 text-slate-100">{question.explanation}</p>
                      </div>
                    </details>
                  </article>
                )) : (
                  <p className="body-soft rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm">
                    這篇筆記還沒有連結題目。
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
