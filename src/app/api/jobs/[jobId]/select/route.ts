import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { selectPhotos } from '@/services/selection-engine';
import type { ApiResponse, SelectRequest, SelectResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/select
 *
 * Runs the selection engine on analyzed photos.
 * Requires criteria in the request body.
 */
export async function POST(request: NextRequest, { params }: Params) {
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

    if (!['selecting', 'ready'].includes(job.status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot select for job with status: ${job.status}. Photos must be analyzed first.` },
        { status: 400 }
      );
    }

    // Parse criteria from request
    const body: SelectRequest = await request.json();
    const criteria = body.criteria;

    // Save criteria to job
    await jobManager.updateCriteria(jobId, criteria);

    // Fetch all analyzed photos
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('job_id', jobId)
      .not('aesthetic_score', 'is', null) // Only analyzed photos
      .order('taken_at', { ascending: true, nullsFirst: false });

    if (fetchError || !photos || photos.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No analyzed photos found' },
        { status: 400 }
      );
    }

    // Run selection engine
    console.log(`[Select] Running selection on ${photos.length} photos for job ${jobId}`);
    const summary = selectPhotos(photos as any, criteria);

    // Reset all selections first
    await supabase
      .from('photos')
      .update({ selected: false, reason_tag: null, selection_score: null })
      .eq('job_id', jobId);

    // Apply new selections
    for (const group of summary.groups) {
      for (const result of group.results) {
        if (result.selected) {
          await supabase
            .from('photos')
            .update({
              selected: true,
              reason_tag: result.reasonTag ? result.reasonTag.label : null,
              selection_score: result.score,
            })
            .eq('id', result.photoId);
        }
      }
    }

    // Update job status to ready
    await jobManager.updateStatus(jobId, 'ready');

    const response: SelectResponse = {
      selectedCount: summary.selectedPhotos,
      totalCount: summary.totalPhotos,
      groups: summary.groups.length,
    };

    console.log(
      `[Select] Completed: ${summary.selectedPhotos}/${summary.totalPhotos} selected (${summary.selectionPercentage}%) across ${summary.groups.length} groups`
    );

    return NextResponse.json<ApiResponse<SelectResponse>>({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error('POST /api/jobs/[jobId]/select error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Selection failed' },
      { status: 500 }
    );
  }
}
