'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ClientPhoto } from '@/types/photo';
import { extractEXIF } from '@/utils/exif';
import { decodePhoto, isHEIC, convertHEICtoJPEG } from '@/utils/image';
import { computePHash } from '@/utils/phash';
import { computeEmbedding } from '@/utils/embedding';
import { detectFaces, preloadFaceDetector } from '@/utils/faceDetection';
import { computeFaceEmbedding, preloadFaceEmbedder } from '@/utils/faceEmbedding';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { trackEv, mark, msSince, photoCountBucket } from '@/lib/events-client';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const MAX_CONCURRENT = 4;
// Face search holds a full-resolution ImageBitmap per in-flight photo on top
// of the normal decode (§ 5.3: "a handful of 12-MP bitmaps is a few hundred
// MB"), and for HEIC specifically that sits on top of a second decode (heic-to
// produces a JPEG blob, which then gets decoded again for the bitmap — see the
// comment in processNext). Reported 2026-08-15: hangs on iPhone Safari with
// face search active, HEIC photos, past ~60-100 in one session — iOS Safari's
// per-tab memory ceiling is much tighter than desktop's, and WASM linear
// memory (both the face models and heic-to's libheif) only grows across a
// session, never shrinks. Halving concurrency halves peak simultaneous
// bitmap + WASM pressure; only kicks in when face search is actually running,
// so the common case (no reference persons) is untouched.
const MAX_CONCURRENT_FACE_SEARCH = 2;

/**
 * Whether the local person search should run for this upload.
 *
 * Read from the store rather than passed in as an option, because the reference
 * persons are chosen on their own step before the upload (GATE 1, Entscheidung 8)
 * and nothing in between needs to thread the flag through.
 *
 * No reference persons → no face is detected and no embedding computed. That is
 * § 3 rule 1 ("der Nutzer aktiviert die Personensuche ausdrücklich selbst")
 * enforced in code rather than in prose.
 */
function wantFaceSearch(): boolean {
  return usePhotoStore.getState().persons.length > 0;
}

interface UseUploadOptions {
  maxPhotos: number;
  locale: string;
}

interface UseUploadReturn {
  photos: ClientPhoto[];
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  addFiles: (files: FileList | File[]) => void;
  removePhoto: (id: string) => void;
  retryFailed: () => void;
  failedCount: number;
  clearAll: () => void;
  error: string | null;
}

export function useUpload({ maxPhotos, locale }: UseUploadOptions): UseUploadReturn {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const processingQueue = useRef<ClientPhoto[]>([]);
  const activeCount = useRef(0);
  // Photos accepted so far, kept in a ref so the tier limit is checked against
  // the real total even when several imports land within one render.
  const acceptedCount = useRef(0);

  const processedCount = photos.filter(
    (p) => p.status === 'ready' || p.status === 'uploading' || p.status === 'uploaded'
  ).length;
  const totalCount = photos.length;
  const failedCount = photos.filter((p) => p.status === 'error').length;
  const isProcessing = photos.some(
    (p) => p.status === 'pending' || p.status === 'extracting' || p.status === 'generating'
  );

  // Event-Spezifikation §4: `file_transfer_ready` — "alle ausgewählten
  // Dateien im Browser lesbar". Fires once per processing batch, on the
  // isProcessing:true → false edge, to measure the iOS-optimised-storage
  // hypothesis in §4 (originals not on-device yet, so processing stalls
  // while they're pulled from iCloud). The ref avoids firing on the initial
  // mount, where isProcessing starts false with no photos.
  const wasProcessing = useRef(false);
  useEffect(() => {
    if (wasProcessing.current && !isProcessing && totalCount > 0) {
      trackEv('file_transfer_ready', locale, {
        photo_count: totalCount,
        duration_since_files_selected_ms: msSince('files_selected'),
      });
    }
    wasProcessing.current = isProcessing;
  }, [isProcessing, totalCount, locale]);

  const updatePhoto = useCallback((id: string, updates: Partial<ClientPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const processNext = useCallback(async () => {
    const concurrencyLimit = wantFaceSearch() ? MAX_CONCURRENT_FACE_SEARCH : MAX_CONCURRENT;
    if (activeCount.current >= concurrencyLimit || processingQueue.current.length === 0) return;

    activeCount.current++;
    const photo = processingQueue.current.shift()!;

    try {
      // Step 1: Extract EXIF from original (works for HEIC too)
      updatePhoto(photo.id, { status: 'extracting' });
      const exif = await extractEXIF(photo.file);

      // Is the local person search active for this run? Read once per photo:
      // the reference persons are chosen BEFORE the upload starts (GATE 1,
      // Entscheidung 8), precisely so this is knowable here. § 3 rule 1 says the
      // user activates the person search explicitly — so when they did not, no
      // face is ever detected or embedded.
      const faceSearchActive = wantFaceSearch();

      let thumbnailBlob: Blob;
      let faceBitmap: ImageBitmap | null = null;

      if (isHEIC(photo.file)) {
        // HEIC path: small files use the server (sharp handles orientation),
        // large files the browser (heic-to). Both output already-upright pixels.
        updatePhoto(photo.id, { status: 'generating', exif });
        if (faceSearchActive) {
          // Ask for the large uncropped frame (1600 px) instead of the 512
          // square: the square is centre-cropped, so anyone at the edge of the
          // frame is gone and background faces are 15-40 px. The thumbnail is
          // then derived locally from that same decode.
          const faceJpeg = await convertHEICtoJPEG(photo.file, false, { face: true });
          const decoded = await decodePhoto(faceJpeg, { keepBitmap: true });
          thumbnailBlob = decoded.thumbnail;
          faceBitmap = decoded.bitmap;
        } else {
          thumbnailBlob = await convertHEICtoJPEG(photo.file, true);
        }
      } else {
        // JPEG/PNG/WebP: thumbnail client-side; createImageBitmap 'from-image'
        // applies EXIF orientation. No manual rotation (it double-applied).
        updatePhoto(photo.id, { status: 'generating', exif });
        const decoded = await decodePhoto(photo.file, { keepBitmap: faceSearchActive });
        thumbnailBlob = decoded.thumbnail;
        faceBitmap = decoded.bitmap;
      }

      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

      // Perceptual hash for near-duplicate / series detection
      const phash = await computePHash(thumbnailBlob);

      // Mark ready (grid fills fast). The CLIP embedding is heavier, so compute
      // it in the background and attach when done — series detection uses it for
      // cross-camera near-duplicates, and falls back to pHash until it lands.
      updatePhoto(photo.id, {
        status: 'ready',
        exif,
        thumbnailBlob,
        thumbnailUrl,
        phash,
      });
      // Tracked in the store, not here: this promise deliberately outlives the
      // upload page (see embeddingsPending in usePhotoStore.ts). updatePhoto
      // covers the photo still being in this hook's state — i.e. the embedding
      // landed before "Weiter" — and noteEmbeddingSettled covers the case where
      // the set has already been snapshotted into the store, where writing to
      // local state alone would be a no-op on an unmounted component.
      usePhotoStore.getState().noteEmbeddingStarted();
      void computeEmbedding(thumbnailBlob)
        .then((embedding) => {
          if (embedding) updatePhoto(photo.id, { embedding });
          usePhotoStore.getState().noteEmbeddingSettled(photo.id, embedding);
        })
        .catch(() => usePhotoStore.getState().noteEmbeddingSettled(photo.id, null));

      // Face pass. Runs AFTER the photo is marked ready (so the grid keeps
      // filling at the same pace) but still INSIDE processNext, deliberately:
      // returning early would free this concurrency slot and let a fifth decode
      // start while this bitmap is still alive. Four full-resolution bitmaps are
      // already a few hundred MB against the 2 GB ceiling in § 5.3.
      //
      // Unlike the CLIP embedding above this is not fire-and-forget, for the
      // same reason — it owns a bitmap that must be closed.
      if (faceBitmap) {
        try {
          const faces = await detectFaces(faceBitmap);
          const faceEmbeddings: number[][] = [];
          for (const face of faces) {
            // Crops come from this full-resolution bitmap, not from the
            // downscaled copy detection ran on (§ 9.5) — it matters for the
            // small faces that are the weakest bucket anyway.
            const embedding = await computeFaceEmbedding(faceBitmap, face);
            if (embedding) faceEmbeddings.push(embedding);
          }
          updatePhoto(photo.id, { faceEmbeddings });
        } catch (err) {
          // A failed face pass must never fail the upload: the photo is fine,
          // only the person search is unavailable for it. Leaving faceEmbeddings
          // at null marks exactly that, and is distinct from "no faces found".
          console.warn(`[upload] face pass failed for ${photo.filename}:`, err);
        } finally {
          faceBitmap.close();
        }
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : `Processing failed (${photo.filename.split('.').pop()?.toUpperCase()} format may not be supported in this browser)`;
      console.error(`Failed to process ${photo.filename}:`, err);
      updatePhoto(photo.id, {
        status: 'error',
        error: message,
      });
    } finally {
      activeCount.current--;
      // Process next in queue
      processNext();
    }
  }, [updatePhoto]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      // Filter to accepted types
      const validFiles = fileArray.filter((f) => {
        const type = f.type.toLowerCase();
        const ext = f.name.toLowerCase();
        return (
          ACCEPTED_TYPES.includes(type) ||
          ext.endsWith('.heic') ||
          ext.endsWith('.heif') ||
          ext.endsWith('.jpg') ||
          ext.endsWith('.jpeg') ||
          ext.endsWith('.png') ||
          ext.endsWith('.webp')
        );
      });

      if (validFiles.length === 0) {
        setError('No supported image files found. Supported formats: JPEG, PNG, HEIC, WebP.');
        return;
      }

      // Check limit against a synchronous counter, NOT against `photos.length`.
      // React state is one render behind, and the Dropbox import calls this
      // several times in a row before a re-render: every call then saw "0 so
      // far" and admitted another full tier's worth. That is how a 250-photo
      // free tier ended up holding 750 photos.
      const currentCount = acceptedCount.current;
      const available = maxPhotos - currentCount;
      if (available <= 0) {
        setError(`Maximum of ${maxPhotos} photos reached.`);
        return;
      }

      const filesToAdd = validFiles.slice(0, available);
      if (filesToAdd.length < validFiles.length) {
        setError(
          `Only ${filesToAdd.length} of ${validFiles.length} files added (limit: ${maxPhotos}).`
        );
      }

      // Create ClientPhoto objects
      const newPhotos: ClientPhoto[] = filesToAdd.map((file) => ({
        id: uuidv4(),
        file,
        filename: file.name,
        exif: null,
        thumbnailBlob: null,
        thumbnailUrl: null,
        phash: null,
        embedding: null,
        faceEmbeddings: null,
        status: 'pending' as const,
        error: null,
      }));

      acceptedCount.current += newPhotos.length;
      setPhotos((prev) => [...prev, ...newPhotos]);

      // Event-Spezifikation §4: "Dateiauswahl bestätigt". Fired per addFiles
      // call (one per picker/drop action), not per accepted total — a second
      // batch later in the same session is its own confirmation.
      const totalMb = filesToAdd.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
      mark('files_selected');
      trackEv(
        'files_selected',
        locale,
        {
          photo_count: filesToAdd.length,
          total_mb: Math.round(totalMb * 10) / 10,
          duration_since_demo_start_ms: msSince('demo_start'),
        },
        photoCountBucket(acceptedCount.current)
      );

      // Load the face models up front rather than letting the first photo
      // trigger it. Two reasons: the download would otherwise land in the middle
      // of the run and distort any timing measurement, and § 5.4 requires the
      // matching itself to be request-free — which is only demonstrable if
      // loading is a completed step beforehand.
      if (wantFaceSearch()) {
        void Promise.all([preloadFaceDetector(), preloadFaceEmbedder()]).catch(() => {});
      }

      // Add to processing queue and start
      processingQueue.current.push(...newPhotos);
      for (let i = 0; i < MAX_CONCURRENT; i++) {
        processNext();
      }
    },
    [maxPhotos, processNext]
  );

  // Re-process only the photos that failed (e.g. a flaky HEIC conversion).
  // Resets them to 'pending' and re-enqueues just those — successful photos
  // are untouched.
  const retryFailed = useCallback(() => {
    setError(null);
    const failed = photos.filter((p) => p.status === 'error');
    if (failed.length === 0) return;
    const reEnqueued = failed.map((p) => ({ ...p, status: 'pending' as const, error: null }));
    setPhotos((prev) =>
      prev.map((p) => (p.status === 'error' ? { ...p, status: 'pending' as const, error: null } : p))
    );
    processingQueue.current.push(...reEnqueued);
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      processNext();
    }
  }, [photos, processNext]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo?.thumbnailUrl) {
        URL.revokeObjectURL(photo.thumbnailUrl);
      }
      if (photo) acceptedCount.current = Math.max(0, acceptedCount.current - 1);
      return prev.filter((p) => p.id !== id);
    });
    // Remove from queue if still pending
    processingQueue.current = processingQueue.current.filter((p) => p.id !== id);
  }, []);

  const clearAll = useCallback(() => {
    photos.forEach((p) => {
      if (p.thumbnailUrl) URL.revokeObjectURL(p.thumbnailUrl);
    });
    setPhotos([]);
    processingQueue.current = [];
    acceptedCount.current = 0;
    setError(null);
  }, [photos]);

  return {
    photos,
    isProcessing,
    processedCount,
    totalCount,
    addFiles,
    removePhoto,
    retryFailed,
    failedCount,
    clearAll,
    error,
  };
}
