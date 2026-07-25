import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { GoogleTag } from '@/components/analytics/GoogleTag';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { FeedbackWidget } from '@/components/beta/FeedbackWidget';
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL(clientConfig.appUrl),
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: 'PicCurate',
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
