import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { analyzePhotos } from '@/services/ai-analyzer';
import { computePhash } from '@/services/phash';
import { getStorage } from '@/lib/storage/interface';
import type { ApiResponse, AnalyzeResponse } from '@/types/api';
import type { EXIFData } from '@/types/photo';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/analyze
 *
 * Triggers AI analysis on all uploaded photos for a job.
 * This is the most expensive operation — calls Claude Vision API.
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

    // Verify job
    const jobManager = new JobManager(supabase);
    const job = await jobManager.getJob(jobId);

    if (!job || job.userId !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (!['uploading', 'created'].includes(job.status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot analyze job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Update status to analyzing
    await jobManager.updateStatus(jobId, 'analyzing');

    // Fetch all photos for this job
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, thumbnail_key, filename, taken_at, latitude, longitude, camera_make, camera_model, original_width, original_height, file_size_bytes, orientation')
      .eq('job_id', jobId)
      .order('taken_at', { ascending: true, nullsFirst: false });

    if (fetchError || !photos || photos.length === 0) {
      await jobManager.updateStatus(jobId, 'failed');
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No photos found for this job' },
        { status: 400 }
      );
    }

    // Build photo analysis input
    const photosForAnalysis = photos.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      thumbnailKey: p.thumbnail_key as string,
      filename: p.filename as string,
      exif: {
        dateTaken: p.taken_at as string | null,
        latitude: p.latitude as number | null,
        longitude: p.longitude as number | null,
        cameraMake: p.camera_make as string | null,
        cameraModel: p.camera_model as string | null,
        orientation: p.orientation as number | null,
        originalWidth: p.original_width as number | null,
        originalHeight: p.original_height as number | null,
        fileSizeBytes: (p.file_size_bytes as number) || 0,
      } satisfies EXIFData,
    }));

    // Run AI analysis
    console.log(`[Analyze] Starting AI analysis for job ${jobId}: ${photos.length} photos`);
    const analysisResults = await analyzePhotos(photosForAnalysis);

    // Compute perceptual hashes in parallel
    const storage = await getStorage();
    const phashPromises = photos.map(async (p: Record<string, unknown>) => {
      try {
        const buffer = await storage.get(p.thumbnail_key as string);
        if (!buffer) return { id: p.id, phash: null };
        const phash = await computePhash(buffer);
        return { id: p.id, phash };
      } catch {
        return { id: p.id, phash: null };
      }
    });
    const phashResults = await Promise.all(phashPromises);
    const phashMap = new Map(phashResults.map((r) => [r.id, r.phash]));

    // Update each photo with analysis results and phash
    for (const result of analysisResults) {
      const phash = phashMap.get(result.photoId) ?? null;
      const a = result.analysis;

      const { error: updateError } = await supabase
        .from('photos')
        .update({
          aesthetic_score: a.aestheticScore,
          sharpness_score: a.sharpnessScore,
          face_count: a.faceAnalysis.count,
          faces_eyes_open: a.faceAnalysis.eyesOpen,
          faces_expression: a.faceAnalysis.expression,
          has_animal: a.animalAnalysis.present,
          animal_clarity: Math.round(a.animalAnalysis.clarityScore),
          animal_proximity: Math.round(a.animalAnalysis.proximityScore),
          scene_type: a.sceneType,
          content_tags: a.contentTags,
          phash,
        })
        .eq('id', result.photoId);

      if (updateError) {
        console.error(`[Analyze] Failed to update photo ${result.photoId}:`, updateError);
      }
    }

    // Update job status
    await jobManager.updateStatus(jobId, 'selecting');

    // If this was a free tier job, mark free tier as used
    if (job.tier === 'free') {
      await jobManager.markFreeTierUsed(user.id);
    }

    const response: AnalyzeResponse = {
      analyzedCount: analysisResults.length,
      status: 'selecting',
    };

    console.log(`[Analyze] Completed: ${analysisResults.length} photos analyzed for job ${jobId}`);

    return NextResponse.json<ApiResponse<AnalyzeResponse>>({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error('POST /api/jobs/[jobId]/analyze error:', err);

    // Try to mark job as failed
    try {
      const { jobId } = await params;
      const supabase = await createServerSupabaseClient();
      const jobManager = new JobManager(supabase);
      await jobManager.updateStatus(jobId, 'failed');
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
