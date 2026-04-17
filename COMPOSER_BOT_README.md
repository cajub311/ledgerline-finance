# Composer bot playbook

Sections §1–§6 are maintained in the project wiki or parent task; this file holds the agent change log only.

## §7 Change log for agents

- 2026-04-17 — **T-02** (envelope / zero-based budgeting with rollover): extended `Budget` and `FinancePreferences`, added `getBudgetEnvelopes` + `getMonthIncome` in `src/finance/ledger.ts`, Flow vs Envelope UI on `src/pages/BudgetsPage.tsx`, Dashboard over-budget count respects envelope `available` when envelope mode is on (`src/pages/DashboardPage.tsx`), tests in `src/finance/ledger.test.ts`. Branch: `cursor/envelope-budgets-7909`.
