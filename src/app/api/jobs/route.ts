import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { CreateJobRequest, CreateJobResponse, ApiResponse } from '@/types/api';
import type { Tier } from '@/types/job';
import { getPlan } from '@/types/pricing';
import { betaOpenAccess, remainingPhotoBudget, ACCESS_ERRORS } from '@/lib/access';
import { clientIp } from '@/lib/rate-limit';

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
    const photoCount = Number((body as { photoCount?: number }).photoCount ?? 0);
    if (photoCount > 0) {
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
