import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { getStorage } from '@/lib/storage/interface';
import { buildZip } from '@/services/zip-builder';
import type { ApiResponse } from '@/types/api';

type Params = { params: Promise<{ jobId: string }> };

/**
 * GET /api/jobs/[jobId]/download
 *
 * Generates a ZIP of selected photo thumbnails and returns it.
 * In the full version, the client uploads originals and we ZIP those.
 * For MVP, we ZIP the thumbnails (which demonstrates the flow).
 */
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

    if (job.status !== 'ready') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job is not ready for download' },
        { status: 400 }
      );
    }

    // Fetch selected photos
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('filename, thumbnail_key')
      .eq('job_id', jobId)
      .eq('selected', true)
      .order('taken_at', { ascending: true });

    if (fetchError || !photos || photos.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No selected photos found' },
        { status: 400 }
      );
    }

    // Load thumbnails from storage
    const storage = await getStorage();
    const files: { name: string; data: Buffer }[] = [];

    for (const photo of photos) {
      const data = await storage.get(photo.thumbnail_key);
      if (data) {
        files.push({ name: photo.filename, data });
      }
    }

    if (files.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Could not load photo files' },
        { status: 500 }
      );
    }

    // Build ZIP
    const zipBuffer = await buildZip(files);

    // Return as downloadable file
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="piccurate-${jobId.slice(0, 8)}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('GET /api/jobs/[jobId]/download error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    );
  }
}
