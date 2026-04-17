# Composer bot playbook

Agent coordination notes for Ledgerline backlog work.

## 7. Change log for agents

- **2026-04-17 — T-01 (Rules engine):** Shipped `FinanceRule` + `rules[]` on `FinanceState`, pure helpers in `src/finance/rules.ts`, import-time categorization in `applyImportedBatch`, bulk re-apply in `reapplyRulesToAllTransactions`, Settings UI for create/edit/delete/reorder with live match count, tests in `src/finance/rules.test.ts` (branch `cursor/rules-engine-t01-2328`).
- **2026-04-17 — T-02 (envelope budgets):** `Budget.rollover` / `carry`, `getBudgetEnvelopes`, `budgetViewMode` preference, Budgets envelope UI + Dashboard over count, tests in `ledger.test.ts`.
