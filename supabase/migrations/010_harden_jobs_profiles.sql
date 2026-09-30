-- Tighten write access to jobs and profiles.
--
-- Until now the signed-in role could write any column of its own rows in these
-- tables (policies from 001). The allowance columns (limits, payment status,
-- grant, expiry, free-tier flag) are the server's to write, so the user-level
-- permissions are narrowed to what the app legitimately writes as the user:
--   jobs:     status, criteria, claim_token, claim_token_expires_at
--   profiles: display_name, locale (nothing writes them today; harmless)
-- Everything else goes through the service-role client on the server
-- (POST /api/jobs creates the job, /api/beta/unlock writes the grant, the
-- webhook writes payment) or through charge_job_photos below.
--
-- Deploy order: the code first (it works with both the old and the new rules),
-- this migration second. A rollback is at the bottom.

-- 1. The charging function writes photo_count / submitted_count, which the
--    user may no longer touch — so it runs with the owner's rights and checks
--    ownership itself (auth.uid() is still the caller's, also inside).
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

REVOKE ALL ON FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) TO authenticated;

-- 2. jobs: no INSERT, UPDATE only on the columns the app writes as the user.
REVOKE INSERT, UPDATE ON public.jobs FROM anon, authenticated;
GRANT UPDATE (status, criteria, claim_token, claim_token_expires_at) ON public.jobs TO authenticated;

-- 4. The grant job is not deletable by its owner (one grant, one job).
--    Everything else stays deletable.
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id AND NOT beta_grant);

-- 3. profiles: grant and free-tier columns are the server's to write.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, locale) ON public.profiles TO authenticated;

-- ROLLBACK (only if something legitimate breaks; it reopens the holes above):
--   GRANT INSERT, UPDATE ON public.jobs TO authenticated;
--   GRANT UPDATE ON public.profiles TO authenticated;
--   DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
--   CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);
--   -- and, to go back to invoker rights for the function:
--   ALTER FUNCTION public.charge_job_photos(UUID, TEXT[], INTEGER, INTEGER) SECURITY INVOKER;
