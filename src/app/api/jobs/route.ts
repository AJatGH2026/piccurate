import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { CreateJobRequest, CreateJobResponse, ApiResponse } from '@/types/api';
import type { Tier } from '@/types/job';
import { getPlan } from '@/types/pricing';
import { betaOpenAccess, remainingPhotoBudget, ACCESS_ERRORS } from '@/lib/access';
import { clientIp } from '@/lib/rate-limit';
import { emailConfigured, sendOrderConfirmation } from '@/lib/email';

const VALID_TIERS: Tier[] = ['free', 'small', 'medium', 'large'];

/** POST /api/jobs — Create a new curation job */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Anonymous accounts are real auth users, so a job can always be attached to
    // one — but once the beta ends they must convert to a permanent account
    // before starting a job, otherwise `free_tier_used` guards nothing.
    if (user.is_anonymous && !betaOpenAccess()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: ACCESS_ERRORS.accountRequired },
        { status: 401 }
      );
    }

    const body: CreateJobRequest = await request.json();

    if (!VALID_TIERS.includes(body.tier)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid tier' },
        { status: 400 }
      );
    }

    // Refuse a run the daily caps cannot finish, before a job exists and before
    // a single token is spent. `photoCount` is advisory (the client's plan for
    // this run); the per-request and per-IP caps in the analysis route remain
    // the hard guards.
    //
    // Skipped for a tier the user unlocked as a beta grant: the allowance is
    // larger than the per-IP daily cap by design, so pre-flighting it against
    // that cap would refuse the very run we invited them to make. The analysis
    // route raises the same ceiling for granted jobs.
    const photoCount = Number((body as { photoCount?: number }).photoCount ?? 0);
    let granted = false;
    if (body.tier !== 'free') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('beta_grant_tier')
        .eq('id', user.id)
        .maybeSingle();
      granted = profile?.beta_grant_tier === body.tier;
    }
    if (photoCount > 0 && !granted) {
      const remaining = await remainingPhotoBudget(clientIp(request));
      if (remaining != null && photoCount > remaining) {
        return NextResponse.json(
          { success: false, error: ACCESS_ERRORS.budgetExceeded, remaining },
          { status: 429, headers: { 'Retry-After': '3600' } }
        );
      }
    }

    const jobManager = new JobManager(supabase);
    const job = await jobManager.createJob(user.id, body.tier);
    const plan = getPlan(body.tier);

    // § 312f BGB for the FREE tier. The paid tiers get their confirmation from
    // the Stripe webhook; a free contract has no payment and therefore no
    // webhook, so this is its only trigger. It belongs here because this is
    // where the contract is formed — terms § 3: accepting the terms and
    // starting the analysis — and § 312f Abs. 2 wants the confirmation before
    // performance begins, which is the analysis that follows this call.
    //
    // Never fail the request on a mail error: the contract exists either way,
    // and refusing the job would punish the user for our outage. Loud in the
    // log instead, exactly as the webhook treats the same failure.
    if (body.tier === 'free') {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, locale')
          .eq('id', user.id)
          .maybeSingle();
        const to = profile?.email || user.email || '';
        // The UI locale wins over the stored preference: the confirmation must
        // be in the language the contract was actually concluded in. Falls back
        // to the profile, then English. Validated here — it arrives from the
        // client and must never reach the mail as free text.
        const requested = String(body.locale || '').toLowerCase();
        const locale =
          requested === 'de' || requested === 'en'
            ? requested
            : profile?.locale === 'de'
              ? 'de'
              : 'en';
        if (!to) {
          console.error(`[jobs] ${job.id}: no address for the free-tier contract confirmation`);
        } else if (!emailConfigured()) {
          console.error(`[jobs] ${job.id}: RESEND_API_KEY unset, confirmation NOT sent`);
        } else {
          const ok = await sendOrderConfirmation({
            to,
            free: true,
            tierLabel: plan.tier,
            photoLimit: job.photoLimit,
            orderRef: job.id,
            placedAt: new Date(),
            locale,
          });
          if (!ok) console.error(`[jobs] ${job.id}: free-tier contract confirmation failed to send`);
        }
      } catch (mailErr) {
        console.error(`[jobs] ${job.id}: confirmation error:`, mailErr);
      }
    }

    const response: CreateJobResponse = {
      jobId: job.id,
      tier: job.tier,
      photoLimit: job.photoLimit,
      requiresPayment: body.tier !== 'free',
    };

    return NextResponse.json<ApiResponse<CreateJobResponse>>(
      { success: true, data: response },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';

    if (message === 'FREE_TIER_ALREADY_USED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Free tier has already been used. Please select a paid tier.' },
        { status: 409 }
      );
    }

    console.error('POST /api/jobs error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/** GET /api/jobs — List user's jobs */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobManager = new JobManager(supabase);
    const jobs = await jobManager.listJobs(user.id);

    return NextResponse.json<ApiResponse>({ success: true, data: jobs });
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
