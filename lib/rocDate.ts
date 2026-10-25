/** Presentation only: stored years, ISO dates, IDs and source text stay unchanged. */
export function toRocYear(value: number | string | null | undefined): number | null {
  const number = typeof value === "string" ? Number(value.replace(/^民國\s*|\s*年$/g, "")) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (number >= 1912) return number - 1911;
  return number <= 300 ? number : null;
}

export function formatRocYear(value: number | string | null | undefined, fallback = "未知年份") {
  const year = toRocYear(value);
  return year === null ? fallback : `民國 ${year} 年`;
}

export function formatRocDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const check = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== value) return "日期未定";
  }
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  if (!Number.isFinite(date.getTime())) return "日期未定";
  return new Intl.DateTimeFormat("zh-TW-u-ca-roc", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", ...options
  }).format(date);
}

export function formatRocExamLabel(label: string) {
  return label.replace(/(\d{2,3})年[（(](\d{4})[）)]/g, "民國 $1 年").replace(/\b(19[2-9]\d|20\d{2})(?=\s*(?:年|第|[-/]))/g, year => String(toRocYear(year)));
}

export function createRocDateFormatter(options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("zh-TW-u-ca-roc", {timeZone:"Asia/Taipei", ...options});
}
