import { useEffect, useRef } from 'react';

import type { FinanceState } from '../finance/types';
import { saveFinanceState } from '../finance/storage';

const DEFAULT_MS = 450;

/**
 * Persists state with debouncing to avoid writing on every keystroke.
 * Flushes the latest state on unmount.
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
      }
    };
  }, [state, loading, debounceMs]);

  useEffect(() => {
    return () => {
      void saveFinanceState(stateRef.current);
    };
  }, []);
}
