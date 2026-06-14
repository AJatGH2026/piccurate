'use client';

import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ClientPhoto } from '@/types/photo';
import { extractEXIF } from '@/utils/exif';
import { generateThumbnail, isHEIC, convertHEICtoJPEG } from '@/utils/image';
import { computePHash } from '@/utils/phash';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const MAX_CONCURRENT = 4;

interface UseUploadOptions {
  maxPhotos: number;
}

interface UseUploadReturn {
  photos: ClientPhoto[];
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  addFiles: (files: FileList | File[]) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
  error: string | null;
}

export function useUpload({ maxPhotos }: UseUploadOptions): UseUploadReturn {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const processingQueue = useRef<ClientPhoto[]>([]);
  const activeCount = useRef(0);

  const processedCount = photos.filter(
    (p) => p.status === 'ready' || p.status === 'uploading' || p.status === 'uploaded'
  ).length;
  const totalCount = photos.length;
  const isProcessing = photos.some(
    (p) => p.status === 'pending' || p.status === 'extracting' || p.status === 'generating'
  );

  const updatePhoto = useCallback((id: string, updates: Partial<ClientPhoto>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const processNext = useCallback(async () => {
    if (activeCount.current >= MAX_CONCURRENT || processingQueue.current.length === 0) return;

    activeCount.current++;
    const photo = processingQueue.current.shift()!;

    try {
      // Step 1: Extract EXIF from original (works for HEIC too)
      updatePhoto(photo.id, { status: 'extracting' });
      const exif = await extractEXIF(photo.file);

      let thumbnailBlob: Blob;

      if (isHEIC(photo.file)) {
        // HEIC fast path: server converts AND resizes to 512×512 in one call
        updatePhoto(photo.id, { status: 'generating', exif });
        thumbnailBlob = await convertHEICtoJPEG(photo.file);
        // Server already returns a 512×512 thumbnail — no client resize needed
      } else {
        // JPEG/PNG/WebP: generate thumbnail client-side (fast, no server needed)
        updatePhoto(photo.id, { status: 'generating', exif });
        thumbnailBlob = await generateThumbnail(photo.file);
      }

      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

      // Perceptual hash for near-duplicate / series detection
      const phash = await computePHash(thumbnailBlob);

      // Mark ready
      updatePhoto(photo.id, {
        status: 'ready',
        exif,
        thumbnailBlob,
        thumbnailUrl,
        phash,
      });
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

      // Check limit
      const currentCount = photos.length;
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
        status: 'pending' as const,
        error: null,
      }));

      setPhotos((prev) => [...prev, ...newPhotos]);

      // Add to processing queue and start
      processingQueue.current.push(...newPhotos);
      for (let i = 0; i < MAX_CONCURRENT; i++) {
        processNext();
      }
    },
    [photos.length, maxPhotos, processNext]
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo?.thumbnailUrl) {
        URL.revokeObjectURL(photo.thumbnailUrl);
      }
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
    setError(null);
  }, [photos]);

  return {
    photos,
    isProcessing,
    processedCount,
    totalCount,
    addFiles,
    removePhoto,
    clearAll,
    error,
  };
}
