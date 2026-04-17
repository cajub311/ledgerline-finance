import assert from 'node:assert/strict';
import test from 'node:test';

import { pageTextItemsToLines } from './pdfText';

test('orders PDF text items into left-to-right lines by y then x', () => {
  const lines = pageTextItemsToLines([
    { str: 'B', transform: [1, 0, 0, 1, 40, 100] },
    { str: 'A', transform: [1, 0, 0, 1, 10, 100] },
    { str: '2', transform: [1, 0, 0, 1, 20, 80] },
    { str: '1', transform: [1, 0, 0, 1, 10, 80] },
  ]);

  assert.deepEqual(lines, ['A B', '1 2']);
});
