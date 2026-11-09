import type {Question} from '@/types/quiz';
import {uncertainTeachingSource} from '@/lib/trustedRelatedContext';

// A misplaced subject label does not make official question text uncertain.
// This exception applies only to explaining the current canonical question.
// Related-question retrieval keeps its existing, stricter source checks.
const CLASSIFICATION_ONLY_FLAGS = new Set([
  'needs_removal_from_anatomy_track',
  'not_strict_anatomy_misclassified',
  'needs_manual_tag_review',
  'classification_corrected_batch10',
  'classification_v4_corrected_from_v2'
]);

export function uncertainPrimaryTeachingSource(question: Question): boolean {
  const flags = question.reviewFlags;
  const classificationOnly = question.sourceType === 'MOEX_PAST_EXAM'
    && Array.isArray(flags) && flags.length > 0
    && flags.every(flag => CLASSIFICATION_ONLY_FLAGS.has(flag));
  return uncertainTeachingSource(classificationOnly
    ? {...question, needsHumanReview: false}
    : question);
}
