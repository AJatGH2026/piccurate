'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * /[locale]/demo — Enables demo mode and redirects to the upload page.
 * This bypasses auth for local testing.
 */
export default function DemoPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  useEffect(() => {
    localStorage.setItem('piccurate-demo-mode', 'true');
    router.replace(`/${locale}/app/upload`);
  }, [locale, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-500">Entering demo mode...</p>
    </div>
  );
}
