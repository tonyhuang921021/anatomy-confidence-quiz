"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  OptionKey,
  Question,
  SavedQuestionRecord,
  SavedQuestionSource,
  SavedQuestionTombstone
} from "@/types/quiz";

const SAVED_QUESTIONS_STORAGE_KEY = "anatomy-confidence-saved-questions:v1";
const SAVED_QUESTION_TOMBSTONES_STORAGE_KEY = "anatomy-confidence-saved-question-tombstones:v1";
const LEGACY_SEARCH_FAVORITES_STORAGE_KEY = "anatomy-confidence-search-favorites:v1";
const CLOUD_SYNC_MIN_INTERVAL_MS = 30_000;
const MAX_SYNC_RECORDS = 1500;

type LegacySearchFavoriteRecord = {
  questionId?: string;
  addedAt?: string;
  correctCount?: number;
  attempts?: number;
  lastAnsweredAt?: string;
};

type SavedQuestionsSyncResponse = {
  ok: boolean;
  records?: SavedQuestionRecord[];
  acknowledgedDeletedQuestionIds?: string[];
  message?: string;
};

let recordsCache: Record<string, SavedQuestionRecord> | null = null;
let tombstonesCache: Record<string, SavedQuestionTombstone> | null = null;
let cloudSyncPromise: Promise<void> | null = null;
let queuedCloudSyncToken: string | null = null;
let lastCloudSyncAt = 0;
let localRevision = 0;

const listeners = new Set<() => void>();
const EMPTY_RECORDS: Record<string, SavedQuestionRecord> = {};

function isBrowser() {
  return typeof window !== "undefined";
}

function safeGetItem(key: string) {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep the current page usable when localStorage is full or blocked.
  }
}

function notifySavedQuestionListeners() {
  listeners.forEach((listener) => listener());
}

function normalizeIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function normalizeCount(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeSource(value: unknown): SavedQuestionSource | undefined {
  return value === "search" ||
    value === "quiz" ||
    value === "results" ||
    value === "review" ||
    value === "saved"
    ? value
    : undefined;
}

function normalizeSavedQuestionRecord(value: unknown): SavedQuestionRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedQuestionRecord>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  if (!questionId) return null;

  const addedAt = normalizeIsoString(raw.addedAt);
  const updatedAt = normalizeIsoString(raw.updatedAt, raw.lastAnsweredAt ?? addedAt);
  const attempts = normalizeCount(raw.attempts);
  const correctCount = Math.min(2, normalizeCount(raw.correctCount));
  const lastAnsweredAt =
    typeof raw.lastAnsweredAt === "string" && raw.lastAnsweredAt.trim()
      ? normalizeIsoString(raw.lastAnsweredAt)
      : undefined;

  return {
    questionId,
    addedAt,
    updatedAt,
    correctCount,
    attempts,
    lastAnsweredAt,
    source: normalizeSource(raw.source)
  };
}

function normalizeTombstone(value: unknown): SavedQuestionTombstone | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedQuestionTombstone>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  if (!questionId) return null;

  return {
    questionId,
    deletedAt: normalizeIsoString(raw.deletedAt)
  };
}

function parseRecordMap(rawValue: string | null) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.values(parsed as Record<string, unknown>)
        .map(normalizeSavedQuestionRecord)
        .filter((record): record is SavedQuestionRecord => Boolean(record))
        .map((record) => [record.questionId, record] as const)
    );
  } catch {
    return {};
  }
}

function parseTombstoneMap(rawValue: string | null) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.values(parsed as Record<string, unknown>)
        .map(normalizeTombstone)
        .filter((record): record is SavedQuestionTombstone => Boolean(record))
        .map((record) => [record.questionId, record] as const)
    );
  } catch {
    return {};
  }
}

function loadLegacySearchFavorites() {
  const rawValue = safeGetItem(LEGACY_SEARCH_FAVORITES_STORAGE_KEY);
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue) as Record<string, LegacySearchFavoriteRecord>;
    if (!parsed || typeof parsed !== "object") return {};

    const records: Record<string, SavedQuestionRecord> = {};
    Object.entries(parsed).forEach(([questionId, record]) => {
      const normalizedId = record?.questionId?.trim() || questionId.trim();
      if (!normalizedId) return;
      const addedAt = normalizeIsoString(record?.addedAt);
      const updatedAt = normalizeIsoString(record?.lastAnsweredAt ?? record?.addedAt, addedAt);
      records[normalizedId] = {
        questionId: normalizedId,
        addedAt,
        updatedAt,
        correctCount: Math.min(2, normalizeCount(record?.correctCount)),
        attempts: normalizeCount(record?.attempts),
        lastAnsweredAt: record?.lastAnsweredAt ? normalizeIsoString(record.lastAnsweredAt) : undefined,
        source: "search"
      };
    });

    return records;
  } catch {
    return {};
  }
}

function getRecordsCache() {
  if (recordsCache) return recordsCache;
  const savedRecords = parseRecordMap(safeGetItem(SAVED_QUESTIONS_STORAGE_KEY));
  const legacyRecords = loadLegacySearchFavorites();
  recordsCache = mergeRecordMapsByUpdatedAt(legacyRecords, savedRecords);
  safeSetItem(SAVED_QUESTIONS_STORAGE_KEY, JSON.stringify(recordsCache));
  return recordsCache;
}

function getTombstonesCache() {
  if (tombstonesCache) return tombstonesCache;
  tombstonesCache = parseTombstoneMap(safeGetItem(SAVED_QUESTION_TOMBSTONES_STORAGE_KEY));
  return tombstonesCache;
}

function setRecordsCache(nextRecords: Record<string, SavedQuestionRecord>, countAsLocalChange = true) {
  recordsCache = nextRecords;
  if (countAsLocalChange) localRevision += 1;
  safeSetItem(SAVED_QUESTIONS_STORAGE_KEY, JSON.stringify(nextRecords));
  notifySavedQuestionListeners();
}

function setTombstonesCache(nextTombstones: Record<string, SavedQuestionTombstone>) {
  tombstonesCache = nextTombstones;
  safeSetItem(SAVED_QUESTION_TOMBSTONES_STORAGE_KEY, JSON.stringify(nextTombstones));
}

function mergeRecordMapsByUpdatedAt(
  left: Record<string, SavedQuestionRecord>,
  right: Record<string, SavedQuestionRecord>
) {
  const merged: Record<string, SavedQuestionRecord> = {};
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  ids.forEach((questionId) => {
    const leftRecord = left[questionId];
    const rightRecord = right[questionId];
    if (!leftRecord && rightRecord) {
      merged[questionId] = rightRecord;
      return;
    }
    if (leftRecord && !rightRecord) {
      merged[questionId] = leftRecord;
      return;
    }
    if (!leftRecord || !rightRecord) return;
    merged[questionId] =
      rightRecord.updatedAt >= leftRecord.updatedAt
        ? {
            ...leftRecord,
            ...rightRecord,
            addedAt: leftRecord.addedAt <= rightRecord.addedAt ? leftRecord.addedAt : rightRecord.addedAt
          }
        : {
            ...rightRecord,
            ...leftRecord,
            addedAt: leftRecord.addedAt <= rightRecord.addedAt ? leftRecord.addedAt : rightRecord.addedAt
          };
  });
  return merged;
}

function recordsArrayToMap(records: SavedQuestionRecord[] = []) {
  return Object.fromEntries(
    records
      .map(normalizeSavedQuestionRecord)
      .filter((record): record is SavedQuestionRecord => Boolean(record))
      .map((record) => [record.questionId, record] as const)
  );
}

function getSavedQuestionRecordsSnapshot() {
  return isBrowser() ? getRecordsCache() : EMPTY_RECORDS;
}

export function subscribeToSavedQuestionRecords(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadSavedQuestionRecords() {
  return getRecordsCache();
}

export function isQuestionSaved(questionId: string) {
  return Boolean(getRecordsCache()[questionId]);
}

export function isSavedQuestionCompleted(record?: SavedQuestionRecord) {
  return (record?.correctCount ?? 0) >= 2;
}

export function getSavedQuestionCount() {
  return Object.keys(getRecordsCache()).length;
}

export function isAcceptedSavedQuestionAnswer(question: Question, answer: OptionKey) {
  if (question.answerCreditType === "all_credit") return true;
  if (
    (question.answerCreditType === "multiple_accepted" ||
      question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
  ) {
    return question.acceptedAnswers.includes(answer);
  }

  return question.answer === answer;
}

export function toggleSavedQuestionRecord(
  questionId: string,
  source: SavedQuestionSource,
  accessToken?: string | null
) {
  const normalizedQuestionId = questionId.trim();
  if (!normalizedQuestionId) return null;

  const now = new Date().toISOString();
  const currentRecords = getRecordsCache();
  const currentTombstones = getTombstonesCache();

  if (currentRecords[normalizedQuestionId]) {
    const nextRecords = { ...currentRecords };
    delete nextRecords[normalizedQuestionId];
    setRecordsCache(nextRecords);
    setTombstonesCache({
      ...currentTombstones,
      [normalizedQuestionId]: {
        questionId: normalizedQuestionId,
        deletedAt: now
      }
    });
    if (accessToken) void queueSavedQuestionsCloudSync(accessToken, { force: true });
    return false;
  }

  const nextRecords = {
    ...currentRecords,
    [normalizedQuestionId]: {
      questionId: normalizedQuestionId,
      addedAt: now,
      updatedAt: now,
      correctCount: 0,
      attempts: 0,
      source
    }
  };
  const nextTombstones = { ...currentTombstones };
  delete nextTombstones[normalizedQuestionId];
  setTombstonesCache(nextTombstones);
  setRecordsCache(nextRecords);
  if (accessToken) void queueSavedQuestionsCloudSync(accessToken, { force: true });
  return true;
}

export function removeSavedQuestionRecord(questionId: string, accessToken?: string | null) {
  const normalizedQuestionId = questionId.trim();
  if (!normalizedQuestionId) return;
  if (!getRecordsCache()[normalizedQuestionId]) return;
  toggleSavedQuestionRecord(normalizedQuestionId, "saved", accessToken);
}

export function recordSavedQuestionAnswer(
  questionId: string,
  isCorrect: boolean,
  accessToken?: string | null
) {
  const normalizedQuestionId = questionId.trim();
  if (!normalizedQuestionId) return;

  const now = new Date().toISOString();
  const currentRecords = getRecordsCache();
  const current = currentRecords[normalizedQuestionId] ?? {
    questionId: normalizedQuestionId,
    addedAt: now,
    updatedAt: now,
    correctCount: 0,
    attempts: 0,
    source: "saved" as const
  };
  const nextRecords = {
    ...currentRecords,
    [normalizedQuestionId]: {
      ...current,
      attempts: current.attempts + 1,
      correctCount: isCorrect ? Math.min(2, current.correctCount + 1) : current.correctCount,
      lastAnsweredAt: now,
      updatedAt: now
    }
  };

  setRecordsCache(nextRecords);
  if (accessToken) void queueSavedQuestionsCloudSync(accessToken, { force: true });
}

export function useSavedQuestionRecords(accessToken?: string | null) {
  const records = useSyncExternalStore(
    subscribeToSavedQuestionRecords,
    getSavedQuestionRecordsSnapshot,
    () => EMPTY_RECORDS
  );

  useEffect(() => {
    if (!accessToken) return;
    void ensureSavedQuestionsCloudSynced(accessToken);
  }, [accessToken]);

  return records;
}

export async function ensureSavedQuestionsCloudSynced(accessToken: string) {
  if (!accessToken) return;
  if (Date.now() - lastCloudSyncAt < CLOUD_SYNC_MIN_INTERVAL_MS) return;
  await queueSavedQuestionsCloudSync(accessToken);
}

export async function queueSavedQuestionsCloudSync(
  accessToken: string,
  options: { force?: boolean } = {}
) {
  if (!accessToken || !isBrowser()) return;
  if (!options.force && Date.now() - lastCloudSyncAt < CLOUD_SYNC_MIN_INTERVAL_MS) return;

  if (cloudSyncPromise) {
    queuedCloudSyncToken = accessToken;
    return cloudSyncPromise;
  }

  const syncStartedRevision = localRevision;
  cloudSyncPromise = syncSavedQuestionsWithCloud(accessToken)
    .then((response) => {
      if (!response.ok || !Array.isArray(response.records)) return;

      const cloudRecords = recordsArrayToMap(response.records);
      const currentRecords = getRecordsCache();
      const nextRecords =
        localRevision === syncStartedRevision
          ? cloudRecords
          : mergeRecordMapsByUpdatedAt(cloudRecords, currentRecords);
      setRecordsCache(nextRecords, false);

      if (response.acknowledgedDeletedQuestionIds?.length) {
        const currentTombstones = getTombstonesCache();
        const nextTombstones = { ...currentTombstones };
        response.acknowledgedDeletedQuestionIds.forEach((questionId) => {
          delete nextTombstones[questionId];
        });
        setTombstonesCache(nextTombstones);
      }
      lastCloudSyncAt = Date.now();
    })
    .catch(() => {
      // Keep local state; the next authenticated page will retry.
    })
    .finally(() => {
      cloudSyncPromise = null;
      const queuedToken = queuedCloudSyncToken;
      queuedCloudSyncToken = null;
      if (queuedToken) {
        void queueSavedQuestionsCloudSync(queuedToken, { force: true });
      }
    });

  return cloudSyncPromise;
}

async function syncSavedQuestionsWithCloud(accessToken: string): Promise<SavedQuestionsSyncResponse> {
  const records = Object.values(getRecordsCache()).slice(0, MAX_SYNC_RECORDS);
  const deletedRecords = Object.values(getTombstonesCache()).slice(0, MAX_SYNC_RECORDS);

  const response = await fetch("/api/saved-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      action: "sync",
      records,
      deletedRecords
    })
  });
  const payload = (await response.json().catch(() => null)) as SavedQuestionsSyncResponse | null;
  return payload ?? { ok: false, message: "儲存題目同步失敗。" };
}
