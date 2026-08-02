/** Centralised environment variable access with fail-fast validation */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Deliberately truthiness, not `??`: an env var that exists with an EMPTY value
// is the common real-world case (a key left blank in a dashboard, or a
// placeholder written by `vercel env pull` for a sensitive variable). `??` only
// catches undefined and would hand that empty string straight through.
function optional(key: string, defaultValue: string = ''): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * A base URL that `new URL()` accepts. Anything else — empty, no scheme, a bare
 * hostname — falls back rather than throwing, because the value ends up in
 * `metadataBase` and a bad one fails the whole production build at prerender
 * time, not at request time where it would be obvious.
 */
function appUrlOrDefault(raw: string | undefined, fallback: string): string {
  if (!raw || raw.trim() === '') return fallback;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw.trim() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Canonical base URL. NEXT_PUBLIC_APP_URL wins when set, but we fall back to the
 * leading production domain so metadataBase/canonical/hreflang/sitemap stay
 * correct even if the Vercel env var is missing. Dev falls back to localhost.
 * (NODE_ENV is 'production' during `next build` on Vercel; the value is inlined
 * into the client bundle at build time.)
 */
const DEFAULT_APP_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://shortlistbuddy.com'
    : 'http://localhost:3000';

/** Server-side configuration (not exposed to the browser) */
export const serverConfig = {
  // Supabase
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  // Anthropic
  anthropicApiKey: () => required('ANTHROPIC_API_KEY'),
  anthropicModel: () => optional('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),

  // Stripe
  stripeSecretKey: () => required('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => required('STRIPE_WEBHOOK_SECRET'),

  // Storage
  storageProvider: () => optional('STORAGE_PROVIDER', 'local') as 'local' | 'r2',
  r2AccountId: () => optional('R2_ACCOUNT_ID'),
  r2AccessKeyId: () => optional('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: () => optional('R2_SECRET_ACCESS_KEY'),
  r2BucketName: () => optional('R2_BUCKET_NAME', 'piccurate-thumbnails'),

  // Email
  emailProvider: () => optional('EMAIL_PROVIDER', 'mock') as 'mock' | 'resend',
  resendApiKey: () => optional('RESEND_API_KEY'),

  // App
  appUrl: () => appUrlOrDefault(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL),
};

/** Client-side configuration (exposed via NEXT_PUBLIC_ prefix) */
export const clientConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  appUrl: appUrlOrDefault(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL),
};
