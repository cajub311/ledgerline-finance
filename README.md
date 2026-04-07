# Ledgerline Finance

Local-first finance workspace built with Expo, React Native, and TypeScript.

It is designed around a statement inbox first:

- Import Wells Fargo PDFs, CSV exports, and spreadsheet files on web.
- Paste statement text on any device as a fallback.
- Review transactions, recategorize them, and mark them reviewed.
- Keep the state serializable with AsyncStorage so the ledger survives app restarts (saves are debounced so typing does not write on every keystroke).
- On web, **Export backup** downloads the full ledger as JSON; **Import backup** restores it (useful for moving between browsers or recovering from a bad import).

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
- **SPA routing:** paths that are not static files fall back to `index.html`. The rewrite **must not** match `/_expo/static/**` (or JS/CSS requests get HTML and the app shows a blank page). See the negative-lookahead pattern in `vercel.json`.

Connect the Git repo in the Vercel dashboard (framework preset: **Other** or leave default; no Next.js). Node 20+ is enforced via `engines` and `.nvmrc`. In GitHub repository settings, consider **branch protection** on `main` requiring the CI workflow to pass before merge.

CLI deploy:

```bash
vercel deploy -y --no-wait
```

## Main files

- `src/FinanceApp.tsx` - finance workspace UI
- `src/components/finance/ImportHubSection.tsx` - import hub (statements, backup, paste)
- `src/finance/backup.ts` - JSON backup serialize/parse
- `public/index.html` - web template (includes `<link rel="manifest">`; do not use a `src/app` folder here — Expo treats it as Expo Router and would change the bundle)
- `src/finance/ledger.ts` - state transitions, summaries, and import application
- `src/finance/import.shared.ts` - CSV and statement-text parsing
- `src/finance/import.web.ts` - web file import and PDF/XLSX parsing
- `src/finance/storage.ts` - AsyncStorage persistence

