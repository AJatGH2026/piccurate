'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';

type Shot = { src: string; label: string };

/**
 * Press screenshots with an in-page viewer.
 *
 * The first version linked each thumbnail straight to the JPG in a new tab —
 * on a phone, and above all in the installed app, that left the visitor on a
 * bare image with no way back (reported 2026-09-28). The viewer stays on the
 * page: close button, tap outside or Esc to leave, and a download link.
 */
export function PressGallery({ shots, closeLabel, downloadLabel }: { shots: Shot[]; closeLabel: string; downloadLabel: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : Math.min(shots.length - 1, i + 1)));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, shots.length]);

  const shot = open === null ? null : shots[open];

  return (
    <>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {shots.map((s, i) => (
          <button key={s.src} type="button" onClick={() => setOpen(i)} className="group block text-left">
            <img
              src={s.src}
              alt={s.label}
              loading="lazy"
              className="aspect-[16/10] w-full rounded-lg object-cover object-top ring-1 ring-black/10 group-hover:ring-indigo-400"
            />
            <span className="mt-1 block text-xs text-zinc-500">{s.label}</span>
          </button>
        ))}
      </div>

      {shot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={shot.label}
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="min-w-0 truncate text-sm text-white/80">{shot.label}</span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="flex-none rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              ✕ {closeLabel}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            <img
              src={shot.src}
              alt={shot.label}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center justify-center gap-3 px-4 py-4" onClick={(e) => e.stopPropagation()}>
            <a
              href={shot.src}
              download
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {downloadLabel}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
