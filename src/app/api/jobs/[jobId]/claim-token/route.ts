import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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
 * Deliberately the user-scoped client, not the admin one: ownership here is
 * enforced by the same RLS policy (`auth.uid() = user_id`) every other job
 * read/write in this app relies on, not by a manual check that could drift
 * from it.
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

    const token = await new JobManager(supabase).issueClaimToken(jobId, user.id);
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
