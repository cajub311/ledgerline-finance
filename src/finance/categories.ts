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
  { pattern: /\b(payroll|salary|deposit|interest|direct dep)\b/i, category: 'Income' },
  { pattern: /\b(mortgage|rent|lease|hoa|homeowner)\b/i, category: 'Housing' },
  { pattern: /\b(utility|electric|power|water|internet|phone|gas bill|xfinity|at&t|verizon|t-mobile|comcast|spectrum|centerpoint|entergy|pge|con ed|duke energy)\b/i, category: 'Utilities' },
  { pattern: /\b(heb|kroger|aldi|whole foods|sprouts|costco|grocery|walmart|target|safeway|publix|trader joe|wegmans|meijer|smith's|ralphs|fry's)\b/i, category: 'Groceries' },
  { pattern: /\b(uber eats|doordash|grubhub|restaurant|coffee|dining|cafe|takeout|chipotle|starbucks|mcdonald|chick-fil|taco bell|panera|subway|domino|pizza|sushi|thai|burrito|diner|bistro|grill)\b/i, category: 'Dining' },
  { pattern: /\b(shell|chevron|exxon|bp|fuel|gas station|texaco|valero|marathon|mobil|76 gas|speedway|wawa|buc-ee)\b/i, category: 'Fuel' },
  { pattern: /\b(united airlines|delta|southwest|american airlines|jetblue|spirit|frontier|hotel|airbnb|marriott|hilton|hyatt|vrbo|expedia|booking\.com|lyft|uber(?! eats)|hertz|enterprise|national car)\b/i, category: 'Travel' },
  { pattern: /\b(spotify|netflix|hulu|apple(?! store)|disney\+|youtube premium|amazon prime|paramount\+|peacock|max hbo|adobe|microsoft 365|dropbox|notion|slack|github|1password|lastpass|duolingo|headspace|calm|nytimes|wsj|subscription|patreon)\b/i, category: 'Subscriptions' },
  { pattern: /\b(amazon(?! prime)|walmart\.com|target\.com|best buy|home depot|lowe's|ikea|nordstrom|tj maxx|marshall|ross|gap|old navy|zara|h&m|etsy|ebay|shopify|wayfair|chewy)\b/i, category: 'Shopping' },
  { pattern: /\b(pharmacy|doctor|urgent care|health|cvs|walgreens|rite aid|hospital|clinic|dental|optometrist|therapist|gym|planet fitness|ymca|anytime fitness|insurance|blue cross|aetna|cigna|united health)\b/i, category: 'Health' },
  { pattern: /\b(transfer|zelle|venmo|paypal|ach|wire|cashapp|cash app)\b/i, category: 'Transfer' },
  { pattern: /\b(fee|overdraft|atm|service charge|late fee|annual fee)\b/i, category: 'Fees' },
  { pattern: /\b(savings|emergency fund|invest|fidelity|vanguard|schwab|robinhood|401k|ira|roth)\b/i, category: 'Savings' },
];

export const CATEGORY_OPTIONS = [...CATEGORY_ORDER];

export const CATEGORY_ICONS: Record<string, string> = {
  Income: '💰',
  Housing: '🏠',
  Utilities: '⚡',
  Groceries: '🛒',
  Dining: '🍽️',
  Fuel: '⛽',
  Travel: '✈️',
  Subscriptions: '📱',
  Shopping: '🛍️',
  Health: '❤️',
  Transfer: '↔️',
  Fees: '💸',
  Savings: '🏦',
  Other: '📋',
};

// Known subscription services for detection (display name -> regex)
export const KNOWN_SUBSCRIPTIONS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Netflix', pattern: /netflix/i },
  { name: 'Spotify', pattern: /spotify/i },
  { name: 'Hulu', pattern: /hulu/i },
  { name: 'Disney+', pattern: /disney/i },
  { name: 'Apple', pattern: /apple\.com\/bill|apple one|apple tv|apple music/i },
  { name: 'Amazon Prime', pattern: /amazon prime|amzn prime/i },
  { name: 'YouTube Premium', pattern: /youtube premium|google one/i },
  { name: 'HBO Max', pattern: /hbo|max\.com/i },
  { name: 'Paramount+', pattern: /paramount/i },
  { name: 'Peacock', pattern: /peacock/i },
  { name: 'Adobe', pattern: /adobe/i },
  { name: 'Microsoft 365', pattern: /microsoft 365|office 365|msft/i },
  { name: 'Dropbox', pattern: /dropbox/i },
  { name: 'iCloud', pattern: /icloud/i },
  { name: 'Notion', pattern: /notion/i },
  { name: 'GitHub', pattern: /github/i },
  { name: '1Password', pattern: /1password/i },
  { name: 'Duolingo', pattern: /duolingo/i },
  { name: 'Headspace', pattern: /headspace/i },
  { name: 'Calm', pattern: /calm/i },
  { name: 'NY Times', pattern: /nytimes|new york times/i },
  { name: 'WSJ', pattern: /wall street journal|wsj\.com/i },
  { name: 'Patreon', pattern: /patreon/i },
  { name: 'Planet Fitness', pattern: /planet fitness/i },
  { name: 'Xfinity', pattern: /xfinity|comcast/i },
];

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
