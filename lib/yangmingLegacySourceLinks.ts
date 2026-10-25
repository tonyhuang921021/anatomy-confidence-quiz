import sourceLinks from "../data/sources/yangming_98_99_source_links.json";

const byId = new Map(sourceLinks.questions.map((item) => [item.questionId, item]));

export function getYangmingLegacySourceLink(questionId: string) {
  const question = byId.get(questionId);
  if (!question) return null;
  return {
    ...question,
    sourceUrl: sourceLinks.sourceUrl,
    bookUrl: sourceLinks.bookUrl,
    errataUrl: sourceLinks.errataUrl
  };
}
