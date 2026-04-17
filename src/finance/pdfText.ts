/**
 * Build readable lines from PDF.js text items (position-aware).
 * Concatenating items in stream order often scrambles bank statements; sorting by y/x preserves columns.
 */

export interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

const Y_BUCKET = 2.5;

function bucketY(y: number): number {
  return Math.round(y / Y_BUCKET) * Y_BUCKET;
}

export function pageTextItemsToLines(items: PdfTextItem[]): string[] {
  const positioned = items
    .map((item) => {
      const str = (item.str ?? '').trim();
      if (!str) return null;
      const t = item.transform;
      const x = Array.isArray(t) && t.length >= 6 ? t[4]! : 0;
      const y = Array.isArray(t) && t.length >= 6 ? t[5]! : 0;
      return { str, x, y: bucketY(y) };
    })
    .filter((e): e is { str: string; x: number; y: number } => e !== null);

  if (positioned.length === 0) {
    return [];
  }

  positioned.sort((a, b) => {
    if (a.y !== b.y) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentY = positioned[0]!.y;
  let parts: string[] = [];

  const flush = () => {
    const line = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
    parts = [];
  };

  for (const item of positioned) {
    if (item.y !== currentY) {
      flush();
      currentY = item.y;
    }
    parts.push(item.str);
  }
  flush();

  return lines;
}
