import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { ApiResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/claim-token
 *
 * First half of the login-path ownership handshake (review-notes.md point 1,
 * migration 008). Call this BEFORE `supabase.auth.signInWithPassword()` —
 * with the still-anonymous session that owns the job — to get a short-lived,
 * single-use token. Redeem it after the session switches via
 * POST /api/jobs/[jobId]/claim.
 *
 * Ownership is established with the user-scoped client — the same RLS policy
 * (`auth.uid() = user_id`) every other job read relies on. Only the token
 * itself is written with the service-role client (migration 011: the token
 * columns are no longer writable by the user).
 *
 * Anonymous sessions only: the handshake carries a job from an anonymous
 * session into the account its visitor then signs in to. A signed-in account
 * has nothing to hand over.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = user.is_anonymous
      ? await new JobManager(supabase).issueClaimToken(jobId, user.id, createAdminClient())
      : null;
    if (!token) {
      // Either no such job, or the caller does not own it — same response
      // either way, matching /confirmation's reasoning: this id travels
      // through the browser, so the two cases must not be distinguishable.
      return NextResponse.json<ApiResponse>({ success: false, error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<{ token: string }>>({ success: true, data: { token } });
  } catch (err) {
    console.error('POST /api/jobs/[jobId]/claim-token error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Could not issue a claim token.' }, { status: 500 });
  }
}
