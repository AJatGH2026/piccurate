-- Allowance accounting as a real pot: atomic charging, one grant job per account.
--
-- Background (2026-09-30). A beta grant / paid tier is a pot of photos that a
-- job holds for 30 days and that several sessions draw from. Two things in the
-- old accounting could not carry that:
--
-- 1. /api/analyze-demo read jobs.photo_count and wrote back `photo_count +
--    charge`. The client sends up to 5 batches in parallel, so concurrent
--    batches each read the same value and the last write won: the counter
--    under-counted, and a second device on the same account made it worse.
--    `charge_job_photos` does the whole step in one transaction, under a row
--    lock on the job, and derives photo_count from job_photos (the truth).
--
-- 2. Nothing stopped one account from creating any number of grant jobs, each
--    with the full allowance. The partial unique index below makes "one grant,
--    one job" a database fact, so two devices creating one at the same moment
--    cannot both win.
--
-- Deliberately SECURITY INVOKER: it runs as the caller, so the existing RLS
-- policies on jobs/job_photos still decide who may charge which job.

CREATE OR REPLACE FUNCTION public.charge_job_photos(
  p_job_id UUID,
  p_refs TEXT[],          -- client photo ids for this batch; NULL = charge every file
  p_files INTEGER,        -- number of files in the batch (also the submission count)
  p_factor INTEGER        -- SUBMISSION_ALLOWANCE_FACTOR
)
RETURNS TABLE (r_status TEXT, r_charged INTEGER, r_count INTEGER, r_limit INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_submitted INTEGER;
  v_count INTEGER;
  v_new TEXT[];
BEGIN
  -- Row lock: concurrent batches of the same job queue up here instead of
  -- reading the same counter. RLS applies, so a foreign job simply isn't found.
  SELECT j.photo_limit, COALESCE(j.submitted_count, j.photo_count)
    INTO v_limit, v_submitted
    FROM public.jobs j
    WHERE j.id = p_job_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count FROM public.job_photos WHERE job_id = p_job_id;

  IF p_refs IS NULL THEN
    -- No usable ids (older client, direct caller): charge every file. The
    -- conservative direction, so omitting ids never buys a bigger allowance.
    SELECT ARRAY(SELECT gen_random_uuid()::TEXT FROM generate_series(1, p_files)) INTO v_new;
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT r FROM unnest(p_refs) AS r
      WHERE NOT EXISTS (
        SELECT 1 FROM public.job_photos jp WHERE jp.job_id = p_job_id AND jp.photo_ref = r
      )
    ) INTO v_new;
  END IF;

  IF v_count + COALESCE(array_length(v_new, 1), 0) > v_limit THEN
    RETURN QUERY SELECT 'exhausted'::TEXT, 0, v_count, v_limit;
    RETURN;
  END IF;

  -- Ceiling on total work however the ids repeat (see SUBMISSION_ALLOWANCE_FACTOR).
  IF v_submitted + p_files > v_limit * p_factor THEN
    RETURN QUERY SELECT 'exhausted'::TEXT, 0, v_count, v_limit;
    RETURN;
  END IF;

  IF COALESCE(array_length(v_new, 1), 0) > 0 THEN
    INSERT INTO public.job_photos (job_id, photo_ref)
      SELECT p_job_id, r FROM unnest(v_new) AS r
      ON CONFLICT DO NOTHING;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count FROM public.job_photos WHERE job_id = p_job_id;

  UPDATE public.jobs
    SET photo_count = v_count,
        submitted_count = v_submitted + p_files,
        status = 'analyzing'
    WHERE id = p_job_id;

  RETURN QUERY SELECT 'ok'::TEXT, COALESCE(array_length(v_new, 1), 0), v_count, v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) TO authenticated;

-- Internal test grants created before this model existed: they could own any
-- number of grant jobs. Reset them so the unique index below can be created;
-- the affected (internal) accounts can unlock again. Product-owner decision, 2026-09-30.
UPDATE public.jobs SET beta_grant = FALSE WHERE beta_grant;
UPDATE public.profiles
  SET beta_grant_tier = NULL, beta_grant_photos = NULL, beta_grant_at = NULL
  WHERE beta_grant_at IS NOT NULL;

-- One grant, one job — per account, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_grant_job_per_user
  ON public.jobs (user_id)
  WHERE beta_grant;
