import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { FinanceState } from '../finance/types';
import { saveFinanceState } from '../finance/storage';

const DEFAULT_MS = 450;

/**
 * Persists state with debouncing to avoid writing on every keystroke.
 * Flushes when a pending debounce is superseded, on unmount, and on web when
 * the tab is hidden or unloaded so work is not lost if the tab closes early.
 */
export function useDebouncedFinancePersistence(
  state: FinanceState,
  loading: boolean,
  debounceMs: number = DEFAULT_MS,
): void {
  const stateRef = useRef(state);
  stateRef.current = state;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveFinanceState(stateRef.current);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void saveFinanceState(stateRef.current);
      }
    };
  }, [state, loading, debounceMs]);

  useEffect(() => {
    return () => {
      void saveFinanceState(stateRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading || Platform.OS !== 'web') return;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const flush = () => {
      void saveFinanceState(stateRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [loading]);
}
