/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import { PRESS, PRESS_SCREENSHOTS } from '@/content/press';
import { LandingVideo } from '@/components/landing/LandingVideo';

// Press page: release, facts, video, screenshots, contact — the one link a
// journalist needs (Presseansprache, 2026-09-27). Indexable on purpose, unlike
// the demo: people search for "<name> Presse".

type Props = { params: Promise<{ locale: string }> };

// The address and number the imprint already publishes (phone on the press
// page: decision AJ 2026-09-28).
const CONTACT = 'contact@auswahlbuddy.de';
const PHONE = '+49 155 61229658';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'de')) return {};
  const t = PRESS[locale as 'de' | 'en'];
  return {
    title: `${t.metaTitle} — ${brandName(locale)}`,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/press`,
      languages: { en: '/en/press', de: '/de/press', 'x-default': '/en/press' },
    },
  };
}

export default async function PressPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'de')) notFound();
  setRequestLocale(locale);
  const lang = locale as 'de' | 'en';
  const t = PRESS[lang];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-xl font-bold text-indigo-600">{brandName(locale)}</Link>
          <Link href={`/${locale === 'de' ? 'en' : 'de'}/press`} className="px-2 py-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase text-xs font-medium">
            {locale === 'de' ? 'EN' : 'DE'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Release */}
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">{t.kicker}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{t.title}</h1>
        <p className="mt-6 text-lg leading-8 text-zinc-700 dark:text-zinc-300">{t.lead}</p>
        {t.body.map((p) => (
          <p key={p.slice(0, 24)} className="mt-4 leading-7 text-zinc-600 dark:text-zinc-400">{p}</p>
        ))}
        <p className="mt-3 text-xs text-zinc-400">{t.source}</p>
        <Link
          href={`/${locale}/demo/beispiel`}
          className="mt-6 inline-block rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          {t.demoCta} →
        </Link>

        {/* Facts */}
        <h2 className="mt-14 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t.factsTitle}</h2>
        <dl className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
          {t.facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 py-3 text-sm">
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">{k}</dt>
              <dd className="col-span-2 text-zinc-600 dark:text-zinc-400">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Media */}
        <h2 className="mt-14 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t.mediaTitle}</h2>
        <h3 className="mt-6 font-semibold text-zinc-900 dark:text-zinc-100">{t.videoTitle}</h3>
        <div className="mt-3">
          <LandingVideo
            locale={locale}
            src={`/video/demo-${lang}.mp4`}
            poster={`/video/demo-${lang}-poster.jpg`}
            label={t.videoTitle}
          />
        </div>
        <p className="mt-2 text-sm">
          <a href={`/video/demo-${lang}.mp4`} download className="text-indigo-600 hover:text-indigo-700">{t.videoLinks} (16:9)</a>
          <span className="mx-2 text-zinc-300">·</span>
          <a href={`/press/demo-${lang}-portrait.mp4`} download className="text-indigo-600 hover:text-indigo-700">{t.videoLinks} (9:16)</a>
        </p>

        <h3 className="mt-10 font-semibold text-zinc-900 dark:text-zinc-100">{t.screenshotsTitle}</h3>
        <p className="mt-1 text-sm text-zinc-500">{t.screenshotsNote}</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {PRESS_SCREENSHOTS.map((s) => (
            <a key={s.file} href={`/press/${lang}-${s.file}.jpg`} target="_blank" rel="noopener" className="group block">
              <img
                src={`/press/${lang}-${s.file}.jpg`}
                alt={s[lang]}
                loading="lazy"
                className="aspect-[16/10] w-full rounded-lg object-cover object-top ring-1 ring-black/10 group-hover:ring-indigo-400"
              />
              <span className="mt-1 block text-xs text-zinc-500">{s[lang]}</span>
            </a>
          ))}
        </div>
        {/* No ZIP of all screenshots: *.zip is blocked by both .gitignore and the
            pre-push hook (guards against backups/exports), and the link went
            live as a 404 on 2026-09-28. The six files are linked one by one above. */}
        <p className="mt-4 text-sm">
          <a href="/icon-512x512.png" download className="text-indigo-600 hover:text-indigo-700">{t.logo}</a>
        </p>

        {/* Contact */}
        <h2 className="mt-14 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t.contactTitle}</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t.contactText}{' '}
          <a href={`mailto:${CONTACT}`} className="font-medium text-indigo-600 hover:text-indigo-700">{CONTACT}</a>
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {locale === 'de' ? 'Telefon' : 'Phone'}:{' '}
          <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="font-medium text-indigo-600 hover:text-indigo-700">{PHONE}</a>
        </p>
        <p className="mt-10 text-xs text-zinc-400">{t.revised}</p>
      </main>
    </div>
  );
}
