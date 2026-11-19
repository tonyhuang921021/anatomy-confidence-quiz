import source from "../data/sources/yangming_1152_source_links.json";
const byId = new Map(source.questions.map(row => [row.questionId, row]));
export function getYangming1152SourceLink(questionId: string) {
  return byId.get(questionId) ?? null;
}
