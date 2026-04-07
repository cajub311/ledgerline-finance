import AsyncStorage from '@react-native-async-storage/async-storage';

import { createFinanceState, rehydrateFinanceState } from './ledger';
import type { FinanceState } from './types';

const STORAGE_KEY = 'ledgerline/finance-state-v1';

export async function loadFinanceState(): Promise<FinanceState> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);

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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearFinanceState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

