"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { TeachingFigure } from "@/components/TeachingFigure";

export type TeachingExplanationData = {
  title: string;
  answerSummary: string;
  options: Array<{ key: string; text: string; explanation: string }>;
  sections: Array<{
    title: string;
    paragraphs: string[];
    figure?: {
      src: string;
      alt: string;
      width?: number;
      height?: number;
      caption: string;
      credit: string;
      sourceUrl: string;
      originalImageUrl: string;
      licenseName: string;
      licenseUrl: string;
    };
  }>;
  related: Array<{ questionId: string; reason: string }>;
};

/** Data must be source-checked and approved before being supplied to this renderer. */
export function TeachingExplanation({ data }: { data: TeachingExplanationData }) {
  const [detailed, setDetailed] = useState(false);
  const panelId = useId();
  const related = data.related.filter(({ questionId }) => /^[A-Za-z0-9_-]{1,160}$/.test(questionId));

  return (
    <section aria-label="教學詳解" className="min-w-0 max-w-full space-y-4">
      <div role="group" aria-label="詳解閱讀方式" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!detailed} aria-controls={panelId} onClick={() => setDetailed(false)} className={`rounded-lg px-3 py-2 ring-1 ring-slate-300 ${!detailed ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>簡解</button>
        <button type="button" aria-pressed={detailed} aria-controls={panelId} onClick={() => setDetailed(true)} className={`rounded-lg px-3 py-2 ring-1 ring-slate-300 ${detailed ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>詳解</button>
      </div>
      <div id={panelId} className="min-w-0 max-w-full space-y-4 leading-7">
        <h3 className="font-semibold">{data.title}</h3>
        <p className="whitespace-pre-line break-words">{data.answerSummary}</p>
        {detailed ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
                <caption className="mb-2 text-left font-semibold">選項比較</caption>
                <thead><tr><th scope="col">選項</th><th scope="col">判斷</th></tr></thead>
                <tbody>{data.options.map((option) => <tr key={option.key} className="border-t border-slate-200"><th scope="row" className="align-top pr-3 py-2">{option.key}．{option.text}</th><td className="py-2">{option.explanation}</td></tr>)}</tbody>
              </table>
            </div>
            {data.sections.map((section, index) => <section key={`${section.title}-${index}`} className="space-y-2"><h4 className="font-semibold">{section.title}</h4>{section.paragraphs.map((paragraph, i) => <p key={i} className="whitespace-pre-line break-words">{paragraph}</p>)}{section.figure ? <TeachingFigure {...section.figure} /> : null}</section>)}
            {related.length ? <section aria-label="相關題"><h4 className="font-semibold">相關題</h4><ul className="list-disc pl-5">{related.map((item) => <li key={item.questionId}><Link href={`/search?query=${encodeURIComponent(item.questionId)}`} className="underline">{item.questionId}</Link>：{item.reason}</li>)}</ul></section> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
