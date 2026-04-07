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
- **Routing:** this build is a single `index.html` plus assets under `/_expo/static/`. Vercel serves those files directly; **no catch‑all rewrite** is needed (a broad rewrite can accidentally serve `index.html` for `.js` requests and break the app).

Connect the Git repo in the Vercel dashboard (framework preset: **Other** or leave default; no Next.js). **Root directory** must be the repository root (where `vercel.json` and `package.json` live). Node 20+ is enforced via `engines` and `.nvmrc`. In GitHub repository settings, consider **branch protection** on `main` requiring the CI workflow to pass before merge.

### Production URL vs preview URL

Long URLs like `ledgernew-73eg17j77-cajub311s-projects.vercel.app` are **one deployment’s preview**. They do **not** auto-update when you push to `main`. After each push, open the **production** domain from the Vercel project instead, for example:

- **`https://ledgernew.vercel.app`** (project **ledgernew**)
- **`https://dist-omega-one-79.vercel.app`** (project **dist**)

Both projects can be linked to the same GitHub repo; use **Deployments → Production** in the dashboard to see which commit is live. Pushes to `main` update production, not old preview links.

### Why a preview URL can look “broken” (spinner forever or blank)

If **Vercel Authentication** (Deployment Protection) is enabled for your team or project, **unauthenticated** requests to a **deployment URL** (`*.vercel.app` subdomains like `ledgernew-xxxxx-cajub311s-projects.vercel.app`) can return **401** for HTML and for `/_expo/static/...` JavaScript. The page shell may load in some cases while scripts do not, so the app never mounts.

- **Use the production alias** (e.g. **`https://ledgernew.vercel.app`**) for a normal public link; it should return **200** for `/` and for `/_expo/static/js/web/*.js`.
- **Or** in the Vercel dashboard: **Project → Settings → Deployment Protection** (or team **Security**), relax protection for preview deployments, or use a **shareable link** / logged-in access for that deployment.
- Quick check: `curl -sI 'https://YOUR-DEPLOYMENT-URL/_expo/static/js/web/index-….js'` — if you see **401**, protection is blocking assets.

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

