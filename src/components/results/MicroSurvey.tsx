'use client';

import { useTranslations } from 'next-intl';
import { trackEv } from '@/lib/events-client';

type Answer = 'fast_alle' | 'etwa_haelfte' | 'wenige';
const ANSWERS: Answer[] = ['fast_alle', 'etwa_haelfte', 'wenige'];
const LABEL_KEY: Record<Answer, 'microSurveyFastAlle' | 'microSurveyEtwaHaelfte' | 'microSurveyWenige'> = {
  fast_alle: 'microSurveyFastAlle',
  etwa_haelfte: 'microSurveyEtwaHaelfte',
  wenige: 'microSurveyWenige',
};

/**
 * Event-Spezifikation §6: one-click question shown right after a completed
 * download. `micro_survey_shown` fires from the parent (results/page.tsx) at
 * the same point the survey becomes visible — this component only owns the
 * answer click.
 */
export function MicroSurvey({ locale, answered, onAnswered }: { locale: string; answered: boolean; onAnswered: () => void }) {
  const t = useTranslations('results');

  if (answered) {
    return (
      <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-indigo-600 dark:text-indigo-400">
        {t('microSurveyThanks')}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('microSurveyQuestion')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              trackEv('micro_survey_answered', locale, { answer: a });
              onAnswered();
            }}
            className="rounded-full border border-zinc-300 dark:border-zinc-600 px-4 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t(LABEL_KEY[a])}
          </button>
        ))}
      </div>
    </div>
  );
}
