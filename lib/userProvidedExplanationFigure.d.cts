export type UserProvidedFigure = Readonly<{
 id:string; questionId:string; explanationHash:string; replacementRevision:string;
 imageSha256:string; asset:string; sectionTitle:string; alt:string; caption:string;
 exampleNote:string; attribution:string; sourceUrl:string; rightsNotice:string;
}>;
export function userProvidedExplanationFigure(questionId:string,explanationHash:string,replacementRevision:unknown):UserProvidedFigure|null;
