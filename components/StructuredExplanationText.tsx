"use client";

type StructuredExplanationTextProps = {
  text?: string | null;
  label?: string;
  compact?: boolean;
  tone?: "light" | "dark";
  className?: string;
  sectionFilter?: (section: ExplanationSection, index: number) => boolean;
  fallbackToFullText?: boolean;
};

type ExplanationBlock =
  | {
      type: "heading";
      title: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

type ExplanationSection = {
  title?: string;
  blocks: Array<Extract<ExplanationBlock, { type: "paragraph" | "table" }>>;
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

const DEFAULT_INLINE_EXPLANATION_TITLES = new Set(["本題核心", "核心知識", "解題關鍵"]);

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

function splitMarkdownTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line?: string) {
  if (!line) return false;
  const cells = splitMarkdownTableRow(line);
  return (
    cells.length >= 2 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function isPotentialMarkdownTableRow(line?: string) {
  if (!line) return false;
  return splitMarkdownTableRow(line).length >= 2 && line.includes("|");
}

function parseExplanationBlocks(text: string): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = [];
  const paragraphLines: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  function flushParagraph() {
    const text = paragraphLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines.length = 0;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (
      isPotentialMarkdownTableRow(line) &&
      isMarkdownTableSeparator(lines[index + 1])
    ) {
      const headers = splitMarkdownTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && isPotentialMarkdownTableRow(lines[index])) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }

      index -= 1;
      if (headers.length > 0 && rows.length > 0) {
        flushParagraph();
        blocks.push({ type: "table", headers, rows });
        continue;
      }
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

function buildExplanationSections(blocks: ExplanationBlock[]): ExplanationSection[] {
  const sections: ExplanationSection[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      sections.push({ title: block.title, blocks: [] });
      continue;
    }

    const currentSection = sections[sections.length - 1];
    if (currentSection) {
      currentSection.blocks.push(block);
    } else {
      sections.push({ blocks: [block] });
    }
  }

  return sections.filter((section) => section.title || section.blocks.length > 0);
}

export function getStructuredExplanationSectionTitles(text?: string | null) {
  const trimmedText = text?.trim();
  if (!trimmedText) return [];
  return buildExplanationSections(parseExplanationBlocks(trimmedText))
    .map((section) => section.title)
    .filter((title): title is string => Boolean(title));
}

export function isDefaultInlineExplanationSectionTitle(title?: string) {
  return !title || DEFAULT_INLINE_EXPLANATION_TITLES.has(title);
}

export function hasCollapsibleStructuredExplanation(text?: string | null) {
  const titles = getStructuredExplanationSectionTitles(text);
  return (
    titles.length > 0 &&
    titles.some((title) => !isDefaultInlineExplanationSectionTitle(title)) &&
    titles.some((title) => isDefaultInlineExplanationSectionTitle(title))
  );
}

export function StructuredExplanationText({
  text,
  label = "詳解",
  compact = false,
  tone = "light",
  className = "",
  sectionFilter,
  fallbackToFullText = true
}: StructuredExplanationTextProps) {
  const trimmedText = text?.trim();
  if (!trimmedText) return null;

  const blocks = parseExplanationBlocks(trimmedText);
  const allSections = buildExplanationSections(blocks);
  let sections = sectionFilter
    ? allSections.filter((section, index) => sectionFilter(section, index))
    : allSections;
  if (sections.length === 0) {
    if (!fallbackToFullText) return null;
    sections = allSections;
  }

  const labelClassName = tone === "dark" ? "text-white" : "text-ink";
  const sectionClassName =
    tone === "dark"
      ? "border-white/20"
      : "border-teal-200";
  const headingClassName = tone === "dark" ? "text-teal-50" : "text-teal-900";
  const paragraphClassName = tone === "dark" ? "text-slate-50" : "text-slate-800";
  const leadBackgroundClassName = tone === "dark" ? "bg-white/5" : "bg-white/60";
  const tableShellClassName =
    tone === "dark"
      ? "border-white/15 bg-white/5"
      : "border-slate-200 bg-white/80";
  const tableHeadClassName =
    tone === "dark"
      ? "bg-white/10 text-teal-50"
      : "bg-teal-50 text-teal-950";
  const tableCellClassName =
    tone === "dark"
      ? "border-white/10 text-slate-50"
      : "border-slate-200 text-slate-800";
  const tableTextWrapClassName =
    "structured-explanation-table-cell min-w-[7.5rem] max-w-[16rem] whitespace-normal break-words [overflow-wrap:anywhere] [word-break:normal] sm:min-w-[8.5rem] sm:max-w-[18rem]";

  return (
    <div className={`structured-explanation-text w-full max-w-full min-w-0 ${className}`}>
      {label ? (
        <p className={`mb-3 text-[15px] font-black leading-6 ${labelClassName}`}>
          {label}
        </p>
      ) : null}
      <div className="w-full max-w-[52rem] min-w-0 space-y-4 sm:space-y-5">
        {sections.map((section, index) => (
          <section
            key={`${section.title ?? "section"}-${index}`}
            className={`w-full max-w-full min-w-0 border-l-4 pl-3 sm:pl-4 ${sectionClassName}`}
          >
            {section.title ? (
              <h4 className={`mb-2 text-[16px] font-black leading-7 sm:text-[17px] ${headingClassName}`}>
                {section.title}
              </h4>
            ) : null}
            {section.blocks.length > 0 ? (
              <div className={`w-full min-w-0 rounded-2xl px-3 py-3 sm:px-4 ${leadBackgroundClassName}`}>
                <div className="space-y-3">
                  {section.blocks.map((block, blockIndex) => {
                    if (block.type === "table") {
                      return (
                        <div
                          key={`${section.title ?? "table"}-${blockIndex}`}
                          className={`structured-explanation-table-shell w-full max-w-full touch-pan-x overscroll-x-contain overflow-x-auto rounded-2xl border shadow-[inset_-18px_0_18px_-20px_rgba(15,23,42,0.65)] [-webkit-overflow-scrolling:touch] ${tableShellClassName}`}
                        >
                          <table className="structured-explanation-table w-full min-w-max max-w-none table-auto border-collapse text-left text-[14px] leading-7 sm:text-[15px]">
                            <thead className={tableHeadClassName}>
                              <tr>
                                {block.headers.map((header, headerIndex) => (
                                  <th
                                    key={`${header}-${headerIndex}`}
                                    className={`border-b px-3 py-2.5 font-black ${tableCellClassName} ${tableTextWrapClassName}`}
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr key={`row-${rowIndex}`}>
                                  {block.headers.map((_, cellIndex) => (
                                    <td
                                      key={`cell-${rowIndex}-${cellIndex}`}
                                      className={`border-t px-3 py-2.5 align-top font-medium ${tableCellClassName} ${tableTextWrapClassName}`}
                                    >
                                      {row[cellIndex] ?? ""}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    return (
                      <p
                        key={`${section.title ?? "paragraph"}-${blockIndex}`}
                        className={`${compact ? "text-[16px] leading-8" : "text-[17px] leading-9"} whitespace-pre-line font-medium ${paragraphClassName} [overflow-wrap:anywhere]`}
                      >
                        {block.text}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
