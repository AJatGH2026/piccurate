'use client';

import { useTranslations } from 'next-intl';

interface SelectionStatsProps {
  selected: number;
  total: number;
  sceneBreakdown: Record<string, number>;
}

export function SelectionStats({ selected, total, sceneBreakdown }: SelectionStatsProps) {
  const t = useTranslations('review');
  const percentage = total > 0 ? Math.round((selected / total) * 100) : 0;

  const sortedScenes = Object.entries(sceneBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
      <div className="text-center">
        <div className="text-3xl font-bold text-indigo-600">{selected}</div>
        <div className="text-sm text-zinc-500">
          {t('subtitle', { selected, total })} ({percentage}%)
        </div>
      </div>

      {sortedScenes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {sortedScenes.map(([scene, count]) => (
            <span
              key={scene}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400"
            >
              {scene}
              <span className="font-medium text-zinc-900 dark:text-zinc-200">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
