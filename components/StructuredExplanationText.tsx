"use client";

type StructuredExplanationTextProps = {
  text?: string | null;
  label?: string;
  compact?: boolean;
  tone?: "light" | "dark";
  className?: string;
};

type ExplanationBlock =
  | {
      type: "heading";
      title: string;
    }
  | {
      type: "paragraph";
      text: string;
    };

const STRUCTURED_HEADING_ALIASES = new Set([
  "本題核心",
  "核心知識",
  "判斷邏輯",
  "解題關鍵",
  "觸類旁通",
  "延伸概念",
  "常見混淆",
  "考場提醒",
  "小結"
]);

function normalizeHeadingTitle(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/^[一二三四五六七八九十0-9]+[、.．]\s*/, "")
    .trim();
}

function parseHeadingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const bracketMatch = trimmed.match(/^【([^】]{2,24})】\s*(.*)$/);
  if (bracketMatch) {
    return {
      title: normalizeHeadingTitle(bracketMatch[1]),
      rest: bracketMatch[2]?.trim() ?? ""
    };
  }

  const markdownMatch = trimmed.match(/^#{2,4}\s+(.{2,30})$/);
  if (markdownMatch) {
    return {
      title: normalizeHeadingTitle(markdownMatch[1]),
      rest: ""
    };
  }

  const labelMatch = trimmed.match(/^([^：:]{2,18})[：:]\s*(.*)$/);
  if (labelMatch) {
    const title = normalizeHeadingTitle(labelMatch[1]);
    if (STRUCTURED_HEADING_ALIASES.has(title)) {
      return {
        title,
        rest: labelMatch[2]?.trim() ?? ""
      };
    }
  }

  return null;
}

function parseExplanationBlocks(text: string): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = [];
  const paragraphLines: string[] = [];

  function flushParagraph() {
    const text = paragraphLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines.length = 0;
  }

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = parseHeadingLine(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", title: heading.title });
      if (heading.rest) {
        paragraphLines.push(heading.rest);
      }
      continue;
    }

    paragraphLines.push(line.trim());
  }

  flushParagraph();

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text }];
}

export function StructuredExplanationText({
  text,
  label = "詳解",
  compact = false,
  tone = "light",
  className = ""
}: StructuredExplanationTextProps) {
  const trimmedText = text?.trim();
  if (!trimmedText) return null;

  const blocks = parseExplanationBlocks(trimmedText);

  const labelClassName = tone === "dark" ? "text-white" : "text-ink";
  const headingClassName =
    tone === "dark"
      ? "bg-white/10 text-teal-50 ring-white/15"
      : "bg-teal-50 text-teal-800 ring-teal-100";
  const paragraphClassName = tone === "dark" ? "text-slate-100" : "text-slate-700";

  return (
    <div className={`structured-explanation-text min-w-0 space-y-3 ${className}`}>
      {label ? <p className={`text-sm font-black ${labelClassName}`}>{label}</p> : null}
      <div className={compact ? "space-y-2.5" : "space-y-3"}>
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h4
                key={`heading-${block.title}-${index}`}
                className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${headingClassName}`}
              >
                {block.title}
              </h4>
            );
          }

          return (
            <p
              key={`paragraph-${index}`}
              className={`${compact ? "text-sm leading-7" : "text-[15px] leading-8"} whitespace-pre-line ${paragraphClassName} [overflow-wrap:anywhere]`}
            >
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
