'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { mark } from '@/lib/events-client';
import { formatEtaDuration } from '@/utils/eta';

interface DropZoneProps {
  onFiles: (files: FileList | File[]) => void;
  maxPhotos: number;
  disabled?: boolean;
}

// Reported 2026-08-19: on mobile, confirming a large selection (e.g. 250
// photos from iCloud) in the native picker can take ~30s before the browser
// hands the files back — the OS has to materialise "optimised storage"
// originals first. Nothing in the page changes during that gap, so it looks
// frozen. This is a safety backstop for that wait; if the user genuinely
// cancelled and the browser doesn't support the 'cancel' event (below), the
// indicator clears itself instead of sticking around forever.
const PICKER_PENDING_TIMEOUT_MS = 90_000;

// Measured on iPhone 2026-08-29: 11 s for 100 photos, 28 s for 250 — ~110 ms
// each, and linear, so it scales straight into the larger tiers (1,000 photos
// ≈ 2 min). This is the OS reading the photo library, not our upload.
//
// Only meaningful on a phone. Picking files from a laptop's disk is close to
// instant, so the same warning there would predict minutes for something that
// takes a second — which is why the notice is gated on the phone check below
// rather than shown to everyone.
const PICKER_HANDOFF_MS_PER_PHOTO = 110;

// A coarse pointer alone is not enough: a touchscreen laptop reports one while
// still picking files from a local disk in about a second. Requiring `hover:
// none` as well narrows it to devices with no mouse at all — phones and
// tablets, which is where the OS handoff is actually slow. Reported
// 2026-08-29: the notice showed on a Dell Latitude.
const PHONE_LIKE_QUERY = '(pointer: coarse) and (hover: none)';

/** Media-query subscription for the phone check below. */
function subscribeToPhoneLike(onChange: () => void): () => void {
  const mq = window.matchMedia?.(PHONE_LIKE_QUERY);
  if (!mq) return () => {};
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function DropZone({ onFiles, maxPhotos, disabled = false }: DropZoneProps) {
  const locale = useLocale();
  const t = useTranslations('upload');
  const tc = useTranslations('common');
  const [isDragging, setIsDragging] = useState(false);
  const [pickerPending, setPickerPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A media query rather than a user-agent string: this is about the input
  // method, which is what actually predicts a slow handoff. Read through
  // useSyncExternalStore so the server snapshot is a plain `false` — the notice
  // simply is not rendered server-side — instead of setting state from an
  // effect and re-rendering.
  const isPhoneLike = useSyncExternalStore(
    subscribeToPhoneLike,
    () => window.matchMedia?.(PHONE_LIKE_QUERY).matches ?? false,
    () => false
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles, disabled]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    setPickerPending(true);
    // Start of the OS handoff — the gap between confirming a selection and the
    // browser receiving it. Measured 2026-08-29 on iPhone: 11 s for 100 photos,
    // 28 s for 250, i.e. ~110 ms per photo and linear, all of it inside iOS
    // before any of our code runs. useUpload reads this back on the
    // files_selected event so the gap is visible in /admin/stats rather than
    // only in a stopwatch — it is the part of the wait users are most likely to
    // abandon, and the one we cannot shorten.
    mark('picker_opened');
    inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPickerPending(false);
      if (e.target.files && e.target.files.length > 0) {
        onFiles(e.target.files);
        // Reset input so the same files can be selected again
        e.target.value = '';
      }
    },
    [onFiles]
  );

  // The 'cancel' event (input type=file) fires when the user dismisses the
  // native picker without choosing anything. Supported in current Chrome,
  // Edge and Safari; where it isn't, PICKER_PENDING_TIMEOUT_MS below is the
  // fallback. Attached via a ref, not a JSX prop — 'cancel' has no React
  // synthetic event.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onCancel = () => setPickerPending(false);
    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, []);

  useEffect(() => {
    if (!pickerPending) return;
    const timer = setTimeout(() => setPickerPending(false), PICKER_PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pickerPending]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer
        transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
            : 'border-blue-300 bg-blue-50/70 hover:border-indigo-400 dark:border-blue-700/60 dark:bg-blue-950/20 dark:hover:border-indigo-500'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.jpg,.jpeg,.png,.heic,.heif,.webp"
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      {pickerPending ? (
        <>
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
            {t('dropzonePending')}
          </p>
          {/* Names iCloud and a half-minute wait — true on a phone, wrong on a
              laptop, where this state lasts a moment. Same gate as the notice. */}
          {isPhoneLike && (
            <p className="mt-2 text-sm text-zinc-500">{t('dropzonePendingHint')}</p>
          )}
        </>
      ) : (
        <>
          <div className="text-4xl mb-4">{isDragging ? '📥' : '📸'}</div>
          <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
            {isDragging ? t('dropzoneActive') : t('dropzone')}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {/* Locale passed explicitly — see the note in app/pricing: a bare
                toLocaleString formats differently on server and client and breaks
                hydration for the whole page. */}
            {t('supported', { limit: maxPhotos.toLocaleString(locale) })}
          </p>
          {/* Said BEFORE the tap, not after it: during the handoff the picker
              is still on screen and nobody is looking at this page, so the
              pending indicator below cannot reach it. Warning first is the only
              thing that gets to the user before they conclude it hung and back
              out — which is the actual risk, since the wait itself cannot be
              shortened from a web page.

              The estimate follows the tier: at ~110 ms/photo the free 250 is
              half a minute, but 1,000 is two minutes and 5,000 is nine, and
              quoting the small number to someone on a large tier would set them
              up for exactly the surprise this is meant to prevent. */}
          {isPhoneLike && (
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              {t('pickerHandoffNotice', {
                photos: maxPhotos.toLocaleString(locale),
                duration: formatEtaDuration(maxPhotos * PICKER_HANDOFF_MS_PER_PHOTO, tc),
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
