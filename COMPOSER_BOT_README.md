# Composer bot playbook — Ledgerline

## §1 Non-negotiables

- Local-first only: no network calls for core ledger behavior.
- No new npm dependencies unless justified in the PR body.
- Tests must run under Node (`npm test`).

## §2 Stack / file map

- Finance types: `src/finance/types.ts`
- Ledger logic: `src/finance/ledger.ts`
- UI pages: `src/pages/*.tsx`
- Persistence: `src/finance/storage.ts`, `src/finance/storage.web.ts`

## §3 Competitor gaps (PR “Why” references)

- **Copilot Money / Monarch / Actual**: auto-categorization with user-defined rules and safe bulk re-apply is expected; this work keeps everything offline-first.

## §4 Workflow

1. Branch from `main` with prefix `cursor/…-0144` per task.
2. Run `npm run typecheck && npm test && npm run build` before push.
3. Conventional commits, one logical change per commit.
4. Append one line to §7 when shipping; do not replace the §7 log wholesale.

## §5 Tickets

### T-01 — Rules engine for auto-categorization

**Problem:** Users need predictable, editable auto-categorization (regex + guards) and bulk re-apply without cloud sync.

**Acceptance**

- `FinanceRule` in `src/finance/types.ts`; `FinanceState.rules` default `[]`.
- Pure helpers in `src/finance/rules.ts`: `applyRules`, `applyRulesToTransactions`, `addRule`, `updateRule`, `deleteRule`, `moveRule`, plus `safeRegex` so bad patterns never throw.
- `applyImportedBatch` applies rules to newly imported rows before dedupe/storage.
- Settings UI: create/edit/delete/reorder; live “would match N transactions” while editing.
- “Re-apply rules to all transactions” with explicit confirmation that categories may be overwritten.
- `src/finance/rules.test.ts`: precedence, invalid regex, amount range, account scope, idempotency, dedupe unchanged.
- Register tests in `package.json` `test` script.

**Touch list:** `types.ts`, `rules.ts`, `ledger.ts`, `SettingsPage.tsx`, `package.json`, tests.

**Gotchas:** Re-apply overwrites categories where rules match; merge carefully if other bots edit `types.ts` / `ledger.ts`.

### T-02 — Envelope / zero-based budgeting with rollover

See task prompt (envelope mode, carry, BudgetsPage); branch `cursor/envelope-budgets-*`.

### T-03 — Net worth trend over time

See task prompt (`getNetWorthSeries`, dashboard chart); branch `cursor/networth-trend-*`.

### T-04 — Upcoming bills & paychecks calendar

See task prompt (`projectRecurring`, Forecast calendar); branch `cursor/upcoming-calendar-*`.

## §6 Coding standards

- Match existing patterns (functional updates, immutable state).
- Prefer small pure modules over UI-heavy ledger files.
- No `any`; keep RN + web compatible.

## §7 Change log for agents

- 2026-04-17 — **T-01** rules engine: `FinanceRule`, `src/finance/rules.ts`, import wiring, Settings UI, `rules.test.ts` (`cursor/rules-engine-0144`).
