const YANGMING_MODE_STORAGE_KEY = "anatomy-confidence-yangming-explanation-mode";
export const YANGMING_MODE_EVENT = "yangming-explanation-mode-change";

function isBrowser() {
  return typeof window !== "undefined";
}

export function isYangmingModeEnabled() {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(YANGMING_MODE_STORAGE_KEY) === "enabled";
}

export function setYangmingModeEnabled(enabled: boolean) {
  if (!isBrowser()) return;

  if (enabled) {
    window.localStorage.setItem(YANGMING_MODE_STORAGE_KEY, "enabled");
  } else {
    window.localStorage.removeItem(YANGMING_MODE_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(YANGMING_MODE_EVENT, { detail: { enabled } }));
}

