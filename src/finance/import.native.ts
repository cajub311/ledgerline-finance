import { parseStatementText } from './import.shared';
import type { ParsedStatementBatch } from './types';

export { parseStatementText };

export async function parseStatementBlob(_file: File): Promise<ParsedStatementBatch> {
  throw new Error('File uploads are available on web only in this build. Paste statement text instead.');
}
