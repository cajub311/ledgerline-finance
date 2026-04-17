# Ledgerline — Notes for Other Agents

> **If you're a Cursor Composer bot looking for work to pick up, read
> [`COMPOSER_BOT_README.md`](./COMPOSER_BOT_README.md) first.** That file has
> the full playbook (rules, stack, coding standards, workflow) and twenty
> scoped, prioritized tickets (T‑01 … T‑20). This file is the historical
> snapshot that kicked off the overhaul.

This document is the "brain's" (Opus) notes after comparing Ledgerline to
market‑leading personal‑finance apps and landing a design + data‑I/O overhaul.
It lists competitive gaps, what's now in place, and the concrete, bounded work
items other agents (composer / code‑executor bots) should pick up next.

## 1. Competitor snapshot (April 2026)

| Feature area | Ledgerline today | Monarch | YNAB | Copilot | Rocket Money |
| --- | --- | --- | --- | --- | --- |
| Philosophy | Local‑first, no accounts | Full dashboard, net worth first | Zero‑based envelopes | AI‑assisted, Apple‑native | Subscription cancel / automation |
| Account link | Manual / CSV / PDF / XLSX | Plaid/MX auto‑sync | Manual + connected | Plaid + automation rules | Plaid |
| Budgets | Per‑category monthly limits | Flexible, envelope+flow | Envelope‑first (primary) | Auto‑categorized, custom rules | Limited |
| Recurring detection | Yes (subs + income, cadence heuristic) | Yes, with couples calendar | No | Yes | Yes |
| Cash flow forecast | Yes (horizon + low‑balance threshold) | Refreshed 2024 | No | No | No |
| Investment tracking | No | Yes | No | Yes | No |
| Couples / shared access | No | Best in class | No | Single login | No |
| Import formats | CSV, XLSX, PDF, paste | Mostly auto‑sync | CSV/manual | CSV | n/a |
| Export formats | **CSV, PDF (new), QIF (new), OFX (new), JSON backup** | CSV | CSV, BYOB | CSV | n/a |
| Price | Free (self‑hosted) | ~$99/yr | ~$109/yr | ~$95/yr | ~$48/yr |

Key competitive wedges Ledgerline already owns: **local‑first privacy**, **bring‑your‑own statements** (no Plaid), **no subscription**, **forecast with threshold warnings**. We should keep leaning on those.

## 2. What this PR changed

### Design refresh
- **Tokens** (`src/theme/tokens.ts`): deeper dark mode, richer primary (`#4a5bf0` light / `#7c8cff` dark), dedicated gradient stops, new `displayXl` typography tier, softer radii (`sm:8 / md:12 / lg:16 / xl:22`). Added `elevation(level, mode)` helper that emits real `boxShadow` on web and `elevation` on native.
- **Sidebar** (`components/layout/Sidebar.tsx`): grouped nav (Overview / Plan / Data), active indicator rail, persistent net‑worth + liquid + MoM chip summary, scrollable pill bar on mobile with brand row.
- **Dashboard** (`pages/DashboardPage.tsx`): new gradient hero card with health score chip, inline "Safe to spend / Net / Savings rate" split. Privacy ribbon demoted to calm secondary strip. Stat grid replaced with actionable tiles (Net worth / Liquid / Unreviewed / Over‑budget).
- **Cards / StatTile**: participate in the new elevation system; cards now have subtle shadows on web.

### Import / export
- New file `src/finance/exportPdf.ts` — lazy‑loads `jspdf` + `jspdf-autotable`, produces a print‑ready PDF statement with a cover summary and color‑coded totals. Supports scope = full ledger, single month (`YYYY-MM`), or single account.
- New `buildAccountQif`, `buildMultiAccountQif`, `buildAccountOfx` in `src/finance/export.ts`. QIF targets Quicken / GnuCash / Moneydance. OFX 1.0.2 targets bank‑import flows and correctly distinguishes BANKACCTFROM vs CCACCTFROM.
- `buildTransactionsCsv` now accepts an `options.transactions` override so we can export filtered subsets.
- `ImportPage` rebuilt: drag‑and‑drop zone, multi‑file import with progress messages, **Undo last import**, scoped export UI (Everything / Single month / Single account), wired to CSV/PDF/QIF/OFX/JSON/restore.
- `utils/format.ts` adds `downloadBlob`, `downloadText`, `formatCurrencyPlain` (Latin‑1 safe for PDF core fonts).

### Transactions
- Bulk select with visible checkboxes, "select all visible" header toggle, sticky bulk action bar: mark reviewed/unreviewed, recategorize via category picker, bulk delete, clear selection.
- Header button for **Export filtered CSV** respects current search/filter.
- New ledger helpers: `deleteTransactions`, `setTransactionsReviewed`, `setTransactionsCategory` (all pure, array‑diffing friendly).
- `export.test.ts` added: CSV filtered subset, per‑account QIF, multi‑account QIF, OFX header/body shape.

## 3. What to pick up next (for composer / code‑exec bots)

Order is rough priority. Each item is scoped so a single PR can finish it. Do **not** rewrite the core data model (`src/finance/types.ts`, `ledger.ts`) — extend it.

### 3a. "Must‑have for parity"
1. **Envelope / zero‑based budgeting mode.** Extend `Budget` with an optional `carryover: boolean` and `rollover: number`, plus a new `PlannedAllocation` slice if needed. Add a "give every dollar a job" view in `BudgetsPage` (available balance → category assignments). Cover with tests in `ledger.test.ts`.
2. **Rules engine for auto‑categorization.** Add `FinanceRule` (pattern + category + optional account target) and apply on import after the current `inferCategory`. Rules UI under Settings → Rules. Rule IDs stable so rules survive restore.
3. **Goals linked to accounts.** Let `FinancialGoal` optionally reference `accountId`; then `currentAmount` can be computed from live balance. Progress bars should auto‑update.
4. **Recurring calendar view.** Reuse `detectSubscriptions` + `detectRecurringIncome` but emit a merged list sorted by next predicted charge date for the next 45 days. Render on the dashboard under a collapsed "Upcoming" panel.

### 3b. Import coverage
5. **PDF layout‑aware parsing.** Current PDF import flattens text; Wells Fargo, Chase, Amex multi‑column statements often need `pdfjs` `getTextContent` with geometry‑aware line grouping (group items by `transform[5]` y‑coord). Add `src/finance/pdfLayout.ts` and fall back to `parseStatementText` when geometry heuristics miss.
6. **Apple Card PDF quirks + JP Morgan layout.** These use tabular layouts with split date/description/amount per row — handle explicitly via regex profiles in `pdfLayout.ts`.
7. **Import preview modal for non‑CSV files.** Today PDF/XLSX import commits straight to the ledger. Introduce a shared `PreviewBatch` modal that lets the user accept/decline/rename rows before commit (reuse existing CSV wizard preview table).

### 3c. Exports
8. **Tax‑year CSV with category totals footer.** Wire off the existing `getCategoryBreakdown` per month; emit both transaction rows and a trailing summary block keyed by year.
9. **Per‑category CSV (for spreadsheet users).** One row per `{year-month, category}` with income/spend totals. Useful for pivoting in Google Sheets / Excel.
10. **Charts in PDF.** Use `html2canvas` on the existing BarChart SVG, or port the bar chart to a server‑rendered SVG path. Embed on page 1 under the summary box.

### 3d. UX polish / accessibility
11. **Keyboard shortcuts on web**: `/` focus search, `N` new transaction, `J/K` navigate rows, `R` toggle review. Use a single `useHotkeys` hook gated to `Platform.OS === 'web'`.
12. **Focus rings + ARIA labels.** Buttons/Pressables lack visible focus state on web. Add `web:{ outline }` styles via the `hovered` prop set.
13. **Number input parsing.** `Input` with `keyboardType="decimal-pad"` still accepts any string; create a `NumericInput` wrapper that normalizes comma thousand separators and blocks non‑numeric chars (still allowing `-` and `.`).

### 3e. Platform / infra
14. **Playwright smoke test**: boot dev server (`npm run web`), open `/`, upload a small CSV fixture from `fixtures/statements/*.csv`, assert transactions render. Add to CI alongside `typecheck`/`test`.
15. **Error boundary page body.** `RootErrorBoundary` exists but each page body should also be wrapped so one failing chart doesn't nuke the whole shell.
16. **Expo ⇄ Web share.** Native builds can't use `jspdf` or `pdfjs` easily — keep those behind dynamic `import()` as done here, and ensure `import.native.ts` continues to not pull them.

## 4. Rules of engagement

- **Do not introduce network calls.** Ledgerline's privacy pitch depends on it. All processing stays client‑side.
- **No new top‑level dependencies without a justification comment** in the PR body. `jspdf` + `jspdf-autotable` are the only additions here.
- **Types over runtime checks.** Prefer narrowing via the existing `types.ts` discriminated unions; avoid `any`.
- **Keep the tests node‑runnable.** `node --import tsx --test` — do not introduce `jsdom` / Jest for the finance core. Component tests can land later under `@testing-library/react-native` in a separate suite.
- **Don't touch git history.** Commit per logical change, rebase only if instructed.

## 5. Quick pointers

- UI shell: `src/FinanceApp.tsx`
- Design tokens: `src/theme/tokens.ts`
- State transitions: `src/finance/ledger.ts`
- Export: `src/finance/export.ts`, `src/finance/exportPdf.ts`
- Import: `src/finance/import.ts` + `import.shared.ts` + `import.web.ts` + `import.native.ts`
- Tests: `src/finance/*.test.ts` — run `npm test` (runs in Node, ~300ms)

When you pick up a task, append a dated bullet under "Recent handoffs" below.

## 6. Recent handoffs

- 2026‑04‑17 — Opus: Shipped tokens/Sidebar/Dashboard refresh, PDF/QIF/OFX/filtered CSV exports, drag‑drop + undo import, bulk tx operations. Tests 14/14. See this PR for the diff.
