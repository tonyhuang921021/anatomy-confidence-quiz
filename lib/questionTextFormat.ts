export type FormattedTextToken = {
  text: string;
  subscript?: string;
  superscript?: string;
};

const splitLeadingWordFixes: Array<[RegExp, string]> = [
  [/\bf\s+ast\b/gi, "fast"],
  [/\bf\s+unny\b/gi, "funny"],
  [/\bg\s+astric\b/gi, "gastric"],
  [/\bp\s+ancreatic\b/gi, "pancreatic"],
  [/\bl\s+ingual\b/gi, "lingual"],
  [/\br\s+eabsorption\b/gi, "reabsorption"],
  [/\bs\s+ecretion\b/gi, "secretion"],
  [/\bf\s+iltration\b/gi, "filtration"],
  [/\ba\s+nabolism\b/gi, "anabolism"],
  [/\bc\s+arbamoyl\b/gi, "carbamoyl"],
  [/\ba\s+spartate\b/gi, "aspartate"],
  [/\bd\s+ihydroorotate\b/gi, "dihydroorotate"],
  [/\bo\s+rotidine\b/gi, "orotidine"],
  [/\bc\s+itrate\b/gi, "citrate"],
  [/\bg\s+lucagon\b/gi, "glucagon"],
  [/\bp\s+almitoyl\b/gi, "palmitoyl"],
  [/\be\s+pinephrine\b/gi, "epinephrine"],
  [/\bc\s+omplex\b/gi, "complex"],
  [/\bg\s+roup\b/gi, "group"],
  [/\ba\s+ngular\b/gi, "angular"],
  [/\bB\s+roca's\b/g, "Broca's"],
  [/\bt\s+ransverse\b/gi, "transverse"],
  [/\bc\s+uneus\b/gi, "cuneus"],
  [/\bC\s+amper's\b/g, "Camper's"],
  [/\bS\s+carpa's\b/g, "Scarpa's"],
  [/\bv\s+itamin\b/gi, "vitamin"]
];

function repairSplitLeadingWords(text: string) {
  return splitLeadingWordFixes.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, text);
}

export function normalizeQuestionText(text: string) {
  const normalized = repairSplitLeadingWords(text);

  return normalized
    .replaceAll("", "酶")
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/gu, "$1$2")
    .replace(/下\s*2\s*列/g, "下列")
    .replace(/\bS\s+A\s+node\b/gi, "SA node")
    .replace(/\bA\s+V\s+node\b/gi, "AV node")
    .replace(/\bI\s+F\s*([123])\b/g, "IF$1")
    .replace(/\be\s+IF\s*([123])\b/g, "eIF$1")
    .replace(/\bF\s+ADH\b/g, "FADH")
    .replace(/\bFADH\s+2\b/g, "FADH2")
    .replace(/\bFADH\s+藉由/g, "FADH2 藉由")
    .replace(/\bFADH\s+只能攜帶一個電子\s+2\b/g, "FADH2 只能攜帶一個電子")
    .replace(/\bFADH\s+高\s+2\b/g, "FADH2 高")
    .replace(/氧分子（O\s*）/g, "氧分子（O2）")
    .replace(/氧\s*2\s*2\s*分子/g, "氧（O2）分子")
    .replace(/（NH\s*\+）\s*4/g, "（NH4+）")
    .replace(/（NH\s*\+）/g, "（NH4+）")
    .replace(/\bNH\s*\+\s*4\b/g, "NH4+")
    .replace(/\bNH\s*\+（/g, "NH4+（")
    .replace(/\bHCO\s*-\s*3\b/g, "HCO3-")
    .replace(/\bHCO3\s*−/g, "HCO3-")
    .replace(/\bHPO\s*2-\s*4\b/g, "HPO4 2-")
    .replace(/\bHPO4\s*2−/g, "HPO4 2-")
    .replace(/\bC\s+H\s+COO-\s*3\s*7\b/g, "C3H7COO-")
    .replace(/\bC3H7COO\s*−/g, "C3H7COO-")
    .replace(/\bNH\s+3\b/g, "NH3")
    .replace(/\bH\s+2\s+O\s+2\b/g, "H2O2")
    .replace(/\bH\s+2\s+O\b/g, "H2O")
    .replace(/\b(PaCO|PACO|PaO|SaO|SpO|FADH|QH|CO|O)\s+2\b/g, "$12")
    .replace(/\bFe\s*2\s*\+/g, "Fe2+")
    .replace(/\bH\s+\+/g, "H+")
    .replace(/\b(vitamin\s+B)\s+(6|12)\b/gi, "$1$2")
    .replace(/\b(vitamin\s+D)\s+(3)\b/gi, "$1$2")
    .replace(/\b(T)\s+(3|4)\b/g, "$1$2")
    .replace(/\b(L)\s*[–-]\s*type\b/gi, "$1-type")
    .replace(/尿素\s+4\s*（urea）/gi, "尿素（urea）")
    .replace(/粒線體\s+4\s*（mitochondria）/gi, "粒線體（mitochondria）")
    .replace(/肝臟的\s+4\s*過氧化體/g, "肝臟的過氧化體")
    .replace(/隨後\s+4\s*再經/g, "隨後再經")
    .replace(/\b(\d)\s+(\d)(?=\d|\s*(?:mL|L|dL|g|mg|mmHg|mEq|IU|U|%|％)\b)/g, "$1$2")
    .replace(/\b(CO|O|HCO|H|N|NO|SO|SiO)\s+(\d)(?=\b|[-+])/g, "$1$2")
    .replace(/\bO\s+bound\s+to\s+hemoglobin\b/gi, "O2 bound to hemoglobin")
    .replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, "$1$2")
    .replace(/\bV\s+下降，K\s+下降\s+max\s+M\b/g, "Vmax 下降，KM 下降")
    .replace(/\bV\s+不變，K\s+下降\s+max\s+M\b/g, "Vmax 不變，KM 下降")
    .replace(/\bV\s+下降，K\s+上升\s+max\s+M\b/g, "Vmax 下降，KM 上升")
    .replace(/\bV\s+不變，K\s+上升\s+max\s+M\b/g, "Vmax 不變，KM 上升")
    .replace(/\bV\s+max\b/g, "Vmax")
    .replace(/\bK\s+M\b/g, "KM")
    .replace(/\bV\s+0\b/g, "V0");
}

function withScripts(text: string, subscript?: string, superscript?: string): FormattedTextToken {
  const token: FormattedTextToken = { text };
  if (subscript) token.subscript = subscript;
  if (superscript) token.superscript = superscript;
  return token;
}

function formatScriptToken(value: string): FormattedTextToken[] {
  const compactValue = value.replace(/\s+/g, "");

  if (compactValue === "Vmax") return [withScripts("V", "max")];
  if (compactValue === "KM" || compactValue === "Km") return [withScripts("K", compactValue.slice(1))];
  if (compactValue === "V0") return [withScripts("V", "0")];
  if (compactValue === "kcat") return [withScripts("k", "cat")];
  if (compactValue === "HCO3-") return [withScripts("HCO", "3", "-")];
  if (compactValue === "HPO42-") return [withScripts("HPO", "4", "2-")];
  if (compactValue === "NH4+") return [withScripts("NH", "4", "+")];
  if (compactValue === "C3H7COO-") {
    return [withScripts("C", "3"), withScripts("H", "7"), withScripts("COO", undefined, "-")];
  }
  if (compactValue === "H2O2") return [withScripts("H", "2"), withScripts("O", "2")];
  if (compactValue === "H2O") return [withScripts("H", "2"), { text: "O" }];
  if (compactValue === "FADH2") return [withScripts("FADH", "2")];
  if (compactValue === "QH2") return [withScripts("QH", "2")];
  if (compactValue === "PACO2") return [withScripts("PACO", "2")];
  if (compactValue === "PaCO2") return [withScripts("PaCO", "2")];
  if (compactValue === "PaO2") return [withScripts("PaO", "2")];
  if (compactValue === "SaO2") return [withScripts("SaO", "2")];
  if (compactValue === "SpO2") return [withScripts("SpO", "2")];
  if (compactValue === "CO2") return [withScripts("CO", "2")];
  if (compactValue === "O2") return [withScripts("O", "2")];
  if (compactValue === "NH3") return [withScripts("NH", "3")];
  if (compactValue === "Fe2+") return [withScripts("Fe", undefined, "2+")];
  if (compactValue === "H+") return [withScripts("H", undefined, "+")];
  if (compactValue === "B12") return [withScripts("B", "12")];
  if (compactValue === "B6") return [withScripts("B", "6")];
  if (compactValue === "D3") return [withScripts("D", "3")];
  if (compactValue === "T4") return [withScripts("T", "4")];
  if (compactValue === "T3") return [withScripts("T", "3")];

  return [{ text: value }];
}

export function tokenizeQuestionText(text: string): FormattedTextToken[] {
  const normalized = normalizeQuestionText(text);
  const pattern =
    /(C3H7COO-|HPO4\s*2-|HCO3-|NH4\+|H2O2|H2O|FADH2|QH2|PACO2|PaCO2|PaO2|SaO2|SpO2|CO2|O2|NH3|Fe2\+|H\+|B12|B6|D3|T4|T3|Vmax|KM|Km|V0|kcat)/g;
  const tokens: FormattedTextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: normalized.slice(lastIndex, match.index) });
    }

    tokens.push(...formatScriptToken(match[0]));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    tokens.push({ text: normalized.slice(lastIndex) });
  }

  return tokens;
}
