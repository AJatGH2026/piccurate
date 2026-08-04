-- Anonymous sign-ins (enabled in the Supabase dashboard 2026-08-04).
--
-- Every visitor gets a real auth user, so a job can always be attached to one
-- and `free_tier_used` keeps working. The beta switch then only decides whether
-- a PERMANENT account is required — there is no second, anonymous code path.
--
-- Two things have to change for that to work at all:
--
-- 1. profiles.email was NOT NULL. Anonymous users have no email, so the
--    on-signup trigger below violated the constraint, the trigger raised, and
--    the anonymous sign-in failed outright.
-- 2. Anonymous users need to be recognisable afterwards — to keep beta traffic
--    out of the real numbers, and to clean them up (they count towards MAU).

ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- Derived from the absence of an email rather than from auth.users.is_anonymous,
-- so this does not depend on that column existing in every Supabase version.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, locale, gdpr_consent_at, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en'),
    CASE
      WHEN NEW.raw_user_meta_data->>'gdpr_consent_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'gdpr_consent_at')::TIMESTAMPTZ
      ELSE NULL
    END,
    NEW.email IS NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- When an anonymous account is upgraded to a real one (Supabase keeps the same
-- user id and fills in the email), carry that over instead of leaving a stale
-- flag behind. Without this, converted users would stay "anonymous" forever and
-- a cleanup job would eventually delete paying customers.
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND OLD.email IS NULL THEN
    UPDATE public.profiles
       SET email = NEW.email, is_anonymous = FALSE, updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_set ON auth.users;
CREATE TRIGGER on_auth_user_email_set
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

CREATE INDEX IF NOT EXISTS profiles_anonymous_idx
  ON public.profiles (is_anonymous, created_at)
  WHERE is_anonymous;
