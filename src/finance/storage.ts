import AsyncStorage from '@react-native-async-storage/async-storage';

import { createFinanceState, rehydrateFinanceState } from './ledger';
import type { FinanceState } from './types';

const STORAGE_KEY = 'ledgerline/finance-state-v2';
/** v1 had a rehydration bug: empty arrays were replaced with demo seed. Migrated reads only. */
const LEGACY_STORAGE_KEY = 'ledgerline/finance-state-v1';

export async function loadFinanceState(): Promise<FinanceState> {
  const current = await AsyncStorage.getItem(STORAGE_KEY);
  if (current) {
    try {
      return rehydrateFinanceState(JSON.parse(current) as Partial<FinanceState>);
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return createFinanceState();
    }
  }

  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const state = rehydrateFinanceState(JSON.parse(legacy) as Partial<FinanceState>);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      return state;
    } catch {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      return createFinanceState();
    }
  }

  return createFinanceState();
}

export async function saveFinanceState(state: FinanceState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearFinanceState(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY, LEGACY_STORAGE_KEY]);
}

