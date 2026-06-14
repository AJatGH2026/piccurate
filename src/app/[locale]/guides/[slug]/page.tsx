import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuide, guideParams } from '@/content/guides';
import { clientConfig } from '@/lib/config';

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return guideParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = getGuide(locale, slug);
  if (!found) return {};
  const { guide, content } = found;
  return {
    title: `${content.title} — PicCurate`,
    description: content.description,
    alternates: {
      canonical: `/${locale}/guides/${content.slug}`,
      languages: {
        en: `/en/guides/${guide.en.slug}`,
        de: `/de/guides/${guide.de.slug}`,
        'x-default': `/en/guides/${guide.en.slug}`,
      },
    },
    openGraph: { title: content.title, description: content.description, type: 'article', locale },
  };
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const found = getGuide(locale, slug);
  if (!found) notFound();
  const { content } = found;
  const t = await getTranslations({ locale, namespace: 'guides' });
  const base = clientConfig.appUrl;
  const url = `${base}/${locale}/guides/${content.slug}`;

  // Structured data: HowTo (the step method), FAQPage (the Q&A), and a
  // BreadcrumbList — all extractable by search and generative engines (§8.2).
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: content.title,
      description: content.description,
      step: content.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.body,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PicCurate', item: `${base}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('indexTitle'), item: `${base}/${locale}/guides` },
        { '@type': 'ListItem', position: 3, name: content.title, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="text-xl font-bold text-indigo-600">PicCurate</Link>
          <Link href={`/${locale}/guides`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('indexTitle')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-zinc-400 mb-4">
          <Link href={`/${locale}`} className="hover:text-indigo-600">PicCurate</Link>
          {' / '}
          <Link href={`/${locale}/guides`} className="hover:text-indigo-600">{t('indexTitle')}</Link>
        </nav>

        <article>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {content.title}
          </h1>

          <div className="mt-6 space-y-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
            {content.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Steps (HowTo) */}
          <h2 className="mt-12 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{content.stepsHeading}</h2>
          <ol className="mt-6 space-y-6">
            {content.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-none inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold dark:bg-indigo-900 dark:text-indigo-300">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* FAQ */}
          <h2 className="mt-12 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{content.faqHeading}</h2>
          <dl className="mt-6 space-y-6">
            {content.faqs.map((f, i) => (
              <div key={i}>
                <dt className="font-semibold text-zinc-900 dark:text-zinc-100">{f.q}</dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">{f.a}</dd>
              </div>
            ))}
          </dl>

          {/* CTA */}
          <div className="mt-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 p-6 text-center">
            <p className="text-zinc-700 dark:text-zinc-300">{t('ctaText')}</p>
            <Link
              href={`/${locale}/demo`}
              className="mt-4 inline-block rounded-full bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              {t('ctaButton')}
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
