'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * The confirmation stage of the § 356a BGB withdrawal function.
 *
 * Stage 1 is the "Vertrag widerrufen" link in the footer, which lands here;
 * stage 2 is the "Widerruf bestätigen" button below. The statute wants those
 * two steps kept apart so a single stray click cannot declare a withdrawal.
 *
 * Only the three items § 356a Abs. 2 lists are asked for. Anything else would
 * be a hurdle in front of a statutory right, and an optional note covers the
 * "which part of the contract" case without making it a condition.
 *
 * The two bot signals sent along with them — a hidden field and the time spent
 * on the form — cost a human nothing: no puzzle, no third-party script, no
 * extra click. See the route handler for why they are there and why a rejection
 * is never silent.
 */
export function WithdrawalForm({ locale }: { locale: string }) {
  const t = useTranslations('withdrawal');
  const [name, setName] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — see the hidden field below
  const mountedAt = useRef(Date.now());
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contractRef,
          email,
          note,
          locale,
          website,
          elapsedMs: Date.now() - mountedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === 'rate_limited'
            ? t('errorRateLimited')
            : data.error === 'missing_fields'
              ? t('errorMissing')
              : t('errorSend')
        );
        setState('error');
        return;
      }
      setReceivedAt(data.receivedAt || null);
      setState('done');
    } catch {
      setError(t('errorSend'));
      setState('error');
    }
  };

  if (state === 'done') {
    const stamp = receivedAt
      ? new Date(receivedAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', {
          timeZone: 'Europe/Berlin',
          dateStyle: 'long',
          timeStyle: 'medium',
        })
      : '';
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/30">
        <h2 className="font-bold text-green-900 dark:text-green-200">{t('doneTitle')}</h2>
        {stamp && <p className="mt-2 text-sm text-green-900 dark:text-green-200">{t('doneAt', { stamp })}</p>}
        <p className="mt-2 text-sm text-green-900 dark:text-green-200">{t('doneReceipt', { email })}</p>
        <p className="mt-2 text-sm text-green-800 dark:text-green-300">{t('doneNotAssessed')}</p>
      </div>
    );
  }

  const field =
    'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
  const label = 'block text-sm font-medium text-zinc-800 dark:text-zinc-200';

  return (
    <form onSubmit={submit} className="space-y-4">
      {/*
        Honeypot. Off-screen rather than `display:none`, because some bots skip
        undisplayed inputs; `aria-hidden` plus `tabIndex={-1}` keeps it out of
        the reach of a screen reader and of the tab order, and `autoComplete="off"`
        keeps a password manager from filling it on a human's behalf. Nobody
        using the form can reach it, so anything in it came from a script.
      */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="w-website">Website</label>
        <input
          id="w-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <div>
        <label className={label} htmlFor="w-name">
          {t('fieldName')}
        </label>
        <input
          id="w-name"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          autoComplete="name"
        />
      </div>
      <div>
        <label className={label} htmlFor="w-contract">
          {t('fieldContract')}
        </label>
        <input
          id="w-contract"
          className={field}
          value={contractRef}
          onChange={(e) => setContractRef(e.target.value)}
          required
          maxLength={200}
        />
        <p className="mt-1 text-xs text-zinc-500">{t('fieldContractHint')}</p>
      </div>
      <div>
        <label className={label} htmlFor="w-email">
          {t('fieldEmail')}
        </label>
        <input
          id="w-email"
          type="email"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
          autoComplete="email"
        />
        <p className="mt-1 text-xs text-zinc-500">{t('fieldEmailHint')}</p>
      </div>
      <div>
        <label className={label} htmlFor="w-note">
          {t('fieldNote')}
        </label>
        <textarea
          id="w-note"
          className={field}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
        />
        <p className="mt-1 text-xs text-zinc-500">{t('fieldNoteHint')}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {state === 'sending' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
