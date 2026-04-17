# Composer bot playbook

## 7. Change log for agents

- **2026-04-17 — T-02 (Envelope budgets):** Added `Budget.rollover` / optional `carry`, `FinancePreferences.budgetEnvelopeMode`, `getBudgetEnvelopes` + `getReadyToAssign` / `getEnvelopeAssignedTotal` in `src/finance/ledger.ts`, Budgets page Flow vs Envelope toggle with Ready to assign banner and inline limits, Dashboard Insights badge uses envelope `available` when envelope mode is on; tests in `src/finance/ledger.test.ts` (branch `cursor/envelope-budgets-t02-2328`).
