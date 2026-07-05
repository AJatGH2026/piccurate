import { setRequestLocale } from 'next-intl/server';
import { routing } from '../../../../i18n/routing';
import Link from 'next/link';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PrivacyPage({ params }: Props) {
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
        <h1>Privacy Policy</h1>
        <p><em>Last updated: June 2026</em></p>

        <h2>1. Data Controller</h2>
        <p>PicCurate is operated by [Operator Name], [Address]. Contact: privacy@piccurate.app.</p>

        <h2>2. What Data We Collect</h2>
        <ul>
          <li><strong>Account data:</strong> Email address and hashed password for authentication.</li>
          <li><strong>Photo thumbnails:</strong> 512x512 pixel JPEG previews of your photos, used solely for AI analysis. Automatically deleted within 24 hours.</li>
          <li><strong>Photo metadata:</strong> Date taken, GPS coordinates, camera model — used for grouping and sorting. Deleted when the job expires (7 days).</li>
          <li><strong>Selection results:</strong> AI scores, selection decisions, and reason tags. Deleted after 30 days.</li>
          <li><strong>Payment data:</strong> Processed by Stripe. We never see or store your card details.</li>
        </ul>

        <h2>3. What Data We Do NOT Collect</h2>
        <ul>
          <li><strong>Full-resolution photos</strong> are only uploaded for selected photos at the download step, stored for max. 24 hours, then deleted.</li>
          <li>We do not use cookies for tracking. Our analytics (Plausible) are cookieless and privacy-first.</li>
          <li>We do not sell, share, or transfer your data to third parties for advertising.</li>
        </ul>

        <h2>4. How We Process Your Photos</h2>
        <p>Your photo thumbnails are sent to a third-party LLM provider (currently Google — the underlying model may change over time; the substance of this section remains unchanged) for quality analysis. The provider&apos;s data processing agreement ensures your images are not used for model training and are deleted after processing.</p>

        <h2>4a. Reference Photos of Named Persons (optional)</h2>
        <p>If you use the optional &quot;Persons&quot; feature to filter your travel photos for specific people, you upload one reference photo per named person. These reference photos are transmitted to the same LLM provider together with the travel photos for face-matching purposes.</p>
        <p>Reference photos <strong>constitute biometric data</strong> under Art. 9 GDPR and are therefore subject to a stricter regime:</p>
        <ul>
          <li>The feature is <strong>opt-in</strong>: reference photos are only processed if you actively upload them, and using the feature is entirely optional.</li>
          <li>Reference photos are <strong>held only in your browser session</strong>. They are never persisted on our servers, never written to your browser&apos;s local storage, and are discarded when you close the tab or start a new job.</li>
          <li>Reference photos are sent to the LLM provider <strong>only for the duration of the analysis</strong>. The provider does not train on this data and deletes it after processing under the applicable data processing agreement.</li>
          <li>You must have the <strong>consent of any person</strong> whose reference photo you upload. You are the data controller for that upload; PicCurate acts as processor only for the technical transmission and result.</li>
          <li>The feature is <strong>currently limited to four persons per job</strong>.</li>
        </ul>

        <h2>5. Data Storage Location</h2>
        <p>All data is stored in the European Union (Frankfurt, Germany) via Cloudflare and Supabase.</p>

        <h2>6. Your Rights (GDPR)</h2>
        <ul>
          <li><strong>Access:</strong> Request a copy of your data.</li>
          <li><strong>Deletion:</strong> Delete your account and all associated data at any time.</li>
          <li><strong>Portability:</strong> Export your data in a machine-readable format.</li>
          <li><strong>Objection:</strong> Object to processing at any time.</li>
        </ul>
        <p>To exercise any of these rights, contact privacy@piccurate.app.</p>

        <h2>7. Data Retention</h2>
        <table>
          <thead><tr><th>Data</th><th>Retention</th></tr></thead>
          <tbody>
            <tr><td>Photo thumbnails</td><td>24 hours</td></tr>
            <tr><td>Photo metadata</td><td>7 days after job completion</td></tr>
            <tr><td>Selection results</td><td>30 days</td></tr>
            <tr><td>Account data</td><td>Until you delete your account</td></tr>
          </tbody>
        </table>

        <h2>8. Sub-Processors</h2>
        <table>
          <thead><tr><th>Service</th><th>Purpose</th><th>Location</th></tr></thead>
          <tbody>
            <tr><td>Supabase</td><td>Database, authentication</td><td>EU (Frankfurt)</td></tr>
            <tr><td>Cloudflare</td><td>Temporary file storage, CDN</td><td>EU</td></tr>
            <tr><td>Third-party LLM provider (currently Google)</td><td>AI photo analysis, including optional reference-photo face matching</td><td>US (with EU DPA)</td></tr>
            <tr><td>Stripe</td><td>Payment processing</td><td>EU/US</td></tr>
            <tr><td>Vercel</td><td>Web hosting</td><td>EU (Frankfurt)</td></tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
