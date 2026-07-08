import type { QuizSettings } from "@/types/quiz";

const START_SETTINGS_HANDOFF_PREFIX = "anatomy-confidence-start-settings:";
const START_SETTINGS_HANDOFF_TTL_MS = 10 * 60 * 1000;
const MAX_INLINE_START_SETTINGS_LENGTH = 12_000;
const CUSTOM_QUESTION_ID_SEPARATOR = "|";

type StartSettingsTransport = Omit<QuizSettings, "customQuestionIds"> & {
  customQuestionIds?: string[];
  customQuestionIdsPacked?: string;
};

type StartSettingsHandoffPayload = {
  createdAt: number;
  settings: QuizSettings;
};

export type StartSettingsResolution = {
  settings: QuizSettings | null;
  error?: "invalid" | "missing-handoff" | "too-large";
};

function packStartSettings(settings: QuizSettings): StartSettingsTransport {
  if ((settings.customQuestionIds?.length ?? 0) <= 20) return settings;

  const { customQuestionIds, ...rest } = settings;
  return {
    ...rest,
    customQuestionIdsPacked: customQuestionIds?.join(CUSTOM_QUESTION_ID_SEPARATOR)
  };
}

function unpackStartSettings(settings: StartSettingsTransport): QuizSettings {
  if (!settings.customQuestionIdsPacked) return settings as QuizSettings;

  const { customQuestionIdsPacked, ...rest } = settings;
  return {
    ...rest,
    customQuestionIds: customQuestionIdsPacked
      .split(CUSTOM_QUESTION_ID_SEPARATOR)
      .map((id) => id.trim())
      .filter(Boolean)
  } as QuizSettings;
}

export function encodeStartSettingsForUrl(settings: QuizSettings) {
  try {
    const json = JSON.stringify(packStartSettings(settings));
    const bytes = new TextEncoder().encode(json);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return encoded.length <= MAX_INLINE_START_SETTINGS_LENGTH ? encoded : null;
  } catch {
    return null;
  }
}

export function decodeStartSettingsFromUrl(encodedSettings: string | null): QuizSettings | null {
  if (!encodedSettings) return null;

  try {
    const normalized = encodedSettings.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return unpackStartSettings(JSON.parse(new TextDecoder().decode(bytes)) as StartSettingsTransport);
  } catch {
    return null;
  }
}

function getStartSettingsHandoffKey(token: string) {
  return `${START_SETTINGS_HANDOFF_PREFIX}${token}`;
}

function createStartSettingsHandoffToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function saveStartSettingsHandoff(settings: QuizSettings) {
  if (typeof window === "undefined") return null;

  try {
    const token = createStartSettingsHandoffToken();
    const payload: StartSettingsHandoffPayload = {
      createdAt: Date.now(),
      settings
    };
    window.sessionStorage.setItem(getStartSettingsHandoffKey(token), JSON.stringify(payload));
    return token;
  } catch {
    return null;
  }
}

export function loadStartSettingsHandoff(token: string | null) {
  if (!token || typeof window === "undefined") return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(token)) return null;

  const key = getStartSettingsHandoffKey(token);

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw) as Partial<StartSettingsHandoffPayload>;
    const createdAt = typeof payload.createdAt === "number" ? payload.createdAt : 0;
    if (createdAt > 0 && Date.now() - createdAt > START_SETTINGS_HANDOFF_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (!payload.settings || typeof payload.settings !== "object") return null;
    return payload.settings as QuizSettings;
  } catch {
    return null;
  }
}

export function resolveStartSettingsFromSearchParams(
  params: Pick<URLSearchParams, "get" | "has"> | null
): StartSettingsResolution {
  if (!params) return { settings: null };

  if (params.has("startSettings")) {
    const settings = decodeStartSettingsFromUrl(params.get("startSettings"));
    return settings ? { settings } : { settings: null, error: "invalid" };
  }

  if (params.has("startSettingsToken")) {
    const settings = loadStartSettingsHandoff(params.get("startSettingsToken"));
    return settings ? { settings } : { settings: null, error: "missing-handoff" };
  }

  if (params.has("startSettingsError")) {
    return { settings: null, error: "too-large" };
  }

  return { settings: null };
}

export function buildNewQuizHref(settings: QuizSettings) {
  const encodedSettings = encodeStartSettingsForUrl(settings);
  if (encodedSettings) {
    return `/quiz?new=1&startSettings=${encodeURIComponent(encodedSettings)}`;
  }

  const token = saveStartSettingsHandoff(settings);
  return token
    ? `/quiz?new=1&startSettingsToken=${encodeURIComponent(token)}`
    : "/quiz?new=1&startSettingsError=too-large";
}
