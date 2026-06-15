"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { PHARMACOLOGY_FLASHCARDS } from "@/data/pharmacologyFlashcards";

function pickRandomIndex() {
  return Math.floor(Math.random() * PHARMACOLOGY_FLASHCARDS.length);
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
  const sameCategoryCards = PHARMACOLOGY_FLASHCARDS.filter((item) => item.category === card.category);

  useEffect(() => {
    setCardIndex(pickRandomIndex());
  }, []);

  const goNext = () => {
    setIsFlipped(false);
    setHasRevealedClass(false);
    setCopied(false);
    setCardIndex(pickRandomIndex());
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
              隨機抽一個藥名，點卡片翻面看分類、機轉、口訣和同分類藥物。重複抽到也沒關係，當作多刷一次。
            </p>
          </div>
          <Link href="/" className="secondary-pill">
            回首頁
          </Link>
        </div>
      </section>

      <section className={`mt-6 grid gap-5 ${hasRevealedClass ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
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
                <span className="body-soft mt-8 block text-center text-sm font-semibold">點一下看分類、機轉與口訣</span>
              </span>

              <span className="drug-flip-face drug-flip-back">
                <span className="grid gap-4 text-left">
                  <span>
                    <span className="eyebrow text-[10px]">藥物</span>
                    <span className="mt-1 block text-3xl font-black tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">{card.name}</span>
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">分類</span>
                    <span className="mt-2 block text-sm font-bold leading-7 text-slate-700">{card.category}</span>
                  </span>
                  <span className="rounded-[1.4rem] bg-white/72 p-4">
                    <span className="text-xs font-black text-brand-700">機轉</span>
                    <span className="mt-2 block text-sm font-semibold leading-7 text-slate-700">{card.mechanism}</span>
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
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="sticky top-0 bg-emerald-50 text-xs font-black text-brand-700">
                  <tr>
                    <th className="px-4 py-3">藥名</th>
                    <th className="px-4 py-3">機轉</th>
                    <th className="px-4 py-3">口訣</th>
                  </tr>
                </thead>
                <tbody>
                  {sameCategoryCards.map((item, index) => (
                    <tr key={`${item.category}-${item.name}-${index}`} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 font-black text-ink">{item.name}</td>
                      <td className="px-4 py-3 font-semibold leading-6 text-slate-600">{item.mechanism}</td>
                      <td className="px-4 py-3 whitespace-pre-line font-semibold leading-6 text-slate-600">{item.mnemonic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
