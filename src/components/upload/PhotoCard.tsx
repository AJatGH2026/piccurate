'use client';

import type { ClientPhoto } from '@/types/photo';

interface PhotoCardProps {
  photo: ClientPhoto;
  onRemove: (id: string) => void;
}

export function PhotoCard({ photo, onRemove }: PhotoCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-zinc-300',
    extracting: 'bg-yellow-400 animate-pulse',
    generating: 'bg-blue-400 animate-pulse',
    ready: 'bg-green-500',
    uploading: 'bg-indigo-500 animate-pulse',
    uploaded: 'bg-green-600',
    error: 'bg-red-500',
  };

  return (
    <div className="relative group rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-square">
      {/* Thumbnail image */}
      {photo.thumbnailUrl ? (
        <img
          src={photo.thumbnailUrl}
          alt={photo.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Status indicator */}
      <div
        className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${statusColors[photo.status]}`}
        title={photo.status}
      />

      {/* Remove button (visible on hover) */}
      <button
        onClick={() => onRemove(photo.id)}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        title="Remove"
      >
        x
      </button>

      {/* EXIF info overlay (visible on hover) */}
      {photo.exif && photo.status === 'ready' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.exif.dateTaken && (
            <div>{new Date(photo.exif.dateTaken).toLocaleDateString()}</div>
          )}
          {photo.exif.cameraModel && <div>{photo.exif.cameraModel}</div>}
        </div>
      )}

      {/* Error overlay */}
      {photo.status === 'error' && (
        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
          <span className="text-xs text-red-700 bg-white/80 px-2 py-1 rounded">
            {photo.error || 'Error'}
          </span>
        </div>
      )}
    </div>
  );
}
