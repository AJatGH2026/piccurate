'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CriteriaConfig } from '@/types/criteria';
import { DEFAULT_CRITERIA } from '@/types/criteria';

const STORAGE_KEY = 'piccurate-criteria';

/**
 * Hook for managing criteria configuration.
 * Persists to localStorage so returning users keep their preferences.
 */
export function useCriteria() {
  const [criteria, setCriteria] = useState<CriteriaConfig>(DEFAULT_CRITERIA);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCriteria({ ...DEFAULT_CRITERIA, ...parsed });
      }
    } catch {
      // Ignore parse errors
    }
    setLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(criteria));
      } catch {
        // Ignore storage errors
      }
    }
  }, [criteria, loaded]);

  const updateCriterion = useCallback(
    (key: keyof CriteriaConfig, value: unknown) => {
      setCriteria((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleCriterion = useCallback(
    (key: keyof CriteriaConfig) => {
      setCriteria((prev) => {
        const current = prev[key];
        if (typeof current === 'object' && current !== null && 'enabled' in current) {
          return {
            ...prev,
            [key]: { ...current, enabled: !current.enabled },
          };
        }
        return prev;
      });
    },
    []
  );

  const setWeight = useCallback(
    (key: keyof CriteriaConfig, weight: number) => {
      setCriteria((prev) => {
        const current = prev[key];
        if (typeof current === 'object' && current !== null && 'weight' in current) {
          return {
            ...prev,
            [key]: { ...current, weight: Math.max(0, Math.min(1, weight)) },
          };
        }
        return prev;
      });
    },
    []
  );

  const addCustom = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setCriteria((prev) => {
      const list = prev.customCriteria || [];
      if (list.some((c) => c.term.toLowerCase() === t.toLowerCase())) return prev;
      if (list.length >= 5) return prev; // keep it sane
      return { ...prev, customCriteria: [...list, { term: t, weight: 0.5 }] };
    });
  }, []);

  const removeCustom = useCallback((term: string) => {
    setCriteria((prev) => ({
      ...prev,
      customCriteria: (prev.customCriteria || []).filter((c) => c.term !== term),
    }));
  }, []);

  const setCustomWeight = useCallback((term: string, weight: number) => {
    setCriteria((prev) => ({
      ...prev,
      customCriteria: (prev.customCriteria || []).map((c) =>
        c.term === term ? { ...c, weight: Math.max(0.1, Math.min(1, weight)) } : c
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    setCriteria(DEFAULT_CRITERIA);
  }, []);

  return {
    criteria,
    setCriteria,
    updateCriterion,
    toggleCriterion,
    setWeight,
    addCustom,
    removeCustom,
    setCustomWeight,
    reset,
    loaded,
  };
}
