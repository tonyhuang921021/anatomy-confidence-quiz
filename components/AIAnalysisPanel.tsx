"use client";

type AIAnalysisPanelProps = {
  analysis: string;
  model?: string;
  error?: string;
  loading: boolean;
  onGenerate: () => void;
};

export function AIAnalysisPanel({
  analysis,
  model,
  error,
  loading,
  onGenerate
}: AIAnalysisPanelProps) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">OpenAI API 補弱解析</h2>
          <p className="mt-1 text-sm text-slate-500">
            有設定 `OPENAI_API_KEY` 時，可直接生成完整補弱講解。
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="min-h-12 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "生成中..." : "呼叫 AI API"}
        </button>
      </div>

      {model ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">{model}</p> : null}

      {error ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
        {analysis || "尚未生成 AI 補弱解析。"}
      </div>
    </section>
  );
}
