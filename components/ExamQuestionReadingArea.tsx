"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";

/** Presentation only. Scrolling never selects an answer or changes a session. */
export function ExamQuestionReadingArea({questionId, scale, children}: {
  questionId: string;
  scale: number;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState<string[]>([]);

  useEffect(() => {
    const view = viewport.current, body = content.current;
    if (!view || !body) return;
    view.scrollTop = 0;
    view.scrollLeft = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bottom = view.getBoundingClientRect().bottom;
      const next = Array.from(body.querySelectorAll<HTMLInputElement>('input[name="exam-answer"]'))
        .filter(input => (input.closest('.option')?.getBoundingClientRect().bottom ?? 0) > bottom + 2)
        .map(input => input.getAttribute('aria-label')?.replace(/^選項\s*/, '') ?? '');
      setRemaining(previous => previous.join(',') === next.join(',') ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(view);
    resize.observe(body);
    view.addEventListener('scroll', schedule, {passive: true});
    body.addEventListener('load', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      view.removeEventListener('scroll', schedule);
      body.removeEventListener('load', schedule, true);
    };
  }, [questionId]);

  return <div className="question-reading-area">
    <div ref={viewport} className="question-body" tabIndex={0}
      aria-label="題目內容，可捲動閱讀"
      style={{'--question-scale': scale} as React.CSSProperties}>
      <div ref={content} className="question-content">{children}</div>
    </div>
    <div className="question-scroll-cue" data-testid="exam-options-scroll-cue">
      {remaining.length ? <button type="button" onClick={() => {
        const view = viewport.current;
        if (view) view.scrollBy({top: Math.max(40, view.clientHeight * .8), behavior: 'auto'});
      }}>下方還有 {remaining.join('、')} 選項 ↓</button> : null}
    </div>
  </div>;
}
