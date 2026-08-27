-- § 312f BGB confirmation: record WHEN it went out, so it goes out exactly once.
--
-- Background (2026-08-27): the confirmation used to be sent from POST /api/jobs
-- and nowhere else. That worked while a permanent account was required before
-- an analysis could run. Since the account gate moved to the ZIP download,
-- most free contracts are concluded by an anonymous visitor we have no address
-- for, so that send is skipped — and the address only turns up later, when the
-- visitor registers to download.
--
-- The mail is therefore sent from two places now (job creation when an address
-- is already known, registration at the download gate otherwise). A column,
-- not a boolean: the timestamp is the evidence of compliance, and "when" is the
-- question anyone auditing this will actually ask.
--
-- NULL means "not sent yet", which is also what every pre-existing row gets.
-- That is deliberate and safe: the only consumer is the send path, which treats
-- NULL as "may send", and an old job whose confirmation did go out is no longer
-- reachable from either trigger anyway (its analysis is long finished).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- Only the owner may read their own job's confirmation state; writes happen
-- through the service role in the API routes, never from the browser.
CREATE INDEX IF NOT EXISTS jobs_confirmation_pending_idx
  ON public.jobs (user_id)
  WHERE confirmation_sent_at IS NULL;
