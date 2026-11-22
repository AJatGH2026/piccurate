'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { v4 as uuidv4 } from 'uuid';
import type { ClientPhoto } from '@/types/photo';
import { extractEXIF } from '@/utils/exif';
import { decodePhoto, convertHEICtoJPEG, sniffImageKind, withRealType, type ImageKind } from '@/utils/image';
import { computePHash } from '@/utils/phash';
import { computeEmbedding } from '@/utils/embedding';
import { detectFaces, preloadFaceDetector } from '@/utils/faceDetection';
import { computeFaceEmbedding, preloadFaceEmbedder } from '@/utils/faceEmbedding';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { isMobileDevice } from '@/utils/device';
import { trackEv, mark, msSince, takeMark, photoCountBucket } from '@/lib/events-client';
import {
  timePhase,
  takeTimingSummary,
  logTimingProgress,
  peekTimingSummary,
  recordFailure,
  recordPhase,
  countEvent,
} from '@/utils/upload-timing';

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
// HEIC conversions are prepared ahead of the pipeline, this many at a time
// (decision 2026-11-22). Measured 2026-11-21 on a desktop with 930 of 1,013
// photos HEIC and person search on: the conversion was ~3/4 of the time per
// photo (4.7 s, mostly waiting on the network/server), but only 2 photos were
// in flight — the person-search cap below, which exists for MEMORY, not for
// the conversion. Waiting costs no memory, so the conversions now run ahead
// of the decode/face pipeline. Bounded: at most this many prepared-but-not-
// yet-used results exist at once (~0.5 MB each). Phones keep the old
// behaviour (0 = no prefetch): their per-tab memory ceiling is far tighter.
const HEIC_PREFETCH_DESKTOP = 6;


interface Prepared {
  kind: ImageKind;
  /** The converted JPEG for a HEIF file; absent for every other kind. */
  heicJpeg?: Blob;
  /** Which conversion was made — the face pass needs the large frame. */
  forFaceSearch: boolean;
}

/** Sniff the format and, for HEIF, convert — the part that can run ahead. */
async function preparePhoto(file: File, forFaceSearch: boolean): Promise<Prepared> {
  const kind = await timePhase('sniff', () => sniffImageKind(file));
  if (kind !== 'heif') return { kind, forFaceSearch };
  const heicJpeg = forFaceSearch
    ? await timePhase('convert_face', () => convertHEICtoJPEG(file, false, { face: true }))
    : await timePhase('convert', () => convertHEICtoJPEG(file, true));
  return { kind, heicJpeg, forFaceSearch };
}

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
  /** Neutral information, e.g. duplicates skipped — not an error. */
  notice: string | null;
  /** Files skipped because their content is not an image. */
  skippedNonImages: number;
}

export function useUpload({ maxPhotos, locale }: UseUploadOptions): UseUploadReturn {
  // Translated since 2026-11-13 — these three messages were hard-coded English,
  // and the 250-photo free-tier cap is exactly where a German visitor met one.
  const t = useTranslations('upload');
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Files dropped because their content is not an image at all (edit sidecars,
  // Live-Photo videos named .HEIC …) — reported apart from real failures.
  const [skippedNonImages, setSkippedNonImages] = useState(0);
  // name|size of every photo in the list, to skip the same file added twice —
  // seen 2026-11-20/21: the same photo sat in two folders of one family set
  // and was converted, embedded and charged against the allowance twice.
  // Name AND size: two different photos sharing both is practically impossible.
  const seenKeys = useRef<Set<string>>(new Set());
  const processingQueue = useRef<ClientPhoto[]>([]);
  // Prepared (sniffed + HEIC-converted) results running ahead of the queue.
  const prefetched = useRef<Map<string, Promise<Prepared>>>(new Map());
  const activeCount = useRef(0);
  // Photos accepted so far, kept in a ref so the tier limit is checked against
  // the real total even when several imports land within one render.
  const acceptedCount = useRef(0);
  // Photos finished (either way) — drives the periodic timing log only.
  const completedCount = useRef(0);

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
      // Per-phase timings ride along (utils/upload-timing.ts) so a slow run can
      // be attributed instead of guessed at. face_search is the axis that
      // matters: with it the pipeline runs three models per photo through one
      // serialized queue instead of one, and at half the concurrency.
      const timings = takeTimingSummary();
      trackEv('file_transfer_ready', locale, {
        photo_count: totalCount,
        duration_since_files_selected_ms: msSince('files_selected'),
        face_search: wantFaceSearch(),
        ...(timings ?? {}),
      });
      if (timings) console.info('[upload] phase timings (ms)', timings);
    }
    wasProcessing.current = isProcessing;
  }, [isProcessing, totalCount, locale]);

  // An abandoned run is the one worth measuring, and it never reaches the edge
  // above — so send what was recorded when the page goes away instead. pagehide
  // covers a real navigation/tab close; the cleanup covers an SPA navigation,
  // which fires neither pagehide nor beforeunload. Marked partial so a
  // half-finished run is never read as a completed one.
  useEffect(() => {
    const flush = () => {
      const timings = peekTimingSummary();
      if (!timings) return;
      trackEv('file_transfer_ready', locale, {
        partial: true,
        photo_count: completedCount.current,
        face_search: wantFaceSearch(),
        ...timings,
      });
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [locale]);

  const updatePhoto = useCallback((id: string, updates: Partial<ClientPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  // Start preparing the next photos in the queue, up to the prefetch limit.
  const pumpPrefetch = useCallback(() => {
    const limit = isMobileDevice() ? 0 : HEIC_PREFETCH_DESKTOP;
    if (limit === 0) return;
    const faceSearch = wantFaceSearch();
    for (const p of processingQueue.current) {
      if (prefetched.current.size >= limit) break;
      if (prefetched.current.has(p.id)) continue;
      const pr = preparePhoto(p.file, faceSearch);
      // Rejections are handled where the result is used (processNext); this
      // only stops an early failure from surfacing as "unhandled".
      pr.catch(() => {});
      prefetched.current.set(p.id, pr);
    }
  }, []);

  const processNext = useCallback(async () => {
    const concurrencyLimit = wantFaceSearch() ? MAX_CONCURRENT_FACE_SEARCH : MAX_CONCURRENT;
    if (activeCount.current >= concurrencyLimit || processingQueue.current.length === 0) return;

    activeCount.current++;
    const photo = processingQueue.current.shift()!;

    try {
      // Step 0: what IS this file? Judged by content, not by name — see
      // sniffImageKind. Not an image at all → take it off the list quietly
      // (counted and shown as "skipped", not as a failure) and give its slot
      // in the allowance back.
      const faceSearchNow = wantFaceSearch();
      const ahead = prefetched.current.get(photo.id);
      prefetched.current.delete(photo.id);
      pumpPrefetch();
      let prepared: Prepared;
      if (ahead) {
        // How long the pipeline still had to wait for a conversion that was
        // started ahead — near 0 means the conversion is no longer the wall.
        const t0 = Date.now();
        try {
          prepared = await ahead;
        } finally {
          recordPhase('prep_wait', Date.now() - t0);
        }
        if (prepared.forFaceSearch !== faceSearchNow && prepared.kind === 'heif') {
          prepared = await preparePhoto(photo.file, faceSearchNow);
        }
      } else {
        prepared = await preparePhoto(photo.file, faceSearchNow);
      }
      const kind = prepared.kind;
      if (kind === 'other') {
        countEvent('skip_nonimage_n');
        acceptedCount.current = Math.max(0, acceptedCount.current - 1);
        seenKeys.current.delete(`${photo.file.name}|${photo.file.size}`);
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        setSkippedNonImages((n) => n + 1);
        return;
      }

      // Step 1: Extract EXIF from original (works for HEIC too)
      updatePhoto(photo.id, { status: 'extracting' });
      const exif = await timePhase('exif', () => extractEXIF(photo.file));

      // Is the local person search active for this run? Read once per photo:
      // the reference persons are chosen BEFORE the upload starts (GATE 1,
      // Entscheidung 8), precisely so this is knowable here. § 3 rule 1 says the
      // user activates the person search explicitly — so when they did not, no
      // face is ever detected or embedded.
      const faceSearchActive = wantFaceSearch();

      let thumbnailBlob: Blob;
      let faceBitmap: ImageBitmap | null = null;

      if (kind === 'heif') {
        // HEIC path: small files use the server (sharp handles orientation),
        // large files the browser (heic-to). Both output already-upright pixels.
        updatePhoto(photo.id, { status: 'generating', exif });
        if (faceSearchActive) {
          // Ask for the large uncropped frame (1600 px) instead of the 512
          // square: the square is centre-cropped, so anyone at the edge of the
          // frame is gone and background faces are 15-40 px. The thumbnail is
          // then derived locally from that same decode.
          // Measured separately from the no-face path: this asks for the 1600px
          // uncropped frame (~250-400 KB) instead of the 512 square (~30 KB),
          // and adds a browser decode the plain path does not have.
          const faceJpeg = prepared.heicJpeg!;
          const decoded = await timePhase('decode', () =>
            decodePhoto(faceJpeg, { keepBitmap: true })
          );
          thumbnailBlob = decoded.thumbnail;
          faceBitmap = decoded.bitmap;
        } else {
          thumbnailBlob = prepared.heicJpeg!;
        }
      } else {
        // JPEG/PNG/WebP: thumbnail client-side; createImageBitmap 'from-image'
        // applies EXIF orientation. No manual rotation (it double-applied).
        updatePhoto(photo.id, { status: 'generating', exif });
        const decoded = await timePhase('decode', () =>
          decodePhoto(withRealType(photo.file, kind), { keepBitmap: faceSearchActive })
        );
        thumbnailBlob = decoded.thumbnail;
        faceBitmap = decoded.bitmap;
      }

      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

      // Perceptual hash for near-duplicate / series detection
      const phash = await timePhase('phash', () => computePHash(thumbnailBlob));

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
          // …and into the store by id, which is what makes a LATE face pass
          // still land. `isProcessing` goes false as soon as the last photo is
          // marked `ready` — which happens a few lines above, BEFORE this pass
          // — so "Weiter" is already clickable while up to
          // MAX_CONCURRENT_FACE_SEARCH photos are still here. Without this,
          // those photos reached /configure with faceEmbeddings: null and were
          // permanently invisible to the person search. Same fix, same reason,
          // as noteEmbeddingSettled for the CLIP pass.
          usePhotoStore.getState().noteFaceEmbeddings(photo.id, faceEmbeddings);
        } catch (err) {
          // A failed face pass must never fail the upload: the photo is fine,
          // only the person search is unavailable for it. Leaving faceEmbeddings
          // at null marks exactly that, and is distinct from "no faces found".
          console.warn(`[upload] face pass failed for ${photo.filename}:`, err);
          recordFailure('face', err);
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
      // Counted per run (phase + error name, never the message) so a run where
      // photos fail shows up in /admin/stats — see utils/upload-timing.ts.
      recordFailure('photo', err);
      updatePhoto(photo.id, {
        status: 'error',
        error: message,
      });
    } finally {
      activeCount.current--;
      // Report as we go, so a run someone abandons half way through still says
      // where its time went — see logTimingProgress. Every 5th photo keeps the
      // console readable on a 250-photo run.
      completedCount.current++;
      if (completedCount.current % 5 === 0) logTimingProgress(completedCount.current);
      // Process next in queue
      processNext();
    }
  }, [updatePhoto, pumpPrefetch]);

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
        setError(t('errorNoSupportedFiles'));
        return;
      }

      // Drop files already in the list (or twice in this selection) before the
      // limit check, so duplicates never use up the allowance.
      const fileKey = (f: File) => `${f.name}|${f.size}`;
      const uniqueFiles: File[] = [];
      for (const f of validFiles) {
        const k = fileKey(f);
        if (seenKeys.current.has(k)) continue;
        seenKeys.current.add(k);
        uniqueFiles.push(f);
      }
      const duplicates = validFiles.length - uniqueFiles.length;
      setNotice(duplicates > 0 ? t('duplicatesSkipped', { count: duplicates }) : null);
      if (uniqueFiles.length === 0) return;

      // Check limit against a synchronous counter, NOT against `photos.length`.
      // React state is one render behind, and the Dropbox import calls this
      // several times in a row before a re-render: every call then saw "0 so
      // far" and admitted another full tier's worth. That is how a 250-photo
      // free tier ended up holding 750 photos.
      const currentCount = acceptedCount.current;
      const available = maxPhotos - currentCount;
      if (available <= 0) {
        for (const f of uniqueFiles) seenKeys.current.delete(fileKey(f));
        setError(t('errorLimitReached', { max: maxPhotos.toLocaleString(locale) }));
        return;
      }

      const filesToAdd = uniqueFiles.slice(0, available);
      for (const f of uniqueFiles.slice(available)) seenKeys.current.delete(fileKey(f));
      if (filesToAdd.length < uniqueFiles.length) {
        setError(
          t('errorLimitPartial', {
            added: filesToAdd.length.toLocaleString(locale),
            total: uniqueFiles.length.toLocaleString(locale),
            max: maxPhotos.toLocaleString(locale),
          })
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
          // How long the OS took to hand the selection over — see the mark in
          // DropZone. Null for a drop or a cloud import, which never open a
          // native picker.
          picker_handoff_ms: takeMark('picker_opened'),
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
      pumpPrefetch();
      for (let i = 0; i < MAX_CONCURRENT; i++) {
        processNext();
      }
    },
    [maxPhotos, processNext, pumpPrefetch, t, locale]
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
    pumpPrefetch();
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      processNext();
    }
  }, [photos, processNext, pumpPrefetch]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo?.thumbnailUrl) {
        URL.revokeObjectURL(photo.thumbnailUrl);
      }
      if (photo) acceptedCount.current = Math.max(0, acceptedCount.current - 1);
      if (photo) seenKeys.current.delete(`${photo.file.name}|${photo.file.size}`);
      return prev.filter((p) => p.id !== id);
    });
    // Remove from queue if still pending
    processingQueue.current = processingQueue.current.filter((p) => p.id !== id);
    prefetched.current.delete(id);
  }, []);

  const clearAll = useCallback(() => {
    photos.forEach((p) => {
      if (p.thumbnailUrl) URL.revokeObjectURL(p.thumbnailUrl);
    });
    setPhotos([]);
    processingQueue.current = [];
    prefetched.current.clear();
    acceptedCount.current = 0;
    seenKeys.current.clear();
    setError(null);
    setNotice(null);
    setSkippedNonImages(0);
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
    notice,
    skippedNonImages,
  };
}
