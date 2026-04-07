# Ledgerline Finance

Local-first finance workspace built with Expo, React Native, and TypeScript.

It is designed around a statement inbox first:

- Import Wells Fargo PDFs, CSV exports, and spreadsheet files on web.
- Paste statement text on any device as a fallback.
- Review transactions, recategorize them, and mark them reviewed.
- Keep the state serializable with AsyncStorage so the ledger survives app restarts.

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

## Web export

```bash
npm run build:web
```

The web export lands in `dist/` and is the same output Vercel hosts.

## Vercel

The repo is configured for Vercel preview deployments with `vercel.json`.

If you want to redeploy from the CLI:

```bash
vercel deploy -y --no-wait
```

## Main files

- `src/app/FinanceApp.tsx` - finance workspace UI
- `src/finance/ledger.ts` - state transitions, summaries, and import application
- `src/finance/import.shared.ts` - CSV and statement-text parsing
- `src/finance/import.web.ts` - web file import and PDF/XLSX parsing
- `src/finance/storage.ts` - AsyncStorage persistence

