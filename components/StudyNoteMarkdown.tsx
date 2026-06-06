"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { StudyNoteQuestionCard } from "@/components/StudyNoteQuestionCard";
import { normalizeStudyNoteMarkdown } from "@/lib/studyNotes";
import type { Question, StudyNoteQuestionLink } from "@/types/quiz";

const NOTE_TEXT_COLOR_CLASS_MAP: Record<string, string> = {
  red: "note-text-color-red",
  green: "note-text-color-green",
  blue: "note-text-color-blue",
  amber: "note-text-color-orange",
  orange: "note-text-color-orange",
  purple: "note-text-color-purple",
  black: "note-text-color-black"
};

const NOTE_TEXT_BACKGROUND_CLASS_MAP: Record<string, string> = {
  yellow: "note-text-bg-yellow"
};

type Props = {
  markdown: string;
  questionMap?: Map<string, Question>;
  questionLinks?: StudyNoteQuestionLink[];
};

type MarkdownPart =
  | {
      type: "markdown";
      content: string;
    }
  | {
      type: "question";
      id: string;
      title?: string;
    };

function parseMarkdownParts(markdown: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const lines = markdown.split("\n");
  let buffer: string[] = [];
  const shortcodePattern = /^\s*\[question-note\s+id="([^"]+)"(?:\s+title="([^"]*)")?\s*\]\s*$/;

  for (const line of lines) {
    const match = line.match(shortcodePattern);
    if (match) {
      if (buffer.length > 0) {
        parts.push({ type: "markdown", content: buffer.join("\n") });
        buffer = [];
      }
      parts.push({ type: "question", id: match[1], title: match[2] });
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    parts.push({ type: "markdown", content: buffer.join("\n") });
  }

  return parts;
}

export function StudyNoteMarkdown({ markdown, questionMap, questionLinks = [] }: Props) {
  const parts = parseMarkdownParts(normalizeStudyNoteMarkdown(markdown));
  const embeddedQuestionIds = new Set(parts.filter((part) => part.type === "question").map((part) => part.id));
  const appendedQuestionLinks = questionLinks.filter((link) => !embeddedQuestionIds.has(link.questionId));

  return (
    <div className="note-markdown">
      {parts.map((part, index) => {
        if (part.type === "question") {
          const link = questionLinks.find((item) => item.questionId === part.id);
          return (
            <StudyNoteQuestionCard
              key={`${part.id}-${index}`}
              question={questionMap?.get(part.id)}
              link={link ?? { questionId: part.id, relationType: "related" }}
              title={part.title}
            />
          );
        }

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              a({ href, children }) {
                const colorKey = href?.match(/^#note-color-([a-z]+)$/)?.[1];
                const colorClassName = colorKey ? NOTE_TEXT_COLOR_CLASS_MAP[colorKey] : undefined;
                if (colorClassName) {
                  return <span className={colorClassName}>{children}</span>;
                }
                const backgroundKey = href?.match(/^#note-bg-([a-z]+)$/)?.[1];
                const backgroundClassName = backgroundKey ? NOTE_TEXT_BACKGROUND_CLASS_MAP[backgroundKey] : undefined;
                if (backgroundClassName) {
                  return <span className={backgroundClassName}>{children}</span>;
                }
                return (
                  <a href={href}>
                    {children}
                  </a>
                );
              }
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
      {appendedQuestionLinks.length > 0 ? (
        <section className="study-note-linked-questions mt-8 rounded-[2rem] border border-teal-100 bg-teal-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Linked Exam Questions</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">相關國考題</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            這些題號來自筆記 metadata，網站會自動帶入題目、選項、答案與詳解。
          </p>
          <div className="mt-4">
            {appendedQuestionLinks.map((link) => (
              <StudyNoteQuestionCard
                key={`${link.questionId}-${link.relationType}`}
                question={questionMap?.get(link.questionId)}
                link={link}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
