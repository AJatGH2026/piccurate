'use client';

interface ReviewPhotoCardProps {
  thumbnailUrl: string;
  filename: string;
  reasonTag: string | null;
  selected: boolean;
  saved?: boolean;
  sceneType: string | null;
  aestheticScore: number | null;
  sharpnessScore: number | null;
  contentTags: string[];
  latitude: number | null;
  longitude: number | null;
  /** Names of reference persons the AI recognised in this photo (lowercased). */
  persons?: string[];
  onToggle: () => void;
  onEnlarge?: () => void;
}

const SCENE_COLORS: Record<string, string> = {
  people: 'bg-pink-500',
  animal: 'bg-amber-500',
  landscape: 'bg-green-500',
  sunset: 'bg-orange-500',
  beach: 'bg-cyan-500',
  mountain: 'bg-emerald-600',
  nature: 'bg-lime-500',
  architecture: 'bg-violet-500',
  city: 'bg-slate-500',
  food: 'bg-red-500',
  street: 'bg-zinc-500',
  other: 'bg-zinc-400',
};

export function ReviewPhotoCard({
  thumbnailUrl,
  filename,
  reasonTag,
  selected,
  saved = false,
  sceneType,
  aestheticScore,
  sharpnessScore,
  contentTags,
  latitude,
  longitude,
  persons,
  onToggle,
  onEnlarge,
}: ReviewPhotoCardProps) {
  const badgeColor = SCENE_COLORS[sceneType || 'other'] || 'bg-zinc-400';
  const hasLocation = latitude != null && longitude != null;

  return (
    <div
      className={`relative group rounded-lg overflow-hidden cursor-pointer transition-all ${
        saved
          ? 'ring-2 ring-emerald-500 shadow-md'
          : selected
            ? 'ring-2 ring-indigo-500 shadow-md'
            : 'opacity-50 hover:opacity-75'
      }`}
      onClick={onToggle}
      title={saved ? 'Gespeichert — klicken zum Entfernen' : undefined}
    >
      {/* Thumbnail */}
      <div className="aspect-square">
        <img
          src={thumbnailUrl}
          alt={filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Selection / saved indicator */}
      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          saved
            ? 'bg-emerald-600 text-white'
            : selected
              ? 'bg-indigo-600 text-white'
              : 'bg-black/40 text-white/60'
        }`}
      >
        {saved ? '🔒' : selected ? '✓' : ''}
      </div>

      {/* Enlarge / preview button — visible on hover, doesn't toggle selection */}
      {onEnlarge && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnlarge();
          }}
          className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/70 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-opacity"
          title="Vergrößern"
          aria-label="Vergrößern"
        >
          ⤢
        </button>
      )}

      {/* Scene type badge + person chips — always visible so you can tell
          at a glance which reference person the AI recognised. */}
      {(sceneType || (persons && persons.length > 0)) && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-3.5rem)]">
          {sceneType && (
            <span className={`${badgeColor} text-white text-[9px] px-1.5 py-0.5 rounded font-medium`}>
              {sceneType}
            </span>
          )}
          {persons?.map((name) => (
            <span
              key={name}
              className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded font-medium"
              title={`Erkannt: ${name}`}
            >
              👤 {name}
            </span>
          ))}
        </div>
      )}

      {/* Location pin — visible when GPS data exists */}
      {hasLocation && (
        <a
          href={`https://maps.google.com/?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-10 bg-black/50 hover:bg-black/70 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors"
          title={`${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`}
        >
          📍
        </a>
      )}

      {/* Scores — visible on hover */}
      <div className="absolute top-7 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-1">
        {aestheticScore != null && (
          <span className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
            quality {aestheticScore}/10
          </span>
        )}
        {sharpnessScore != null && (
          <span className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
            sharp {sharpnessScore}/10
          </span>
        )}
      </div>

      {/* Reason tag / content tags at bottom */}
      {(reasonTag || contentTags.length > 0) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 pt-6">
          {selected && reasonTag ? (
            <span className="text-[10px] text-white leading-tight line-clamp-2 font-medium">
              {reasonTag}
            </span>
          ) : (
            <span className="text-[9px] text-white/70 leading-tight line-clamp-1">
              {contentTags.slice(0, 3).join(' · ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
