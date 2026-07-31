-- Update handle_new_user to also persist gdpr_consent_at from signup metadata.
-- Run this if you already applied 001_initial_schema.sql.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, locale, gdpr_consent_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en'),
    CASE
      WHEN NEW.raw_user_meta_data->>'gdpr_consent_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'gdpr_consent_at')::TIMESTAMPTZ
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
