export type RollupRow = { session_id: string; question_id: string; created_at: string; answered_at: string };
type Marker = Pick<RollupRow, "created_at" | "session_id" | "question_id">;
type Scan = { since: string; until: string; after: Marker };
export type RollupCursor = { version: 2; lastCreatedAt: string; scan: Scan | null };
export type RollupPlan = { previousCursor: string | null; since: string; until: string; after: Marker | null };
const OVERLAP_MS = 120_000;
const INITIAL_LOOKBACK_MS = 86_400_000;
export const ROLLUP_BATCH_LIMIT = 500;
export const ROLLUP_MAX_DAYS = 10;

// Keep the database's six fractional digits. Re-serializing through Date would
// round the key down to milliseconds and can replay/skip timestamp ties.
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Invalid rollup timestamp");
  return value;
}
function micros(value: string) {
  const fraction = /\.(\d{1,6})/.exec(value)?.[1] ?? "";
  return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.padEnd(6, "0").slice(3));
}
function marker(value: unknown): Marker {
  const v = value as Marker | null;
  if (!v || typeof v.session_id !== "string" || !v.session_id || typeof v.question_id !== "string" || !v.question_id) throw new Error("Invalid rollup keyset marker");
  return { created_at: timestamp(v.created_at), session_id: v.session_id, question_id: v.question_id };
}
export function planRollup(value: unknown, now: string): RollupPlan {
  timestamp(now);
  const v = value as Partial<RollupCursor> | null;
  const previousCursor = v?.lastCreatedAt ? timestamp(v.lastCreatedAt) : null;
  if (v?.version === 2 && (!previousCursor || v.scan === undefined)) throw new Error("Incomplete rollup cursor");
  if (v?.version === 2 && v.scan) {
    const since = timestamp(v.scan.since), until = timestamp(v.scan.until), after = marker(v.scan.after);
    if (!previousCursor || micros(since) > micros(after.created_at) || micros(after.created_at) > micros(until) || micros(previousCursor) > micros(until) || micros(until) > micros(now)) throw new Error("Invalid rollup scan bounds");
    return { previousCursor, since, until, after };
  }
  if (v?.version !== undefined && v.version !== 2) throw new Error("Unsupported rollup cursor version");
  if (previousCursor && micros(previousCursor) > micros(now)) throw new Error("Rollup cursor is ahead of clock");
  return { previousCursor, since: new Date(previousCursor ? Date.parse(previousCursor) - OVERLAP_MS : Date.parse(now) - INITIAL_LOOKBACK_MS).toISOString(), until: now, after: null };
}
// PostgREST reserved characters are quoted, then the SDK URL-encodes them.
const quote = (value: string) => '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
export function keysetFilter(after: Marker) {
  const t = quote(after.created_at), s = quote(after.session_id), q = quote(after.question_id);
  return `created_at.gt.${t},and(created_at.eq.${t},session_id.gt.${s}),and(created_at.eq.${t},session_id.eq.${s},question_id.gt.${q})`;
}
export async function fetchRollupPage(db: any, plan: RollupPlan, signal: AbortSignal): Promise<RollupRow[]> {
  let query = db.from("question_attempt_logs").select("question_id,answered_at,created_at,session_id")
    // Push the resumed timestamp into the index bound, avoiding rescanning the
    // already-processed prefix behind the OR tie-break filter.
    .gte("created_at", plan.after?.created_at ?? plan.since).lte("created_at", plan.until);
  if (plan.after) query = query.or(keysetFilter(plan.after));
  const { data, error } = await query.order("created_at", { ascending: true }).order("session_id", { ascending: true }).order("question_id", { ascending: true }).limit(ROLLUP_BATCH_LIMIT).abortSignal(signal);
  if (error) throw error;
  return data ?? [];
}
export function boundRollupDays(rows: RollupRow[], today: string, dayKey: (value: string) => string) {
  const days = new Set([today]);
  let size = 0;
  for (const row of rows) {
    const day = dayKey(row.answered_at);
    if (!days.has(day) && days.size >= ROLLUP_MAX_DAYS) break;
    days.add(day); size++;
  }
  return { rows: rows.slice(0, size), hasMore: rows.length >= ROLLUP_BATCH_LIMIT || size < rows.length };
}
export function nextRollupCursor(plan: RollupPlan, rows: RollupRow[], hasMore: boolean): RollupCursor {
  if (!hasMore) return { version: 2, lastCreatedAt: plan.until, scan: null };
  if (!rows.length) throw new Error("Rollup cannot advance an empty partial batch");
  const after = marker(rows[rows.length - 1]);
  const lastCreatedAt = plan.previousCursor && micros(plan.previousCursor) > micros(after.created_at) ? plan.previousCursor : after.created_at;
  return { version: 2, lastCreatedAt, scan: { since: plan.since, until: plan.until, after } };
}
