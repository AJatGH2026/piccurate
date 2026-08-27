import { createAdminClient } from '@/lib/supabase/server';
import { emailConfigured, sendOrderConfirmation } from '@/lib/email';
import { freeTierLabel, paidTierLabel } from '@/lib/contract-confirmation';

/**
 * Mail the § 312f confirmation for one job, at most once.
 *
 * Two callers, because since 2026-08-27 the address can turn up at either of
 * two moments: POST /api/jobs when the visitor already had an account, and the
 * download gate's registration when they did not. `jobs.confirmation_sent_at`
 * is what keeps the second from repeating the first.
 *
 * Never throws. A missing address, an unconfigured mailer or a refused send is
 * logged and reported as `false` — the contract exists either way, and neither
 * caller may fail the user's request over our outage.
 *
 * The claim to check before trusting a `true`: the row is stamped only after
 * the send succeeds, so a failure leaves the job eligible for a later retry.
 */
export async function sendContractConfirmationOnce(jobId: string, uiLocale?: string): Promise<boolean> {
  try {
    // Admin client on purpose: this reads and writes a compliance timestamp
    // that the browser must neither see nor set, and it runs after the caller
    // has already verified the session owns this job.
    const admin = createAdminClient();
    const { data: job } = await admin
      .from('jobs')
      .select('id, user_id, tier, photo_limit, payment_status, created_at, confirmation_sent_at')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) {
      console.error(`[confirmation] ${jobId}: job not found`);
      return false;
    }
    if (job.confirmation_sent_at) return true; // already discharged
    // A job settled through Stripe gets its confirmation from the webhook,
    // which knows the amount actually charged. Sending from here would state a
    // price we would have to invent.
    if (job.payment_status === 'paid') return false;

    const { data: profile } = await admin
      .from('profiles')
      .select('email, locale')
      .eq('id', job.user_id)
      .maybeSingle();

    const to = profile?.email || '';
    if (!to) {
      // The normal case for an anonymous visitor mid-analysis, not a fault.
      // Stays quiet at info level so the genuinely broken cases below remain
      // visible in the log.
      console.info(`[confirmation] ${jobId}: no address yet, deferred`);
      return false;
    }
    if (!emailConfigured()) {
      console.error(`[confirmation] ${jobId}: RESEND_API_KEY unset, confirmation NOT sent`);
      return false;
    }

    // The UI locale wins over the stored preference: the confirmation must be
    // in the language the contract was actually concluded in. Falls back to the
    // profile, then English.
    const locale = uiLocale === 'de' || uiLocale === 'en' ? uiLocale : profile?.locale === 'de' ? 'de' : 'en';

    // `free: true` for every job that gets here, and that is not a shortcut:
    // the paid-and-charged case returned above, so what remains is the free
    // tier and a tier unlocked as a beta grant — in both, no money changed
    // hands and "kostenlos" is the accurate statement. Only the tier's label
    // differs, so a granted L still reads as L rather than as the free plan.
    const ok = await sendOrderConfirmation({
      to,
      free: true,
      tierLabel: job.tier === 'free' ? freeTierLabel(locale) : paidTierLabel(String(job.tier)),
      photoLimit: job.photo_limit,
      orderRef: job.id,
      placedAt: new Date(job.created_at),
      locale,
    });

    if (!ok) {
      console.error(`[confirmation] ${jobId}: contract confirmation failed to send`);
      return false;
    }

    await admin.from('jobs').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', jobId);
    return true;
  } catch (err) {
    console.error(`[confirmation] ${jobId}: error:`, err);
    return false;
  }
}
