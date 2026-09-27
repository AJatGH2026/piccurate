import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { brandName } from '@/lib/brand';

// Title only — noindex comes from demo/layout.tsx. The sample demo is linked
// from the landing page, which carries the content search engines should see;
// this route is an interactive client page with nothing crawlable of its own.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sampleDemo' });
  return { title: `${t('metaTitle')} — ${brandName(locale)}` };
}

export default function SampleDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
