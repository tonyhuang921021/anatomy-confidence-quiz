const YANGMING_MODE_STORAGE_KEY = "anatomy-confidence-yangming-explanation-mode";
export const YANGMING_MODE_EVENT = "yangming-explanation-mode-change";

function isBrowser() {
  return typeof window !== "undefined";
}

function getStorageKey(accountKey?: string | null) {
  const normalized = accountKey?.trim();
  return normalized ? `${YANGMING_MODE_STORAGE_KEY}:${normalized}` : YANGMING_MODE_STORAGE_KEY;
}

export function isYangmingModeEnabled(accountKey?: string | null) {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(getStorageKey(accountKey)) === "enabled";
}

export function setYangmingModeEnabled(enabled: boolean, accountKey?: string | null) {
  if (!isBrowser()) return;

  if (enabled) {
    window.localStorage.setItem(getStorageKey(accountKey), "enabled");
  } else {
    window.localStorage.removeItem(getStorageKey(accountKey));
  }

  window.dispatchEvent(new CustomEvent(YANGMING_MODE_EVENT, { detail: { enabled } }));
}
