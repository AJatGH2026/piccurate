import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { brandName } from '@/lib/brand';

/**
 * Site footer — rendered by the locale layout, so it appears on every page.
 *
 * It used to live on the landing page only. § 356a Abs. 1 BGB requires the
 * withdrawal function to be "dauerhaft verfügbar" and easily accessible for the
 * whole withdrawal period, and a link that exists only on the home page is
 * neither. The other legal links benefit from the same treatment.
 */
export function Footer({ locale }: { locale: string }) {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
        <div>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{brandName(locale)}</span>{' '}
          &mdash; {t('tagline')}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link href={`/${locale}/guides`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('guides')}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('privacy')}
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('terms')}
          </Link>
          {/* § 356a Abs. 1 wants this one prominent and easily accessible — a
              fourth grey link in a row of grey links is neither, so it carries
              its own colour and weight. */}
          <Link
            href={`/${locale}/withdrawal`}
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t('withdrawal')}
          </Link>
          <Link href={`/${locale}/imprint`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('imprint')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
