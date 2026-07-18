import type { QuizSession } from "@/types/quiz";

export const POST_EXAM_CUTOFF_AT = "2026-07-17T07:00:00.000Z";
export const POST_EXAM_SNAPSHOT_VERSION = "post-exam-2026-v1";
export const POST_EXAM_SURVEY_ID = "med_exam_post_exam_legacy_2026";
export const POST_EXAM_PREVIEW_EMAIL = "tonyhuang921021@gmail.com";

export type PostExamSubject = "醫學（一）" | "醫學（二）";

export type PostExamSessionRollup = {
  sessionId: string;
  mode: string;
  attempts: number;
  correctAttempts: number;
  completedAt: string;
};

export type PostExamSimulationResult = {
  sessionId: string;
  subject: PostExamSubject;
  paperKey: string;
  paperLabel: string;
  score: number;
  completedAt: string;
};

export type PostExamSimulationYearGroup = {
  key: string;
  label: string;
  sortOrder: number;
  med1: PostExamSimulationResult[];
  med2: PostExamSimulationResult[];
};

export type PostExamPersonalSnapshot = {
  version: string;
  cutoffAt: string;
  generatedAt: string;
  sessions: PostExamSessionRollup[];
  simulations: PostExamSimulationResult[];
  localReconciledAt?: string;
};

export type PostExamCumulativePoint = {
  date: string;
  cumulativeAttempts: number;
  cumulativeCorrectAttempts: number;
  cumulativeAccuracy: number;
};

export type PostExamSurveyAnswers = {
  publicAlias: string;
  discloseScores: boolean;
  med1Score: number | null;
  med2Score: number | null;
  shareScores: boolean;
  studyReflection: string;
  encouragement: string;
};

export type PostExamSurveyValidation = {
  data: PostExamSurveyAnswers;
  errors: Partial<Record<keyof PostExamSurveyAnswers, string>>;
};

const DEFAULT_PUBLIC_ALIAS = "匿名考生";
const ALIAS_MAX_LENGTH = 20;
const RESPONSE_MAX_LENGTH = 2000;
const AI_PAPER_LABELS: Record<string, string> = {
  "AI-MED1-113115-HUMANLIKE-002": "第二份 gpt5.6 出的醫學一（有改良）",
  "AI-MED1-113115-HUMANLIKE-001": "gpt5.6 出的醫學一",
  "AI-MED2-113115-HUMANLIKE-001": "gpt5.6 出的醫學二",
  "AI-MED1-ADV-B-001": "AI 出題｜醫學（一）進階模擬 B 卷",
  "AI-MED2-ADV-001": "AI 出題｜醫學（二）進階模擬卷"
};

function toFiniteInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function isWithinPostExamCutoff(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.parse(POST_EXAM_CUTOFF_AT);
}

export function canonicalizePostExamSessionId(sessionId: string) {
  return sessionId.trim().replace(/^user-[^:]+:/, "");
}

export function inferPostExamPaperKey(session: Pick<QuizSession, "settings" | "questionOrder">) {
  const selectedPaperKey = session.settings?.selectedPaperKey?.trim();
  if (selectedPaperKey) return selectedPaperKey;

  const firstQuestionId = session.questionOrder?.[0]?.trim() ?? "";
  const aiMatch = firstQuestionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/i);
  if (aiMatch) return aiMatch[1];

  const moexMatch = firstQuestionId.match(/^MOEX-(.+)-Q\d+$/i);
  return moexMatch?.[1] ?? "";
}

export function inferPostExamSubject(
  paperKey: string,
  explicitSubject?: string | null
): PostExamSubject | null {
  if (explicitSubject === "醫學（一）" || explicitSubject === "醫學（二）") {
    return explicitSubject;
  }

  const normalized = paperKey.trim().toUpperCase();
  if (/AI-MED1(?:-|$)/.test(normalized)) return "醫學（一）";
  if (/AI-MED2(?:-|$)/.test(normalized)) return "醫學（二）";
  if (/(?:^|-)(?:1301|1101|5301)$/.test(normalized)) return "醫學（一）";
  if (/(?:^|-)(?:2301|2101|6301)$/.test(normalized)) return "醫學（二）";
  return null;
}

export function formatPostExamPaperLabel(paperKey: string, sessionName?: string | null) {
  const normalizedKey = paperKey.trim();
  const normalizedName = sessionName?.trim() ?? "";
  if (normalizedName && !/^模擬考$/i.test(normalizedName)) return normalizedName.slice(0, 80);
  return AI_PAPER_LABELS[normalizedKey] ?? (normalizedKey || "模擬考");
}

function getPostExamSimulationYear(result: PostExamSimulationResult) {
  const officialKeyMatch = result.paperKey.match(/^(?:MOEX-)?(\d{3})\d{3}-\d{4}$/i);
  if (officialKeyMatch) {
    const year = Number(officialKeyMatch[1]) + 1911;
    if (year >= 1990 && year <= 2100) return year;
  }

  const labelMatch = result.paperLabel.match(/(?:19|20)\d{2}/);
  if (labelMatch) return Number(labelMatch[0]);
  return null;
}

export function groupPostExamSimulationsByYear(
  results: PostExamSimulationResult[]
): PostExamSimulationYearGroup[] {
  const groups = new Map<string, PostExamSimulationYearGroup>();

  for (const result of results) {
    const year = getPostExamSimulationYear(result);
    const isAiPaper = /^AI-/i.test(result.paperKey);
    const key = year ? `year-${year}` : isAiPaper ? "ai" : "other";
    const group = groups.get(key) ?? {
      key,
      label: year ? `${year} 年` : isAiPaper ? "AI 模擬卷" : "其他模擬卷",
      sortOrder: year ?? (isAiPaper ? -1 : -2),
      med1: [],
      med2: []
    };

    if (result.subject === "醫學（一）") group.med1.push(result);
    else group.med2.push(result);
    groups.set(key, group);
  }

  const sortResults = (items: PostExamSimulationResult[]) =>
    items.sort(
      (left, right) =>
        left.paperLabel.localeCompare(right.paperLabel, "zh-TW") ||
        left.completedAt.localeCompare(right.completedAt)
    );

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      med1: sortResults(group.med1),
      med2: sortResults(group.med2)
    }))
    .sort((left, right) => right.sortOrder - left.sortOrder || left.label.localeCompare(right.label, "zh-TW"));
}

export function normalizePostExamSessionRollup(input: unknown): PostExamSessionRollup | null {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!row) return null;

  const sessionId = canonicalizePostExamSessionId(String(row.sessionId ?? row.session_id ?? ""));
  const completedAt = normalizeDate(row.completedAt ?? row.completed_at);
  const attempts = toFiniteInteger(row.attempts ?? row.question_count);
  const correctAttempts = Math.min(
    attempts,
    toFiniteInteger(row.correctAttempts ?? row.correct_attempts ?? row.correct_count)
  );
  if (!sessionId || !completedAt || !isWithinPostExamCutoff(completedAt) || attempts <= 0) {
    return null;
  }

  return {
    sessionId,
    mode: typeof (row.mode) === "string" ? row.mode.trim().slice(0, 32) : "",
    attempts,
    correctAttempts,
    completedAt
  };
}

export function normalizePostExamSimulation(input: unknown): PostExamSimulationResult | null {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!row) return null;

  const sessionId = canonicalizePostExamSessionId(String(row.sessionId ?? row.session_id ?? ""));
  const completedAt = normalizeDate(row.completedAt ?? row.completed_at);
  const paperKey = String(row.paperKey ?? row.paper_key ?? "").trim().slice(0, 80);
  const score = toFiniteInteger(row.score ?? row.correct_count);
  const subject = inferPostExamSubject(paperKey, String(row.subject ?? ""));
  if (
    !sessionId ||
    !completedAt ||
    !isWithinPostExamCutoff(completedAt) ||
    !paperKey ||
    !subject ||
    score <= 3 ||
    score > 100
  ) {
    return null;
  }

  return {
    sessionId,
    subject,
    paperKey,
    paperLabel: formatPostExamPaperLabel(
      paperKey,
      typeof row.paperLabel === "string"
        ? row.paperLabel
        : typeof row.session_name === "string"
          ? row.session_name
          : null
    ),
    score,
    completedAt
  };
}

export function buildPostExamPersonalSnapshot(
  sessionRows: unknown[],
  simulationRows: unknown[],
  generatedAt = new Date().toISOString()
): PostExamPersonalSnapshot {
  const sessions = mergePostExamSessionRollups([], sessionRows);
  const simulations = mergePostExamSimulations([], simulationRows);
  return {
    version: POST_EXAM_SNAPSHOT_VERSION,
    cutoffAt: POST_EXAM_CUTOFF_AT,
    generatedAt: normalizeDate(generatedAt) || new Date().toISOString(),
    sessions,
    simulations
  };
}

export function normalizePostExamPersonalSnapshot(input: unknown): PostExamPersonalSnapshot | null {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!value || value.version !== POST_EXAM_SNAPSHOT_VERSION) return null;
  return {
    version: POST_EXAM_SNAPSHOT_VERSION,
    cutoffAt: POST_EXAM_CUTOFF_AT,
    generatedAt: normalizeDate(value.generatedAt) || new Date(0).toISOString(),
    sessions: mergePostExamSessionRollups([], Array.isArray(value.sessions) ? value.sessions : []),
    simulations: mergePostExamSimulations(
      [],
      Array.isArray(value.simulations) ? value.simulations : []
    ),
    ...(normalizeDate(value.localReconciledAt)
      ? { localReconciledAt: normalizeDate(value.localReconciledAt) }
      : {})
  };
}

export function mergePostExamSessionRollups(
  existing: PostExamSessionRollup[],
  incoming: unknown[]
) {
  const merged = new Map<string, PostExamSessionRollup>();
  for (const row of existing) {
    const normalized = normalizePostExamSessionRollup(row);
    if (normalized) merged.set(normalized.sessionId, normalized);
  }
  for (const row of incoming) {
    const normalized = normalizePostExamSessionRollup(row);
    if (normalized && !merged.has(normalized.sessionId)) {
      merged.set(normalized.sessionId, normalized);
    }
  }
  return Array.from(merged.values()).sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt)
  );
}

export function mergePostExamSimulations(
  existing: PostExamSimulationResult[],
  incoming: unknown[]
) {
  const merged = new Map<string, PostExamSimulationResult>();
  for (const row of existing) {
    const normalized = normalizePostExamSimulation(row);
    if (normalized) merged.set(normalized.sessionId, normalized);
  }
  for (const row of incoming) {
    const normalized = normalizePostExamSimulation(row);
    if (normalized && !merged.has(normalized.sessionId)) {
      merged.set(normalized.sessionId, normalized);
    }
  }
  return Array.from(merged.values()).sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt)
  );
}

export function summarizeLocalPostExamSessions(sessions: QuizSession[]) {
  const rollups: PostExamSessionRollup[] = [];
  const simulations: PostExamSimulationResult[] = [];

  for (const session of sessions) {
    const completedAt = normalizeDate(session.completedAt);
    const sessionId = canonicalizePostExamSessionId(session.id);
    if (!sessionId || !completedAt || !isWithinPostExamCutoff(completedAt)) continue;

    const attempts = session.attempts.length;
    const correctAttempts = session.attempts.filter((attempt) => attempt.isCorrect).length;
    if (attempts <= 0) continue;
    rollups.push({
      sessionId,
      mode: session.settings?.mode ?? "",
      attempts,
      correctAttempts,
      completedAt
    });

    if (session.settings?.mode !== "simulation" || attempts !== 100 || correctAttempts <= 3) {
      continue;
    }
    const paperKey = inferPostExamPaperKey(session);
    const subject = inferPostExamSubject(paperKey, session.subject);
    if (!paperKey || !subject) continue;
    simulations.push({
      sessionId,
      subject,
      paperKey,
      paperLabel: formatPostExamPaperLabel(paperKey, session.settings?.sessionName),
      score: correctAttempts,
      completedAt
    });
  }

  return {
    sessions: mergePostExamSessionRollups([], rollups),
    simulations: mergePostExamSimulations([], simulations)
  };
}

export function mergePostExamSnapshotWithLocal(
  snapshot: PostExamPersonalSnapshot,
  local: { sessions: PostExamSessionRollup[]; simulations: PostExamSimulationResult[] },
  reconciledAt = new Date().toISOString()
) {
  return {
    ...snapshot,
    sessions: mergePostExamSessionRollups(snapshot.sessions, local.sessions),
    simulations: mergePostExamSimulations(snapshot.simulations, local.simulations),
    localReconciledAt: normalizeDate(reconciledAt) || new Date().toISOString()
  } satisfies PostExamPersonalSnapshot;
}

function getTaipeiDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function buildPostExamCumulativePoints(sessions: PostExamSessionRollup[]) {
  const daily = new Map<string, { attempts: number; correctAttempts: number }>();
  for (const session of mergePostExamSessionRollups([], sessions)) {
    const date = getTaipeiDateKey(session.completedAt);
    const current = daily.get(date) ?? { attempts: 0, correctAttempts: 0 };
    current.attempts += session.attempts;
    current.correctAttempts += session.correctAttempts;
    daily.set(date, current);
  }

  let cumulativeAttempts = 0;
  let cumulativeCorrectAttempts = 0;
  return Array.from(daily.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, point]) => {
      cumulativeAttempts += point.attempts;
      cumulativeCorrectAttempts += point.correctAttempts;
      return {
        date,
        cumulativeAttempts,
        cumulativeCorrectAttempts,
        cumulativeAccuracy:
          cumulativeAttempts > 0
            ? Number(((cumulativeCorrectAttempts / cumulativeAttempts) * 100).toFixed(1))
            : 0
      };
    });
}

function normalizePlainText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const collapsed = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(collapsed).slice(0, maxLength).join("");
}

function normalizeLongText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(normalized).slice(0, maxLength).join("");
}

export function containsObviousPersonalInfo(value: string) {
  const normalized = value.trim();
  return (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized) ||
    /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+(?:com|net|org|tw|io|me|app|co)\b)/i.test(normalized) ||
    /(?:^|\s)@[a-z0-9_.-]{3,}/i.test(normalized) ||
    /\b(?:line|ig|instagram)\b\s*(?:id|帳號)?\s*[:：@]?\s*[a-z0-9_.-]{3,}/i.test(normalized) ||
    /(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/.test(normalized) ||
    /\b\d{8,}\b/.test(normalized) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(normalized)
  );
}

function normalizeOptionalScore(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const score = Number(value);
  return Number.isFinite(score) && Number.isInteger(score) && score >= 0 && score <= 100
    ? score
    : null;
}

export function validatePostExamSurveyAnswers(input: unknown): PostExamSurveyValidation {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawAlias = normalizePlainText(value.publicAlias, ALIAS_MAX_LENGTH);
  const discloseScores = value.discloseScores !== false;
  const shareScores = discloseScores && value.shareScores !== false;
  const med1Score = discloseScores ? normalizeOptionalScore(value.med1Score) : null;
  const med2Score = discloseScores ? normalizeOptionalScore(value.med2Score) : null;
  const errors: PostExamSurveyValidation["errors"] = {};

  if (typeof value.publicAlias === "string" && Array.from(value.publicAlias.trim()).length > ALIAS_MAX_LENGTH) {
    errors.publicAlias = `公開暱稱最多 ${ALIAS_MAX_LENGTH} 字。`;
  } else if (rawAlias && containsObviousPersonalInfo(rawAlias)) {
    errors.publicAlias = "公開暱稱不能包含 email、網址、電話或帳號等明顯個資。";
  }
  if (discloseScores && value.med1Score !== "" && value.med1Score != null && med1Score === null) {
    errors.med1Score = "醫學（一）分數需為 0 到 100 的整數。";
  }
  if (discloseScores && value.med2Score !== "" && value.med2Score != null && med2Score === null) {
    errors.med2Score = "醫學（二）分數需為 0 到 100 的整數。";
  }

  return {
    data: {
      publicAlias: rawAlias || DEFAULT_PUBLIC_ALIAS,
      discloseScores,
      med1Score,
      med2Score,
      shareScores,
      studyReflection: normalizeLongText(value.studyReflection, RESPONSE_MAX_LENGTH),
      encouragement: normalizeLongText(value.encouragement, RESPONSE_MAX_LENGTH)
    },
    errors
  };
}

export function hasPostExamSurveyErrors(validation: PostExamSurveyValidation) {
  return Object.keys(validation.errors).length > 0;
}

export function getDefaultPostExamSurveyAnswers(): PostExamSurveyAnswers {
  return {
    publicAlias: "",
    discloseScores: true,
    med1Score: null,
    med2Score: null,
    shareScores: true,
    studyReflection: "",
    encouragement: ""
  };
}
