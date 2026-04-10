# Agents

## Cursor Cloud specific instructions

**Product:** Ledgerline Finance — a local-first personal finance app (Expo + React Native Web + TypeScript). No backend, no database, no external services. All data persists in browser localStorage via AsyncStorage.

**Key commands** (also documented in `README.md` and `package.json`):

| Task | Command |
|---|---|
| Install deps | `npm ci` |
| Dev server (web) | `npm run web` (serves on `http://localhost:8081`) |
| Type check | `npm run typecheck` |
| Tests | `npm test` |
| Production build | `npm run build` (output in `dist/`) |

**Non-obvious notes:**

- The dev server uses Expo's Metro bundler. The first page load after starting `npm run web` can take 10-15 seconds while Metro bundles.
- There is no ESLint configured — only `tsc --noEmit` for type checking.
- Tests use Node.js native test runner (`node --test`) with `tsx` for TypeScript transpilation, not Jest or Vitest.
- The `package-lock.json` is the lockfile; always use `npm ci` (not `npm install`) for reproducible installs in CI-like contexts.
- No environment variables or `.env` files are needed.
