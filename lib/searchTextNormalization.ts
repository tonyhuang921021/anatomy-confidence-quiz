const DASH_PATTERN = /[‐‑‒–—―]/g;
const INVISIBLE_AND_CONTROL_PATTERN = /[\p{Cf}\p{Cc}]/gu;
const SEARCH_SEPARATOR_PATTERN = /[\s\-_,，、/／()（）]+/g;

export function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_AND_CONTROL_PATTERN, " ")
    .toLowerCase()
    .replace(DASH_PATTERN, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactSearchText(value?: string | null) {
  return normalizeSearchText(value).replace(SEARCH_SEPARATOR_PATTERN, "");
}
