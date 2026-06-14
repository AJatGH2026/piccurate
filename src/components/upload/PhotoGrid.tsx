'use client';

import type { ClientPhoto } from '@/types/photo';
import { PhotoCard } from './PhotoCard';

interface PhotoGridProps {
  photos: ClientPhoto[];
  onRemove: (id: string) => void;
}

export function PhotoGrid({ photos, onRemove }: PhotoGridProps) {
  if (photos.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {photos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
