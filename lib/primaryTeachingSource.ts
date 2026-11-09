import type {Question} from '@/types/quiz';
import {uncertainTeachingSource,reviewedTeachingFingerprint} from '@/lib/trustedRelatedContext';

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
  // Official question, standard key and the correction list were checked on
  // 2026-11-09: Q90 = D, with no correction. This exact content is safe despite
  // the empty imported official_answer_note. Never waive that flag globally.
  // Sources: wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx
  // Q/S: t=Q or S&code=110020&c=301&s=11&q=1; corrections: t=A&code=110020.
  const verifiedOfficialNote = question.sourceType === 'MOEX_PAST_EXAM'
    && question.id === 'MOEX-110020-1301-Q090'
    && Array.isArray(flags) && flags.length === 1 && flags[0] === 'official_answer_note'
    && reviewedTeachingFingerprint(question) === 'cf3354c45a79402ea99450950eff6847acedc2f9ba0a24c01676fa27b46bcf19';
  return uncertainTeachingSource(classificationOnly || verifiedOfficialNote
    ? {...question, needsHumanReview: false}
    : question);
}
