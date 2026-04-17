# Composer bot playbook (Ledgerline)

## §1 Non-negotiables

- Local-first only; no network calls from app logic.
- Do not add dependencies without calling them out in the PR.
- Keep tests runnable with Node (`npm test`).

## §2 Stack / file map

- Finance core: `src/finance/types.ts`, `src/finance/ledger.ts`, `src/finance/*.test.ts`
- UI: `src/pages/*`, `src/FinanceApp.tsx`

## §3 Competitor gaps (reference)

- YNAB / Actual / Monarch-style envelope budgeting and rollover.

## §4 Workflow

- Branch from `main` with prefix `cursor/`.
- Run `npm run typecheck && npm test && npm run build` before push.

## §5 Tickets (summary)

- **T-02**: Envelope / zero-based budgeting with rollover (this PR).

## §6 Coding standards

- Prefer pure functions in `ledger.ts` for finance math.
- Match existing React Native / Expo patterns.

## §7 Change log for agents

Append one line per shipped agent task (newest at bottom).

- **T-02 (2026-04-17)**: Envelope budgeting with `getBudgetEnvelopes`, rollover/carry on `Budget`, Flow vs Envelope UI on Budgets, Ready to assign, Dashboard over-budget uses envelope `available` when envelope mode is on (`cursor/envelope-budgets-73ac`).
