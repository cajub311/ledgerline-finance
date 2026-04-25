import { createFinanceState, rehydrateFinanceState } from './ledger';
import type { FinanceState } from './types';

const STORAGE_KEY = 'ledgerline/finance-state-v2';
/** v1 had a rehydration bug: empty arrays were replaced with demo seed. Migrated reads only. */
const LEGACY_STORAGE_KEY = 'ledgerline/finance-state-v1';

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota, private mode, or policy — app still runs; data may not persist
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function loadFinanceState(): Promise<FinanceState> {
  const current = safeGetItem(STORAGE_KEY);
  if (current) {
    try {
      return rehydrateFinanceState(JSON.parse(current) as Partial<FinanceState>);
    } catch {
      safeRemoveItem(STORAGE_KEY);
      return createFinanceState();
    }
  }

  const legacy = safeGetItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const state = rehydrateFinanceState(JSON.parse(legacy) as Partial<FinanceState>);
      safeSetItem(STORAGE_KEY, JSON.stringify(state));
      safeRemoveItem(LEGACY_STORAGE_KEY);
      return state;
    } catch {
      safeRemoveItem(LEGACY_STORAGE_KEY);
      return createFinanceState();
    }
  }

  return createFinanceState();
}

export async function saveFinanceState(state: FinanceState): Promise<void> {
  safeSetItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearFinanceState(): Promise<void> {
  safeRemoveItem(STORAGE_KEY);
  safeRemoveItem(LEGACY_STORAGE_KEY);
}
