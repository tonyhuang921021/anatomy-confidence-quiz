"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StudyNoteMarkdown } from "@/components/StudyNoteMarkdown";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { isNoteSubject } from "@/lib/noteSubjects";
import { BIOCHEMISTRY_SUBJECT } from "@/lib/questionTrackFilters";
import {
  filterMicrobiologyImmunologyNotes,
  isMicrobiologyImmunologySubject,
  MICROBIOLOGY_IMMUNOLOGY_CATEGORIES
} from "@/lib/noteSubjectCategories";
import { clearQuestionExplanationBackgroundCache } from "@/lib/cloudSync";
import {
  loadQuestionExplanationOverridesForIds,
  mergeQuestionExplanationOverrides,
  saveQuestionExplanationOverride
} from "@/lib/storage";
import {
  createStudyNoteCollection,
  deleteStudyNoteCollection,
  loadStudyNote,
  loadStudyNoteCollections,
  loadStudyNotes,
  normalizeStudyNoteMarkdown,
  reorderStudyNoteOutline,
  reorderStudyNotes,
  toggleStudyNoteStar,
  updateStudyNote,
  updateStudyNoteCollection
} from "@/lib/studyNotes";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { buildQuestionExplanationRequestQuestion } from "@/lib/questionExplanationRequest";
import { getQuestionPrimaryTag } from "@/lib/analysisPrimaryTag";
import type {
  OptionKey,
  Question,
  QuestionExplanationOverride,
  StudyNoteCollection,
  StudyNoteDetail,
  SubjectName
} from "@/types/quiz";

function getAllowedQuestionSubjectsForNote(note: StudyNoteDetail): SubjectName[] {
  if (note.subject === BIOCHEMISTRY_SUBJECT) {
    return ["生物化學", "細胞生物學", "分子生物學"];
  }

  return note.subject ? [note.subject] : [];
}

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

type NoteUndoSnapshot = {
  noteId: string;
  rawMarkdown: string;
};

const NOTE_MOVE_SUBJECTS = [...MED1_SUBJECTS, ...MED2_SUBJECTS];
const NOTE_TEXT_COLORS = [
  { id: "red", label: "鮮紅", value: "#ff1744" },
  { id: "green", label: "亮綠", value: "#00c853" },
  { id: "blue", label: "亮藍", value: "#2979ff" },
  { id: "orange", label: "橘色", value: "#ff9100" },
  { id: "purple", label: "亮紫", value: "#d500f9" },
  { id: "black", label: "黑色", value: "#050816" }
] as const;
const NOTE_BACKGROUND_HIGHLIGHT = { id: "yellow", label: "亮黃背景", value: "#fff176" } as const;

type NoteTextColorId = (typeof NOTE_TEXT_COLORS)[number]["id"];
type NoteMarkKind = `color-${NoteTextColorId}` | "bg-yellow";

const NOTE_MARK_LINK_PATTERN = /\[((?:\\.|[^\]\\])*)\]\(#note-(?:color-[a-z]+|bg-yellow)\)/g;

function escapeMarkdownLinkText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\]/g, "\\]")
    .replace(/\[/g, "\\[")
    .replace(/\n+/g, " ");
}

function unescapeMarkdownLinkText(value: string) {
  return value.replace(/\\([\[\]\\])/g, "$1");
}

function createNoteMark(text: string, kind: NoteMarkKind) {
  return `[${escapeMarkdownLinkText(text)}](#note-${kind})`;
}

function replaceSelectedTextWithNoteMark(markdown: string, selectedText: string, kind: NoteMarkKind) {
  const normalizedSelectedText = selectedText.replace(/\s+/g, " ").trim();
  if (!normalizedSelectedText) return null;

  NOTE_MARK_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NOTE_MARK_LINK_PATTERN.exec(markdown))) {
    const markedText = unescapeMarkdownLinkText(match[1]).replace(/\s+/g, " ").trim();
    if (markedText === normalizedSelectedText) {
      return `${markdown.slice(0, match.index)}${createNoteMark(markedText, kind)}${markdown.slice(match.index + match[0].length)}`;
    }
  }

  const directIndex = markdown.indexOf(normalizedSelectedText);
  if (directIndex < 0) return null;
  return `${markdown.slice(0, directIndex)}${createNoteMark(normalizedSelectedText, kind)}${markdown.slice(directIndex + normalizedSelectedText.length)}`;
}

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
  const [dragOverRootZone, setDragOverRootZone] = useState(false);
  const [activeQuestionNoteId, setActiveQuestionNoteId] = useState("");
  const [moveMenuNoteId, setMoveMenuNoteId] = useState("");
  const [currentNoteId, setCurrentNoteId] = useState("");
  const [selectedTextColor, setSelectedTextColor] = useState<NoteTextColorId>("red");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorApplyMessage, setColorApplyMessage] = useState("");
  const [noteUndoStack, setNoteUndoStack] = useState<NoteUndoSnapshot[]>([]);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
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
  const selectedTextColorItem = NOTE_TEXT_COLORS.find((item) => item.id === selectedTextColor) ?? NOTE_TEXT_COLORS[0];
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
    .filter((link) => {
      const question = questionMap.get(link.questionId);
      if (!currentNote || !question) return false;
      return getAllowedQuestionSubjectsForNote(currentNote).includes(question.subject);
    })
    .length ?? 0;
  const activeQuestionNote = notes.find((note) => note.id === activeQuestionNoteId);
  const activeRelatedQuestions = useMemo(() => {
    if (!activeQuestionNote) return [];
    const allowedSubjects = getAllowedQuestionSubjectsForNote(activeQuestionNote);
    return activeQuestionNote.questionLinks
      .map((link) => ({
        link,
        question: questionMap.get(link.questionId)
      }))
      .filter(
        (item): item is { link: typeof item.link; question: Question } =>
          item.question !== undefined && allowedSubjects.includes(item.question.subject)
      );
  }, [activeQuestionNote, questionMap]);

  useEffect(() => {
    const questionIds = activeRelatedQuestions.map((item) => item.question.id);
    if (questionIds.length === 0) return;
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverridesForIds(questionIds))
    );
  }, [activeRelatedQuestions]);

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

  function getDraggedNote() {
    if (!draggingNoteId) return undefined;
    return notesRef.current.find((note) => note.id === draggingNoteId);
  }

  function getCollectionForNote(note: StudyNoteDetail) {
    if (!note.collectionId) return undefined;
    return collectionsRef.current.find((collection) => collection.id === note.collectionId);
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

  function previewDraggedNoteCollection(targetNote: StudyNoteDetail) {
    if (!outlineEditMode || !targetNote.collectionId) return;
    const draggedNote = getDraggedNote();
    if (!draggedNote || draggedNote.id === targetNote.id) return;

    if (draggedNote.collectionId === targetNote.collectionId) {
      previewDraggedNote(targetNote.id);
      return;
    }

    setDragOverCollectionId(targetNote.collectionId);
    setDragOverNoteId("");
  }

  function finishDrag() {
    if (!outlineEditMode) return;
    const originalOrderKey = originalOrderRef.current.join(",");
    const nextOrderKey = getOrderKey(notesRef.current);
    setDraggingNoteId("");
    setDragOverNoteId("");
    setDraggingCollectionId("");
    setDragOverCollectionId("");
    setDragOverRootZone(false);
    originalOrderRef.current = [];
    originalRootOrderRef.current = [];
    lastPreviewTargetRef.current = "";
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
    setDragOverRootZone(false);
    originalRootOrderRef.current = [];
    lastPreviewTargetRef.current = "";
    if (originalOrderKey && originalOrderKey !== nextOrderKey) {
      void persistRootOutlineOrder(rootOutlineItemsRef.current);
    }
  }

  function handleDropOnRootCollection(event: React.DragEvent<HTMLElement>, collection?: StudyNoteCollection) {
    if (!outlineEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event.dataTransfer);
    if (!payload) return;

    if (payload.type === "note") {
      const note = notesRef.current.find((item) => item.id === payload.id);
      if (note) void handleMoveNoteToCollection(note, collection?.name, collection);
      if (originalRootOrderRef.current.length > 0) {
        finishRootDrag();
      } else {
        finishDrag();
      }
      return;
    }

    finishRootDrag();
  }

  function handleDropOnNestedNote(event: React.DragEvent<HTMLElement>, targetNote: StudyNoteDetail) {
    if (!outlineEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event.dataTransfer);
    if (payload?.type !== "note") {
      finishDrag();
      return;
    }

    const draggedNote = notesRef.current.find((item) => item.id === payload.id);
    if (!draggedNote || draggedNote.id === targetNote.id) {
      finishDrag();
      return;
    }

    if (targetNote.collectionName && draggedNote.collectionId !== targetNote.collectionId) {
      void handleMoveNoteToCollection(draggedNote, targetNote.collectionName, getCollectionForNote(targetNote));
      if (originalRootOrderRef.current.length > 0) {
        finishRootDrag();
      } else {
        finishDrag();
      }
      return;
    }

    finishDrag();
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

  function handleDropOnRootItem(event: React.DragEvent<HTMLElement>) {
    if (!outlineEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event.dataTransfer);
    if (payload?.type === "note") {
      const note = notesRef.current.find((item) => item.id === payload.id);
      if (note?.collectionId) {
        void handleMoveNoteToCollection(note, undefined);
        finishDrag();
        return;
      }
    }
    finishRootDrag();
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

  async function handleMoveNoteToCollection(
    note: StudyNoteDetail,
    collectionName?: string,
    collection?: StudyNoteCollection
  ) {
    if (!session?.access_token || outlineSaving) return;
    const previousNotes = notesRef.current;
    const fallbackCollection = collectionName
      ? collectionsRef.current.find((item) => item.name === collectionName)
      : undefined;
    const optimisticCollection = collection ?? fallbackCollection;
    const optimisticNotes = previousNotes.map((item) =>
      item.id === note.id
        ? {
            ...item,
            collectionId: collectionName ? optimisticCollection?.id : undefined,
            collectionName
          }
        : item
    );

    notesRef.current = optimisticNotes;
    setNotes(optimisticNotes);
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
      notesRef.current = previousNotes;
      setNotes(previousNotes);
      setError(rawError instanceof Error ? rawError.message : "筆記資料夾更新失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  function shouldKeepNoteInCurrentView(note: StudyNoteDetail) {
    if (note.subject !== subject) return false;
    if (!isMicrobiology) return true;
    return filterMicrobiologyImmunologyNotes([note], category).length > 0;
  }

  async function handleMoveNoteDestination(
    note: StudyNoteDetail,
    targetSubject: SubjectName,
    targetCategory?: string
  ) {
    if (!session?.access_token || outlineSaving) return;
    const categoryLabel = MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.find((item) => item.id === targetCategory)?.label;

    setOutlineSaving(true);
    setMoveMenuNoteId("");
    setError("");
    try {
      const updated = await updateStudyNote({
        accessToken: session.access_token,
        id: note.id,
        title: note.title,
        rawMarkdown: note.rawMarkdown,
        summary: note.summary,
        subject: targetSubject,
        chapter: categoryLabel,
        section: undefined,
        collectionName: undefined,
        tags: note.tags,
        questionLinks: note.questionLinks
      });
      setNotes((currentNotes) => {
        if (!shouldKeepNoteInCurrentView(updated)) {
          return currentNotes.filter((item) => item.id !== updated.id);
        }
        return currentNotes.map((item) => (item.id === updated.id ? updated : item));
      });
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "筆記移動失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleGenerateQuestionExplanation(
    question: Question,
    previousOverride?: QuestionExplanationOverride
  ) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 AI 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session.access_token,
          question: buildQuestionExplanationRequestQuestion(question),
          previousOverride
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        sharedSaved?: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "AI 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation,
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5.4-mini",
        updatedAt: new Date().toISOString()
      };

      clearQuestionExplanationBackgroundCache(question.id);
      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) =>
        mergeQuestionExplanationOverrides(current, { [question.id]: override })
      );
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 AI 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persistNoteMarkdownChange(
    note: StudyNoteDetail,
    nextMarkdown: string,
    previousNotes: StudyNoteDetail[],
    successMessage: string
  ) {
    const optimisticNotes = previousNotes.map((item) =>
      item.id === note.id ? { ...item, rawMarkdown: nextMarkdown } : item
    );

    notesRef.current = optimisticNotes;
    setNotes(optimisticNotes);
    setOutlineSaving(true);
    setColorApplyMessage(successMessage);

    try {
      const updated = await updateStudyNote({
        accessToken: session?.access_token ?? "",
        id: note.id,
        title: note.title,
        rawMarkdown: nextMarkdown,
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
      notesRef.current = previousNotes;
      setNotes(previousNotes);
      setColorApplyMessage("更新失敗");
      setError(rawError instanceof Error ? rawError.message : "筆記更新失敗");
    } finally {
      setOutlineSaving(false);
    }
  }

  async function handleApplySelectedTextMark(kind: NoteMarkKind) {
    if (!session?.access_token || outlineSaving) return;
    if (typeof window === "undefined") return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!selection || selection.rangeCount === 0 || !selectedText) {
      setColorApplyMessage("先選取文字");
      return;
    }

    const range = selection.getRangeAt(0);
    const startElement =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    const endElement =
      range.endContainer instanceof Element
        ? range.endContainer
        : range.endContainer.parentElement;
    const startArticle = startElement?.closest<HTMLElement>("[data-study-note-id]");
    const endArticle = endElement?.closest<HTMLElement>("[data-study-note-id]");

    if (!startArticle || !endArticle || startArticle.dataset.studyNoteId !== endArticle.dataset.studyNoteId) {
      setColorApplyMessage("請只選同一篇筆記內的文字");
      return;
    }

    const note = notesRef.current.find((item) => item.id === startArticle.dataset.studyNoteId);
    if (!note) {
      setColorApplyMessage("找不到這篇筆記");
      return;
    }

    const normalizedMarkdown = normalizeStudyNoteMarkdown(note.rawMarkdown);
    const candidates = [selection.toString(), selectedText]
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const matchedText = candidates.find((value) => normalizedMarkdown.includes(value));

    if (!matchedText) {
      setColorApplyMessage("這段文字太複雜");
      return;
    }

    const nextMarkdown = replaceSelectedTextWithNoteMark(normalizedMarkdown, matchedText, kind);
    if (!nextMarkdown || nextMarkdown === normalizedMarkdown) {
      setColorApplyMessage("已經是這個標記");
      return;
    }

    const previousNotes = notesRef.current;
    setNoteUndoStack((current) => [...current, { noteId: note.id, rawMarkdown: note.rawMarkdown }].slice(-20));
    await persistNoteMarkdownChange(note, nextMarkdown, previousNotes, kind === "bg-yellow" ? "已加背景" : "已改顏色");
    selection.removeAllRanges();
  }

  async function handleUndoNoteMark() {
    if (!session?.access_token || outlineSaving) return;
    const snapshot = noteUndoStack[noteUndoStack.length - 1];
    if (!snapshot) {
      setColorApplyMessage("沒有上一步");
      return;
    }

    const note = notesRef.current.find((item) => item.id === snapshot.noteId);
    if (!note) {
      setNoteUndoStack((current) => current.slice(0, -1));
      setColorApplyMessage("找不到筆記");
      return;
    }

    const previousNotes = notesRef.current;
    setNoteUndoStack((current) => current.slice(0, -1));
    await persistNoteMarkdownChange(note, snapshot.rawMarkdown, previousNotes, "已返回上一步");
  }

  function renderOutlineNote(note: StudyNoteDetail, nested = false) {
    const rootKey = `note:${note.id}`;
    return (
      <div
        key={note.id}
        onDragEnter={(event) => {
          if (!outlineEditMode) return;
          if (nested) event.stopPropagation();
          if (nested) {
            previewDraggedNoteCollection(note);
          } else {
            previewDraggedRootItem(rootKey);
          }
        }}
        onDragOver={(event) => {
          if (!outlineEditMode) return;
          event.preventDefault();
          if (nested) event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          if (!nested) {
            previewDraggedRootItem(rootKey);
          }
        }}
        onDrop={(event) => {
          if (!outlineEditMode) return;
          if (nested) {
            handleDropOnNestedNote(event, note);
          } else {
            handleDropOnRootItem(event);
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
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleRenameNote(note)}
                  disabled={outlineSaving}
                  className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
                >
                  改筆記名
                </button>
                <button
                  type="button"
                  onClick={() => setMoveMenuNoteId((current) => (current === note.id ? "" : note.id))}
                  disabled={outlineSaving}
                  aria-expanded={moveMenuNoteId === note.id}
                  className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                >
                  移動
                </button>
              </div>
              {moveMenuNoteId === note.id ? (
                <div className="mt-2 rounded-2xl border border-slate-100 bg-white/95 p-2 shadow-sm">
                  <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    移到
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {NOTE_MOVE_SUBJECTS.map((targetSubject) => {
                      const isMicrobiologyTarget = isMicrobiologyImmunologySubject(targetSubject);
                      return (
                        <div key={targetSubject} className={isMicrobiologyTarget ? "col-span-2" : ""}>
                          <button
                            type="button"
                            onClick={() => void handleMoveNoteDestination(note, targetSubject)}
                            disabled={outlineSaving}
                            className="w-full rounded-xl bg-slate-50 px-2 py-1.5 text-left text-[11px] font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50"
                          >
                            {subjectRegistry[targetSubject].label.replace(/（.*）/g, "")}
                          </button>
                          {isMicrobiologyTarget ? (
                            <div className="mt-1 grid grid-cols-3 gap-1 pl-2">
                              {MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => void handleMoveNoteDestination(note, targetSubject, item.id)}
                                  disabled={outlineSaving}
                                  className="rounded-xl bg-teal-50 px-2 py-1 text-[10px] font-black text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main id="main-content" className="shell workspace-page max-w-[1600px]">
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
                  data-root-drop-target={dragOverRootZone}
                  onDragEnter={(event) => {
                    if (!outlineEditMode || !draggingNoteId) return;
                    event.preventDefault();
                    setDragOverRootZone(true);
                    setDragOverCollectionId("");
                    setDragOverNoteId("");
                  }}
                  onDragOver={(event) => {
                    if (!outlineEditMode || !draggingNoteId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverRootZone(true);
                  }}
                  onDragLeave={(event) => {
                    if (!outlineEditMode) return;
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                    setDragOverRootZone(false);
                  }}
                  onDrop={handleDropOnRoot}
                >
                  {hasOutlineItems ? (
                    <>
                      {outlineEditMode ? (
                        <div
                          className="note-outline-root-dropzone rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-xs font-bold text-slate-500"
                          data-drop-target={dragOverRootZone}
                          onDragEnter={(event) => {
                            if (!outlineEditMode || !draggingNoteId) return;
                            event.preventDefault();
                            event.stopPropagation();
                            setDragOverRootZone(true);
                            setDragOverCollectionId("");
                            setDragOverNoteId("");
                          }}
                          onDragOver={(event) => {
                            if (!outlineEditMode || !draggingNoteId) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverRootZone(true);
                            setDragOverCollectionId("");
                            setDragOverNoteId("");
                          }}
                          onDrop={handleDropOnRoot}
                        >
                          拖到這裡，移出資料夾並放回科目根目錄
                        </div>
                      ) : null}
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
                          event.stopPropagation();
                          previewDraggedRootItem(groupKey);
                          if (draggingNoteId) {
                            setDragOverCollectionId(group.id);
                            setDragOverRootZone(false);
                          }
                        }}
                        onDragOver={(event) => {
                          if (!outlineEditMode) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          if (group.collection) previewDraggedRootItem(groupKey);
                          if (draggingNoteId) {
                            setDragOverCollectionId(group.id);
                            setDragOverRootZone(false);
                          }
                        }}
                        onDrop={(event) => handleDropOnRootCollection(event, group.collection)}
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
                        <div
                          className="note-outline-folder-body ml-5 mt-1 grid min-h-14 gap-1 rounded-2xl border border-dashed border-transparent border-l-slate-100 px-2 py-2"
                          data-drop-target={dragOverCollectionId === group.id && draggingCollectionId !== group.id}
                          onDragEnter={(event) => {
                            if (!outlineEditMode || !group.collection || !draggingNoteId) return;
                            event.preventDefault();
                            event.stopPropagation();
                            setDragOverCollectionId(group.id);
                            setDragOverNoteId("");
                            setDragOverRootZone(false);
                          }}
                          onDragOver={(event) => {
                            if (!outlineEditMode || !group.collection || !draggingNoteId) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverCollectionId(group.id);
                            setDragOverNoteId("");
                            setDragOverRootZone(false);
                          }}
                          onDrop={(event) => handleDropOnRootCollection(event, group.collection)}
                        >
                          {group.notes.length > 0 ? (
                            group.notes.map((note) => renderOutlineNote(note, true))
                          ) : (
                            <p className="rounded-xl px-2 py-4 text-xs font-semibold text-slate-400">
                              這個資料夾還沒有筆記。拖到這裡即可放入。
                            </p>
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
                    <article
                      key={note.id}
                      id={`note-${note.id}`}
                      data-note-id={note.id}
                      data-study-note-id={note.id}
                      className="min-w-0 overflow-hidden scroll-mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-7"
                    >
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

            <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2 sm:bottom-6 sm:right-6">
              <button
                type="button"
                onClick={() => void handleUndoNoteMark()}
                disabled={outlineSaving || noteUndoStack.length === 0}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 text-base font-black text-slate-700 shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="返回上一步文字標記"
                title="返回上一步"
              >
                ↶
              </button>
              <div className="note-color-tool relative flex items-center" data-open={colorPickerOpen}>
                <div className="note-color-palette absolute bottom-14 right-0 flex items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur">
                  {NOTE_TEXT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedTextColor(color.id);
                        setColorPickerOpen(false);
                        setColorApplyMessage("");
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white transition hover:scale-105"
                      aria-label={`選擇${color.label}`}
                      aria-pressed={selectedTextColor === color.id}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: color.value }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
                {colorApplyMessage ? (
                  <span className="absolute bottom-12 right-0 whitespace-nowrap rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    {colorApplyMessage}
                  </span>
                ) : null}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleApplySelectedTextMark(`color-${selectedTextColor}`)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-50"
                  aria-label={`套用${selectedTextColorItem.label}文字顏色`}
                  title="選取文字後按一下標色"
                >
                  <span
                    className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                    style={{ backgroundColor: selectedTextColorItem.value }}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setColorPickerOpen((value) => !value)}
                  className="note-color-palette-toggle absolute -left-3 grid h-7 w-7 place-items-center rounded-full border border-white/70 bg-white/95 text-xs font-black text-slate-600 shadow-lg transition hover:bg-teal-50 hover:text-teal-700"
                  aria-label="打開文字顏色選單"
                  aria-expanded={colorPickerOpen}
                >
                  ‹
                </button>
              </div>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleApplySelectedTextMark("bg-yellow")}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-yellow-50"
                aria-label="套用亮黃色文字背景"
                title="選取文字後按一下加亮黃背景"
              >
                <span
                  className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                  style={{ backgroundColor: NOTE_BACKGROUND_HIGHLIGHT.value }}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={scrollToTop}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/60 bg-white/90 text-lg font-black text-slate-800 shadow-xl shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-teal-700 hover:text-white"
                aria-label="回到頁面頂端"
                title="回頂"
              >
                ↑
              </button>
            </div>

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
                {activeRelatedQuestions.length > 0 ? activeRelatedQuestions.map(({ link, question }) => {
                  const override = explanationOverrides[question.id];
                  const explanation = override?.explanation || question.explanation;
                  const optionAnalysis = override?.optionAnalysis ?? question.optionAnalysis;
                  const explanationLoading = explanationLoadingMap[question.id];
                  const explanationError = explanationErrorMap[question.id];

                  return (
                    <article key={`${question.id}-${link.relationType}`} className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="font-bold text-slate-950">{question.id}</span>
                        <span>{question.subject}</span>
                        <span className="text-sky-700">
                          {getQuestionPrimaryTag(question) ?? `${question.chapter} / ${question.section}`}
                        </span>
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <details>
                          <summary className="secondary-pill cursor-pointer list-none px-4 py-2 text-sm">
                            看答案與詳解
                          </summary>
                          <div className="mt-3 min-w-0 overflow-hidden break-words rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-7 text-white">
                            <p className="font-bold">答案：{question.answer}</p>
                            <StructuredExplanationText
                              text={explanation}
                              label="詳解"
                              compact
                              tone="dark"
                              className="mt-3"
                            />
                            <YangmingExplanationPanel
                              questionId={question.id}
                              compact
                              className="mt-3"
                              buttonClassName="min-h-10 rounded-2xl bg-amber-100/15 px-4 py-2 text-sm font-semibold text-amber-50 ring-1 ring-amber-100/20 transition hover:bg-amber-100/25 disabled:cursor-wait disabled:opacity-60"
                            />
                            {optionAnalysis && Object.keys(optionAnalysis).length > 0 ? (
                              <div className="mt-3 grid gap-2">
                                {Object.entries(optionAnalysis).map(([key, value]) =>
                                  value ? (
                                    <p key={key} className="rounded-2xl bg-white/10 px-3 py-2">
                                      <span className="font-bold text-white">{key}. </span>
                                      <span className="text-slate-100">{value}</span>
                                    </p>
                                  ) : null
                                )}
                              </div>
                            ) : null}
                          </div>
                        </details>
                        {override ? (
                          <>
                            <span className="secondary-pill px-4 py-2 text-sm text-slate-600">
                              已替換詳解・{override.model ?? "gpt-5.4-mini"}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleGenerateQuestionExplanation(question, override)}
                              disabled={explanationLoading}
                              className="secondary-pill px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
                            >
                              {explanationLoading ? "重新生成中..." : "重新替換詳解"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleGenerateQuestionExplanation(question)}
                            disabled={explanationLoading}
                            className="secondary-pill px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
                          >
                            {explanationLoading ? "AI 生成中..." : "用 AI 補詳解"}
                          </button>
                        )}
                      </div>
                      {explanationError ? (
                        <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700">
                          {explanationError}
                        </p>
                      ) : null}
                    </article>
                  );
                }) : (
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
