'use client';

// Mandatory confirmation step for the person EXCLUDE mode.
//
// GATE 1, Entscheidung 6: exclude is delivered, but never silently. § 5.2's
// fallback rule would technically allow silent removal at the precision we
// measured (≥ 0.98) — but that rule was written assuming recall would clear its
// own gate, and it does not: 0.49 in exclude mode. Removing silently at that
// recall means roughly every second photo of the person stays in while the user
// believes they are all gone. That is a promise the numbers do not support, so
// the removal is shown and has to be accepted.
//
// Include mode has no equivalent step on purpose: a missed photo there is
// harmless (the photo is still in the set), whereas a wrongly removed one is not.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import type { CriteriaConfig } from '@/types/criteria';

interface Props {
  criteria: CriteriaConfig;
}

export function ExcludeConfirm({ criteria }: Props) {
  const t = useTranslations('review');
  const persons = usePhotoStore((s) => s.persons);
  const excludeConfirmed = usePhotoStore((s) => s.excludeConfirmed);
  const setExcludeConfirmed = usePhotoStore((s) => s.setExcludeConfirmed);
  const photosPendingExclusion = usePhotoStore((s) => s.photosPendingExclusion);
  const [open, setOpen] = useState(false);

  const excludeNames = persons.filter((p) => p.mode === 'exclude').map((p) => p.name);
  if (excludeNames.length === 0 || excludeConfirmed) return null;

  const pending = photosPendingExclusion();
  if (pending.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-950/20 p-4">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
        {t('excludeTitle', { count: pending.length, names: excludeNames.join(', ') })}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('excludeBody')}</p>

      {open && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {pending.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800">
              <Image
                src={p.thumbnailUrl}
                alt={p.filename}
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-zinc-300 dark:border-zinc-600 px-4 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {open ? t('excludeHide') : t('excludeShow', { count: pending.length })}
        </button>
        <button
          onClick={() => setExcludeConfirmed(true, criteria)}
          className="rounded-full bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          {t('excludeConfirm')}
        </button>
      </div>
    </div>
  );
}
