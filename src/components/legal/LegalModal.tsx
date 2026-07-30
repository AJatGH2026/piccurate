'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Inline link that opens a same-origin legal page (terms / persons-info) in an
 * overlay (iframe) instead of navigating away. Used from the configure consent
 * checkboxes: navigating off the page would unload the in-progress upload —
 * mobile browsers (iOS Safari) discard backgrounded tabs and reload on return,
 * losing the client-side photo state. The overlay keeps the configure page
 * mounted, so the upload survives. Rendered via a portal to escape the parent
 * <label> (so backdrop clicks don't toggle the checkbox).
 */
export function LegalModal({
  href,
  label,
  linkClassName,
}: {
  href: string;
  label: string;
  linkClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={linkClassName ?? 'underline hover:text-indigo-600'}
      >
        {label}
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-zinc-600 shadow hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                ✕
              </button>
              <iframe src={href} title={label} className="h-full w-full flex-1 border-0" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
