-- Keep stale browser sync bursts from occupying DB workers for too long during peaks.
-- Client sync already preserves local/pending records when a cloud request times out.
alter role authenticated set statement_timeout = '5s';
