-- Narrow what the signed-in role can write directly, part two (after 010).
--
-- The app writes these tables on the server or through charge_job_photos; the
-- browser-side roles keep only what the running app does as the user:
--   jobs:       UPDATE (status)
--   profiles:   UPDATE (display_name, locale)        -- unchanged from 010
--   photos:     nothing (no code path writes or reads it any more)
--   job_photos: SELECT only (rows are written by charge_job_photos)
--
-- Deploy order: the code first (it works with both the old and the new rules),
-- this migration second. A rollback is at the bottom.
--
-- One transaction: if any statement fails, nothing is changed.

BEGIN;

-- 1. photos: the routes that filled this table were removed. Reading own rows
--    stays possible; writing does not.
REVOKE ALL ON public.photos FROM anon, authenticated;
GRANT SELECT ON public.photos TO authenticated;
DROP POLICY IF EXISTS "Users can insert photos to own jobs" ON public.photos;
DROP POLICY IF EXISTS "Users can update own photos" ON public.photos;

-- 2. job_photos: written only inside charge_job_photos, which runs with the
--    owner's rights (010) and checks ownership itself.
REVOKE ALL ON public.job_photos FROM anon, authenticated;
GRANT SELECT ON public.job_photos TO authenticated;
DROP POLICY IF EXISTS "Users can insert photo refs to own jobs" ON public.job_photos;

-- 3. jobs: the claim token is issued by the server now, and nothing writes
--    criteria as the user any more. Status stays (the analysis route advances
--    it with the caller's session).
REVOKE UPDATE ON public.jobs FROM anon, authenticated;
GRANT UPDATE (status) ON public.jobs TO authenticated;

-- 4. profiles.display_name is the one free-text column a user may still write.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 100);

-- 5. Rights no browser-side role has a use for. Row-level security does not
--    cover TRUNCATE, so it is taken away outright; feedback is written and read
--    by the server only (003).
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.jobs, public.profiles, public.photos, public.job_photos
  FROM anon, authenticated;
REVOKE ALL ON public.feedback FROM anon, authenticated;

-- 6. charge_job_photos: same logic as in 010, with the arguments bounded. The
--    function is callable by any signed-in session, so it does not take the
--    batch size, the id format or the retry factor on trust.
CREATE OR REPLACE FUNCTION public.charge_job_photos(
  p_job_id UUID,
  p_refs TEXT[],
  p_files INTEGER,
  p_factor INTEGER
)
RETURNS TABLE (r_status TEXT, r_charged INTEGER, r_count INTEGER, r_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER;
  v_submitted INTEGER;
  v_count INTEGER;
  v_new TEXT[];
  v_factor INTEGER;
BEGIN
  SELECT j.photo_limit, COALESCE(j.submitted_count, j.photo_count)
    INTO v_limit, v_submitted
    FROM public.jobs j
    WHERE j.id = p_job_id
      AND j.user_id = auth.uid()
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, 0, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count FROM public.job_photos WHERE job_id = p_job_id;

  -- One request carries at most 250 photos (BETA_MAX_PHOTOS_PER_REQUEST).
  IF p_files IS NULL OR p_files < 1 OR p_files > 250 THEN
    RETURN QUERY SELECT 'exhausted'::TEXT, 0, v_count, v_limit;
    RETURN;
  END IF;

  -- The factor is a ceiling on retries; a caller cannot widen it. 3 matches
  -- SUBMISSION_ALLOWANCE_FACTOR in the analysis route — raise both together.
  v_factor := LEAST(GREATEST(COALESCE(p_factor, 1), 1), 3);

  -- Ids must be one per file and short (the client sends uuids). Anything else
  -- is treated like "no ids": every file is charged.
  IF p_refs IS NOT NULL AND (
       COALESCE(array_length(p_refs, 1), 0) <> p_files
       OR EXISTS (
         SELECT 1 FROM unnest(p_refs) AS r
         WHERE r IS NULL OR char_length(r) < 1 OR char_length(r) > 64
       )
     ) THEN
    p_refs := NULL;
  END IF;

  IF p_refs IS NULL THEN
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

  IF v_submitted + p_files > v_limit * v_factor THEN
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

REVOKE ALL ON FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) TO authenticated;

COMMIT;

-- ROLLBACK (only if something legitimate breaks):
--   GRANT INSERT, UPDATE ON public.photos TO authenticated;
--   CREATE POLICY "Users can insert photos to own jobs" ON public.photos FOR INSERT
--     WITH CHECK (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()));
--   CREATE POLICY "Users can update own photos" ON public.photos FOR UPDATE
--     USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()));
--   GRANT INSERT ON public.job_photos TO authenticated;
--   CREATE POLICY "Users can insert photo refs to own jobs" ON public.job_photos FOR INSERT
--     WITH CHECK (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_photos.job_id AND jobs.user_id = auth.uid()));
--   GRANT UPDATE (status, criteria, claim_token, claim_token_expires_at) ON public.jobs TO authenticated;
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_length;
--   -- and re-run the charge_job_photos definition from 010.
