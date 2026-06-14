'use client';

import { useTranslations } from 'next-intl';

interface UploadProgressProps {
  processedCount: number;
  totalCount: number;
  isProcessing: boolean;
}

export function UploadProgress({
  processedCount,
  totalCount,
  isProcessing,
}: UploadProgressProps) {
  const t = useTranslations('upload');
  const percentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  if (totalCount === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-zinc-600 dark:text-zinc-400">
          {isProcessing
            ? t('processing', { current: processedCount, total: totalCount })
            : t('ready', { count: processedCount })}
        </span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{percentage}%</span>
      </div>
      <div className="w-full bg-zinc-200 rounded-full h-2 dark:bg-zinc-700">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isProcessing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
