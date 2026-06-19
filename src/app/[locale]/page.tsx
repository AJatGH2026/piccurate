/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { clientConfig } from '@/lib/config';
import { PRICING_PLANS } from '@/types/pricing';

type Props = {
  params: Promise<{ locale: string }>;
};

// Curated travel stock photos (Unsplash CDN, Unsplash License — free to use).
// Verified-live photo IDs; sized/cropped via Unsplash URL params.
const PHOTO_IDS = [
  '1507525428034-b723cf961d3e', // beach
  '1469474968028-56623f02e42e', // mountain lake
  '1502602898657-3e91760cbb34', // Paris street
  '1501785888041-af3ef285b470', // alpine lake
  '1488646953014-85cb44e25828', // travel flatlay
  '1530789253388-582c481c54b0', // tropical aerial
  '1476514525535-07fb3b4ae5f1', // forest lake
  '1539635278303-d4002c07eae3', // mountains
  '1516483638261-f4dbaf036963', // coastal village
  '1533105079780-92b9be482077', // canyon road
];

const img = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

// Homepage hreflang + canonical. Title/description are inherited from the
// locale layout's generateMetadata; here we add the per-page alternates.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', de: '/de', 'x-default': '/en' },
    },
  };
}

// SoftwareApplication structured data — helps Rich Results and makes the
// product's facts (category, pricing) machine-extractable for GEO (§8.2).
async function softwareJsonLd(locale: string) {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PicCurate',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: `${clientConfig.appUrl}/${locale}`,
    description: t('description'),
    offers: PRICING_PLANS.map((p) => ({
      '@type': 'Offer',
      name: p.tier,
      price: (p.priceEurCents / 100).toFixed(2),
      priceCurrency: 'EUR',
    })),
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const jsonLd = await softwareJsonLd(locale);

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <Header locale={locale} />

      {/* Hero */}
      <HeroSection locale={locale} />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Showcase */}
      <ShowcaseSection />

      {/* Pricing */}
      <PricingSection locale={locale} />

      {/* Footer */}
      <Footer locale={locale} />
    </div>
  );
}

function Header({ locale }: { locale: string }) {
  const t = useTranslations('nav');
  const otherLocale = locale === 'en' ? 'de' : 'en';

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href={`/${locale}`} className="text-xl font-bold text-indigo-600">
          PicCurate
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href={`/${otherLocale}`}
            className="px-2 py-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase text-xs font-medium"
          >
            {otherLocale.toUpperCase()}
          </Link>
          <Link
            href={`/${locale}/auth/login`}
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {t('login')}
          </Link>
          <Link
            href={`/${locale}/auth/register`}
            className="rounded-full bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('register')}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroSection({ locale }: { locale: string }) {
  const t = useTranslations('hero');

  return (
    <section className="relative overflow-hidden pt-20 sm:pt-28 pb-16 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950">
      {/* soft decorative glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[42rem] rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-zinc-800/70 ring-1 ring-indigo-100 dark:ring-zinc-700 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 backdrop-blur">
          ✨ {t('demoNote')}
        </span>
        <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('title')}
          <br />
          <span className="text-indigo-600">{t('titleHighlight')}</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl leading-8 text-zinc-600 dark:text-zinc-400 max-w-5xl mx-auto whitespace-pre-line">
          {t('subtitle')}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/${locale}/demo`}
            className="rounded-full bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
          >
            {t('cta')}
          </Link>
          <a
            href="#pricing"
            className="text-lg font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {t('ctaSecondary')} &darr;
          </a>
        </div>
      </div>

      {/* Photo "filmstrip" */}
      <div className="relative mt-16 flex justify-center items-end gap-3 sm:gap-5 px-4">
        {PHOTO_IDS.slice(0, 5).map((id, i) => (
          <div
            key={id}
            className={`relative aspect-[3/4] w-28 sm:w-44 flex-none overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5 transition-transform ${
              i === 2 ? 'sm:scale-110 z-10' : i % 2 ? 'rotate-2' : '-rotate-2'
            } ${i > 2 ? 'hidden sm:block' : ''}`}
          >
            <img
              src={img(id, 400)}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const t = useTranslations('howItWorks');

  const steps = [
    { icon: '📤', title: t('step1Title'), desc: t('step1Desc') },
    { icon: '🤖', title: t('step2Title'), desc: t('step2Desc') },
    { icon: '👁️', title: t('step3Title'), desc: t('step3Desc') },
    { icon: '📦', title: t('step4Title'), desc: t('step4Desc') },
  ];

  return (
    <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100">
          {t('title')}
        </h2>
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-2xl">
                {step.icon}
              </div>
              <div className="absolute top-6 right-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseSection() {
  const t = useTranslations('showcase');
  const selected = new Set([0, 3, 4, 7]); // highlighted "keepers"

  return (
    <section className="py-20 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h2>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {PHOTO_IDS.map((id, i) => {
            const sel = selected.has(i);
            return (
              <div
                key={id}
                className={`group relative aspect-square overflow-hidden rounded-xl transition-all ${
                  sel
                    ? 'ring-4 ring-indigo-500 shadow-lg'
                    : 'opacity-50 saturate-50 hover:opacity-80'
                }`}
              >
                <img src={img(id, 400)} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                {sel && (
                  <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs shadow">
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ locale }: { locale: string }) {
  const t = useTranslations('pricing');

  const plans = [
    {
      name: t('free'),
      price: t('free'),
      badge: t('freeBadge'),
      photos: 250,
      highlight: false,
      features: ['allCriteria', 'reviewAdjust', 'downloadZip'],
      note: t('oneTimeUse'),
    },
    {
      name: t('small'),
      price: '€4.99',
      badge: null,
      photos: 1000,
      highlight: false,
      features: ['allCriteria', 'reviewAdjust', 'downloadZip', 'customCriteria'],
      note: t('perUse'),
    },
    {
      name: t('medium'),
      price: '€7.99',
      badge: null,
      photos: 2500,
      highlight: true,
      features: ['allCriteria', 'reviewAdjust', 'downloadZip', 'customCriteria'],
      note: t('perUse'),
    },
    {
      name: t('large'),
      price: '€10.99',
      badge: null,
      photos: 5000,
      highlight: false,
      features: ['allCriteria', 'reviewAdjust', 'downloadZip', 'customCriteria'],
      note: t('perUse'),
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('title')}
          </h2>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 shadow-xl'
                  : 'bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.badge && (
                  <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                    {plan.badge}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.note && (
                  <span
                    className={`ml-1 text-sm ${
                      plan.highlight ? 'text-indigo-200' : 'text-zinc-500'
                    }`}
                  >
                    {plan.note}
                  </span>
                )}
              </div>
              <p
                className={`mt-1 text-sm ${
                  plan.highlight ? 'text-indigo-200' : 'text-zinc-500'
                }`}
              >
                {t('photosUpTo', { count: plan.photos.toLocaleString(locale) })}
              </p>
              <ul className="mt-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span className={plan.highlight ? 'text-indigo-200' : 'text-green-500'}>
                      ✓
                    </span>
                    {t(`features.${f}`)}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/auth/register`}
                className={`mt-6 block text-center rounded-full py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {t('cta')}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ locale }: { locale: string }) {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
        <div>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">PicCurate</span>
          {' '}&mdash; {t('tagline')}
        </div>
        <div className="flex gap-4">
          <Link href={`/${locale}/guides`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('guides')}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('privacy')}
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('terms')}
          </Link>
          <Link href={`/${locale}/imprint`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('imprint')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
