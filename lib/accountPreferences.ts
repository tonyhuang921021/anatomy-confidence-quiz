import type { User } from "@supabase/supabase-js";
import type { HomeToneMode, PracticeYearRange, ThemeMode } from "@/lib/storage";

type MetadataSource = User["user_metadata"] | null | undefined;

export type AccountPreferencePatch = {
  home_tone_mode?: HomeToneMode;
  theme_mode?: ThemeMode;
  practice_year_from?: number;
  practice_year_to?: number;
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
