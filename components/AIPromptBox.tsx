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
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">給 AI 的補弱 Prompt</h2>
          <p className="mt-2 text-sm text-slate-500">這段不會呼叫 API，只是幫你整理好可直接貼給任一 AI 的內容。</p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
        >
          {copied ? "已複製" : "複製 Prompt"}
        </button>
      </div>
      <textarea
        readOnly
        value={promptText}
        className="mt-4 min-h-72 w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none"
      />
    </section>
  );
}
