/** Only locally stored, reviewed image assets may enter the inline viewer. */
export function reviewedImageSource(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const base = new URL(origin);
    const url = new URL(value, base);
    if (url.origin !== base.origin || url.username || url.password) return null;
    if (!url.pathname.startsWith("/reviewed-explanations/assets/")) return null;
    return url.href;
  } catch {
    return null;
  }
}
