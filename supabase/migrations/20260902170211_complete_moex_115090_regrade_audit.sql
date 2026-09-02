-- Complete the audit marker for revised questions whose correctness did not change.
-- Rows already backed up by the main regrade migration are left untouched.

update public.quiz_session_attempts
set is_correct_before_revision = is_correct,
    answer_key_revision = 'moex-115090-appeal-v1'
where question_id in (
    'MOEX-115090-1301-Q063',
    'MOEX-115090-1301-Q066',
    'MOEX-115090-2301-Q014',
    'MOEX-115090-2301-Q025',
    'MOEX-115090-2301-Q055',
    'MOEX-115090-2301-Q068',
    'MOEX-115090-2301-Q095',
    'MOEX-115090-2301-Q098'
  )
  and answer_key_revision is distinct from 'moex-115090-appeal-v1';
