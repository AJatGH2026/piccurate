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

  // Load from localStorage on mount. Defensive merge: any Criterion key whose
  // stored value isn't a proper { enabled, weight } object falls back to the
  // default — otherwise a stale/corrupt entry (e.g. from an older schema)
  // could sneak through and make renderCriterion() return null, hiding the
  // whole card.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CriteriaConfig>;
        const merged: CriteriaConfig = { ...DEFAULT_CRITERIA };
        for (const k of Object.keys(DEFAULT_CRITERIA) as (keyof CriteriaConfig)[]) {
          const defVal = DEFAULT_CRITERIA[k];
          const storedVal = parsed[k];
          if (storedVal === undefined) continue;
          // Motif/sharpness criteria: only accept a { enabled, weight } object.
          if (typeof defVal === 'object' && defVal !== null && 'enabled' in defVal) {
            if (
              typeof storedVal === 'object' &&
              storedVal !== null &&
              'enabled' in storedVal &&
              'weight' in storedVal
            ) {
              (merged[k] as unknown) = storedVal;
            }
            continue;
          }
          // Scalar / array fields (selectionPercentage, dedupSensitivity,
          // customCriteria): trust the stored value if types match.
          if (typeof storedVal === typeof defVal) {
            (merged[k] as unknown) = storedVal;
          }
        }
        setCriteria(merged);
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
      if (list.length >= 7) return prev; // upper bound (see pipeline §9.2)
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
