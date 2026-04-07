import { rehydrateFinanceState } from './ledger';
import type { FinanceState } from './types';

export function serializeFinanceState(state: FinanceState): string {
  return JSON.stringify(state, null, 2);
}

export function parseFinanceBackupJson(text: string): FinanceState {
  const parsed: unknown = JSON.parse(text);
  return rehydrateFinanceState(parsed as Partial<FinanceState>);
}
