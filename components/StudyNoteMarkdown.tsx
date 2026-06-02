"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { StudyNoteQuestionCard } from "@/components/StudyNoteQuestionCard";
import type { Question, StudyNoteQuestionLink } from "@/types/quiz";

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
  const parts = parseMarkdownParts(markdown);

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
          <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
