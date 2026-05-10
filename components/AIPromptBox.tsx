"use client";

import { useState } from "react";

type AIPromptBoxProps = {
  promptText: string;
};

export function AIPromptBox({ promptText }: AIPromptBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">AI 補弱 Prompt</h2>
          <p className="mt-1 text-sm text-slate-500">
            可直接複製貼到任一 AI，重點只拿回你需要補的知識區塊。
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
        >
          {copied ? "已複製" : "複製 Prompt"}
        </button>
      </div>
      <textarea
        readOnly
        value={promptText}
        className="mt-5 min-h-[340px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none"
      />
    </section>
  );
}
