'use client';

import { useState, useCallback, useEffect } from 'react';

const DEMO_KEY = 'piccurate-demo-mode';

/**
 * Demo mode hook — bypasses auth and external services for local testing.
 * Stores state in localStorage so it persists across page navigations.
 */
export function useDemoMode() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(localStorage.getItem(DEMO_KEY) === 'true');
  }, []);

  const enableDemo = useCallback(() => {
    localStorage.setItem(DEMO_KEY, 'true');
    setIsDemo(true);
  }, []);

  const disableDemo = useCallback(() => {
    localStorage.removeItem(DEMO_KEY);
    setIsDemo(false);
  }, []);

  return { isDemo, enableDemo, disableDemo };
}
