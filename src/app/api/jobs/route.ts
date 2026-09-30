import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { CreateJobRequest, CreateJobResponse, ApiResponse } from '@/types/api';
import type { Tier } from '@/types/job';
import { analysisRequiresAccount, remainingPhotoBudget, ACCESS_ERRORS } from '@/lib/access';
import { getGrantStatus } from '@/lib/grant';
import { clientIp } from '@/lib/rate-limit';
import { sendContractConfirmationOnce } from '@/lib/send-contract-confirmation';

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

    // Anonymous accounts are real auth users, so a job can always be attached
    // to one. Whether a PERMANENT account is required to get this far is a
    // separate switch from the payment rule below (split 2026-08-27) — today
    // it is not, because the free analysis is the whole free service and the
    // account belongs at the ZIP download instead.
    if (user.is_anonymous && analysisRequiresAccount()) {
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

    // A beta grant is a pot of photos held by ONE job for 30 days (lib/grant.ts).
    // Whoever has an active one runs against it — whatever tier the client
    // derived from its photo count, which only fits the purchase flow. Until
    // 2026-09-30 the tier had to match the granted tier exactly, so a "Large"
    // grant with 900 photos got a small job with no grant flag at all.
    const grant = user.is_anonymous ? null : await getGrantStatus(supabase, user.id);

    // Refuse a run the caps cannot finish, before a job exists and before a
    // single token is spent. `photoCount` is advisory (the client's plan for
    // this run); the checks in the analysis route remain the hard guards.
    //
    // A grant job is measured against what is left of its own allowance and the
    // global daily cap — not against the per-connection cap, which would refuse
    // the very run we invited them to make.
    const photoCount = Number((body as { photoCount?: number }).photoCount ?? 0);
    if (grant && photoCount > grant.remaining) {
      return NextResponse.json(
        {
          success: false,
          error: ACCESS_ERRORS.grantExhausted,
          remaining: grant.remaining,
          grantRemaining: true,
        },
        { status: 402 }
      );
    }
    if (photoCount > 0) {
      const remaining = await remainingPhotoBudget(clientIp(request), { skipIp: !!grant });
      if (remaining != null && photoCount > remaining) {
        return NextResponse.json(
          { success: false, error: ACCESS_ERRORS.budgetExceeded, remaining },
          { status: 429, headers: { 'Retry-After': '3600' } }
        );
      }
    }

    // The grant's job already exists (an earlier session, or another device on
    // the same account): use it rather than open a second one.
    if (grant?.jobId) {
      return NextResponse.json<ApiResponse<CreateJobResponse>>(
        {
          success: true,
          data: { jobId: grant.jobId, tier: grant.tier, photoLimit: grant.total, requiresPayment: false },
        },
        { status: 200 }
      );
    }

    // The language this contract is being concluded in. Computed before the job
    // exists because both the profile row and the § 312f confirmation need it.
    const requested = String(body.locale || '').toLowerCase();
    const contractLocale = requested === 'de' || requested === 'en' ? requested : null;

    // jobs.user_id references profiles(id), and that row is created by the
    // on_auth_user_created trigger on auth.users. On 2026-08-12 that trigger did
    // not exist in production, so every job insert failed with a raw
    // jobs_user_id_fkey error in the user's face. The trigger is back, but the
    // app cannot verify it is there — and the production database has already
    // drifted from supabase/migrations once.
    //
    // So do not depend on it: make sure the row exists first. Idempotent, and a
    // no-op whenever the trigger did its job. The id comes from the validated
    // session, never from the request body. Needs the admin client because
    // profiles has no INSERT policy (the trigger is SECURITY DEFINER instead).
    try {
      await createAdminClient()
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            locale: contractLocale ?? 'en',
            is_anonymous: !user.email,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
    } catch (profileErr) {
      // Never block on this: if the row already exists we did not need it, and
      // if it genuinely cannot be written the insert below reports the real
      // problem anyway.
      console.error(`[jobs] profile ensure failed for ${user.id}:`, profileErr);
    }

    // Created with the service-role client on purpose (migration 010): the row
    // carries the allowance, which is the server's to write. The owner is the
    // validated session user, never anything from the request body.
    const jobManager = new JobManager(createAdminClient());
    let job;
    if (grant) {
      try {
        job = await jobManager.createJob(user.id, grant.tier, {
          photoLimit: grant.total,
          expiresAt: grant.expiresAt,
        });
      } catch (err) {
        // Two devices created the grant's job at the same moment; the unique
        // index (migration 009) let one through. Hand out the winner's job.
        const raced = err instanceof Error && err.message.includes('jobs_one_grant_job_per_user');
        const existing = raced ? await getGrantStatus(supabase, user.id) : null;
        if (!existing?.jobId) throw err;
        return NextResponse.json<ApiResponse<CreateJobResponse>>(
          {
            success: true,
            data: {
              jobId: existing.jobId,
              tier: existing.tier,
              photoLimit: existing.total,
              requiresPayment: false,
            },
          },
          { status: 200 }
        );
      }
    } else {
      job = await jobManager.createJob(user.id, body.tier);
    }

    // § 312f BGB for the FREE tier. The paid tiers get their confirmation from
    // the Stripe webhook; a free contract has no payment and therefore no
    // webhook, so this is its first trigger. It belongs here because this is
    // where the contract is formed — terms § 3: accepting the terms and
    // starting the analysis — and § 312f Abs. 2 wants the confirmation before
    // performance begins, which is the analysis that follows this call.
    //
    // It is no longer the ONLY trigger. Since the account gate moved to the ZIP
    // download, most visitors are anonymous at this point and there is no
    // address to mail; the send is skipped and the job stays eligible, so
    // registering at the download gate discharges it later. What those visitors
    // get at *this* moment instead is the same text on screen, with a save
    // button — email was never the only durable medium (§ 126b), see
    // lib/contract-confirmation.ts.
    //
    // Never fail the request on a mail error: the contract exists either way,
    // and refusing the job would punish the user for our outage.
    if (!grant && body.tier === 'free') {
      await sendContractConfirmationOnce(job.id, contractLocale ?? undefined);
    }

    const response: CreateJobResponse = {
      jobId: job.id,
      tier: job.tier,
      photoLimit: job.photoLimit,
      requiresPayment: !grant && body.tier !== 'free',
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

    // The raw message belongs in the log, not in the dialog. A user once saw
    // `insert or update on table "jobs" violates foreign key constraint
    // "jobs_user_id_fkey"` — unreadable, and it hands out table and constraint
    // names. The client shows its own translated sentence on a 500.
    console.error('POST /api/jobs error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Could not create the analysis job.' },
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
