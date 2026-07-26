import { setRequestLocale } from 'next-intl/server';
import { brandName, brandDomain } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// DRAFT — legal scaffold for the public beta (pipeline §6 / §10 B2).
// Entity-specific fields are marked TODO and must be filled after the company
// is founded; the bracketed placeholders are deliberately visible so an
// accidental launch shows an obviously-incomplete imprint rather than silently
// wrong data. Final legal review pending (done by the operator).
export default async function ImprintPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const de = locale === 'de';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 prose dark:prose-invert prose-zinc">
        <h1>{de ? 'Impressum' : 'Imprint'}</h1>

        <h2>{de ? 'Diensteanbieter (§ 5 DDG)' : 'Service provider (§ 5 DDG)'}</h2>
        <p>
          AJ GmbH<br />
          Danziger Str. 80<br />
          65191 Wiesbaden<br />
          {de ? 'Deutschland' : 'Germany'}
        </p>

        <h2>{de ? 'Vertreten durch' : 'Represented by'}</h2>
        <p>Dr. Andreas Jahnke{de ? ' (Geschäftsführer)' : ' (Managing Director)'}</p>

        <h2>{de ? 'Kontakt' : 'Contact'}</h2>
        <p>
          {de ? 'E-Mail' : 'Email'}: contact@{brandDomain(locale)}<br />
          {de ? 'Telefon' : 'Phone'}: [{de ? 'optional — bei Bedarf eintragen' : 'optional — add if desired'}]
        </p>

        <h2>{de ? 'Registereintrag' : 'Register entry'}</h2>
        <p>
          {de ? 'Registergericht: Amtsgericht Wiesbaden' : 'Registering court: Amtsgericht Wiesbaden'}<br />
          {de ? 'Handelsregister-Nummer: HRB 33249' : 'Commercial register number: HRB 33249'}
        </p>

        <h2>{de ? 'Umsatzsteuer-ID' : 'VAT ID'}</h2>
        <p>
          {de
            ? 'Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:'
            : 'VAT identification number pursuant to § 27a of the German VAT Act:'}
          <br />
          DE433664608
        </p>

        <h2>
          {de
            ? 'Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)'
            : 'Responsible for content (§ 18 (2) MStV)'}
        </h2>
        <p>
          Dr. Andreas Jahnke<br />
          {de ? 'Anschrift wie oben' : 'Address as above'}
        </p>

        <h2>{de ? 'Verbraucherstreitbeilegung' : 'Consumer dispute resolution'}</h2>
        <p>
          {de
            ? 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG). [Vor Veröffentlichung prüfen — geschäftliche Entscheidung.]'
            : 'We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board (§ 36 VSBG). [Review before publishing — business decision.]'}
        </p>
        <p>
          {de
            ? 'Hinweis: Die EU-Plattform zur Online-Streitbeilegung (OS) wurde 2025 eingestellt — vor Veröffentlichung prüfen, ob ein Verweis hier noch erforderlich ist.'
            : 'Note: the EU Online Dispute Resolution (ODR) platform was discontinued in 2025 — verify before publishing whether a reference here is still required.'}
        </p>
      </main>
    </div>
  );
}
