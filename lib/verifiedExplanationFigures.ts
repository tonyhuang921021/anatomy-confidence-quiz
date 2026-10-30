import { reviewedImageSource } from '@/lib/reviewedImageSource';

export type VerifiedExplanationFigure = {
  asset: string;
  alt: string;
  caption: string;
  sourceUrl: string;
  attribution: string;
  license: string;
};

// Only independently reviewed, rights-cleared figures may be added here.
// An empty list is honest: missing images are never invented by the model.
const verifiedFigures: Readonly<Record<string, readonly VerifiedExplanationFigure[]>> = {};

export function validVerifiedFigure(figure: VerifiedExplanationFigure): boolean {
  if (!figure.alt.trim() || !figure.caption.trim() || !figure.attribution.trim() || !figure.license.trim()) return false;
  if (!figure.asset.startsWith('/reviewed-explanations/assets/') || !reviewedImageSource(figure.asset, 'https://example.invalid')) return false;
  try { const url = new URL(figure.sourceUrl); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}

export function getVerifiedExplanationFigures(questionId: string): readonly VerifiedExplanationFigure[] {
  return (verifiedFigures[questionId] ?? []).filter(validVerifiedFigure);
}
