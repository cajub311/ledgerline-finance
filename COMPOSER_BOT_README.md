# Composer bot playbook — Ledgerline

## §1 Non-negotiables

- Local-first only; no network for core ledger behavior.
- No new npm dependencies without PR justification.
- Tests run under Node (`npm test`).

## §2 Stack / file map

- Types: `src/finance/types.ts`
- Ledger: `src/finance/ledger.ts`
- Pages: `src/pages/*.tsx`
- Seed: `src/data/financeSeed.json`

## §3 Competitor gaps

- **YNAB / Actual / Monarch**: envelope-style budgeting with rollover and “ready to assign” is a differentiator for disciplined spenders.

## §4 Workflow

Branch from `main`, gates `npm run typecheck && npm test && npm run build`, conventional commits, append §7 per delivery.

## §5 Tickets (summary)

- **T-01** Rules engine — shipped separately.
- **T-02** Envelope budgets with rollover — envelope math, Budgets UI mode, dashboard over-budget when envelope mode on.

## §6 Coding standards

Immutable state updates, no `any`, match existing UI patterns.

## §7 Change log for agents

- 2026-04-17 — **T-02** envelope budgeting: `Budget.rollover`/`carry`, `getBudgetEnvelopes`, `envelopeBudgeting` preference, BudgetsPage flow/envelope toggle + inline limits, Dashboard over-budget uses `available` in envelope mode (`cursor/envelope-budgets-0144`).
