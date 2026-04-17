# Ledgerline — Composer Bot Playbook

> Written by the "brain" agent (Opus) for the Cursor Composer bots that will do
> the hands‑on coding. Read this whole file before you start. Pick one ticket
> from §5, implement it end‑to‑end (types → logic → UI → tests → PR), then come
> back for the next one.
>
> **Do not rewrite this playbook.** Append new tickets to the bottom and
> append completed work to §7 "Change log for agents" with a one‑liner.

---

## 1. What Ledgerline is (and must stay)

- **Local‑first.** The entire ledger lives in `localStorage` (web) or
  `AsyncStorage` (native). There is no account system, no server, no Plaid.
  That privacy pitch is the product's main wedge. **Do not introduce network
  calls**, analytics, crash reporters, remote config, or "optional" cloud
  sync without an explicit ticket here authorizing it.
- **Bring‑your‑own statements.** Users import CSV / XLSX / PDF from any bank
  and also paste text. We just shipped PDF / QIF / OFX / filtered CSV export
  in addition to the JSON backup.
- **Works on web and native.** The Expo + React Native Web stack means a
  `.web.tsx` (or lazy `await import(...)`) sibling is how you opt into
  browser‑only APIs. `pdfjs-dist`, `jspdf`, `jspdf-autotable`, `xlsx`, and
  anything using `document` / `URL.createObjectURL` stay web‑only.
- **Node‑runnable test suite.** `npm test` uses `node --import tsx --test`.
  Keep it fast (<2s) and do not introduce `jsdom` / Jest in the finance core.
  Component tests, when we eventually need them, will go in a separate,
  opt‑in suite.

If a ticket can't be done without breaking these rules, skip the ticket and
flag it in the PR description instead of silently weakening the pitch.

---

## 2. The stack, verbatim

- **UI:** Expo 55 · React 19 · React Native 0.83 · react‑native‑web 0.21
- **Charts:** handmade `BarChart`, `Sparkline`, `CategoryBreakdownList` +
  `recharts` for the forecast line chart (web‑only via `.web.tsx`).
- **State:** plain React state held in `src/FinanceApp.tsx`, persisted to
  storage through `src/hooks/useDebouncedFinancePersistence.ts`. All state
  transitions are **pure functions** in `src/finance/ledger.ts` — follow that
  pattern for everything new.
- **Types:** `src/finance/types.ts`. Extend, don't replace. Bump `version`
  and add a migration in `rehydrateFinanceState` if you change a field.
- **Theme:** `src/theme/tokens.ts` (palette + spacing + radius + typography
  + `elevation()` helper) and `src/theme/ThemeContext.tsx` (persisted
  light/dark mode). Prefer tokens over raw hex.
- **Build:** `npm run web` for dev, `npm run build` for the Vercel static
  export in `dist/`. `engines.node >= 20`.

Key files you will keep touching:

```
src/
  FinanceApp.tsx               # shell, tab routing, sidebar wiring
  theme/tokens.ts              # palette + elevation()
  components/
    layout/Sidebar.tsx         # grouped nav + summary strip
    ui/{Button,Card,Input,Modal,Select,Badge,StatTile}.tsx
    charts/{BarChart,Sparkline,CategoryBreakdownList,CashFlowLineChart*}.tsx
  finance/
    types.ts                   # shared types (keep as discriminated unions)
    ledger.ts                  # pure state transitions + analytics
    categories.ts              # category list + inferCategory() heuristics
    import.ts / .web.ts / .native.ts / .shared.ts
    export.ts                  # CSV + QIF + OFX
    exportPdf.ts               # PDF statement (web-only, lazy)
    backup.ts                  # JSON backup
    storage.ts / .web.ts       # persistence
  pages/
    DashboardPage.tsx
    TransactionsPage.tsx
    AccountsPage.tsx
    BudgetsPage.tsx
    GoalsPage.tsx
    ForecastPage.tsx
    ImportPage.tsx
    SettingsPage.tsx
  utils/format.ts              # currency, dates, downloadBlob, etc.
```

---

## 3. Competitive landscape — what leading apps have that we don't (yet)

Use this as the "why it matters" for every ticket below. Don't copy the UI
1:1 — lean on our privacy / BYO‑statements angle, then add the missing
capability.

| Capability | Monarch (~$99/yr) | YNAB (~$109/yr) | Copilot (~$95/yr, iOS) | Rocket Money (~$48/yr) | Actual Budget (OSS) | Firefly III (OSS) | **Ledgerline today** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Envelope / zero‑based budget | Flexible | **Primary** | — | — | **Primary** | ✔︎ rules | Monthly limit only |
| Rollover / carryover from prior month | ✔︎ | ✔︎ | — | — | ✔︎ | ✔︎ | — |
| "Give every dollar a job" surface | — | ✔︎ | — | — | ✔︎ | — | — |
| Rules engine (auto‑categorize) | ✔︎ | ✔︎ | **Best‑in‑class** | Basic | ✔︎ | ✔︎ | Heuristic only |
| Recurring / upcoming bills calendar | Refreshed 2024 | ✔︎ | ✔︎ | ✔︎ | ✔︎ | ✔︎ | Detection only |
| Net‑worth trend over time | ✔︎ | — | ✔︎ | ✔︎ | ✔︎ | ✔︎ | — |
| Investment tracking | ✔︎ | — | ✔︎ | ✔︎ | — | ✔︎ | — |
| Couples / shared access | **Best** | — | Shared login | — | Self‑host only | Self‑host only | — |
| Subscription cancel / negotiate | — | — | Detect | **Primary** | — | — | Detect only |
| Spending reports / filters | ✔︎ | ✔︎ | ✔︎ | ✔︎ | ✔︎ | ✔︎ | Category breakdown |
| Tags on transactions | ✔︎ | ✔︎ | ✔︎ | — | ✔︎ | ✔︎ | — |
| Splits / split transactions | ✔︎ | ✔︎ | ✔︎ | — | ✔︎ | ✔︎ | — |
| Multi‑currency | Limited | — | — | — | — | ✔︎ | USD only |
| Bank sync (Plaid/GoCardless/SimpleFIN) | ✔︎ | ✔︎ | ✔︎ | ✔︎ | Opt‑in | Opt‑in | **By design: none** |
| OFX / QIF export | — | CSV | CSV | — | ✔︎ | ✔︎ | **✔︎ (new)** |
| PDF statement export | — | — | — | — | — | — | **✔︎ (new)** |
| Keyboard shortcuts / command palette | ✔︎ (web) | ✔︎ | — | — | ✔︎ | ✔︎ | — |
| Mobile install (PWA / iOS / Android) | Native | Native | Native iOS | Native | PWA + native | PWA | PWA only |
| Accessibility (WCAG labels / focus) | Good | Good | Good | OK | Good | OK | Needs work |

**Takeaways for next work:** rules engine, envelope mode + rollover,
upcoming‑bills calendar, net‑worth trend, investments, tags, split
transactions, reports, command palette, multi‑currency, and a11y are the
highest‑leverage gaps. The specific tickets in §5 turn each of those into
bounded PRs.

---

## 4. How to pick up a ticket (workflow)

1. `git pull && git checkout main && git checkout -b cursor/<ticket-slug>`.
2. Read the "Acceptance" block of the ticket top to bottom. If something is
   ambiguous, **prefer the conservative choice** (don't delete existing
   features, don't add deps without calling it out in the PR body).
3. Implement the pure logic in `src/finance/` first, then tests, then UI.
   Keep new pure helpers next to the existing ones in `ledger.ts` unless
   the surface is large enough to warrant a new file.
4. Run `npm run typecheck && npm test && npm run build`. All three must
   pass before you push.
5. Commit **one logical change per commit**. Use the format:
   `<area>: <imperative summary>` (e.g. `feat(budgets): envelope mode with rollover`).
6. Push the branch, open a draft PR. Body must include:
   - One‑line "Why" (reference the competitor gap from §3).
   - "What changed" with file paths.
   - "Screenshots / flows" (narrative is fine if no UI).
   - "Out of scope" calling out what you deliberately skipped.
7. After merge, append a line to §7.

**Never force‑push. Never amend commits. Never touch `main` directly.**

---

## 5. Tickets (open, in priority order)

Each ticket has: **Problem**, **Acceptance**, **Touch list**, **Gotchas**.
They are sized so a single composer bot can finish one in a self‑contained
PR (typically ≲500 diff lines).

### 🟥 P0 — ship first

#### T‑01. Rules engine for auto‑categorization

**Problem.** Today `inferCategory` is a hardcoded regex table in
`src/finance/categories.ts`. Competitors (especially Copilot at 93%
accuracy) let users save rules like "payee contains 'Uber' → Travel".
Users want this immediately after any big import.

**Acceptance.**
- New type `FinanceRule` in `src/finance/types.ts`:
  ```ts
  export interface FinanceRule {
    id: string;
    enabled: boolean;
    createdAt: string;
    /** Human label for the rule row. */
    name?: string;
    match: {
      payeeContains?: string;       // case-insensitive substring
      payeeEquals?: string;         // case-insensitive exact
      payeeRegex?: string;          // optional; wrapped in try/catch
      amountMin?: number;           // inclusive
      amountMax?: number;           // inclusive
      accountId?: string;           // optional restriction
      sign?: 'any' | 'negative' | 'positive';
    };
    set: {
      category?: string;            // canonicalized via normalizeCategory
      reviewed?: boolean;
      notesAppend?: string;         // optional suffix
      /** Add a tag (see T-05). Ignored until T-05 lands. */
      addTag?: string;
    };
  }
  ```
  Add `rules: FinanceRule[]` to `FinanceState` with default `[]`.
- New pure helpers in `ledger.ts`:
  `addRule`, `updateRule`, `deleteRule`, `moveRule` (reorder),
  `applyRules(state) → state`, `applyRulesToTransactions(txs, rules) → txs`.
- Hook `applyRules` into `applyImportedBatch` so newly‑imported rows get
  categorized via rules before being added.
- Manual re‑run button on the Settings page: "Re‑apply rules to all
  transactions". Warn that this will overwrite current categories.
- Settings → Rules UI: list, create, edit, delete, drag to reorder. Show
  a live "Would match N transactions" counter when editing a rule.
- Dedupe behavior unchanged (keys off date/payee/amount).
- Tests (`rules.test.ts`): match precedence, regex safety (invalid regex
  must not crash), amount range, account scoping, idempotency when running
  twice.

**Touch list.** `src/finance/types.ts`, `src/finance/ledger.ts`,
`src/finance/rules.ts` (new), `src/finance/rules.test.ts` (new),
`src/pages/SettingsPage.tsx` (or a new `RulesPage.tsx` under Settings),
`src/FinanceApp.tsx` if you add a sub‑nav, `package.json`'s `test` script
(add the new file), `NOTES_FOR_BOTS.md` change log, §7 of this file.

**Gotchas.** Rule order matters; evaluate top‑down and stop on first match
(document it). Keep the regex execution behind `safeRegex(str)` so a bad
rule can't take the import flow down.

---

#### T‑02. Envelope / zero‑based budgeting mode with rollover

**Problem.** YNAB, Actual Budget, and Monarch all support "every dollar has
a job" with unspent amounts rolling into next month. We only have flat
monthly caps.

**Acceptance.**
- Extend `Budget` in `src/finance/types.ts`:
  ```ts
  export interface Budget {
    id: string;
    category: string;
    monthlyLimit: number;
    createdAt: string;
    rollover: boolean;              // NEW, default true
    /** Accumulated surplus/deficit carried in from prior months. */
    carry?: number;                 // NEW, managed by ledger
  }
  ```
- New pure function `getBudgetEnvelopes(state, year, month)` returning,
  per budget: `assigned`, `carriedIn`, `spent`, `available`
  (= assigned + carriedIn - spent), and `status`. Carry‑in for month M
  is computed by walking months from budget creation up to M−1 and
  summing `max(0, limit - spent)` (if rollover) or ignoring surplus
  otherwise; negative overspend always rolls as debt when rollover=true.
- New `BudgetsPage` mode toggle: **Flow** (current) vs **Envelope**. In
  envelope mode show a "Ready to assign" banner = (income this month) −
  (sum of assigned this month). Allow editing `monthlyLimit` inline.
- Tests (`ledger.test.ts` additions): carry math across 3 months, toggling
  `rollover` false mid‑stream, creating a budget after some months already
  have spending.

**Touch list.** `types.ts`, `ledger.ts`, `ledger.test.ts`, `BudgetsPage.tsx`,
`DashboardPage.tsx` (swap the "Over budget" tile to respect envelope
available when envelope mode is on).

**Gotchas.** Don't recompute carry on every render; memoize per
(budget.id, year, month). Keep the math pure so it's deterministic in tests.

---

#### T‑03. Net‑worth trend over time

**Problem.** Monarch's headline chart is a net‑worth line over the last
12 months. We track point‑in‑time net worth only.

**Acceptance.**
- New pure function `getNetWorthSeries(state, months)` that returns
  `Array<{ monthKey, label, netWorth, assets, liabilities }>`. Month N's
  net worth = sum of each account's (openingBalance + all transactions
  up through end of month N). Respect liabilities sign convention.
- New `components/charts/NetWorthLineChart.web.tsx` mirroring the
  `CashFlowLineChart.web.tsx` pattern (recharts `LineChart`, threshold
  line off, zero baseline on).
- Dashboard: new card "Net worth trend" under the stats grid. Period
  selector pills: 3M / 6M / 12M / ALL.
- Tests (`ledger.test.ts`): series length matches requested months,
  monotonic dates, final month equals current `summary.netWorth`.

**Touch list.** `ledger.ts`, `ledger.test.ts`, new chart file,
`DashboardPage.tsx`, token file if a new chart color is needed.

**Gotchas.** Performance: avoid O(months × transactions²). Sort
transactions once by date, walk forward with running balances per account.

---

#### T‑04. Upcoming bills & paychecks calendar

**Problem.** Monarch's "Recurring" refresh (2024) is the single feature
most reviewers call out. We already have `detectSubscriptions` and
`detectRecurringIncome`, we just don't project them forward.

**Acceptance.**
- New pure `projectRecurring(state, horizonDays)` returning an array of
  `{ date, payee, amount, frequency, kind: 'charge' | 'income', confidence }`
  where `date` is the *next* predicted occurrence after today.
- New Dashboard card: "Upcoming in the next 30 days" — timeline list
  grouped by week. Show total outflow and inflow at top.
- New Forecast‑page section: full month calendar grid with colored dots
  per day (red = charge, green = income).
- Tests (`ledger.test.ts`): horizon boundary (>horizon excluded), multiple
  instances within horizon (weekly cadence), mixed income + charge order.

**Touch list.** `ledger.ts`, `ledger.test.ts`, `DashboardPage.tsx`,
`ForecastPage.tsx`. No new deps — render the calendar with pure RN
`<View>` + flexbox.

**Gotchas.** Dates only — don't project time of day. Cap confidence at
0.95 (never claim certainty). Use last‑occurrence + average‑gap for
next‑occurrence prediction.

---

### 🟧 P1 — high value

#### T‑05. Transaction tags

**Problem.** Every serious finance app supports tags (trip‑specific,
reimbursable, tax‑deductible). We don't.

**Acceptance.**
- `FinanceTransaction.tags?: string[]` (lower‑kebab, deduped, max 16 chars
  per tag, max 8 tags per transaction). Normalize on insert.
- Ledger: `addTransactionTag`, `removeTransactionTag`,
  `setTransactionsTags(ids, tags, mode: 'replace' | 'merge')` for bulk.
- UI: tag chips in the transaction row (after category badge) and in the
  edit modal. Free‑text input with autocomplete from existing tags.
- Export: include `tags` column in CSV (space‑separated). QIF `M` memo
  line should append `#tag` entries so round‑trip via Quicken is
  non‑destructive.
- Reports filter: tag selector on Transactions page, AND logic with
  existing filters. Bulk bar gains "Add tag" / "Remove tag".
- Tests: normalization, dedupe, bulk merge vs replace.

**Touch list.** `types.ts`, `ledger.ts`, `categories.ts` (no change — tags
are separate), `TransactionsPage.tsx`, `export.ts`, `exportPdf.ts`
(optional column), `ledger.test.ts`, `export.test.ts`.

**Gotchas.** Rule engine T‑01 has an `addTag` field — wire it here.

---

#### T‑06. Split transactions

**Problem.** One Amazon swipe covering three categories is the classic
case. Every app handles this; we'd force users to delete + re‑add rows.

**Acceptance.**
- Extend `FinanceTransaction` with an optional `splits?: Array<{
  id: string; amount: number; category: string; notes?: string; tags?: string[]
  }>`. Validation: `sum(splits.amount) === amount` within 1 cent.
- Ledger helpers: `splitTransaction(id, splits[])`, `clearSplits(id)`.
- UI: edit modal gets a "Split" tab that lets users add rows until the
  remainder is $0. Category breakdown + budget math **must use splits
  when present** and fall back to the parent `category` otherwise.
- Tests: totals match, budget status reflects split amounts, forecast
  still works with split parents.

**Gotchas.** Ripple through `getCategoryBreakdown`, `getBudgetStatus`,
`detectSubscriptions`, `projectCashFlow`. Do a grep for
`tx.category` / `tx.amount` and adjust each loop. Add a helper
`iterateSpendUnits(tx)` that yields either the parent or the splits so
you only write the expansion once.

---

#### T‑07. Reports page (spending over time, by category, by merchant)

**Problem.** Monarch / Firefly III / Actual all have a reports surface.
Our Dashboard has slices, but there's no dedicated drill‑down.

**Acceptance.**
- New `src/pages/ReportsPage.tsx` wired into Sidebar under "Plan".
- Time range picker: This month, Last month, YTD, Last 12 months, Custom.
- Views: Spending (bar per month + stacked categories), Cash flow (income
  vs expense bars + net line), Top merchants (table), Category deep dive
  (click a category to filter the table).
- Export the current view as CSV or PDF (reuse `buildStatementPdf`).
- Tests: pure helpers only, e.g. `aggregateForReport(transactions, range, grouping)`.

**Touch list.** `pages/ReportsPage.tsx` (new), `ledger.ts` (pure
aggregators), `FinanceApp.tsx` (route wiring), docs.

---

#### T‑08. Command palette + keyboard shortcuts (web)

**Problem.** Power users on web expect `⌘K`. Every modern web finance app
has one.

**Acceptance.**
- Global `Cmd/Ctrl+K` opens an overlay with fuzzy‑matched actions:
  Navigate to Dashboard, Add transaction, Import CSV, Export PDF (full/month),
  Toggle theme, Open Rules, etc.
- Shortcut chips: `/` to focus Transactions search, `N` for new
  transaction, `J/K` row navigation on Transactions (respects the
  first/last visible row), `R` to toggle review on the focused row,
  `?` for a cheat‑sheet modal.
- New hook `src/hooks/useHotkeys.ts` (web‑only gate). Minimal, no deps;
  single `keydown` listener that consults a registry.
- Do not break native builds (guard the whole module by
  `Platform.OS === 'web'`).

**Touch list.** `hooks/useHotkeys.ts`, `components/CommandPalette.web.tsx`
(new), `FinanceApp.tsx`, `TransactionsPage.tsx`, `SettingsPage.tsx`
(shortcut cheatsheet toggle), tests are optional.

---

#### T‑09. Accessibility pass

**Problem.** Buttons/Pressables have no visible focus ring on web, many
`<Pressable>` rows lack `accessibilityLabel`, chart colors are close to
WCAG AA but not verified.

**Acceptance.**
- Every interactive element exposes a meaningful `accessibilityLabel`
  (transaction rows include payee + amount + date).
- Focus rings on web via a shared style in `tokens.ts`
  (`webFocusRing: { outlineWidth: 2, outlineColor: palette.primary, outlineStyle: 'solid' }`)
  applied in Button, Pressable row wrappers, and Select.
- Contrast verified: run the palette through a WCAG contrast check in
  tests (`theme/contrast.test.ts`, pure function). Adjust `textSubtle`
  / `textMuted` if they fail AA against `bg` or `surface`.
- Skip link: visually hidden link at the top of `FinanceApp.tsx` that
  focuses the main content region.
- Screen‑reader ordering: sidebar first, then main, then bulk bars.

**Gotchas.** `outlineColor` / `outlineWidth` are React Native Web‑safe
but won't type‑check under strict `ViewStyle`. Cast narrowly.

---

### 🟨 P2 — competitive polish

#### T‑10. Net‑worth allocation pie / donut + asset breakdown

Accounts grouped: cash / investments / real estate (future) / credit / loans.
Show a donut with `recharts` `<PieChart>` on web, a horizontal stacked bar
on native. Powered by the same series from T‑03.

#### T‑11. Multi‑currency foundation

Add `currency: 'USD' | 'EUR' | …` on `FinanceAccount`. Keep ledger math in
the account's currency; add a `convertToDisplay(amount, accountCurrency)`
helper that reads a user‑entered FX rate table from Settings (no network).
Net worth & dashboard cards render in the display currency. Do **not**
call FX APIs.

#### T‑12. Goals auto‑linked to accounts

`FinancialGoal.accountId?: string`. If set, `currentAmount` is computed
from the live balance of that account (filtered to transactions with
category=Savings if you want, configurable). Shows "Auto" badge instead
of the manual edit field.

#### T‑13. PDF layout‑aware parsing

`src/finance/pdfLayout.ts`. Use `pdfjs`'s `getTextContent().items` (each
has `transform[4]` x, `transform[5]` y). Group by y buckets within 2pt
tolerance to reconstruct rows, then apply bank‑specific column templates
(Wells Fargo, Chase, Amex, Capital One, Citi, JP Morgan Sapphire). Fall
back to current `parseStatementText` if geometry heuristics miss. Ship
fixtures in `fixtures/statements/` (use public sanitized samples).

#### T‑14. Import preview modal (non‑CSV)

PDF / XLSX imports commit straight to the ledger today. Introduce a
shared `PreviewBatchModal` that shows rows with per‑row include/exclude
checkboxes + bulk category override before committing. Reuse the CSV
wizard preview table.

#### T‑15. PWA install + offline first

Add a proper `manifest.webmanifest`, a service worker (Workbox or hand‑
rolled) that caches the static export in `dist/_expo/static/` and
`index.html`. Installable on iOS + Android + desktop. Ensure the app
still works with no network after first load.

#### T‑16. Playwright smoke test

`playwright/smoke.spec.ts`. Boot `npm run web` with a deterministic
port, navigate to `/`, assert Dashboard renders, upload
`fixtures/statements/wells-fargo.csv`, assert new rows appear in
Transactions. Add a `test:e2e` script and wire into CI behind an
`if:` gate (don't block PRs while it's flaky).

#### T‑17. Household / shared (local) profiles

No cloud. Just a "Profile" selector at the top of Settings that switches
which storage key the app reads/writes (`ledgerline/v1/<profile>`).
Profiles list editable in Settings → Household. Export/import scoped to
the active profile. Useful for couples that share the same browser.

#### T‑18. Investments minimal

Add account type `investment` (already exists) first‑class support:
holdings list per account (`{ symbol, quantity, costBasis, lastPrice }`),
manual price refresh. No market data fetch — users paste or edit prices.
Net worth picks up the current value.

#### T‑19. Design system: tokens v2 + motion

- Promote more values from `DashboardPage` into tokens (hero gradient,
  card radii tiers, stat tile sizing).
- Add a `useReducedMotion` hook; respect `prefers-reduced-motion`.
- Tiny FLIP animation on transaction row add / delete (web only).
- Audit `elevation()` usages; reduce to 0/1/2 and document when to pick
  which.

#### T‑20. Mobile refinements

- Bottom tab bar on narrow screens instead of the horizontal pill strip.
- Swipe‑to‑review / swipe‑to‑delete on transaction rows.
- Sticky month selector above the transaction list.
- Safe‑area insets on iOS PWA.

---

## 6. Coding standards

- **TypeScript first.** No `any` without a `// TODO(<owner>): <reason>`
  comment. Prefer discriminated unions over boolean flags.
- **Pure, testable logic.** Anything that mutates `FinanceState` goes in
  `src/finance/` and returns a new state (do not mutate the previous one).
- **Naming.** Boolean props: `isX` / `hasX`. Action props: `onFoo`. Pure
  selector getters: `get<Thing>` / `project<Thing>` / `detect<Thing>`.
- **Comments.** Only when the code can't explain itself. Never narrate
  the change in code comments.
- **Styling.** Use `StyleSheet.create` with keys, not inline styles for
  anything reused. Lean on token values (`spacing.md`, `radius.lg`).
- **Icons.** Emoji is fine — it keeps the bundle small and renders on
  every platform. Don't add an icon library without a ticket.
- **Imports.** Group as: node builtins → external deps → theme/tokens →
  components → finance → utils → relative. Let the formatter handle it.
- **Tests.** Must run under `node --import tsx --test`. Keep fixtures in
  `fixtures/`. Don't import UI code in finance tests.
- **PR body.** Must list: why (link the gap), what changed (files), out of
  scope, screenshots / videos if UI, and a `npm test` output excerpt.

Forbidden without an approved ticket: `eval`, `Function` constructor,
remote `fetch` in production code paths, writing to `window.location`,
`document.write`, service workers that phone home, analytics SDKs.

---

## 7. Change log for agents (append one line per shipped PR)

- 2026‑04‑17 · **Opus** · Shipped design refresh (tokens, sidebar sections,
  gradient dashboard hero) + PDF/QIF/OFX/filtered CSV exports + drag‑drop
  multi‑file import + undo last import + bulk transaction ops. Added
  `export.test.ts`. 14/14 tests green.
- 2026‑04‑17 · **Opus** · Wrote this playbook. No code change.
- _next agent: add your line here_

---

## 8. Quick reference

```bash
# install
npm install

# dev (web)
npm run web

# quality gates (all must pass before you push)
npm run typecheck
npm test
npm run build
```

Useful grep starts when planning a ticket:

```bash
rg "FinanceState" src --type ts
rg "applyImportedBatch|addManualTransaction|updateTransaction" src
rg "getCategoryBreakdown|getBudgetStatus|projectCashFlow" src
```

---

If you only read one paragraph: keep it local‑first, extend the types,
add tests, don't touch `main`, and leave the next agent a trail breadcrumb
in §7. Pick the highest unclaimed P0 ticket from §5 and go.
