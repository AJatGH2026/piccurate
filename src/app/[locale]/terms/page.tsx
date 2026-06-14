import { setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TermsPage({ params }: Props) {
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
        <h1>Terms of Service</h1>
        <p><em>Last updated: June 2026</em></p>

        <h2>1. Service Description</h2>
        <p>PicCurate provides an AI-powered photo curation service. Users upload travel photos (or connect cloud storage), and the service analyses and selects the best photos based on configurable criteria.</p>

        <h2>2. Account Registration</h2>
        <p>You must provide a valid email address and create a password to use PicCurate. You are responsible for maintaining the security of your account.</p>

        <h2>3. Pricing and Payment</h2>
        <ul>
          <li><strong>Free tier:</strong> 250 photos, one-time use per account.</li>
          <li><strong>Paid tiers:</strong> Per-use pricing. Payment is processed via Stripe before photo analysis begins.</li>
          <li>All prices include applicable VAT.</li>
          <li>Refunds are available within 14 days if the service was not used (EU consumer right of withdrawal).</li>
        </ul>

        <h2>4. Your Photos</h2>
        <ul>
          <li>You retain full ownership of your photos at all times.</li>
          <li>We do not claim any rights to your photos.</li>
          <li>Photos are processed solely for the purpose of AI curation.</li>
          <li>Thumbnails are automatically deleted within 24 hours. Full-resolution photos (uploaded for download) are deleted within 24 hours.</li>
        </ul>

        <h2>5. AI Analysis</h2>
        <p>The AI analysis is provided &quot;as is&quot;. While we strive for high-quality results, the AI may occasionally misidentify content, miss important photos, or produce unexpected selections. The review step allows you to adjust all selections before finalising.</p>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to upload illegal content, malware, or content that violates third-party rights. PicCurate is designed for personal travel photos.</p>

        <h2>7. Limitation of Liability</h2>
        <p>PicCurate is not liable for loss of photos, data corruption, or service interruptions beyond the amount paid for the specific transaction. We recommend keeping original copies of all photos.</p>

        <h2>8. Data Protection</h2>
        <p>See our <Link href={`/${locale}/privacy`}>Privacy Policy</Link> for details on how we handle your data.</p>

        <h2>9. Termination</h2>
        <p>You may delete your account and all data at any time. We may suspend accounts that violate these terms.</p>

        <h2>10. Governing Law</h2>
        <p>These terms are governed by the laws of the Federal Republic of Germany. The courts of [City] shall have jurisdiction.</p>
      </main>
    </div>
  );
}
