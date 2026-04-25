export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Currency formatter without locale-specific Unicode symbols / narrow no-break spaces.
 * Useful for PDF rendering where core jsPDF fonts only cover Latin-1.
 */
export function formatCurrencyPlain(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100)
    .toString()
    .padStart(2, '0');
  const wholeStr = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${wholeStr}.${cents}`;
}

/** Compact display: $1,234 → $1.2k, $12,345 → $12.3k, $1,234,567 → $1.2M */
export function formatCurrencyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return formatCurrency(amount);
}

/** Short date: 2026-04-10 → Apr 10, 2026-04-10 (today) → Today */
export function formatDateShort(isoDate: string): string {
  const today = formatIsoDate();
  if (isoDate === today) return 'Today';
  const yesterday = formatIsoDate(new Date(Date.now() - 86_400_000));
  if (isoDate === yesterday) return 'Yesterday';
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Month label: 2026-04 → April 2026 */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

/**
 * Trigger a download of a blob in the browser. No-op on native.
 */
export function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  if (typeof Blob === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}
