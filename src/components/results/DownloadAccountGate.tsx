'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { clientConfig } from '@/lib/config';
import { Honeypot, useBotSignals } from '@/components/forms/Honeypot';

const POLL_INTERVAL_MS = 4_000;
const RESEND_COOLDOWN_S = 30;

/**
 * The account gate in front of the ZIP download.
 *
 * It sits here, and not on the upload page, since 2026-08-27: analysing and
 * seeing the result are the free service in full (terms § 3), and asking for
 * an address before any of that had been shown was what campaign traffic died
 * on — 12 visitors reached the old gate, none registered.
 *
 * **Everything happens in this tab, on purpose.** `usePhotoStore` is plain
 * in-memory Zustand with no persistence, so sending someone to /auth/register
 * would destroy the very result they are trying to download. So: no
 * navigation, no redirect away from this page.
 *
 * Registering converts the ANONYMOUS auth user that already exists (created
 * when the analysis started) into a permanent one via `updateUser`. That keeps
 * the same `user.id`, so the job stays attached without any claim mechanism.
 *
 * **Logging in is different (fixed 2026-09-01, review-notes.md point 1):**
 * `signInWithPassword` REPLACES the session with a different, existing
 * account — the job's `user_id` is still the old anonymous one afterwards, so
 * the § 312f confirmation this dialog triggers on `onUnlocked` used to 404
 * silently for every returning visitor who chose Login over Register. Fixed
 * with a short-lived claim token: requested from `/api/jobs/[jobId]/claim-token`
 * BEFORE `signInWithPassword` (while the anonymous session still demonstrably
 * owns the job), redeemed at `/api/jobs/[jobId]/claim` right after (now
 * authenticated as the returning account) — see migration 008. Best-effort:
 * if `jobId` is absent or either call fails, login still proceeds and the
 * download still happens, just without the ownership transfer this time.
 *
 * **The download waits for the confirmation click (changed 2026-08-27).**
 * `updateUser` succeeding only means the address was well-formed and free to
 * claim — it is not proof anyone can receive mail there, and unlocking the
 * download at that point let any syntactically valid, unowned address in.
 * So this dialog now shows a "check your mail" screen and polls
 * `supabase.auth.getUser()` for `is_anonymous` to flip to `false` — the flag
 * GoTrue itself only flips once the link has actually been opened at
 * Supabase's `/auth/v1/verify` (see `/auth/callback`'s comment on why this
 * app never exchanges that code for a session itself). The moment that
 * happens, in this tab or any other, the poll here notices and starts the
 * download automatically — no extra click, and still no redirect away from
 * the result.
 */
export function DownloadAccountGate({
  locale,
  jobId,
  onClose,
  onUnlocked,
}: {
  locale: string;
  // Undefined only if the analysis somehow never produced a job — the claim
  // handshake below is then skipped, not attempted against `undefined`.
  jobId: string | undefined;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const t = useTranslations('results');
  const ta = useTranslations('auth');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { website, setWebsite, signals } = useBotSignals();

  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Read fresh inside the poll below without re-arming the interval on every
  // parent render — the parent passes a new `onUnlocked` closure each time.
  const onUnlockedRef = useRef(onUnlocked);
  useEffect(() => {
    onUnlockedRef.current = onUnlocked;
  });

  const checkConfirmed = async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user && !data.user.is_anonymous) {
      onUnlockedRef.current();
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!awaitingConfirmation) return;
    const id = setInterval(() => {
      checkConfirmed().catch(() => false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [awaitingConfirmation]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      if (mode === 'login') {
        // Claimed BEFORE signing in — see the file doc comment. Best-effort:
        // a request that never gets a token here still logs in and
        // downloads normally, it just cannot transfer ownership afterwards.
        let claimToken: string | null = null;
        if (jobId) {
          try {
            const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/claim-token`, { method: 'POST' });
            const json = await res.json();
            claimToken = typeof json?.data?.token === 'string' ? json.data.token : null;
          } catch {
            /* proceed without a token — see redeemClaim below */
          }
        }

        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error(err.message);

        if (jobId && claimToken) {
          // Awaited, unlike the confirmation POST below: onUnlocked() fires
          // that POST immediately, and its ownership check needs the
          // transfer to have already landed — a fire-and-forget here would
          // race it. Errors are swallowed, not surfaced: a failed claim must
          // not block the download the user is waiting for, and the worst
          // case is the pre-existing 404 this mechanism exists to avoid, not
          // a new failure mode.
          try {
            await fetch(`/api/jobs/${encodeURIComponent(jobId)}/claim`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: claimToken }),
            });
          } catch (e) {
            console.warn('[download-gate] claim failed:', e);
          }
        }

        onUnlocked();
        return;
      }
      // Bot signals are checked here rather than posted to /api/auth/register:
      // that route creates a NEW user, which would orphan the anonymous one
      // this result belongs to. Same filter, applied in place.
      const { website: hp, elapsedMs } = signals();
      if (hp.trim() || elapsedMs < 2500) throw new Error(ta('registerFailed'));
      const { error: err } = await supabase.auth.updateUser(
        {
          email,
          password,
          data: { locale, gdpr_consent_at: new Date().toISOString() },
        },
        // Without this, GoTrue falls back to the bare Site URL — the visitor
        // lands on the home page after clicking the confirmation link with no
        // indication anything happened, instead of a page that reflects what
        // it actually did. `source=download-gate` tells /auth/callback this
        // confirmation came from here, not from the ordinary signup form — see
        // that route's comment for why it skips the login page for this one.
        { emailRedirectTo: `${clientConfig.appUrl}/${locale}/auth/callback?source=download-gate` }
      );
      if (err) throw new Error(err.message);
      // Address accepted and mail sent — not unlocked yet, see the file doc comment above.
      setPendingEmail(email);
      setAwaitingConfirmation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('registerFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setCheckMessage(null);
    try {
      const ok = await checkConfirmed();
      if (!ok) setCheckMessage(t('downloadGateNotYetConfirmed'));
    } catch {
      setCheckMessage(t('downloadGateNotYetConfirmed'));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResendBusy(true);
    setCheckMessage(null);
    try {
      const supabase = createClient();
      // `email_change`, not `signup`: converting the anonymous user with
      // `updateUser({ email })` runs GoTrue's EMAIL CHANGE flow — the account
      // already exists, it is gaining an address, and that is also why the mail
      // comes from the "Change Email Address" template rather than "Confirm
      // signup". Resending as `signup` asks GoTrue to repeat a registration
      // that never happened. Falls back to `signup` for the case where the
      // account came from the ordinary register form and is merely being
      // confirmed from here.
      let { error: err } = await supabase.auth.resend({ type: 'email_change', email: pendingEmail });
      if (err) ({ error: err } = await supabase.auth.resend({ type: 'signup', email: pendingEmail }));
      if (err) throw err;
      setCheckMessage(t('downloadGateResendSent'));
      setResendCooldown(RESEND_COOLDOWN_S);
    } catch {
      setCheckMessage(t('downloadGateResendFailed'));
    } finally {
      setResendBusy(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl text-center">
          <div className="text-4xl mb-2">📬</div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('downloadGateAwaitingTitle')}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('downloadGateAwaitingBody', { email: pendingEmail })}
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('downloadGateKeepsResult')}</p>

          {checkMessage && (
            <div className="mt-4 p-3 rounded-lg bg-zinc-50 text-zinc-600 text-sm dark:bg-zinc-800 dark:text-zinc-300">
              {checkMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckNow}
            disabled={checking}
            className="mt-4 w-full rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {checking ? t('downloadGateBusy') : t('downloadGateCheckNow')}
          </button>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendBusy || resendCooldown > 0}
              className="text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
            >
              {resendCooldown > 0
                ? t('downloadGateResendCooldown', { seconds: resendCooldown })
                : t('downloadGateResend')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {t('downloadGateCancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('downloadGateTitle')}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('downloadGateBody')}</p>
        {/* Says the result is safe. Without it, leaving the dialog looks like
            it might cost the analysis — which is exactly what it would have
            done had this been a redirect. */}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('downloadGateKeepsResult')}</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <Honeypot id="dl-website" value={website} onChange={setWebsite} />
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={ta('email')}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={ta('passwordMinHint')}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {busy ? t('downloadGateBusy') : mode === 'login' ? ta('loginCta') : t('downloadGateSubmit')}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError(null);
            }}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {mode === 'register' ? ta('hasAccount') : ta('noAccount')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {t('downloadGateCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
