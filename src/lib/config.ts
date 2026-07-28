/** Centralised environment variable access with fail-fast validation */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string = ''): string {
  return process.env[key] ?? defaultValue;
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
  appUrl: () => optional('NEXT_PUBLIC_APP_URL', DEFAULT_APP_URL),
};

/** Client-side configuration (exposed via NEXT_PUBLIC_ prefix) */
export const clientConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL,
};
