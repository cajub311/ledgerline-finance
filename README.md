# Ledgerline Finance

Local-first personal finance workspace built with Expo, React Native Web, and TypeScript.

Everything is organized into focused tabs:

- **Dashboard** — net worth, cash flow, savings rate, 6-month income/spend trend, category breakdown, top merchants, detected subscriptions, and automatic insights.
- **Transactions** — searchable, filterable ledger with inline edit, delete, and review. Filter by account, category, income/expense, or unreviewed.
- **Budgets** — per-category monthly limits with live status (on track / close / over) and suggestions for unbudgeted spending.
- **Goals** — savings targets with progress bars, days remaining, and the monthly save rate required to hit each target on time.
- **Accounts** — add / edit / delete any combination of checking, savings, credit, cash, loan, or investment accounts.
- **Import** — upload CSV, XLSX, or PDF statements from any bank (headers detected automatically), paste text, or export/restore a full JSON backup.
- **Settings** — switch between light and dark mode, rename your household, and reset to demo data.

The app is 100% client-side: transactions live in your browser (AsyncStorage / localStorage). Saves are debounced so typing does not write on every keystroke.

## Requirements

- Node.js 20 or newer (see `engines` in `package.json` and `.nvmrc`)

## Run locally

```bash
npm install
npm run web
```

## Quality checks

```bash
npm run typecheck
npm test
```

On pull requests and pushes to `main`, GitHub Actions runs the same checks plus a production web build (see `.github/workflows/ci.yml`).

## Web export / production build

```bash
npm run build
```

(`npm run build:web` is an alias.) The static export lands in `dist/` and is what Vercel serves.

## Vercel

The repo is configured for static hosting with `vercel.json`:

- **Install:** `npm ci` for reproducible builds from `package-lock.json`
- **Build:** `npm run build` (also exposed as `vercel-build` for frameworks that look for it)
- **Output:** `dist/`
- **Routing:** this build is a single `index.html` plus assets under `/_expo/static/`. Vercel serves those files directly; **no catch‑all rewrite** is needed (a broad rewrite can accidentally serve `index.html` for `.js` requests and break the app).

Connect the Git repo in the Vercel dashboard (framework preset: **Other** or leave default; no Next.js). **Root directory** must be the repository root (where `vercel.json` and `package.json` live). Node 20+ is enforced via `engines` and `.nvmrc`. In GitHub repository settings, consider **branch protection** on `main` requiring the CI workflow to pass before merge.

### Production URL vs preview URL

Long URLs like `ledgernew-73eg17j77-cajub311s-projects.vercel.app` are **one deployment’s preview**. They do **not** auto-update when you push to `main`. After each push, open the **production** domain from the Vercel project instead, for example:

- **`https://ledgernew.vercel.app`** (project **ledgernew**)
- **`https://dist-omega-one-79.vercel.app`** (project **dist**)

Both projects can be linked to the same GitHub repo; use **Deployments → Production** in the dashboard to see which commit is live. Pushes to `main` update production, not old preview links.

CLI deploy:

```bash
vercel deploy -y --no-wait
```

## Main files

- `src/FinanceApp.tsx` — app shell, tab routing, responsive sidebar
- `src/theme/` — design tokens (colors, spacing, typography) and light/dark ThemeProvider
- `src/pages/` — one file per tab: `DashboardPage.tsx`, `TransactionsPage.tsx`, `BudgetsPage.tsx`, `GoalsPage.tsx`, `AccountsPage.tsx`, `ImportPage.tsx`, `SettingsPage.tsx`
- `src/components/ui/` — reusable primitives (Button, Card, Input, Modal, Select, StatTile, Badge)
- `src/components/charts/` — BarChart (income/spend), CategoryBreakdownList, Sparkline
- `src/components/layout/Sidebar.tsx` — sidebar on wide screens, top pill bar on narrow
- `src/finance/ledger.ts` — all state transitions including `updateTransaction`, `deleteTransaction`, `addAccount`, `updateAccount`, `deleteAccount`, budgets, goals, insights, subscription detection
- `src/finance/import.shared.ts` / `import.web.ts` — CSV / XLSX / PDF parsing with header-alias detection (works with any bank, not just one)
- `src/finance/backup.ts` — JSON backup serialize/parse
- `src/finance/storage.ts` — AsyncStorage persistence (debounced via `useDebouncedFinancePersistence`)
- `public/index.html` — web template (do not use a `src/app` folder here — Expo treats it as Expo Router)

