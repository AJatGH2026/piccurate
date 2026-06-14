import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import type { ApiResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/** GET /api/jobs/[jobId] — Get job details */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobManager = new JobManager(supabase);
    const job = await jobManager.getJob(jobId);

    if (!job || job.userId !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Also fetch photo counts
    const { data: photoStats } = await supabase
      .from('photos')
      .select('selected')
      .eq('job_id', jobId);

    const totalPhotos = photoStats?.length ?? 0;
    const selectedPhotos = photoStats?.filter((p: { selected: boolean }) => p.selected).length ?? 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { ...job, totalPhotos, selectedPhotos },
    });
  } catch (err) {
    console.error('GET /api/jobs/[jobId] error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** DELETE /api/jobs/[jobId] — Cancel and delete a job */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobManager = new JobManager(supabase);
    const job = await jobManager.getJob(jobId);

    if (!job || job.userId !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Clean up storage
    const { getStorage } = await import('@/lib/storage/interface');
    const storage = await getStorage();
    await storage.deletePrefix(`${jobId}/`);

    // Delete job (cascades to photos)
    await supabase.from('jobs').delete().eq('id', jobId);

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (err) {
    console.error('DELETE /api/jobs/[jobId] error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
