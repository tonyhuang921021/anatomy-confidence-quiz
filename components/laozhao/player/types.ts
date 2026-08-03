import type { LaoZhaoVideo } from "./content-contract";

export type LaoZhaoPlayerState = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export type LaoZhaoPlayerError = {
  code: number;
  message: string;
};

export type LaoZhaoBookmark = {
  id: string;
  videoId: string;
  timeSec: number;
  label?: string;
  createdAt: string;
};

export type LaoZhaoTimestampNote = {
  id: string;
  videoId: string;
  timeSec: number;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type LaoZhaoLearningSnapshot = {
  lastPositionSec: number;
  watchedRanges: readonly [number, number][];
  completed: boolean;
  bookmarks: readonly LaoZhaoBookmark[];
  notes: readonly LaoZhaoTimestampNote[];
};

export interface LaoZhaoLearningAdapter {
  load?: (videoId: string) => Promise<Partial<LaoZhaoLearningSnapshot> | null>;
  saveProgress?: (input: {
    videoId: string;
    lastPositionSec: number;
    durationSec: number;
    completed: boolean;
    watchedRanges: readonly [number, number][];
  }) => Promise<void>;
  saveBookmark?: (bookmark: LaoZhaoBookmark) => Promise<void>;
  deleteBookmark?: (input: { videoId: string; bookmarkId: string }) => Promise<void>;
  saveNote?: (note: LaoZhaoTimestampNote) => Promise<void>;
  deleteNote?: (input: { videoId: string; noteId: string }) => Promise<void>;
}

export type LaoZhaoWatchClientProps = {
  video: LaoZhaoVideo;
  playlist: readonly LaoZhaoVideo[];
  learningAdapter?: LaoZhaoLearningAdapter;
};

