import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { ApiResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/claim
 *
 * Second half of the login-path ownership handshake — call this right after
 * `supabase.auth.signInWithPassword()` resolves, with the token from
 * POST /api/jobs/[jobId]/claim-token (obtained BEFORE that call, while the
 * session still owned the job). See migration 008 / review-notes.md point 1.
 *
 * Runs on the admin client on purpose: the now-authenticated user does not
 * own this row yet — that is the entire problem being solved — so the normal
 * RLS UPDATE policy (`auth.uid() = user_id`) would refuse the transfer. The
 * token, checked and consumed atomically in JobManager.redeemClaimToken, is
 * what stands in for that policy here.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;
    const body = (await request.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === 'string' ? body.token : '';

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Anonymous here would mean signInWithPassword never actually ran (or
    // failed) — nothing to claim into.
    if (!user || user.is_anonymous) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing token' }, { status: 400 });
    }

    const claimed = await new JobManager(createAdminClient()).redeemClaimToken(jobId, token, user.id);

    return NextResponse.json<ApiResponse<{ claimed: boolean }>>({ success: true, data: { claimed } });
  } catch (err) {
    console.error('POST /api/jobs/[jobId]/claim error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Could not claim the job.' }, { status: 500 });
  }
}
