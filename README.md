# FH Performance Dashboard

Performance-monitoring dashboard for a college field hockey team (25 athletes), used by
strength & conditioning / performance staff. Replaces spreadsheet review of three exported
data sources: **TeamBuildr** (lifts), **PlayerData** (GPS/load), and **Perch** (VBT power).

Ground-up rebuild — not a patch on the V1 single-file dashboard.

## Stack

- **Frontend:** Vite + React + TypeScript (strict) + Tailwind CSS v4
- **Backend (planned, gated on the §2.1 architecture spike):** AWS Amplify Hosting, Cognito
  auth, AppSync GraphQL, Aurora PostgreSQL Serverless v2 (RDS Data API), private S3 for CSV
  imports
- **Tests:** Vitest · **Lint:** oxlint · **Format:** Prettier

## Development

Requires Node.js ≥ 22.12 (see `.nvmrc`).

> This machine's toolchain was installed user-space at `~/.local/node`. If `node` is not on
> your PATH: `export PATH="$HOME/.local/node/bin:$PATH"`.

```bash
npm install
npm run dev          # local dev server (synthetic data / mock auth only)
npm run test         # unit tests
npm run typecheck    # tsc -b across app + tools
npm run lint         # oxlint
npm run format       # prettier
npm run seed:generate -- --season=2026 --seed=20260801   # deterministic synthetic dataset
npm run db:migrate   # apply SQL migrations (requires DATABASE_URL; refuses production)
```

## Environments

| Mode           | Data                       | Auth                                      |
| -------------- | -------------------------- | ----------------------------------------- |
| Local          | synthetic only             | mock allowed (`AUTH_MODE=mock`)           |
| Dev AWS        | synthetic only             | real Cognito, test accounts               |
| Production AWS | approved real imports only | Cognito + MFA, Availability gate enforced |

Real athlete data never enters this repository, local machines, or the dev environment.
Production builds hard-fail if mock auth or dev resource identifiers are detected.

## Key documents

- `docs/build-status.md` — live build checklist and session log
- `docs/adr/` — architecture decision records (001–006 required before their areas ship)
- `docs/import-sources/` — documented real export formats per source
- `db/migrations/` — versioned SQL schema, the only way schema changes ship

## Repository rules

Architecture-sensitive paths (schema, migrations, auth flows, import transaction logic,
calculation formulas, environment guards) require architect-level review before merge —
see `.github/CODEOWNERS` and `docs/adr/`. No secrets in git, ever.
