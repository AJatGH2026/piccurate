-- Count a job's allowance by DISTINCT photos, not by photos submitted.
--
-- Reported 2026-08-29: an analysis of 249 photos was interrupted after 100
-- (saving the contract confirmation on iOS aborted the in-flight requests, see
-- components/legal/ContractConfirmation.tsx). Retrying the remainder then hit
-- "job exhausted": /api/analyze-demo reserved photo_count += files.length
-- before calling Gemini, so the first attempt had already consumed the quota
-- for photos whose results never reached the browser. With 249 of a 250 limit
-- there is no headroom, and the run became unrecoverable.
--
-- Recording which photos a job has already been charged for makes a retry of
-- the same photos free, which is what the user expects from "you can catch up
-- on the rest later".
--
-- What is stored: photo_ref, the client-side uuidv4 that useUpload assigns to
-- each photo in the browser. It is random and carries nothing about the image
-- — no filename, no bytes, no analysis result — so this does NOT widen what
-- /api/analyze-demo persists beyond the counter it already kept (see the
-- pass-through guarantee in the 2026-08-19 job/payment investigation). It
-- rides the job's own lifetime via ON DELETE CASCADE.
CREATE TABLE public.job_photos (
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The composite key IS the deduplication: re-submitting a photo conflicts
  -- instead of being charged twice.
  PRIMARY KEY (job_id, photo_ref)
);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Same shape as the photos policies: reachable only through a job the caller
-- owns. No UPDATE policy — a charge record is written once and never edited.
CREATE POLICY "Users can read photo refs of own jobs"
  ON public.job_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_photos.job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photo refs to own jobs"
  ON public.job_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_photos.job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE INDEX idx_job_photos_job_id ON public.job_photos(job_id);

-- Cumulative photos SUBMITTED, as opposed to photo_count which now means
-- distinct photos charged. Counting distinct photos alone would let a caller
-- re-use the same ids for different images and analyse without limit; this
-- keeps a ceiling on total work per job (see SUBMISSION_ALLOWANCE_FACTOR in
-- /api/analyze-demo) while leaving honest retries free.
ALTER TABLE public.jobs
  ADD COLUMN submitted_count INTEGER NOT NULL DEFAULT 0;

-- Existing jobs: everything charged so far was also submitted, so seeding the
-- new counter from photo_count keeps them consistent rather than handing them
-- a fresh ceiling.
UPDATE public.jobs SET submitted_count = photo_count;
