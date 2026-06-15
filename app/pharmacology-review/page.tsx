"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { PHARMACOLOGY_FLASHCARDS } from "@/data/pharmacologyFlashcards";

const LEVEL_META = {
  A: {
    label: "A 級高頻",
    hint: "最常考，抽到機率最高",
    className: "border-rose-200 bg-rose-100 text-rose-800"
  },
  B: {
    label: "B 級常考",
    hint: "常見考點，建議熟",
    className: "border-amber-200 bg-amber-100 text-amber-800"
  },
  C: {
    label: "C 級會考",
    hint: "有機會出現，刷到就補",
    className: "border-sky-200 bg-sky-100 text-sky-800"
  },
  D: {
    label: "D 級低頻",
    hint: "低頻但保留複習",
    className: "border-slate-200 bg-slate-100 text-slate-700"
  }
} as const;

function pickWeightedIndex() {
  const totalWeight = PHARMACOLOGY_FLASHCARDS.reduce((sum, item) => sum + Math.max(item.drawWeight, 1), 0);
  let cursor = Math.random() * totalWeight;

  for (let index = 0; index < PHARMACOLOGY_FLASHCARDS.length; index += 1) {
    cursor -= Math.max(PHARMACOLOGY_FLASHCARDS[index]?.drawWeight ?? 1, 1);
    if (cursor <= 0) {
      return index;
    }
  }

  return Math.max(PHARMACOLOGY_FLASHCARDS.length - 1, 0);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function PharmacologyReviewPage() {
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRevealedClass, setHasRevealedClass] = useState(false);
  const [copied, setCopied] = useState(false);

  const card = PHARMACOLOGY_FLASHCARDS[cardIndex] ?? PHARMACOLOGY_FLASHCARDS[0];
  const levelMeta = LEVEL_META[card.examLevel] ?? LEVEL_META.D;
  const sameCategoryCards = PHARMACOLOGY_FLASHCARDS.filter((item) => item.category === card.category).sort(
    (first, second) => second.drawWeight - first.drawWeight || first.name.localeCompare(second.name)
  );

  useEffect(() => {
    setCardIndex(pickWeightedIndex());
  }, []);

  const goNext = () => {
    setIsFlipped(false);
    setHasRevealedClass(false);
    setCopied(false);
    setCardIndex(pickWeightedIndex());
  };

  const flipCard = () => {
    setIsFlipped((value) => {
      const nextValue = !value;
      if (nextValue) {
        setHasRevealedClass(true);
      }
      return nextValue;
    });
  };

  const copyDrugName = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await copyText(card.name);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Pharmacology Cards</p>
            <h1 className="display-title mt-3 text-4xl sm:text-6xl">藥理複習</h1>
            <p className="body-soft mt-3 max-w-2xl text-base leading-8">
              隨機抽一個藥名，點卡片翻面看分類、機轉、作用、適應症和口訣。同分類藥物會在翻面後出現在下方。
            </p>
          </div>
          <Link href="/" className="secondary-pill">
            回首頁
          </Link>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        <div className="surface-card p-4 sm:p-6">
          <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.22em] text-brand-700">
            口訣來自國防國考藥訣 4.2 demo
          </p>

          <div
            role="button"
            tabIndex={0}
            className={`drug-flip-card ${isFlipped ? "is-flipped" : ""}`}
            onClick={flipCard}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flipCard();
              }
            }}
            aria-label="翻轉藥理複習卡"
          >
            <span className="drug-flip-inner">
              <span className="drug-flip-face drug-flip-front">
                <span className="rounded-full bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-700">
                  Today's Random Drug
                </span>
                <span className="mt-10 block max-w-full text-center font-serif text-[clamp(2rem,11vw,4.8rem)] font-bold leading-[1.02] tracking-[-0.04em] text-ink [overflow-wrap:anywhere] sm:text-[clamp(3rem,7vw,6.2rem)]">
                  {card.name}
                </span>
                <span className="body-soft mt-8 block text-center text-sm font-semibold">點一下看分類、機轉、作用與口訣</span>
              </span>

              <span className="drug-flip-face drug-flip-back">
                <span className="grid gap-4 text-left">
                  <span className="flex flex-wrap items-start justify-between gap-3">
                    <span>
                      <span className="eyebrow text-[10px]">藥物</span>
                      <span className="mt-1 block text-3xl font-black tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">{card.name}</span>
                    </span>
                    <span className={`rounded-full border px-3 py-2 text-xs font-black ${levelMeta.className}`}>
                      {levelMeta.label}
                    </span>
                  </span>
                  <span className="rounded-[1.1rem] border border-slate-100 bg-white/60 px-4 py-3 text-xs font-bold text-slate-600">
                    {levelMeta.hint}
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">分類</span>
                    <span className="mt-2 block text-sm font-bold leading-7 text-slate-700">{card.category}</span>
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">機轉</span>
                    <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.mechanism}</span>
                  </span>
                  <span className="grid gap-4 sm:grid-cols-2">
                    <span className="rounded-[1.4rem] bg-emerald-50/90 p-4">
                      <span className="text-xs font-black text-brand-700">作用 / 重點</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.effects}</span>
                    </span>
                    <span className="rounded-[1.4rem] bg-sky-50/90 p-4">
                      <span className="text-xs font-black text-sky-800">適應症</span>
                      <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.indications}</span>
                    </span>
                  </span>
                  <span className="rounded-[1.4rem] bg-amber-50/90 p-4">
                    <span className="text-xs font-black text-amber-800">口訣</span>
                    <span className="mt-2 block whitespace-pre-line text-sm font-semibold leading-7 text-amber-950">{card.mnemonic}</span>
                  </span>
                </span>
              </span>
            </span>

            <span className="absolute bottom-4 right-4 z-20">
              <button
                type="button"
                onClick={copyDrugName}
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5"
              >
                複製藥名
              </button>
            </span>
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={goNext} className="primary-pill min-w-44">
              下一個藥
            </button>
            {copied ? (
              <div className="rounded-full bg-slate-950/86 px-4 py-2 text-xs font-bold text-white shadow-lg sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
                已複製
              </div>
            ) : null}
          </div>
        </div>

        {hasRevealedClass ? (
          <aside className="surface-card-muted p-5">
            <p className="eyebrow">Same Class</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-ink">同分類藥物</h2>
            <p className="body-soft mt-2 text-sm leading-6">{card.category}</p>
            <div className="mt-5 max-h-[560px] overflow-auto rounded-[1.4rem] border border-slate-200 bg-white/72">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="sticky top-0 bg-emerald-50 text-xs font-black text-brand-700">
                  <tr>
                    <th className="px-4 py-3">藥名</th>
                    <th className="px-4 py-3">等級</th>
                    <th className="px-4 py-3">機轉</th>
                    <th className="px-4 py-3">作用 / 重點</th>
                    <th className="px-4 py-3">適應症</th>
                    <th className="px-4 py-3">口訣</th>
                  </tr>
                </thead>
                <tbody>
                  {sameCategoryCards.map((item, index) => {
                    const itemLevelMeta = LEVEL_META[item.examLevel] ?? LEVEL_META.D;

                    return (
                      <tr key={`${item.category}-${item.name}-${index}`} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 font-black text-ink">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${itemLevelMeta.className}`}>
                            {item.examLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.mechanism}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.effects}</td>
                        <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.indications}</td>
                        <td className="whitespace-pre-line px-4 py-3 font-semibold leading-6 text-slate-600">{item.mnemonic}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
