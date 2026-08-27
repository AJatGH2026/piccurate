import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { sendContractConfirmationOnce } from '@/lib/send-contract-confirmation';
import type { ApiResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/confirmation
 *
 * Sends the § 312f BGB confirmation for a job whose owner has an address now
 * but did not when the contract was concluded — the normal case since the
 * account gate moved to the ZIP download: the analysis runs anonymously, and
 * the address only arrives when the visitor registers to download.
 *
 * Called by the download gate once the account is confirmed. Idempotent via
 * `jobs.confirmation_sent_at`, so a reload, a second tab or a retried poll
 * cannot produce a second mail.
 *
 * Answers 200 even when nothing was sent. The caller is a download the user is
 * waiting on; failing it because our mailer is down would punish them for our
 * outage, and the send is retried the next time this is called. `sent` says
 * what actually happened, for the caller that wants to know.
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

    // Ownership, not just authentication: the job id travels through the
    // browser, so without this any signed-in user could trigger a mail to a
    // stranger's address by guessing one.
    const job = await new JobManager(supabase).getJob(jobId);
    if (!job || job.userId !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const locale = String(new URL(request.url).searchParams.get('locale') || '');
    const sent = await sendContractConfirmationOnce(jobId, locale);

    return NextResponse.json<ApiResponse<{ sent: boolean }>>({ success: true, data: { sent } });
  } catch (err) {
    console.error('POST /api/jobs/[jobId]/confirmation error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Could not send the contract confirmation.' },
      { status: 500 }
    );
  }
}
