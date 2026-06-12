import type { User } from "@supabase/supabase-js";
import type {
  HomeToneMode,
  PracticeQuestionCount,
  PracticeYearRange,
  ThemeMode
} from "@/lib/storage";

type MetadataSource = User["user_metadata"] | null | undefined;

export type AccountPreferencePatch = {
  home_tone_mode?: HomeToneMode;
  theme_mode?: ThemeMode;
  practice_year_from?: number;
  practice_year_to?: number;
  practice_question_count?: PracticeQuestionCount;
  practice_stop_after_review?: boolean;
  practice_fast_answer_mode?: boolean;
};

export function getHomeToneModePreference(metadata: MetadataSource): HomeToneMode | null {
  return metadata?.home_tone_mode === "anxious" ? "anxious" : metadata?.home_tone_mode === "calm" ? "calm" : null;
}

export function getThemeModePreference(metadata: MetadataSource): ThemeMode | null {
  return metadata?.theme_mode === "dark" ? "dark" : metadata?.theme_mode === "light" ? "light" : null;
}

export function getPracticeYearRangePreference(
  metadata: MetadataSource,
  defaultRange?: PracticeYearRange
): PracticeYearRange | null {
  const yearFrom = metadata?.practice_year_from;
  const yearTo = metadata?.practice_year_to;

  if (typeof yearFrom === "number" && Number.isFinite(yearFrom) && typeof yearTo === "number" && Number.isFinite(yearTo)) {
    return {
      yearFrom: Math.min(yearFrom, yearTo),
      yearTo: Math.max(yearFrom, yearTo)
    };
  }

  return defaultRange ?? null;
}

export function getPracticeQuestionCountPreference(
  metadata: MetadataSource,
  defaultCount: PracticeQuestionCount = 10
): PracticeQuestionCount {
  const value = metadata?.practice_question_count;
  return [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(value)
    ? (value as PracticeQuestionCount)
    : defaultCount;
}

export function getPracticeStopAfterReviewPreference(metadata: MetadataSource, defaultValue = false) {
  return typeof metadata?.practice_stop_after_review === "boolean"
    ? metadata.practice_stop_after_review
    : defaultValue;
}

export function getPracticeFastAnswerModePreference(metadata: MetadataSource, defaultValue = false) {
  return typeof metadata?.practice_fast_answer_mode === "boolean"
    ? metadata.practice_fast_answer_mode
    : defaultValue;
}

export function hasPracticeQuestionCountPreference(metadata: MetadataSource) {
  return typeof metadata?.practice_question_count === "number";
}

export function hasPracticeStopAfterReviewPreference(metadata: MetadataSource) {
  return typeof metadata?.practice_stop_after_review === "boolean";
}

export function hasPracticeFastAnswerModePreference(metadata: MetadataSource) {
  return typeof metadata?.practice_fast_answer_mode === "boolean";
}
