# Agents

## Cursor Cloud specific instructions

**Product:** Ledgerline Finance — a local-first personal finance app (Expo + React Native Web + TypeScript). No backend, no database, no external services. All data persists in the browser (AsyncStorage / localStorage).

**Key commands** (also in `README.md` and `package.json`):

| Task | Command |
| --- | --- |
| Install deps | `npm ci` |
| Dev server (web) | `npm run web` (Metro; often `http://localhost:8081`) |
| Type check | `npm run typecheck` |
| Tests | `npm test` |
| Production build | `npm run build` (output in `dist/`) |

**Non-obvious notes:**

- The dev server uses Expo's Metro bundler. The first page load after `npm run web` can take a while while Metro bundles.
- There is no ESLint configured — only `tsc --noEmit` for type checking.
- Tests use Node.js native test runner (`node --test`) with `tsx` for TypeScript, not Jest or Vitest.
- Use `npm ci` with `package-lock.json` for reproducible installs in CI.
- Optional **web** password gate: set `EXPO_PUBLIC_WEB_ACCESS_PASSWORD` at build time (e.g. Vercel) to require a password before the app loads; omit it for a public static deploy.
