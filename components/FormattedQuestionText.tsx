"use client";

type FormattedQuestionTextProps = {
  text: string;
};

type TextToken = {
  text: string;
  subscript?: string;
};

function normalizeQuestionText(text: string) {
  return text
    .replaceAll("", "酶")
    .replace(/\bV\s+下降，K\s+下降\s+max\s+M\b/g, "Vmax 下降，KM 下降")
    .replace(/\bV\s+不變，K\s+下降\s+max\s+M\b/g, "Vmax 不變，KM 下降")
    .replace(/\bV\s+下降，K\s+上升\s+max\s+M\b/g, "Vmax 下降，KM 上升")
    .replace(/\bV\s+不變，K\s+上升\s+max\s+M\b/g, "Vmax 不變，KM 上升")
    .replace(/\bV\s+max\b/g, "Vmax")
    .replace(/\bK\s+M\b/g, "KM")
    .replace(/\bV\s+0\b/g, "V0");
}

function tokenize(text: string): TextToken[] {
  const normalized = normalizeQuestionText(text);
  const pattern = /(Vmax|KM|Km|V0|kcat)/g;
  const tokens: TextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: normalized.slice(lastIndex, match.index) });
    }

    const value = match[0];
    if (value === "Vmax") tokens.push({ text: "V", subscript: "max" });
    else if (value === "KM" || value === "Km") tokens.push({ text: "K", subscript: value.slice(1) });
    else if (value === "V0") tokens.push({ text: "V", subscript: "0" });
    else if (value === "kcat") tokens.push({ text: "k", subscript: "cat" });
    else tokens.push({ text: value });

    lastIndex = match.index + value.length;
  }

  if (lastIndex < normalized.length) {
    tokens.push({ text: normalized.slice(lastIndex) });
  }

  return tokens;
}

export function FormattedQuestionText({ text }: FormattedQuestionTextProps) {
  return (
    <>
      {tokenize(text).map((token, index) => (
        <span key={`${token.text}-${index}`} className="[overflow-wrap:anywhere]">
          {token.text}
          {token.subscript ? <sub className="text-[0.72em]">{token.subscript}</sub> : null}
        </span>
      ))}
    </>
  );
}
