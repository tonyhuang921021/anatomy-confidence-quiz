-- PostgREST connects as authenticator before switching request roles.
-- Keep stale direct REST sync requests from holding pooled DB workers too long.
alter role authenticator set statement_timeout = '5s';
alter role authenticator set lock_timeout = '5s';
notify pgrst, 'reload config';
