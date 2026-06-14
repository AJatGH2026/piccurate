'use client';

import { useState, useCallback } from 'react';

interface PhotoSelectionState {
  selectedIds: Set<string>;
  togglePhoto: (photoId: string) => void;
  addPhoto: (photoId: string) => void;
  removePhoto: (photoId: string) => void;
  isSelected: (photoId: string) => boolean;
  selectedCount: number;
  setInitialSelection: (ids: string[]) => void;
  getSelectedIds: () => string[];
  hasChanges: boolean;
}

/**
 * Hook for managing photo selection state in the review step.
 * Tracks which photos are selected, allows add/remove, and detects changes.
 */
export function usePhotoSelection(): PhotoSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());

  const setInitialSelection = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setSelectedIds(new Set(idSet));
    setInitialIds(new Set(idSet));
  }, []);

  const togglePhoto = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const addPhoto = useCallback((photoId: string) => {
    setSelectedIds((prev) => new Set([...prev, photoId]));
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (photoId: string) => selectedIds.has(photoId),
    [selectedIds]
  );

  const getSelectedIds = useCallback(() => Array.from(selectedIds), [selectedIds]);

  // Detect if user changed the selection
  const hasChanges =
    selectedIds.size !== initialIds.size ||
    [...selectedIds].some((id) => !initialIds.has(id));

  return {
    selectedIds,
    togglePhoto,
    addPhoto,
    removePhoto,
    isSelected,
    selectedCount: selectedIds.size,
    setInitialSelection,
    getSelectedIds,
    hasChanges,
  };
}
