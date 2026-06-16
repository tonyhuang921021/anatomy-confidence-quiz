import type { QuizSettings } from "@/types/quiz";

export function encodeStartSettingsForUrl(settings: QuizSettings) {
  try {
    const json = JSON.stringify(settings);
    const bytes = new TextEncoder().encode(json);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return encoded.length <= 1800 ? encoded : null;
  } catch {
    return null;
  }
}

export function buildNewQuizHref(settings: QuizSettings) {
  const encodedSettings = encodeStartSettingsForUrl(settings);
  return encodedSettings
    ? `/quiz?new=1&startSettings=${encodeURIComponent(encodedSettings)}`
    : "/quiz?new=1";
}
