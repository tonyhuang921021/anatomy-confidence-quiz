export const LAOZHAO_LOCAL_DB_NAME = "laozhao-anatomy-learning" as const;
export const LAOZHAO_LOCAL_DB_VERSION = 1 as const;

export const LAOZHAO_LOCAL_STORES = ["progress", "bookmarks", "notes"] as const;
export type LaoZhaoLocalStore = (typeof LAOZHAO_LOCAL_STORES)[number];

export type WatchedRange = {
  startSec: number;
  endSec: number;
};

export type LaoZhaoProgressRecord = {
  videoId: string;
  lastPositionSec: number;
  durationSec: number;
  watchedRanges: WatchedRange[];
  ended: boolean;
  updatedAt: number;
};

export type LaoZhaoBookmarkRecord = {
  id: string;
  videoId: string;
  atSec: number;
  label: string;
  createdAt: number;
  updatedAt: number;
};

export type LaoZhaoNoteRecord = {
  id: string;
  videoId: string;
  atSec: number;
  label: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type LaoZhaoBookmarkInput = {
  id?: string;
  videoId: string;
  atSec: number;
  label?: string;
};

export type LaoZhaoBookmarkPatch = {
  atSec?: number;
  label?: string;
};

export type LaoZhaoNoteInput = {
  id?: string;
  videoId: string;
  atSec: number;
  label?: string;
  body: string;
};

export type LaoZhaoNotePatch = {
  atSec?: number;
  label?: string;
  body?: string;
};

export type LaoZhaoLocalExport = {
  schemaVersion: typeof LAOZHAO_LOCAL_DB_VERSION;
  dbName: typeof LAOZHAO_LOCAL_DB_NAME;
  exportedAt: number;
  progress: LaoZhaoProgressRecord[];
  bookmarks: LaoZhaoBookmarkRecord[];
  notes: LaoZhaoNoteRecord[];
};

export type LaoZhaoLocalChange = {
  sourceId: string;
  store: LaoZhaoLocalStore | "all";
  action: "upsert" | "delete" | "clear";
  id?: string;
  videoId?: string;
  changedAt: number;
};
