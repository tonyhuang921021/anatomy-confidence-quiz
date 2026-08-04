export type CaptionCue = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type CaptionSentence = CaptionCue & {
  sourceCueIds: string[];
};

const SENTENCE_PART_PATTERN = /.*?[。！？!?]+[」』”’）》〕】)]*|.+$/gu;
const SENTENCE_END_PATTERN = /[。！？!?]+[」』”’）》〕】)]*$/u;

function splitSentenceParts(text: string) {
  const normalized = text.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalized.match(SENTENCE_PART_PATTERN)?.filter(Boolean) ?? [];
}

function joinParts(previous: string, next: string) {
  if (!previous) return next;
  const needsSpace = /[A-Za-z0-9]$/u.test(previous) && /^[A-Za-z0-9]/u.test(next);
  return `${previous}${needsSpace ? " " : ""}${next}`;
}

export function buildCaptionSentences(cues: readonly CaptionCue[]): CaptionSentence[] {
  const sentences: CaptionSentence[] = [];
  let current: CaptionSentence | null = null;

  for (const cue of cues) {
    const parts = splitSentenceParts(cue.text);
    if (parts.length === 0) continue;
    const totalWeight = parts.reduce((sum, part) => sum + Math.max(1, [...part].length), 0);
    const cueStart = Number.isFinite(cue.startSec) ? cue.startSec : 0;
    const cueEnd = Number.isFinite(cue.endSec) ? Math.max(cueStart, cue.endSec) : cueStart;
    const cueDuration = cueEnd - cueStart;
    let elapsedWeight = 0;

    for (const part of parts) {
      const partWeight = Math.max(1, [...part].length);
      const partStart = cueStart + cueDuration * (elapsedWeight / totalWeight);
      elapsedWeight += partWeight;
      const partEnd = cueStart + cueDuration * (elapsedWeight / totalWeight);

      if (!current) {
        current = {
          id: `sentence-${cue.id}-${sentences.length + 1}`,
          startSec: partStart,
          endSec: partEnd,
          text: part,
          sourceCueIds: [cue.id]
        };
      } else {
        current.text = joinParts(current.text, part);
        current.endSec = partEnd;
        if (current.sourceCueIds.at(-1) !== cue.id) current.sourceCueIds.push(cue.id);
      }

      if (SENTENCE_END_PATTERN.test(part)) {
        sentences.push(current);
        current = null;
      }
    }
  }

  if (current) sentences.push(current);
  return sentences;
}

export function findCaptionSentenceAtTime(
  sentences: readonly CaptionSentence[],
  seconds: number
) {
  let low = 0;
  let high = sentences.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sentences[middle].startSec <= seconds) low = middle + 1;
    else high = middle;
  }
  const candidate = sentences[low - 1];
  return candidate && seconds >= candidate.startSec && seconds < candidate.endSec
    ? candidate
    : null;
}
