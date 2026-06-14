-- PicCurate Initial Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ── Profiles (extends Supabase Auth users) ──────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'de')),
  free_tier_used BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, locale)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'locale', 'en'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Jobs ────────────────────────────────────────────────────────

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'uploading', 'analyzing', 'selecting', 'ready', 'expired', 'failed')),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'small', 'medium', 'large')),
  photo_count INTEGER NOT NULL DEFAULT 0,
  photo_limit INTEGER NOT NULL,
  stripe_session_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'free')),
  criteria JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);

-- ── Photos ──────────────────────────────────────────────────────

CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL,
  original_width INTEGER,
  original_height INTEGER,
  file_size_bytes BIGINT,
  taken_at TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  camera_make TEXT,
  camera_model TEXT,
  orientation INTEGER,
  -- AI analysis results
  aesthetic_score SMALLINT,
  sharpness_score SMALLINT,
  face_count SMALLINT DEFAULT 0,
  faces_eyes_open BOOLEAN,
  faces_expression TEXT,
  has_animal BOOLEAN DEFAULT FALSE,
  animal_clarity SMALLINT,
  animal_proximity SMALLINT,
  scene_type TEXT,
  content_tags TEXT[],
  phash TEXT,
  -- Selection results
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  reason_tag TEXT,
  selection_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Photos are accessed through their parent job
CREATE POLICY "Users can read own photos"
  ON public.photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photos to own jobs"
  ON public.photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own photos"
  ON public.photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()
    )
  );

CREATE INDEX idx_photos_job_id ON public.photos(job_id);
CREATE INDEX idx_photos_selected ON public.photos(job_id, selected);
CREATE INDEX idx_photos_phash ON public.photos(phash) WHERE phash IS NOT NULL;

-- ── Updated-at trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
