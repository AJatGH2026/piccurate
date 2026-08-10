import type { Metadata } from 'next';
import { brandName } from '@/lib/brand';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { GoogleTag } from '@/components/analytics/GoogleTag';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { FeedbackWidget } from '@/components/beta/FeedbackWidget';
import { Footer } from '@/components/layout/Footer';
import { routing } from '../../../i18n/routing';
import { clientConfig } from '@/lib/config';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Only 'en'/'de' are valid locales. Reject anything else (e.g. scanner paths
// like /admin.php) with a clean 404 BEFORE any locale-consuming code runs —
// otherwise an invalid segment reaches an Intl API and throws
// `RangeError: Incorrect locale information` (a 500 instead of a 404).
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  // Defense-in-depth: generateMetadata runs independently of the component
  // guard below, so validate here too before calling getTranslations/Intl.
  if (!routing.locales.includes(locale as 'en' | 'de')) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL(clientConfig.appUrl),
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: brandName(locale),
      locale,
      type: 'website',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as 'en' | 'de')) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <NextIntlClientProvider messages={messages}>
          {children}
          {/* Every page, not just the landing page: § 356a Abs. 1 BGB wants the
              withdrawal function continuously available and easily accessible
              for the whole withdrawal period. */}
          <Footer locale={locale} />
          {/* Inside the intl provider — these use useTranslations. */}
          <ConsentBanner />
          <FeedbackWidget />
        </NextIntlClientProvider>
        {/* Vercel Web Analytics — cookieless page-view + funnel data.
            Only fires on production builds under a Vercel deployment;
            a no-op locally. Enable in the Vercel dashboard (Analytics tab). */}
        <Analytics />
        {/* Google tag (GA4 + Ads) with Consent Mode v2 — dormant until
            NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_GOOGLE_ADS_ID are set. No i18n. */}
        <GoogleTag />
      </body>
    </html>
  );
}
