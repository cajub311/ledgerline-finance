import { createFinanceState, rehydrateFinanceState } from './ledger';
import type { FinanceState } from './types';

const STORAGE_KEY = 'ledgerline/finance-state-v1';

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
  const saved = safeGetItem(STORAGE_KEY);

  if (!saved) {
    return createFinanceState();
  }

  try {
    return rehydrateFinanceState(JSON.parse(saved) as Partial<FinanceState>);
  } catch {
    return createFinanceState();
  }
}

export async function saveFinanceState(state: FinanceState): Promise<void> {
  safeSetItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearFinanceState(): Promise<void> {
  safeRemoveItem(STORAGE_KEY);
}
