-- Beta feedback submitted from the website (results page + floating widget).
--
-- Written server-side from /api/beta with the service-role key and read only by
-- the admin dashboard. The browser never touches this table, so RLS is enabled
-- with NO policies at all: anon/authenticated get nothing, the service role
-- bypasses RLS. Storage is deliberately the primary path — the notification
-- mail is best-effort on top, so a broken mail setup can never lose feedback.

CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message TEXT NOT NULL,
  locale TEXT,
  path TEXT,
  -- Whether the notification mail was accepted by Resend. Lets the dashboard
  -- show a silently broken mail path instead of hiding it.
  emailed BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX feedback_created_at_idx ON public.feedback (created_at DESC);
