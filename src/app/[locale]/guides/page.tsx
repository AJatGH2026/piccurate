import type { Metadata } from 'next';
import { brandName } from '@/lib/brand';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { GUIDES } from '@/content/guides';
import { routing } from '../../../../i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
  return {
    title: `${t('indexTitle')} — ${brandName(locale)}`,
    description: t('indexLead'),
    alternates: {
      canonical: `/${locale}/guides`,
      languages: { en: '/en/guides', de: '/de/guides', 'x-default': '/en/guides' },
    },
  };
}

export default async function GuidesIndex({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });
  const loc = locale === 'de' ? 'de' : 'en';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-xl font-bold text-indigo-600">{brandName(locale)}</Link>
          <Link href={`/${locale}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('backHome')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('indexTitle')}</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">{t('indexLead')}</p>

        <ul className="mt-10 space-y-4">
          {GUIDES.map((g) => {
            const c = g[loc];
            return (
              <li key={g.id}>
                <Link
                  href={`/${locale}/guides/${c.slug}`}
                  className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                >
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{c.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.description}</p>
                  <span className="mt-2 inline-block text-sm font-medium text-indigo-600">{t('readMore')} →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
