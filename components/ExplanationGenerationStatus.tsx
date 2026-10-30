"use client";

import { useEffect, useState } from "react";
import {
  advanceGenerationStatus,
  INITIAL_GENERATION_STATUS,
  type GenerationSignal
} from "@/lib/explanationGenerationStatus";
import styles from "./ExplanationGenerationStatus.module.css";

export function ExplanationGenerationStatus({ questionId, loading, error, resultVersion }: GenerationSignal) {
  const [state, setState] = useState(INITIAL_GENERATION_STATUS);
  const signal = { questionId, loading, error, resultVersion };
  const next = advanceGenerationStatus(state, signal);
  useEffect(() => {
    setState((previous) => advanceGenerationStatus(previous, { questionId, loading, error, resultVersion }));
  }, [questionId, loading, error, resultVersion]);

  if (next.phase === "idle") return null;
  const complete = next.phase === "complete";
  return (
    <div className={styles.status} data-phase={next.phase} role="status" aria-live="polite" aria-atomic="true" aria-busy={!complete}>
      <svg className={styles.cat} viewBox="0 0 112 88" width="112" height="88" aria-hidden="true" focusable="false">
        <ellipse cx="54" cy="79" rx="43" ry="4" fill="#dfebe7" />
        <path className={styles.tail} d="M77 66c24 6 25-15 16-17" fill="none" stroke="#d7986c" strokeWidth="9" strokeLinecap="round" />
        <path d="M32 66c-1-18 9-27 22-27s24 9 23 27" fill="#efbc91" stroke="#775342" strokeWidth="2" />
        <g className={styles.head}>
          <path d="M29 30l-1-21 19 11c6-2 13-2 19 0L84 9l-2 23c5 25-14 31-27 31S24 57 29 30Z" fill="#f5cda5" stroke="#775342" strokeWidth="2" strokeLinejoin="round" />
          <path d="m32 16 1 14 9-8M78 16l-10 7 10 7" fill="#e5a694" />
          <path d="m48 22 3 7m5-8 1 8m6-7-2 7" stroke="#cf9569" strokeWidth="3" strokeLinecap="round" />
          <g className={styles.eyes} stroke="#604739" strokeWidth="2.5" strokeLinecap="round" fill="none">
            {complete ? <><path d="m39 39 4-4 4 4" /><path d="m64 39 4-4 4 4" /></> : <><path d="M42 36v4" /><path d="M68 36v4" /></>}
          </g>
          <path d="m52 43 3 3 3-3Z" fill="#bd7c72" />
          <path d="M55 46v2m0 0c-2 3-5 2-6 0m6 0c2 3 5 2 6 0" fill="none" stroke="#775342" strokeWidth="1.5" strokeLinecap="round" />
          <g stroke="#b78669" strokeWidth="1.4" strokeLinecap="round"><path d="m34 44-11-2m11 7-11 2m53-7 11-2m-11 7 11 2" /></g>
          <ellipse cx="37" cy="46" rx="4" ry="2" fill="#e8a6a0" opacity=".55" /><ellipse cx="73" cy="46" rx="4" ry="2" fill="#e8a6a0" opacity=".55" />
        </g>
        <g stroke="#537f78" strokeWidth="2" strokeLinejoin="round">
          <path d="M19 63c13-4 25-2 36 4 11-6 24-8 37-4v15c-13-4-25-2-37 3-12-5-24-7-36-3Z" fill="#83b6aa" />
          <path d="M22 57c11-3 23 0 33 6 11-6 23-9 34-6v16c-11-2-23 1-34 6-10-5-22-8-33-6Z" fill="#fff9e8" />
          <path d="M55 63v16" />
        </g>
        <g stroke="#b9c9b7" strokeWidth="1.6" strokeLinecap="round"><path d="m29 62 16 4m-16 1 12 3m23-4 17-4m-17 9 13-4" /></g>
        <path className={styles.page} d="M55 63c-9-7-18-9-25-8v15c9-1 17 2 25 9Z" fill="#fffdf5" stroke="#9db7a7" strokeWidth="1.5" />
        <ellipse cx="27" cy="65" rx="7" ry="4" fill="#f5cda5" stroke="#775342" strokeWidth="1.6" /><ellipse cx="83" cy="65" rx="7" ry="4" fill="#f5cda5" stroke="#775342" strokeWidth="1.6" />
        {!complete && <text className={styles.sleep} x="92" y="27" fill="#7c9c95" fontSize="13" fontWeight="600">z</text>}
        {complete && <path className={styles.sparkle} d="m96 20 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#dfb758" />}
      </svg>
      <div className={styles.copy}>
        <span className={styles.label}>{complete ? "詳解完成" : "詳解生成中"}</span>
        <span className={styles.caption}>{complete ? "可以開始看了" : "小貓陪你等一下"}</span>
      </div>
    </div>
  );
}
