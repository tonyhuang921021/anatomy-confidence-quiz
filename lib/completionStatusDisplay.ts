import type { CompletionStatus } from "@/types/quiz";

export const completionStatusClasses: Record<CompletionStatus, string> = {
  未開始: "bg-slate-100 text-slate-700",
  進行中: "bg-sky-100 text-sky-800",
  已完成但不穩: "bg-amber-100 text-amber-900",
  已完成且穩定: "bg-emerald-100 text-emerald-800"
};

export function getCompletionStatusLabel(status: CompletionStatus) {
  if (status === "已完成但不穩") return "練過但不穩";
  if (status === "已完成且穩定") return "熟練穩定";
  return status;
}
