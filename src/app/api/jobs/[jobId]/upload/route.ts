import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { getStorage } from '@/lib/storage/interface';
import type { ApiResponse, UploadPhotoMeta } from '@/types/api';
import { v4 as uuidv4 } from 'uuid';

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/jobs/[jobId]/upload
 *
 * Receives a batch of thumbnails + metadata.
 * Expects multipart/form-data with:
 * - files: thumbnail JPEGs (field name: "thumbnails")
 * - metadata: JSON array of UploadPhotoMeta (field name: "metadata")
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

    // Verify job ownership and status
    const jobManager = new JobManager(supabase);
    const job = await jobManager.getJob(jobId);

    if (!job || job.userId !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (!['created', 'uploading'].includes(job.status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot upload to job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Check payment status for paid tiers
    if (job.tier !== 'free' && job.paymentStatus !== 'paid') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Payment required before uploading' },
        { status: 402 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const metadataStr = formData.get('metadata') as string;
    const thumbnailFiles = formData.getAll('thumbnails') as File[];

    if (!metadataStr || thumbnailFiles.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing metadata or thumbnail files' },
        { status: 400 }
      );
    }

    const metadataList: UploadPhotoMeta[] = JSON.parse(metadataStr);

    if (metadataList.length !== thumbnailFiles.length) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Metadata count does not match file count' },
        { status: 400 }
      );
    }

    // Check photo limit
    if (job.photoCount + thumbnailFiles.length > job.photoLimit) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Upload would exceed photo limit (${job.photoLimit}). Current: ${job.photoCount}, uploading: ${thumbnailFiles.length}`,
        },
        { status: 400 }
      );
    }

    // Store thumbnails and create photo records
    const storage = await getStorage();
    const photoRecords = [];

    for (let i = 0; i < thumbnailFiles.length; i++) {
      const file = thumbnailFiles[i];
      const meta = metadataList[i];
      const photoId = uuidv4();
      const key = `${jobId}/${photoId}.jpg`;

      // Store thumbnail
      const buffer = Buffer.from(await file.arrayBuffer());
      await storage.put(key, buffer, 'image/jpeg');

      // Prepare database record
      photoRecords.push({
        id: photoId,
        job_id: jobId,
        filename: meta.filename,
        thumbnail_key: key,
        original_width: meta.originalWidth,
        original_height: meta.originalHeight,
        file_size_bytes: meta.fileSizeBytes,
        taken_at: meta.dateTaken,
        latitude: meta.latitude,
        longitude: meta.longitude,
        camera_make: meta.cameraMake,
        camera_model: meta.cameraModel,
        orientation: meta.orientation,
      });
    }

    // Batch insert photo records
    const { error: insertError } = await supabase
      .from('photos')
      .insert(photoRecords);

    if (insertError) {
      // Clean up stored files on failure
      for (const record of photoRecords) {
        await storage.delete(record.thumbnail_key);
      }
      throw new Error(`Failed to insert photos: ${insertError.message}`);
    }

    // Update job photo count and status
    await jobManager.incrementPhotoCount(jobId, thumbnailFiles.length);
    if (job.status === 'created') {
      await jobManager.updateStatus(jobId, 'uploading');
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        uploaded: thumbnailFiles.length,
        totalPhotos: job.photoCount + thumbnailFiles.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';

    if (message === 'PHOTO_LIMIT_EXCEEDED') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Photo limit exceeded for this tier' },
        { status: 400 }
      );
    }

    console.error('POST /api/jobs/[jobId]/upload error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
