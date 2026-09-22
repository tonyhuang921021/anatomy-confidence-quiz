import { tokenizeQuestionText, type FormattedTextToken } from "./questionTextFormat";

/** PDF presentation only. NFC preserves units/scripts while resolving canonical
 * equivalents, including CJK compatibility ideographs in both Unicode planes.
 * Do not use whole-string NFKC: it would flatten e.g. m², CO₂, ① and ㎎.
 * https://www.unicode.org/reports/tr15/
 */
export function normalizeWrongQuestionPdfText(text: string): string {
  return text.normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\v\f\u0085\u2028\u2029]/g, "\n")
    .replace(/\t/g, "    ")
    // Unknown nonprinting C0/C1 controls must not join two visible words.
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u0084\u0086-\u009f]/g, " ")
    .replace(/\u200b/g, " ") // zero-width space is a word-break opportunity
    // Discretionary hyphens/BOM/word-joiners and bidi layout marks are not glyphs.
    // Keep ZWJ/ZWNJ and variation selectors: they can affect actual characters.
    .replace(/[\u00ad\u061c\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, "");
}

// Explicit UnicodeData <super>/<sub> characters rendered with a baseline shift.
// Compatibility normalization is confined to this allowlist; units and PUA stay.
const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁᵂᵝᵞᵟᵠᵡ";
const subscripts = "ᵢᵣᵤᵥᵦᵧᵨᵩᵪ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜⱼ";
const nativeScripts = new Map(Array.from(superscripts, (character) =>
  [character, { kind: "superscript" as "superscript" | "subscript", base: character.normalize("NFKC") }] as const
));
for (const character of subscripts) nativeScripts.set(character, { kind: "subscript", base: character.normalize("NFKC") });

/** Split native scripts before applying the existing plain-text medical formatter.
 * O₂/CO2 each produce exactly one subscript; HCO₃⁻ keeps both scripts.
 * Empty-base tokens intentionally attach to the preceding layout unit.
 */
export function tokenizeWrongQuestionPdfText(text: string, formatted = true): FormattedTextToken[] {
  const tokens: FormattedTextToken[] = [];
  let plain = "";
  const flush = () => {
    if (plain) for (const part of plain.split(/( {2,})/u)) {
      if (part) tokens.push(...(formatted && !/^ +$/u.test(part) ? tokenizeQuestionText(part) : [{ text: part }]));
    }
    plain = "";
  };
  for (const character of normalizeWrongQuestionPdfText(text)) {
    const script = nativeScripts.get(character);
    if (script) {
      flush();
      const previous = tokens.at(-1);
      if (previous?.text === "" && previous[script.kind]) previous[script.kind] += script.base;
      else tokens.push({ text: "", [script.kind]: script.base });
    } else if (character === "\n") {
      // Preserve explicit lines outside the shared formatter's whitespace repair.
      flush();
      tokens.push({ text: "\n" });
    } else plain += character;
  }
  flush();
  return tokens;
}
