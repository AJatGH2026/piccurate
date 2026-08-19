'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

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

export function DropZone({ onFiles, maxPhotos, disabled = false }: DropZoneProps) {
  const locale = useLocale();
  const t = useTranslations('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [pickerPending, setPickerPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
          <p className="mt-2 text-sm text-zinc-500">{t('dropzonePendingHint')}</p>
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
        </>
      )}
    </div>
  );
}
