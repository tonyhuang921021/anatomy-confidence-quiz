import {
  LAOZHAO_SCHEMA_VERSION,
  LAOZHAO_PLAYLIST_ID,
  type ChapterRecord,
  type CourseManifest,
  type ManifestValidationIssue,
  type ManifestValidationResult,
  type RightsStatus,
  type Video,
  type VideoAvailability,
  type VideoVisibility
} from "../types";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const RIGHTS_STATUSES: ReadonlySet<RightsStatus> = new Set([
  "embed_only",
  "authorized",
  "private_only",
  "blocked",
  "unknown"
]);
const VIDEO_VISIBILITIES: ReadonlySet<VideoVisibility> = new Set([
  "public",
  "unlisted",
  "private",
  "unknown"
]);
const VIDEO_AVAILABILITIES: ReadonlySet<VideoAvailability> = new Set([
  "available",
  "unavailable"
]);
const CHAPTER_REVIEW_STATUSES = new Set(["reviewed", "draft", "rejected"]);
const PUBLIC_RIGHTS_STATUSES: ReadonlySet<RightsStatus> = new Set(["embed_only", "authorized"]);
const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "courseId",
  "title",
  "playlistId",
  "generatedAt",
  "contentRevision",
  "videos",
  "chapters"
]);
const VIDEO_KEYS = new Set([
  "id",
  "youtubeId",
  "title",
  "position",
  "durationSec",
  "thumbnailUrl",
  "channelTitle",
  "visibility",
  "availability",
  "rightsStatus"
]);
const CHAPTER_KEYS = new Set([
  "id",
  "videoId",
  "title",
  "startSec",
  "endSec",
  "reviewStatus",
  "rightsStatus"
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFICIAL_THUMBNAIL_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "i1.ytimg.com",
  "i2.ytimg.com",
  "i3.ytimg.com",
  "i4.ytimg.com"
]);
const warnedContentRevisions = new Set<string>();

function isOfficialThumbnailUrl(value: string, youtubeId: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      OFFICIAL_THUMBNAIL_HOSTS.has(url.hostname) &&
      url.pathname.includes(`/vi/${youtubeId}/`)
    );
  } catch {
    return false;
  }
}

export class CourseManifestValidationError extends Error {
  readonly result: ManifestValidationResult;

  constructor(result: ManifestValidationResult) {
    super(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "CourseManifestValidationError";
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  severity: ManifestValidationIssue["severity"],
  code: string,
  path: string,
  message: string
): ManifestValidationIssue {
  return { severity, code, path, message };
}

function hasString(value: unknown, minLength = 1): value is string {
  return typeof value === "string" && value.trim().length >= minLength;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  errors: ManifestValidationIssue[]
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(
        issue("error", "unexpected_public_field", `${path}.${key}`, "公開 manifest 含有未允許欄位。")
      );
    }
  }
}

function validateVideo(
  value: unknown,
  index: number,
  errors: ManifestValidationIssue[]
): value is Video {
  const path = `videos[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue("error", "video_not_object", path, "影片紀錄必須是物件。"));
    return false;
  }
  validateKnownKeys(value, VIDEO_KEYS, path, errors);

  let valid = true;
  if (!hasString(value.id) || !YOUTUBE_ID_PATTERN.test(value.id)) {
    errors.push(issue("error", "invalid_video_id", `${path}.id`, "影片 ID 格式無效。"));
    valid = false;
  }
  if (!hasString(value.youtubeId) || !YOUTUBE_ID_PATTERN.test(value.youtubeId)) {
    errors.push(issue("error", "invalid_youtube_id", `${path}.youtubeId`, "YouTube video ID 格式無效。"));
    valid = false;
  }
  if (hasString(value.id) && hasString(value.youtubeId) && value.id !== value.youtubeId) {
    errors.push(issue("error", "video_id_mismatch", path, "第一版要求穩定影片 ID 與 YouTube ID 相同。"));
    valid = false;
  }
  if (!hasString(value.title)) {
    errors.push(issue("error", "missing_video_title", `${path}.title`, "影片標題不可空白。"));
    valid = false;
  }
  if (!hasFiniteNumber(value.position) || !Number.isInteger(value.position) || value.position < 0) {
    errors.push(issue("error", "invalid_video_position", `${path}.position`, "影片順序必須是非負整數。"));
    valid = false;
  }
  if (
    value.durationSec !== null &&
    (!hasFiniteNumber(value.durationSec) || !Number.isInteger(value.durationSec) || value.durationSec < 0)
  ) {
    errors.push(issue("error", "invalid_video_duration", `${path}.durationSec`, "影片長度必須是非負整數秒或 null。"));
    valid = false;
  }
  if (
    value.thumbnailUrl !== null &&
    (!hasString(value.thumbnailUrl) ||
      !hasString(value.youtubeId) ||
      !isOfficialThumbnailUrl(value.thumbnailUrl, value.youtubeId))
  ) {
    errors.push(issue("error", "invalid_thumbnail_url", `${path}.thumbnailUrl`, "縮圖只能使用這支影片的 YouTube 官方縮圖網址。"));
    valid = false;
  }
  if (value.channelTitle !== null && !hasString(value.channelTitle)) {
    errors.push(issue("error", "invalid_channel_title", `${path}.channelTitle`, "頻道名稱必須是文字或 null。"));
    valid = false;
  }
  if (!VIDEO_VISIBILITIES.has(value.visibility as VideoVisibility)) {
    errors.push(issue("error", "invalid_video_visibility", `${path}.visibility`, "影片公開狀態無效。"));
    valid = false;
  }
  if (!VIDEO_AVAILABILITIES.has(value.availability as VideoAvailability)) {
    errors.push(issue("error", "invalid_video_availability", `${path}.availability`, "影片可用狀態無效。"));
    valid = false;
  }
  if (!RIGHTS_STATUSES.has(value.rightsStatus as RightsStatus)) {
    errors.push(issue("error", "invalid_video_rights", `${path}.rightsStatus`, "影片權利狀態無效。"));
    valid = false;
  } else if (value.rightsStatus === "unknown") {
    errors.push(issue("error", "unresolved_video_rights", `${path}.rightsStatus`, "未確認權利的影片不可進入公開 manifest。"));
    valid = false;
  }
  return valid;
}

function validateChapter(
  value: unknown,
  index: number,
  videosById: ReadonlyMap<string, Video>,
  errors: ManifestValidationIssue[]
): value is ChapterRecord {
  const path = `chapters[${index}]`;
  if (!isRecord(value)) {
    errors.push(issue("error", "chapter_not_object", path, "章節紀錄必須是物件。"));
    return false;
  }
  validateKnownKeys(value, CHAPTER_KEYS, path, errors);

  let valid = true;
  if (!hasString(value.id) || !STABLE_ID_PATTERN.test(value.id)) {
    errors.push(issue("error", "invalid_chapter_id", `${path}.id`, "章節 ID 格式無效。"));
    valid = false;
  }
  if (!hasString(value.videoId) || !videosById.has(value.videoId)) {
    errors.push(issue("error", "unknown_chapter_video", `${path}.videoId`, "章節必須指向 manifest 內的影片。"));
    valid = false;
  }
  if (!hasString(value.title)) {
    errors.push(issue("error", "missing_chapter_title", `${path}.title`, "章節標題不可空白。"));
    valid = false;
  }
  if (!hasFiniteNumber(value.startSec) || !Number.isInteger(value.startSec) || value.startSec < 0) {
    errors.push(issue("error", "invalid_chapter_start", `${path}.startSec`, "章節起點必須是非負整數秒。"));
    valid = false;
  }
  if (
    value.endSec !== null &&
    (!hasFiniteNumber(value.endSec) ||
      !Number.isInteger(value.endSec) ||
      value.endSec <= (hasFiniteNumber(value.startSec) ? value.startSec : 0))
  ) {
    errors.push(issue("error", "invalid_chapter_end", `${path}.endSec`, "章節終點必須是大於起點的整數秒或 null。"));
    valid = false;
  }
  if (!CHAPTER_REVIEW_STATUSES.has(value.reviewStatus as string)) {
    errors.push(issue("error", "invalid_chapter_review_status", `${path}.reviewStatus`, "章節審核狀態無效。"));
    valid = false;
  } else if (value.reviewStatus !== "reviewed") {
    errors.push(
      issue(
        "error",
        "unreviewed_chapter_in_public_manifest",
        `${path}.reviewStatus`,
        "公開 manifest 只能包含已審核章節。"
      )
    );
    valid = false;
  }
  if (!RIGHTS_STATUSES.has(value.rightsStatus as RightsStatus)) {
    errors.push(issue("error", "invalid_chapter_rights", `${path}.rightsStatus`, "章節權利狀態無效。"));
    valid = false;
  } else if (value.rightsStatus === "unknown") {
    errors.push(issue("error", "unresolved_chapter_rights", `${path}.rightsStatus`, "未確認權利的章節不可進入公開 manifest。"));
    valid = false;
  } else if (!PUBLIC_RIGHTS_STATUSES.has(value.rightsStatus as RightsStatus)) {
    errors.push(
      issue(
        "error",
        "private_chapter_in_public_manifest",
        `${path}.rightsStatus`,
        "公開 manifest 只能包含可公開章節。"
      )
    );
    valid = false;
  }

  const video = typeof value.videoId === "string" ? videosById.get(value.videoId) : undefined;
  if (video && hasFiniteNumber(value.startSec) && video.durationSec !== null && value.startSec >= video.durationSec) {
    errors.push(issue("error", "chapter_after_video", `${path}.startSec`, "章節起點必須早於影片結束。"));
    valid = false;
  }
  if (video && hasFiniteNumber(value.endSec) && video.durationSec !== null && value.endSec > video.durationSec) {
    errors.push(issue("error", "chapter_end_after_video", `${path}.endSec`, "章節終點不可超過影片長度。"));
    valid = false;
  }
  return valid;
}

export function validateCourseManifest(
  value: unknown,
  options: { now?: Date; enforceFreshness?: boolean } = {}
): ManifestValidationResult {
  const errors: ManifestValidationIssue[] = [];
  const warnings: ManifestValidationIssue[] = [];
  const now = options.now ?? new Date();

  if (!isRecord(value)) {
    errors.push(issue("error", "manifest_not_object", "manifest", "manifest 必須是物件。"));
    return { valid: false, errors, warnings };
  }
  validateKnownKeys(value, MANIFEST_KEYS, "manifest", errors);
  if (value.schemaVersion !== LAOZHAO_SCHEMA_VERSION) {
    errors.push(issue("error", "unsupported_schema", "schemaVersion", "不支援的 manifest schema version。"));
  }
  if (value.courseId !== "laozhao-anatomy") {
    errors.push(issue("error", "invalid_course_id", "courseId", "courseId 必須是 laozhao-anatomy。"));
  }
  if (!hasString(value.title)) {
    errors.push(issue("error", "missing_course_title", "title", "課程標題不可空白。"));
  }
  if (
    !hasString(value.playlistId) ||
    !PLAYLIST_ID_PATTERN.test(value.playlistId) ||
    value.playlistId !== LAOZHAO_PLAYLIST_ID
  ) {
    errors.push(issue("error", "invalid_playlist_id", "playlistId", "playlistId 必須是指定的老趙官方播放清單。"));
  }
  if (!hasString(value.contentRevision)) {
    errors.push(issue("error", "missing_content_revision", "contentRevision", "contentRevision 不可空白。"));
  }

  const generatedAt = typeof value.generatedAt === "string" ? new Date(value.generatedAt) : new Date(NaN);
  if (!hasString(value.generatedAt) || Number.isNaN(generatedAt.getTime())) {
    errors.push(issue("error", "invalid_generated_at", "generatedAt", "generatedAt 必須是有效 ISO 日期。"));
  } else {
    const ageDays = (now.getTime() - generatedAt.getTime()) / DAY_MS;
    if (ageDays > 30) {
      const staleIssue = issue(
        options.enforceFreshness ? "error" : "warning",
        "stale_metadata",
        "generatedAt",
        "YouTube metadata 已超過 30 天，發布老趙內容前必須重新同步。"
      );
      if (options.enforceFreshness) errors.push(staleIssue);
      else warnings.push(staleIssue);
    } else if (ageDays > 21) {
      warnings.push(issue("warning", "metadata_refresh_due", "generatedAt", "YouTube metadata 已超過 21 天，應安排重新同步。"));
    }
  }

  if (!Array.isArray(value.videos)) {
    errors.push(issue("error", "videos_not_array", "videos", "videos 必須是陣列。"));
  } else if (value.videos.length === 0) {
    errors.push(issue("error", "videos_empty", "videos", "官方播放清單至少要有一部影片。"));
  }
  if (!Array.isArray(value.chapters)) {
    errors.push(issue("error", "chapters_not_array", "chapters", "chapters 必須是陣列。"));
  }

  const videosById = new Map<string, Video>();
  const videoIds = new Set<string>();
  const youtubeIds = new Set<string>();
  const videoPositions = new Set<number>();
  if (Array.isArray(value.videos)) {
    value.videos.forEach((video, index) => {
      if (!validateVideo(video, index, errors)) return;
      const typedVideo = video as Video;
      if (videoIds.has(typedVideo.id)) {
        errors.push(issue("error", "duplicate_video_id", `videos[${index}].id`, "影片 ID 不可重複。"));
      }
      if (youtubeIds.has(typedVideo.youtubeId)) {
        errors.push(issue("error", "duplicate_youtube_id", `videos[${index}].youtubeId`, "YouTube video ID 不可重複。"));
      }
      if (videoPositions.has(typedVideo.position)) {
        errors.push(issue("error", "duplicate_video_position", `videos[${index}].position`, "影片順序不可重複。"));
      }
      videoIds.add(typedVideo.id);
      youtubeIds.add(typedVideo.youtubeId);
      videoPositions.add(typedVideo.position);
      videosById.set(typedVideo.id, typedVideo);
    });
  }

  const chapterIds = new Set<string>();
  const chaptersByVideoId = new Map<string, Array<{ chapter: ChapterRecord; index: number }>>();
  if (Array.isArray(value.chapters)) {
    value.chapters.forEach((chapter, index) => {
      if (!validateChapter(chapter, index, videosById, errors)) return;
      const typedChapter = chapter as ChapterRecord;
      if (chapterIds.has(typedChapter.id)) {
        errors.push(issue("error", "duplicate_chapter_id", `chapters[${index}].id`, "章節 ID 不可重複。"));
      }
      chapterIds.add(typedChapter.id);
      const videoChapters = chaptersByVideoId.get(typedChapter.videoId) ?? [];
      videoChapters.push({ chapter: typedChapter, index });
      chaptersByVideoId.set(typedChapter.videoId, videoChapters);
    });
  }

  for (const videoChapters of chaptersByVideoId.values()) {
    for (let index = 1; index < videoChapters.length; index += 1) {
      const previous = videoChapters[index - 1];
      const current = videoChapters[index];
      if (current.chapter.startSec <= previous.chapter.startSec) {
        errors.push(
          issue(
            "error",
            "chapters_not_sorted",
            `chapters[${current.index}].startSec`,
            "同一影片的章節必須依起點嚴格遞增排列。"
          )
        );
      }
      if (previous.chapter.endSec !== null && current.chapter.startSec < previous.chapter.endSec) {
        errors.push(
          issue(
            "error",
            "chapter_overlap",
            `chapters[${current.index}].startSec`,
            "同一影片的章節時間不可重疊。"
          )
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidCourseManifest(
  value: unknown,
  options: { now?: Date; enforceFreshness?: boolean } = {}
): CourseManifest {
  const result = validateCourseManifest(value, options);
  if (!result.valid) throw new CourseManifestValidationError(result);
  const contentRevision = isRecord(value) && hasString(value.contentRevision)
    ? value.contentRevision
    : "unknown";
  if (result.warnings.length > 0 && !warnedContentRevisions.has(contentRevision)) {
    warnedContentRevisions.add(contentRevision);
    console.warn(
      `[laozhao] ${result.warnings.map((warning) => warning.message).join(" ")}`
    );
  }
  return value as CourseManifest;
}

export function isCourseManifest(
  value: unknown,
  options: { now?: Date; enforceFreshness?: boolean } = {}
): value is CourseManifest {
  return validateCourseManifest(value, options).valid;
}
