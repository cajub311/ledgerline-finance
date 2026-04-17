# Composer bot playbook

## 7. Change log for agents

- **2026-04-17 — T-03 (Net worth trend):** Added `NetWorthMonthPoint`, `getNetWorthSeries` in `src/finance/ledger.ts` (single-pass sorted txs, end-of-month + current through last month), `NetWorthLineChart` web/native in `src/components/charts/`, Dashboard card with 3M/6M/12M/ALL pills; tests in `src/finance/ledger.test.ts` (branch `cursor/networth-trend-t03-2328`).
