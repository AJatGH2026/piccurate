/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { brandName } from '@/lib/brand';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { routing } from '../../../i18n/routing';
import { clientConfig } from '@/lib/config';
import { PRICING_PLANS, formatPrice } from '@/types/pricing';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { TrackLandingView } from '@/components/analytics/TrackLandingView';

type Props = {
  params: Promise<{ locale: string }>;
};

// Curated travel stock photos, originally Unsplash CDN (Unsplash License —
// free to use, no attribution required, self-hosting explicitly permitted).
// Self-hosted since 2026-08-15: both call sites below request the same 400px
// width, so a live third-party fetch bought nothing — it only meant every
// landing-page visitor's browser silently contacted images.unsplash.com,
// undisclosed in the privacy policy's recipient list (flagged in the second
// Abmahnprüfung, § 2). Downloaded once at that exact size/crop
// (public/landing/, gitignored source: fetched via the same URLs, same
// photo IDs kept here for provenance) — no code change needed if a photo
// ever needs to be swapped, no external call either way now.
const PHOTO_FILES = [
  'beach', // 1507525428034-b723cf961d3e
  'mountain-lake', // 1469474968028-56623f02e42e
  'paris-street', // 1502602898657-3e91760cbb34
  'alpine-lake', // 1501785888041-af3ef285b470
  'travel-flatlay', // 1488646953014-85cb44e25828
  'tropical-aerial', // 1530789253388-582c481c54b0
  'forest-lake', // 1476514525535-07fb3b4ae5f1
  'mountains', // 1539635278303-d4002c07eae3
  'coastal-village', // 1516483638261-f4dbaf036963
  'canyon-road', // 1533105079780-92b9be482077
];

const img = (file: string) => `/landing/${file}.jpg`;

// Homepage hreflang + canonical. Title/description are inherited from the
// locale layout's generateMetadata; here we add the per-page alternates.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  // Same guard as the locale layout, and for the same reason (see its
  // comment): this generateMetadata runs independently of the layout's, so
  // an invalid segment (bot-scanned paths like /ads.txt, /xmlrpc.php get
  // caught here as locale="ads.txt") reaches this code before the layout's
  // check ever applies. Confirmed live 2026-09-02/03/04: these paths 404'd
  // correctly but also logged a RangeError from the page component below
  // still running and hitting toLocaleString(locale) with the bogus value.
  if (!routing.locales.includes(locale as 'en' | 'de')) {
    return {};
  }
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
    name: brandName(locale),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: `${clientConfig.appUrl}/${locale}`,
    description: t('description'),
    // A paid tier without a Stripe price cannot be bought yet. Saying so in the
    // structured data too, rather than only in the visible card: an Offer with a
    // price and no availability reads as purchasable wherever it is re-rendered.
    offers: PRICING_PLANS.map((p) => ({
      '@type': 'Offer',
      name: p.tier,
      price: (p.priceEurCents / 100).toFixed(2),
      priceCurrency: 'EUR',
      availability:
        p.tier === 'free' || p.stripePriceId
          ? 'https://schema.org/InStock'
          : 'https://schema.org/PreOrder',
    })),
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  // Same guard as the locale layout — see the comment on generateMetadata
  // above for why this page needs its own copy rather than relying on the
  // layout's. Without it, a bot-scanned path (locale="ads.txt" etc.) reaches
  // plan.photos.toLocaleString(locale) below and throws RangeError instead
  // of the clean 404 the layout otherwise produces for the same request.
  if (!routing.locales.includes(locale as 'en' | 'de')) {
    notFound();
  }
  setRequestLocale(locale);
  const jsonLd = await softwareJsonLd(locale);

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackLandingView locale={locale} />

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
      {/* Footer now lives in the locale layout — it has to be on every page,
          not just this one (§ 356a Abs. 1 BGB). */}
    </div>
  );
}

async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('nav');
  const otherLocale = locale === 'en' ? 'de' : 'en';

  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  // Anonymous sign-in gives demo visitors a session. They are not "logged in"
  // in any sense they would recognise — showing them a sign-out link and an
  // empty email would be a puzzle, so the header stays in its signed-out state.
  const user = authUser && !authUser.is_anonymous ? authUser : null;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href={`/${locale}`} className="text-xl font-bold text-indigo-600">
          {brandName(locale)}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href={`/${otherLocale}`}
            className="px-2 py-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase text-xs font-medium"
          >
            {otherLocale.toUpperCase()}
          </Link>
          {user ? (
            <>
              <span className="text-zinc-500 text-xs hidden sm:block">{user.email}</span>
              <LogoutButton locale={locale} />
            </>
          ) : (
            <>
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function HeroSection({ locale }: { locale: string }) {
  const t = useTranslations('hero');

  // Mobile spacing is deliberately tighter than desktop (2026-08-26): on a
  // 375x812 phone the first photo used to start at 792px, i.e. below the fold,
  // and the CTA sat at 634px — right at the edge once the browser chrome is
  // subtracted. Paid-social visitors arrive without the intent a searcher has,
  // so a hero they have to scroll to act on loses them: Meta traffic converted
  // at 2.4% landing_view -> demo_start against 41% for the "foto filtern"
  // keyword on the very same page. Desktop keeps its original breathing room.
  return (
    <section className="relative overflow-hidden pt-10 sm:pt-28 pb-16 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950">
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
        <p className="mt-6 text-lg sm:text-xl leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto whitespace-pre-line">
          {t('subtitle')}
        </p>
        <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
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
        {/* The privacy promise used to open the subtitle, two lines above the
            fold, answering a question nobody had asked yet. It belongs here
            instead: short, specific, and at the moment someone hesitates over
            the button. */}
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          {t('trustNote')}
        </p>
      </div>

      {/* Photo "filmstrip" */}
      <div className="relative mt-8 sm:mt-16 flex justify-center items-end gap-3 sm:gap-5 px-4">
        {PHOTO_FILES.slice(0, 5).map((file, i) => (
          <div
            key={file}
            className={`relative aspect-[3/4] w-28 sm:w-44 flex-none overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5 transition-transform ${
              i === 2 ? 'sm:scale-110 z-10' : i % 2 ? 'rotate-2' : '-rotate-2'
            } ${i > 2 ? 'hidden sm:block' : ''}`}
          >
            <img
              src={img(file)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
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
          {PHOTO_FILES.map((file, i) => {
            const sel = selected.has(i);
            return (
              <div
                key={file}
                className={`group relative aspect-square overflow-hidden rounded-xl transition-all ${
                  sel
                    ? 'ring-4 ring-indigo-500 shadow-lg'
                    : 'opacity-50 saturate-50 hover:opacity-80'
                }`}
              >
                <img src={img(file)} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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

  // Driven by PRICING_PLANS rather than by hardcoded strings, so the landing
  // page cannot drift from the page that actually sells. Two things follow from
  // the plan data and must not be restated by hand:
  //   - the price in the locale's own notation, with the VAT statement on the
  //     price itself (§ 6 PAngV wants it there, not three steps down the funnel);
  //   - whether the tier can be booked at all. No Stripe price id means selling
  //     is off, and a card that says "Jetzt starten" over a price nobody can pay
  //     is the easiest misleading-advertising screenshot on the site.
  const label = (tier: string) =>
    tier === 'free' ? t('freeTitle') : tier === 'small' ? t('small') : tier === 'medium' ? t('medium') : t('large');

  const plans = PRICING_PLANS.map((p) => {
    const bookable = p.tier === 'free' || Boolean(p.stripePriceId);
    return {
      tier: p.tier,
      name: label(p.tier),
      price: p.tier === 'free' ? t('free') : formatPrice(p.priceEurCents, locale),
      badge: p.tier === 'free' ? t('freeBadge') : null,
      photos: p.photoLimit,
      highlight: p.tier === 'medium',
      bookable,
      // A tier that cannot be booked leads to the beta offer, not to sign-up.
      // The tier belongs in the link: which tier someone reaches for is the
      // whole point of the offer, and `/app/pricing` reopens the dialogue from
      // `?offer=` after the account detour it triggers itself. Sending them to
      // the bare sign-up form instead would spend the click and keep nothing.
      href: bookable
        ? `/${locale}/auth/register`
        : `/${locale}/app/pricing?offer=${p.tier}`,
      features:
        p.tier === 'free'
          ? ['allCriteria', 'reviewAdjust', 'downloadZip']
          : ['allCriteria', 'reviewAdjust', 'downloadZip', 'customCriteria', 'personSearch'],
      note: p.tier === 'free' ? t('oneTimeUse') : t('priceNote'),
    };
  });

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
              key={plan.tier}
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
              {/* Amount on its own line, the qualifier underneath — same shape
                  as the in-app pricing page, so the two do not disagree. */}
              <div className="mt-4 text-3xl font-bold">{plan.price}</div>
              {plan.note && (
                <p className={`text-xs ${plan.highlight ? 'text-indigo-200' : 'text-zinc-500'}`}>
                  {plan.note}
                </p>
              )}
              {/* Same weight as the tier name: after the price, the photo count
                  is what tiers are actually compared on. */}
              <p
                className={`mt-3 text-lg font-semibold ${
                  plan.highlight ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
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
                href={plan.href}
                className={`mt-6 block text-center rounded-full py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {plan.bookable ? t('cta') : t('choosePlan')}
              </Link>
              {/* "Not bookable yet" is disclosed once in the section subtitle
                  rather than under every button, where four repetitions read as
                  a warning not to click. Still first-level information. */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
