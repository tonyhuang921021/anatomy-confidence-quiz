export const ALL_PHARMACOLOGY_LIBRARY_SCOPES = "全部範圍" as const;

export type PharmacologyLibraryIndexItem = {
  id: string;
  name: string;
  aliases: string[];
  scopes: string[];
  categories: string[];
  level: string | null;
  batch: string;
  directExamCount: number;
  mentionExamCount: number;
  searchText: string;
};

export type PharmacologyLibraryIndex = {
  generatedAt: string;
  total: number;
  scopes: string[];
  drugs: PharmacologyLibraryIndexItem[];
};

export type PharmacologyLibrarySource = {
  sourceId: string;
  title: string;
  publisher: string | null;
  url: string;
  locator: string | null;
};

export type PharmacologyLibraryStatement = {
  text: string;
  sourceIds: string[];
  scope?: string | null;
  detail?: string | null;
};

export type PharmacologyLibraryDrug = {
  id: string;
  name: string;
  aliases: string[];
  scopes: string[];
  categories: Array<{ path: string; sourceIds: string[] }>;
  level: string | null;
  summarySections: Array<{
    key: string;
    label: string;
    items: PharmacologyLibraryStatement[];
  }>;
  mnemonics: Array<{
    segmentId: string;
    text: string;
    sourceIds: string[];
  }>;
  detailGroups: Array<{
    key: string;
    label: string;
    statements: PharmacologyLibraryStatement[];
  }>;
  exams: Array<{
    id: string;
    period: string;
    questionNo: number;
    subject: string;
    relation: string;
    verificationStatus: "verified_exam_target" | "verified_mention";
    questionUrl: string | null;
    answerUrl: string | null;
    amendedAnswerUrl: string | null;
  }>;
  sources: PharmacologyLibrarySource[];
};

export type PharmacologyLibraryBatch = {
  batch: string;
  drugs: PharmacologyLibraryDrug[];
};

export function normalizePharmacologyLibraryQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-Hant");
}

export function filterPharmacologyLibraryItems(
  items: readonly PharmacologyLibraryIndexItem[],
  query: string,
  scope: string
) {
  const normalizedQuery = normalizePharmacologyLibraryQuery(query);

  return items.filter((item) => {
    if (scope !== ALL_PHARMACOLOGY_LIBRARY_SCOPES && !item.scopes.includes(scope)) return false;
    if (!normalizedQuery) return true;
    return normalizePharmacologyLibraryQuery(item.searchText).includes(normalizedQuery);
  });
}
