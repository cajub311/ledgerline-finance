const CATEGORY_ORDER = [
  'Income',
  'Housing',
  'Utilities',
  'Groceries',
  'Dining',
  'Fuel',
  'Travel',
  'Subscriptions',
  'Shopping',
  'Health',
  'Transfer',
  'Fees',
  'Savings',
  'Other',
] as const;

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(payroll|salary|deposit|interest)\b/i, category: 'Income' },
  { pattern: /\b(mortgage|rent|lease)\b/i, category: 'Housing' },
  { pattern: /\b(utility|electric|power|water|internet|phone|gas bill)\b/i, category: 'Utilities' },
  { pattern: /\b(heb|kroger|aldi|whole foods|sprouts|costco|grocery)\b/i, category: 'Groceries' },
  { pattern: /\b(uber eats|restaurant|coffee|dining|cafe|takeout|chipotle|starbucks)\b/i, category: 'Dining' },
  { pattern: /\b(shell|chevron|exxon|bp|fuel|gas station)\b/i, category: 'Fuel' },
  { pattern: /\b(united airlines|delta|southwest|hotel|airbnb|lyft|uber)\b/i, category: 'Travel' },
  { pattern: /\b(spotify|netflix|hulu|apple|subscription)\b/i, category: 'Subscriptions' },
  { pattern: /\b(transfer|zelle|venmo|ach)\b/i, category: 'Transfer' },
  { pattern: /\b(fee|overdraft|atm)\b/i, category: 'Fees' },
  { pattern: /\b(pharmacy|doctor|urgent care|health)\b/i, category: 'Health' },
  { pattern: /\b(savings)\b/i, category: 'Savings' },
];

export const CATEGORY_OPTIONS = [...CATEGORY_ORDER];

export function inferCategory(payee: string): string {
  const matched = CATEGORY_RULES.find((rule) => rule.pattern.test(payee));
  return matched?.category ?? 'Other';
}

export function normalizeCategory(category?: string, payee = ''): string {
  const candidate = category?.trim();

  if (candidate) {
    const canonical = CATEGORY_OPTIONS.find(
      (entry) => entry.toLowerCase() === candidate.toLowerCase(),
    );

    return canonical ?? candidate;
  }

  return inferCategory(payee);
}

export function cycleCategory(current: string): string {
  const index = CATEGORY_OPTIONS.findIndex(
    (entry) => entry.toLowerCase() === current.trim().toLowerCase(),
  );

  return CATEGORY_OPTIONS[(index + 1) % CATEGORY_OPTIONS.length];
}
