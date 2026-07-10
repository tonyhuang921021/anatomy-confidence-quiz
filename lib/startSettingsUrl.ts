import type { QuizSettings } from "@/types/quiz";

const START_SETTINGS_HANDOFF_PREFIX = "anatomy-confidence-start-settings:";
const START_SETTINGS_HANDOFF_TTL_MS = 10 * 60 * 1000;
const MAX_INLINE_START_SETTINGS_LENGTH = 12_000;
const CUSTOM_QUESTION_ID_SEPARATOR = "|";

type PackedQuestionIdSequence = {
  version: 2;
  prefixes: Array<[prefix: string, numberWidth: number]>;
  sequence: string;
};

type StartSettingsTransport = Omit<QuizSettings, "customQuestionIds"> & {
  customQuestionIds?: string[];
  customQuestionIdsPacked?: string | PackedQuestionIdSequence;
};

type StartSettingsHandoffPayload = {
  createdAt: number;
  settings: QuizSettings;
};

const memoryHandoffs = new Map<string, StartSettingsHandoffPayload>();

export type StartSettingsResolution = {
  settings: QuizSettings | null;
  error?: "invalid" | "missing-handoff" | "too-large";
};

function packQuestionIds(questionIds: string[]): PackedQuestionIdSequence {
  const prefixes: Array<[string, number]> = [];
  const prefixIndexMap = new Map<string, number>();
  const sequence = questionIds.map((questionId) => {
    const match = questionId.match(/^(.*-Q)(\d+)$/);
    if (!match) return `!${encodeURIComponent(questionId)}`;

    const prefix = match[1];
    const numberWidth = match[2].length;
    const prefixKey = `${prefix}\u0000${numberWidth}`;
    let prefixIndex = prefixIndexMap.get(prefixKey);
    if (prefixIndex === undefined) {
      prefixIndex = prefixes.length;
      prefixIndexMap.set(prefixKey, prefixIndex);
      prefixes.push([prefix, numberWidth]);
    }

    return `${prefixIndex.toString(36)}.${Number.parseInt(match[2], 10).toString(36)}`;
  });

  return {
    version: 2,
    prefixes,
    sequence: sequence.join(",")
  };
}

function unpackQuestionIds(packed: string | PackedQuestionIdSequence) {
  if (typeof packed === "string") {
    return packed
      .split(CUSTOM_QUESTION_ID_SEPARATOR)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  if (packed.version !== 2 || !Array.isArray(packed.prefixes) || typeof packed.sequence !== "string") {
    return [];
  }

  return packed.sequence
    .split(",")
    .filter(Boolean)
    .map((token) => {
      if (token.startsWith("!")) {
        try {
          return decodeURIComponent(token.slice(1));
        } catch {
          return "";
        }
      }

      const [prefixIndexText, questionNumberText] = token.split(".");
      const prefixIndex = Number.parseInt(prefixIndexText, 36);
      const questionNumber = Number.parseInt(questionNumberText, 36);
      const prefixItem = packed.prefixes[prefixIndex];
      if (!prefixItem || !Number.isFinite(questionNumber)) return "";
      return `${prefixItem[0]}${String(questionNumber).padStart(prefixItem[1], "0")}`;
    })
    .filter(Boolean);
}

function packStartSettings(settings: QuizSettings): StartSettingsTransport {
  if ((settings.customQuestionIds?.length ?? 0) <= 20) return settings;

  const { customQuestionIds, ...rest } = settings;
  return {
    ...rest,
    customQuestionIdsPacked: packQuestionIds(customQuestionIds ?? [])
  };
}

function unpackStartSettings(settings: StartSettingsTransport): QuizSettings {
  if (!settings.customQuestionIdsPacked) return settings as QuizSettings;

  const { customQuestionIdsPacked, ...rest } = settings;
  return {
    ...rest,
    customQuestionIds: unpackQuestionIds(customQuestionIdsPacked)
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

  const token = createStartSettingsHandoffToken();
  const payload: StartSettingsHandoffPayload = {
    createdAt: Date.now(),
    settings
  };
  memoryHandoffs.set(token, payload);

  try {
    window.sessionStorage.setItem(getStartSettingsHandoffKey(token), JSON.stringify(payload));
  } catch {
    // Same-tab navigation can still use the in-memory handoff when browser storage is full.
  }

  return token;
}

export function loadStartSettingsHandoff(token: string | null) {
  if (!token || typeof window === "undefined") return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(token)) return null;

  const key = getStartSettingsHandoffKey(token);
  const memoryPayload = memoryHandoffs.get(token);
  if (memoryPayload) {
    if (Date.now() - memoryPayload.createdAt <= START_SETTINGS_HANDOFF_TTL_MS) {
      return memoryPayload.settings;
    }
    memoryHandoffs.delete(token);
  }

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
