import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';
import { BackButton } from '@/components/legal/BackButton';
import { WithdrawalForm } from './WithdrawalForm';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Own title and description, not the root layout's. This page is why the
// problem was noticed: searching the brand on Google returned /withdrawal as
// the second result under the HOMEPAGE's exact title and description, because
// it inherited them unchanged. A withdrawal form presented as the product's
// own landing page is the worst of the set to have shown up that way.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'withdrawal' });
  return {
    title: `${t('title')} — ${brandName(locale)}`,
    description:
      locale === 'de'
        ? 'Widerrufsformular nach § 356a BGB: Vertrag über die Fotoauswahl elektronisch widerrufen, oder formlos per E-Mail oder Brief.'
        : 'Withdrawal form under Sec. 356a BGB: withdraw from the photo selection contract electronically, or informally by email or letter.',
    alternates: {
      canonical: `/${locale}/withdrawal`,
      languages: { en: '/en/withdrawal', de: '/de/withdrawal', 'x-default': '/en/withdrawal' },
    },
  };
}

/**
 * Electronic withdrawal function, § 356a BGB (in force 19 June 2026).
 *
 * Required for every distance contract concluded through an online interface
 * for which a statutory right of withdrawal exists — including one-off
 * purchases. The obligation attaches to the right existing *in principle*, so
 * the fact that it usually expires the moment analysis starts (§ 356 Abs. 5
 * BGB) does not exempt us: those conditions have to be met first, and where
 * they are not, the right runs for up to twelve months and fourteen days.
 *
 * Kept out of the login-protected area on purpose: Abs. 1 wants the function
 * continuously available and easily accessible, and someone who bought and
 * then lost their session must still get here.
 */
export default async function WithdrawalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'withdrawal' });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <BackButton locale={locale} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10 text-zinc-800 dark:text-zinc-200 leading-relaxed">
        <h1 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
        <p className="mb-3 text-sm">{t('intro')}</p>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          {t('alternative')}{' '}
          <Link href={`/${locale}/terms`} className="text-indigo-600 underline">
            {t('termsLink')}
          </Link>
        </p>
        <WithdrawalForm locale={locale} />
        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <BackButton locale={locale} />
        </div>
      </main>
    </div>
  );
}
