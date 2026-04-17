# Ledgerline — Composer bot playbook

## §1 Non-negotiables

- Local-first only; no network in core flows.
- No new dependencies without PR justification.
- Finance tests stay Node-runnable.

## §2 Stack / file map

- `src/finance/types.ts`, `src/finance/ledger.ts`, `src/pages/BudgetsPage.tsx`, `src/pages/DashboardPage.tsx`

## §3 Competitor gaps (Why)

YNAB / Actual / Monarch emphasize **envelope budgeting** and **month-to-month rollover**. T-02 adds envelope math and a mode toggle without cloud sync.

## §4 Workflow

Branch from `main`, implement, run `npm run typecheck && npm test && npm run build`, conventional commits, draft PR, append one line to §7.

## §5 Tickets (summary)

| ID | Title |
|----|--------|
| T-02 | Envelope budgeting with rollover |

## §6 Coding standards

Immutable `FinanceState` updates; pure ledger helpers; rebase on conflicts.

## §7 Change log for agents

- **2026-04-17 — T-02:** Envelope mode (`budgetViewMode`), `getBudgetEnvelopes`, `Budget.rollover`/`carry`, Budgets UI (ready to assign, inline limits), Dashboard over-budget uses `available` in envelope mode — branch `cursor/envelope-budgets-171e`.
