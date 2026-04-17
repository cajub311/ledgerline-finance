# Ledgerline — Composer bot playbook

## §1 Non-negotiables

- **Local-first only:** no network calls from core finance flows; data stays on device.
- **No new dependencies** without explicit justification in the PR body.
- **Tests:** Node-runnable (`node --test` + tsx); do not pull RN-only chart modules into finance unit tests.

## §2 Stack / file map

- **Types:** `src/finance/types.ts`
- **Ledger / analytics:** `src/finance/ledger.ts`
- **Import:** `src/finance/import*.ts`, `import.shared.ts`
- **UI pages:** `src/pages/*Page.tsx`, shell `src/FinanceApp.tsx`
- **Persistence:** `src/finance/storage.ts`, `storage.web.ts`

## §3 Competitor gaps (Why)

Products like **Copilot Money**, **Actual Budget**, and **Monarch Money** expose stronger **merchant rules and auto-categorization** than many minimal ledgers. T-01 closes the gap with ordered, user-defined rules and safe regex handling.

## §4 Workflow

1. `git fetch origin && git checkout main && git pull && git checkout -b cursor/<ticket-branch>`
2. Implement the ticket; run `npm run typecheck && npm test && npm run build`.
3. Conventional commits, one logical change each; push and open a **draft** PR.
4. Append **one line** to §7 in the same PR (do not replace the whole playbook).

## §5 Tickets (summary)

| ID | Title |
|----|--------|
| T-01 | Rules engine for auto-categorization |
| T-02 | Envelope budgeting with rollover |
| T-03 | Net-worth trend over time |
| T-04 | Upcoming bills & paychecks calendar |

*(Full acceptance criteria live in product docs / issue tracker when linked.)*

## §6 Coding standards

- Match existing patterns (pure finance helpers, `FinanceState` immutability).
- Prefer small, focused modules over god files.
- On merge conflicts in shared files (`types.ts`, `ledger.ts`, `DashboardPage.tsx`), **rebase** and preserve other agents’ additions.

## §7 Change log for agents

- **2026-04-17 — T-01 (rules engine):** Shipped `FinanceRule`, `src/finance/rules.ts`, import-time + bulk re-apply categorization, Settings rules UI, `src/finance/rules.test.ts` (branch `cursor/rules-engine-171e`).
