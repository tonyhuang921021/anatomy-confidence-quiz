import release from "../data/sources/yangming_reviewed_release.json";
import type { YangmingExplanationContent } from "../types/quiz";

const rows = new Map(release.rows.map(row => [row.questionId, row]));
const aliases = new Map(release.rows.map(row => [row.sourceQuestionId, row.questionId]));
export const YANGMING_REVIEWED_RELEASE_ID = release.releaseId;
export function isReviewedYangmingQuestion(questionId: string) {
  return rows.has(aliases.get(questionId) ?? questionId);
}

export function findReviewedYangmingExplanation(questionId: string, storageUrl: string) {
  const canonicalId = aliases.get(questionId) ?? questionId;
  const row = rows.get(canonicalId);
  if (!row) return null;
  const publicPrefix = storageUrl.replace(/\/$/, "") + "/storage/v1/object/public/" + release.storageBucket + "/";
  const content: YangmingExplanationContent = {
    body: row.body, reviewedOriginal: true, releaseId: release.releaseId,
    pendingSource: "pendingSource" in row && row.pendingSource === true,
    author: "author" in row ? row.author ?? undefined : undefined,
    reviewer: "reviewer" in row ? row.reviewer ?? undefined : undefined,
    sourceLabel: row.sourceLabel, sourceFile: row.sourceFile,
    sourcePageStart: row.sourcePageStart ?? undefined, sourcePageEnd: row.sourcePageEnd ?? undefined,
    sections: "sections" in row ? row.sections : undefined,
    sourceNotes: row.sourceNotes,
    humanNotes: row.humanNotes,
    assets: row.assets.map(asset => ({ ...asset, storagePath: asset.src, src: publicPrefix + asset.src }))
  };
  return { canonicalId, sourceQuestionId: row.sourceQuestionId, content };
}

export type YangmingHumanRow = {
  body?: string | null; updated_at?: string | null; match_status?: string | null;
  assets?: unknown;
};

// Text remains separate from the author's original. An intentional empty body is respected.
export function mergeCurrentYangmingHumanContent(
  content: YangmingExplanationContent,
  groups: { layer: string; rows: YangmingHumanRow[] }[],
  normalizeAssets: (assets: unknown) => NonNullable<YangmingExplanationContent["assets"]>
) {
  const humanNotes: NonNullable<YangmingExplanationContent["humanNotes"]> = [];
  const previousHumanAssets: NonNullable<YangmingExplanationContent["assets"]> = [];
  for (const group of groups) for (const row of group.rows) {
    if (row.body?.trim() && !humanNotes.some(note => note.body === row.body)) {
      humanNotes.push({ body: row.body, recordLayer: group.layer, updatedAt: row.updated_at ?? undefined });
    }
    if (row.match_status?.startsWith("community_corrected")) {
      for (const asset of normalizeAssets(row.assets)) {
        if (!previousHumanAssets.some(item => item.src === asset.src)) previousHumanAssets.push(asset);
      }
    }
  }
  return { ...content, humanNotes, previousHumanAssets };
}
