# Build Status

Live tracker maintained by the orchestrator (docs/orchestration.md). Spec references
(§) point at `docs/spec/build-prompt.md`.

**Current phase:** Build Order step 0–2 groundwork (repo, process, schema, calculations,
synthetic data). Backend spike (§2.1) blocked on AWS account access.

## Blockers / required inputs (owner: Sebastian)

| # | Input | Needed for | Status |
|---|---|---|---|
| 1 | AWS account + credentials/region decision, billing owner | §2.1 spike; all infra | **Blocked — nothing AWS exists on this machine** |
| 2 | Representative redacted TeamBuildr CSV | TeamBuildr adapter | Missing |
| 3 | Representative redacted Perch CSV | Perch adapter | Missing |
| 4 | PlayerData export **with athlete name + date columns** | PlayerData adapter | Partial — two real exports on Desktop have metrics but **no athlete/date columns** (see docs/import-sources/playerdata.md) |
| 5 | Penn Athletics logo asset (approved files) | Sidebar/login branding | Missing (style-guide PDF exists on Desktop) |
| 6 | Coach-approved thresholds + wording for load flags | Trends & Recommendations | Missing |
| 7 | Personal-best window for speed flag | Speed flag | Default recommended: active season + previous season |
| 8 | Institutional IT/privacy approval owner | Real-data import sign-off | Missing |

## Build order progress (§10)

| Step | Scope | Status |
|---|---|---|
| 0 | Repo, strict TS, lint/format/test, migrations tooling, ADRs | **Done** (this session) |
| 0 | §2.1 backend verification spike | **Blocked** on input 1 |
| 1 | Dev AWS infra + schema applied | Not started (schema SQL authored, unapplied) |
| 2 | Synthetic generator + calculation layer | In progress this session |
| 3 | Design tokens + app shell | Tokens this session; shell minimal |
| 4 | Import foundation | Not started (PlayerData format documented) |
| 5 | Coach-facing modules | Not started — gated on spike |
| 6 | Administration | Not started |
| 7 | Hardening + launch | Not started |

## Functional checklist (§13) — condensed

- Platform/data: repo+tooling done; auth, import pipeline, seasons — not started
- Overview / Monitoring / Data Trends / Performance modules — not started (gated on spike)
- Administration — not started

## Non-functional checklist (§14) — items already locked in

- [x] TypeScript strict; migrations-as-SQL policy; ADR process; CODEOWNERS protected paths
- [x] Secrets/.env gitignored from day one; real-data patterns gitignored
- [x] Synthetic-data determinism policy defined (seed 20260801, versioned config)
- [ ] Everything AWS-dependent (Cognito JWT enforcement, backups, budgets, env separation)

## Session log

### 2026-07-15 — Session 1

- Found machine had no Node/npm/brew/AWS CLI. Installed Node 22.23.1 user-space
  (`~/.local/node`, SHA-256 verified from nodejs.org).
- Scaffolded Vite + React 19 + TS 6 (strict, `noUncheckedIndexedAccess`) + Tailwind v4 +
  Vitest + oxlint + Prettier. All checks green. git init: `main` (production model),
  working branch `dev`.
- Wrote ADRs 001–006 (001 Proposed/blocked; 002, 005, 006 Accepted; 003, 004 Proposed
  pending spike), orchestration doc, CODEOWNERS.
- Discovered two real PlayerData exports on Desktop; documented format + gaps in
  docs/import-sources/playerdata.md; created redacted fixture with the real header set.
- Authored initial schema migration (db/migrations/0001) implementing §3 + migration
  runner with production refusal.
- Implemented §12 design tokens; §3.1 calculation layer with hand-checked tests; §8
  synthetic generator core.
