-- Beta grant: the free allowance a tester unlocks instead of paying.
--
-- During the beta the paid tiers are not buyable. Clicking one opens an offer
-- instead: the tester registers, gives feedback, and gets that tier's photo
-- allowance once, for free. See the pricing page and /api/beta/unlock.
--
-- Why the granted amount is stored and not just the tier: the tier configs are
-- code (src/lib/stripe/prices.ts) and will move. What we promised a tester on
-- the day they unlocked must not change retroactively because we later
-- repriced a tier.
--
-- One grant per account, ever — not one per tier. Otherwise a tester collects
-- S, then M, then L and walks away with the sum of all three.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_grant_tier TEXT
    CHECK (beta_grant_tier IN ('small', 'medium', 'large')),
  ADD COLUMN IF NOT EXISTS beta_grant_photos INTEGER,
  ADD COLUMN IF NOT EXISTS beta_grant_at TIMESTAMPTZ;

-- `beta_grant_at IS NULL` is the gate the unlock endpoint checks. Partial index
-- because the interesting rows are the few that have one.
CREATE INDEX IF NOT EXISTS profiles_beta_grant_idx
  ON public.profiles (beta_grant_at)
  WHERE beta_grant_at IS NOT NULL;

-- Marks a job as running on a beta grant rather than on a payment. Needed at
-- analysis time: a granted job may exceed the per-IP daily photo cap, which
-- exists to protect the free-beta budget from runaway traffic and would
-- otherwise refuse the very allowance we just promised (the cap is 750/day,
-- the smallest grant is 1,000).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS beta_grant BOOLEAN NOT NULL DEFAULT FALSE;
