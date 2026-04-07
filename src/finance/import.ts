import { Platform } from 'react-native';

import { parseStatementText } from './import.shared';
import type { ParsedStatementBatch } from './types';

export { parseStatementText };

export async function parseStatementBlob(file: File): Promise<ParsedStatementBatch> {
  if (Platform.OS === 'web') {
    const { parseStatementBlob: parseWebStatementBlob } = await import('./import.web');
    return parseWebStatementBlob(file);
  }

  const { parseStatementBlob: parseNativeStatementBlob } = await import('./import.native');
  return parseNativeStatementBlob(file);
}
