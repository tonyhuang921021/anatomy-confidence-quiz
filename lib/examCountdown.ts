export type ScheduledExam = { id: string; label: string; date: string | null; sourceUrl: string };

export const PHYSICIAN_STAGE_ONE_EXAMS: ScheduledExam[] = [{
  id: "116020-stage1", label: "116 年第一次醫師第一階段", date: "2027-01-16",
  sourceUrl: "https://wwwc.moex.gov.tw/main/exam/wFrmPropertyDetail.aspx?m=8076&c=116020"
}];

function calendarDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const milliseconds = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === date
    ? milliseconds / 86400000 : null;
}

export function getExamCountdown(now: Date, exams: ScheduledExam[] = PHYSICIAN_STAGE_ONE_EXAMS) {
  if (!Number.isFinite(now.getTime())) return { status: "unknown" as const, exam: null, days: null };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", calendar: "gregory" }).format(now);
  const todayDay = calendarDay(today)!;
  const next = exams.map(exam => ({ exam, day: exam.date ? calendarDay(exam.date) : null }))
    .filter((item): item is { exam: ScheduledExam; day: number } => item.day !== null && item.day >= todayDay)
    .sort((a, b) => a.day - b.day)[0];
  if (!next) return { status: "unknown" as const, exam: null, days: null };
  const days = next.day - todayDay;
  return { status: days === 0 ? "today" as const : "upcoming" as const, exam: next.exam, days };
}
