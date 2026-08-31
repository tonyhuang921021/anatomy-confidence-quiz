export const PHARMACOLOGY_REVIEW_SCOPES = [
  "神經／精神",
  "心臟",
  "腸胃道",
  "胸腔／呼吸",
  "內分泌／代謝",
  "感染",
  "血液／腫瘤",
  "風濕／免疫",
  "自泌素／發炎",
  "麻醉／止痛",
  "毒物",
  "泌尿"
] as const;

export const ALL_PHARMACOLOGY_REVIEW_SCOPE = "全部藥物" as const;

export type PharmacologyReviewScope =
  | typeof ALL_PHARMACOLOGY_REVIEW_SCOPE
  | (typeof PHARMACOLOGY_REVIEW_SCOPES)[number];

type PharmacologyReviewCardLike = {
  category: string;
};

const ROOT_SCOPE_MAP: Readonly<Record<string, (typeof PHARMACOLOGY_REVIEW_SCOPES)[number]>> = {
  "神經/精神科": "神經／精神",
  心臟科: "心臟",
  腸胃科: "腸胃道",
  胸腔科: "胸腔／呼吸",
  "內分泌/新陳代謝": "內分泌／代謝",
  感染科: "感染",
  血液腫瘤科: "血液／腫瘤",
  風濕免疫科: "風濕／免疫",
  自泌素: "自泌素／發炎",
  麻醉科: "麻醉／止痛",
  毒物學: "毒物"
};

const MIXED_ROOT_SCOPE_MAP: Readonly<
  Record<string, readonly (typeof PHARMACOLOGY_REVIEW_SCOPES)[number][]>
> = {
  "自泌素/腸胃": ["自泌素／發炎", "腸胃道"],
  "泌尿/膽鹼拮抗": ["泌尿", "神經／精神"],
  "麻醉科/毒物學": ["麻醉／止痛", "毒物"],
  "泌尿科/毒物學": ["泌尿", "毒物"],
  "風濕免疫/腫瘤": ["血液／腫瘤"]
};

const REVIEW_SCOPE_SET = new Set<PharmacologyReviewScope>([
  ALL_PHARMACOLOGY_REVIEW_SCOPE,
  ...PHARMACOLOGY_REVIEW_SCOPES
]);

export function normalizePharmacologyReviewScope(value: unknown): PharmacologyReviewScope {
  return typeof value === "string" && REVIEW_SCOPE_SET.has(value as PharmacologyReviewScope)
    ? (value as PharmacologyReviewScope)
    : ALL_PHARMACOLOGY_REVIEW_SCOPE;
}

export function getPharmacologyReviewScopes(category: string) {
  const root = category.normalize("NFKC").split(">")[0]?.trim() ?? "";
  const mixedScopes = MIXED_ROOT_SCOPE_MAP[root];
  if (mixedScopes) return mixedScopes;

  const scope = ROOT_SCOPE_MAP[root];
  return scope ? ([scope] as const) : ([] as const);
}

export function getPharmacologyReviewCardIndexes(
  cards: readonly PharmacologyReviewCardLike[],
  scope: PharmacologyReviewScope
) {
  if (scope === ALL_PHARMACOLOGY_REVIEW_SCOPE) {
    return cards.map((_, index) => index);
  }

  return cards.flatMap((card, index) =>
    getPharmacologyReviewScopes(card.category).includes(scope) ? [index] : []
  );
}
