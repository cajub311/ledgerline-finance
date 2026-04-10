export const SUMMARY_WIDGET_IDS = [
  'liquid-cash',
  'month-income',
  'month-spend',
  'savings-rate',
  'budget-health',
  'unreviewed',
  'safe-to-spend',
  'projected-month-end',
  'recurring-burn',
  'review-completion',
] as const;

export type SummaryWidgetId = (typeof SUMMARY_WIDGET_IDS)[number];

export const SUMMARY_WIDGET_LABELS: Record<SummaryWidgetId, string> = {
  'liquid-cash': 'Liquid cash',
  'month-income': 'Month income',
  'month-spend': 'Month spend',
  'savings-rate': 'Savings rate',
  'budget-health': 'Budget health',
  unreviewed: 'Unreviewed',
  'safe-to-spend': 'Safe to spend',
  'projected-month-end': 'Projected month-end',
  'recurring-burn': 'Recurring burn',
  'review-completion': 'Review completion',
};

const STORAGE_KEY = 'ledgerline/summary-widgets-v1';

function isSummaryWidgetId(value: string): value is SummaryWidgetId {
  return SUMMARY_WIDGET_IDS.includes(value as SummaryWidgetId);
}

export function loadSummaryWidgetPrefs(): {
  order: SummaryWidgetId[];
  hidden: SummaryWidgetId[];
} {
  if (typeof window === 'undefined') {
    return { order: [...SUMMARY_WIDGET_IDS], hidden: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { order: [...SUMMARY_WIDGET_IDS], hidden: [] };
    }

    const parsed = JSON.parse(raw) as {
      order?: string[];
      hidden?: string[];
    };
    const order = (parsed.order ?? []).filter(isSummaryWidgetId);
    const hidden = (parsed.hidden ?? []).filter(isSummaryWidgetId);

    const dedupedOrder: SummaryWidgetId[] = [];
    for (const id of order) {
      if (!dedupedOrder.includes(id)) {
        dedupedOrder.push(id);
      }
    }

    for (const id of SUMMARY_WIDGET_IDS) {
      if (!dedupedOrder.includes(id)) {
        dedupedOrder.push(id);
      }
    }

    return {
      order: dedupedOrder,
      hidden: hidden.filter((id, idx, list) => list.indexOf(id) === idx),
    };
  } catch {
    return { order: [...SUMMARY_WIDGET_IDS], hidden: [] };
  }
}

export function saveSummaryWidgetPrefs(order: SummaryWidgetId[], hidden: SummaryWidgetId[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        order,
        hidden,
      }),
    );
  } catch {
    // ignore storage failures
  }
}
