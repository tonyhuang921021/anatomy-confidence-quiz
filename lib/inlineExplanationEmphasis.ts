/** Split simple inline emphasis without interpreting HTML or links. */
export function splitInlineExplanationEmphasis(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part) => ({
    text: part.startsWith('**') && part.endsWith('**') && part.length > 4 ? part.slice(2, -2) : part,
    strong: part.startsWith('**') && part.endsWith('**') && part.length > 4
  }));
}
