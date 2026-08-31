-- Job ownership handshake for the download gate's LOGIN path.
--
-- review-notes.md point 1: the analysis runs anonymously, and the download
-- gate has two ways to get an address for it — Register (updateUser on the
-- SAME anonymous account, same user_id, job stays attached automatically) and
-- Login (signInWithPassword REPLACES the session with a different, existing
-- account). The job's user_id is still the old anonymous id after a login, so
-- POST /api/jobs/[jobId]/confirmation 404s (RLS + the explicit ownership
-- check both see a mismatch) and the § 312f confirmation mail never goes out
-- for anyone who returns via Login instead of Register.
--
-- Fix is a short-lived, single-use claim token, not a direct ownership
-- transfer at login time: at the moment of the request there is no server-side
-- way to learn the target account's user_id without ALREADY switching the
-- session to it (signInWithPassword is the only credential-check available,
-- and it does both at once). So: while still anonymous — session demonstrably
-- owns the job — the client requests a token; after signInWithPassword swaps
-- the session, the client redeems it, and the server (service role, since the
-- authenticated user does not own the row yet — RLS would otherwise block
-- exactly the UPDATE this needs) transfers user_id and clears the token in the
-- same statement, so it cannot be redeemed twice.
--
-- NULL/expired means "not claimable" — every pre-existing row already reads
-- that way, so no backfill needed.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ;

-- Looked up by token value (not by id) when redeeming, so an index on the
-- token itself is the one that matters; NULL tokens (the overwhelming
-- majority of rows, always) are excluded so the index stays small.
CREATE INDEX IF NOT EXISTS jobs_claim_token_idx
  ON public.jobs (claim_token)
  WHERE claim_token IS NOT NULL;
