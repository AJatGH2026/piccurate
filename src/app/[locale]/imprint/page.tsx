import { setRequestLocale } from 'next-intl/server';
import { brandName } from '@/lib/brand';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Generated from the reviewed B2C legal source (2026-07-26). German is the
// authoritative version; English is provided for information.
function GermanBody() {
  return (
    <>
      <h1>Impressum</h1>
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)<br />AJ GmbH<br />Danziger Str. 80<br />65191 Wiesbaden<br />Deutschland<br />Vertreten durch den Geschäftsführer:<br />Dr. Andreas Jahnke</p>
      <h2>Kontakt</h2>
      <p>E-Mail: contact@auswahlbuddy.de<br />Telefon oder unmittelbarer Kontaktweg: +49 155 61229658</p>
      <h2>Registereintrag</h2>
      <p>Registergericht: Amtsgericht Wiesbaden<br />Handelsregister: HRB 33249</p>
      <h2>Umsatzsteuer-ID</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />DE433664608</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </>
  );
}

function EnglishBody() {
  return (
    <>
      <h1>Imprint</h1>
      <p>Information pursuant to section 5 of the German Digital Services Act (DDG)<br />AJ GmbH<br />Danziger Str. 80<br />65191 Wiesbaden<br />Germany<br />Represented by the Managing Director:<br />Dr Andreas Jahnke</p>
      <h2>Contact</h2>
      <p>Email: contact@shortlistbuddy.com<br />Telephone or direct contact channel: +49 155 61229658</p>
      <h2>Commercial register</h2>
      <p>Register court: Amtsgericht Wiesbaden<br />Commercial register number: HRB 33249</p>
      <h2>VAT identification number</h2>
      <p>VAT identification number pursuant to section 27a of the German VAT Act:<br />DE433664608</p>
      <h2>Consumer dispute resolution</h2>
      <p>We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
    </>
  );
}

export default async function ImprintPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 prose dark:prose-invert prose-zinc">
        {locale === 'de' ? <GermanBody /> : <EnglishBody />}
      </main>
    </div>
  );
}
