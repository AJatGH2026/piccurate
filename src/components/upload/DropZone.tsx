'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface DropZoneProps {
  onFiles: (files: FileList | File[]) => void;
  maxPhotos: number;
  disabled?: boolean;
}

export function DropZone({ onFiles, maxPhotos, disabled = false }: DropZoneProps) {
  const t = useTranslations('upload');
  const [isDragging, setIsDragging] = useState(false);
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
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFiles(e.target.files);
        // Reset input so the same files can be selected again
        e.target.value = '';
      }
    },
    [onFiles]
  );

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
            : 'border-zinc-300 hover:border-indigo-400 dark:border-zinc-700 dark:hover:border-indigo-500'
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
      <div className="text-4xl mb-4">{isDragging ? '📥' : '📸'}</div>
      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
        {isDragging ? t('dropzoneActive') : t('dropzone')}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        {t('supported', { limit: maxPhotos.toLocaleString() })}
      </p>
    </div>
  );
}
