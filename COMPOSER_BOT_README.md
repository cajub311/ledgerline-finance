# Composer bot playbook — Ledgerline

This file was missing from the repository; it was added so agent runs can append §7 as required by the backlog tickets.

## 1. Non-negotiables

- **Local-first only:** no network calls from app logic; persistence stays on device.
- **No new dependencies** unless justified in the PR body and truly necessary.
- **Tests must be Node-runnable** (`node --import tsx --test`).

## 2. Stack / file map (short)

- Expo + React Native Web, TypeScript.
- Finance domain: `src/finance/types.ts`, `src/finance/ledger.ts`, `src/finance/*.test.ts`.
- UI pages: `src/pages/*.tsx`.

## 3. Competitor gaps (Why)

Copilot Money, Actual Budget, and Monarch Money support richer **rule-based auto-categorization** than a static keyword list alone.

## 4. Workflow

Branch from `main`, implement, run `npm run typecheck && npm test && npm run build`, commit, push, open draft PR, append §7.

## 5. Tickets (T-01 …)

### T-01 — Rules engine for auto-categorization

**Problem:** Users cannot define their own categorization rules (regex, amount bands, account scope) or re-apply them in bulk after imports.

**Acceptance:**

- `FinanceRule` type and `rules: FinanceRule[]` on `FinanceState` (default `[]`).
- Pure helpers in `src/finance/rules.ts`: `applyRules`, `applyRulesToTransactions`, CRUD + `moveRule`, plus `safeRegex` so bad patterns never throw.
- `applyImportedBatch` runs rules on newly imported rows before persistence.
- Settings UI: create/edit/delete/reorder; live “would match N transactions” while editing.
- “Re-apply rules to all transactions” with confirmation that existing categories may be overwritten.
- Tests: precedence, invalid regex safety, amount range, account scoping, idempotency, import dedupe unchanged.

**Touch list:** `types.ts`, `rules.ts`, `ledger.ts`, `SettingsPage.tsx`, `package.json` (test script), `rules.test.ts`.

**Gotchas:** Merge conflicts in `types.ts` / `ledger.ts` — rebase and preserve other bots’ additions.

_Additional tickets T-02–T-04: see maintainer backlog / parallel agent prompts._

## 6. Coding standards

Match existing patterns; prefer pure functions for domain logic; no drive-by refactors.

## 7. Change log for agents

- **2026-04-17 — T-01 (rules engine):** `FinanceRule` + `rules[]` on state, `src/finance/rules.ts`, import + bulk re-apply in `ledger.ts` / `SettingsPage.tsx`, `src/finance/rules.test.ts` (PR: feat(rules): auto-categorization rules engine).
