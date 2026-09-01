import { getPharmacologyExamPeriods, type PharmacologyLibraryExam } from "@/lib/pharmacologyLibrary";

export function PharmacologyExamPeriodSummary({
  exams,
  limit = 6
}: {
  exams: readonly PharmacologyLibraryExam[];
  limit?: number;
}) {
  const periods = getPharmacologyExamPeriods(exams);
  if (periods.length === 0) return null;

  const visiblePeriods = periods.slice(0, limit);
  const hiddenCount = periods.length - visiblePeriods.length;

  return (
    <span className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`考過 ${periods.join("、")}`}>
      <span className="mr-0.5 text-[11px] font-bold text-slate-500">考過</span>
      {visiblePeriods.map((period) => (
        <span key={period} className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-black tabular-nums text-amber-900 ring-1 ring-amber-200">
          {period}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="text-[11px] font-bold text-slate-500">另 {hiddenCount} 個考期</span>
      ) : null}
    </span>
  );
}
