'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ProcessedPhoto } from '@/hooks/usePhotoStore';

interface LightboxProps {
  photos: ProcessedPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
}

/**
 * Full-screen preview of a single photo for closer inspection while reviewing.
 * Uses the 512px thumbnail (always a JPEG — renders even for HEIC originals).
 * Arrow keys navigate, Esc closes; the keep/remove button toggles selection.
 */
export function Lightbox({ photos, index, onIndexChange, onToggle, onClose }: LightboxProps) {
  const t = useTranslations('review');
  const tc = useTranslations('common');
  const photo = photos[index];

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!photo) return null;

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm truncate">
          {photo.filename}
          <span className="ml-2 text-white/40">{index + 1} / {photos.length}</span>
        </span>
        <button onClick={onClose} className="text-2xl leading-none hover:text-white">×</button>
      </div>

      {/* Image + nav */}
      <div className="flex-1 flex items-center justify-center px-2 sm:px-12 min-h-0" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button
            onClick={() => go(-1)}
            className="absolute left-2 sm:left-4 text-white/70 hover:text-white text-4xl px-2"
            aria-label="Previous"
          >
            ‹
          </button>
        )}
        {photo.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumbnailUrl}
            alt={photo.filename}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        )}
        {hasNext && (
          <button
            onClick={() => go(1)}
            className="absolute right-2 sm:right-4 text-white/70 hover:text-white text-4xl px-2"
            aria-label="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom bar: meta + keep/remove */}
      <div className="px-4 py-4 flex items-center justify-between gap-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 text-xs text-white/60">
          {photo.sceneType && <span className="mr-2">{photo.sceneType}</span>}
          {photo.aestheticScore != null && <span className="mr-2">quality {photo.aestheticScore}/10</span>}
          {photo.sharpnessScore != null && <span className="mr-2">sharp {photo.sharpnessScore}/10</span>}
          {photo.contentTags?.length > 0 && (
            <span className="text-white/40">· {photo.contentTags.slice(0, 4).join(' · ')}</span>
          )}
        </div>
        <button
          onClick={() => onToggle(photo.id)}
          className={`flex-none rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
            photo.selected
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {photo.selected ? t('remove') : t('addBack')}
        </button>
      </div>

      <button className="sr-only" onClick={onClose}>{tc('close')}</button>
    </div>
  );
}
