import { renderOgCard, ogCardStaticParams, size, contentType, alt } from './og-card';

export { size, contentType, alt };
export const generateStaticParams = ogCardStaticParams;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderOgCard(locale);
}
