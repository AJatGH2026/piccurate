import { setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ImprintPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">PicCurate</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 prose dark:prose-invert prose-zinc">
        <h1>{locale === 'de' ? 'Impressum' : 'Imprint'}</h1>

        <h2>{locale === 'de' ? 'Angaben gemaess § 5 TMG' : 'Information pursuant to § 5 TMG'}</h2>
        <p>
          [Operator Name]<br />
          [Street Address]<br />
          [Postal Code] [City]<br />
          Germany
        </p>

        <h2>{locale === 'de' ? 'Kontakt' : 'Contact'}</h2>
        <p>
          Email: contact@piccurate.app<br />
          {locale === 'de' ? 'Telefon' : 'Phone'}: [Phone Number]
        </p>

        <h2>{locale === 'de' ? 'Umsatzsteuer-ID' : 'VAT ID'}</h2>
        <p>
          {locale === 'de'
            ? 'Umsatzsteuer-Identifikationsnummer gemaess §27a Umsatzsteuergesetz:'
            : 'VAT identification number pursuant to §27a of the German VAT Act:'}
          <br />
          DE [Number]
        </p>

        <h2>{locale === 'de' ? 'Verantwortlich fuer den Inhalt' : 'Responsible for content'}</h2>
        <p>
          [Name]<br />
          [Address]
        </p>

        <h2>{locale === 'de' ? 'Streitschlichtung' : 'Dispute Resolution'}</h2>
        <p>
          {locale === 'de'
            ? 'Die Europaeische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:'
            : 'The European Commission provides a platform for online dispute resolution (OS):'}
          <br />
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
      </main>
    </div>
  );
}
