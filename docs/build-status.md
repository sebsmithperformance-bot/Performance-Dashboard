# Build Status

Live tracker maintained by the orchestrator (docs/orchestration.md). Spec references
(§) point at `docs/spec/build-prompt.md`.

**Current phase:** Build Order step 4 complete locally (import pipeline + Import Data
page on the local PGlite backend). Backend spike (§2.1) blocked on AWS account access
and remains the gate for coach-facing analytics pages.

## Blockers / required inputs (owner: Sebastian)

| #   | Input                                                    | Needed for                | Status                                                                                                                     |
| --- | -------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | AWS account + credentials/region decision, billing owner | §2.1 spike; all infra     | **Blocked — nothing AWS exists on this machine**                                                                           |
| 2   | Representative redacted TeamBuildr CSV                   | TeamBuildr adapter        | Missing                                                                                                                    |
| 3   | Representative redacted Perch CSV                        | Perch adapter             | Missing                                                                                                                    |
| 4   | PlayerData export **with athlete name + date columns**   | PlayerData adapter        | Partial — two real exports on Desktop have metrics but **no athlete/date columns** (see docs/import-sources/playerdata.md) |
| 5   | Penn Athletics logo asset (approved files)               | Sidebar/login branding    | Missing (style-guide PDF exists on Desktop)                                                                                |
| 6   | Coach-approved thresholds + wording for load flags       | Trends & Recommendations  | Missing                                                                                                                    |
| 7   | Personal-best window for speed flag                      | Speed flag                | Default recommended: active season + previous season                                                                       |
| 8   | Institutional IT/privacy approval owner                  | Real-data import sign-off | Missing                                                                                                                    |

## Build order progress (§10)

| Step | Scope                                                       | Status                                                  |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------- |
| 0    | Repo, strict TS, lint/format/test, migrations tooling, ADRs | **Done** (this session)                                 |
| 0    | §2.1 backend verification spike                             | **Blocked** on input 1                                  |
| 1    | Dev AWS infra + schema applied                              | Not started (schema SQL authored, unapplied)            |
| 2    | Synthetic generator + calculation layer                     | **Done** (this session, quality gate green)             |
| 3    | Design tokens + app shell                                   | **Done** (tokens + shell, session 2)                    |
| 4    | Import foundation                                           | **Done locally** (session 3; AWS re-homing after spike) |
| 5    | Coach-facing modules                                        | Not started — gated on spike                            |
| 6    | Administration                                              | Not started                                             |
| 7    | Hardening + launch                                          | Not started                                             |

## Functional checklist (§13) — condensed

- Platform/data: repo+tooling done. Import pipeline done locally: upload/preview/resolve/
  acknowledge/atomic-commit ✓, hash dedupe ✓, identities remembered ✓, fuzzy-never-creates ✓,
  Import History with per-row before/after ✓. Cognito auth + S3 originals — gated on spike.
- Overview / Monitoring / Data Trends / Performance modules — not started (gated on spike)
- Administration — Import Data page done (local backend); KPI Settings / Data Management
  not started

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
  runner with production refusal; 9 integration tests green on PGlite (in-process
  PostgreSQL — real constraints/triggers without a local server).
- Implemented §12 design tokens (spec property names verbatim, Tailwind v4 @theme,
  self-hosted Inter) — visually verified, zero console errors.
- Implemented §3.1 calculation layer (ADR-005 semantics: observed/rest/missing day
  states; not-computable results instead of NaN) with 24 hand-calculated fixture tests.
- Built §8 synthetic generator: default seed 20260801 → 25 athletes, 139 sessions,
  2081 GPS / 1985 lift / 1858 Perch rows, §8.13 scenario events, per-session PlayerData
  CSVs in the real header shape, §8.11 problem fixtures, §8.12 quality gate (all hard
  invariants pass; generation exits non-zero on violation). 39 tests total, all green.
- Note for later ADR-005 discussion: with the strict any-missing-day-blocks rule and a
  realistic ~3% device-missing rate, ~half of mature 28-day ACWR windows are incomplete.
  That is faithful to the spec ("omit the ratio and show a data-completeness warning"),
  but the coach may eventually want an explicit tolerance policy — requires sign-off.

### 2026-07-15 — Session 2

- Re-checked AWS: still no CLI/credentials — §2.1 spike remains blocked on input 1.
- §7.3 environment guards: pure policy module (CODEOWNERS path) + verifier wired into
  `npm run build`. Verified live: APP_ENV=production with mock auth blocks the build
  with 3 violations; mock auth rejected outside local. 6 tests.
- Build Order step 3 shipped: §5 IA app shell (collapsible sidebar with separated Admin
  group, topbar with athlete badge / session-date picker / env badge / Import Data,
  sub-tab rows incl. nested Monitoring→GPS tabs, mobile drawer), §7.3 mock auth with
  sign-in screen + 15-min idle sign-out (§7.1), app-level error boundary, and honest
  gated placeholders for every coach-facing pane. Cognito is an explicit unwired seam.
- Local synthetic data now feeds the shell: generator writes `seed/output/current/`,
  a dev-only (serve-mode) Vite middleware exposes it, and the picker/badges consume it.
  The date picker independently confirmed calendar events (rest Sundays and the
  canceled-Wednesday gap are absent from the options).
- Verified in browser at desktop / collapsed / mobile widths; console clean. 45 tests
  green; production build green behind the guard.
- Next: Build Order step 4 (import foundation) can start against the synthetic fixtures
  and documented PlayerData format; the §2.1 spike stays the gate for backend-wired
  pages and needs the AWS account decision.

### 2026-07-16 — Session 3 (Build Order step 4: import pipeline)

- Shipped the source-agnostic ingestion engine in `src/lib/import/` (CODEOWNERS path):
  adapter contract → canonical staging → athlete/session resolution ladders → row
  classification → filterable preview → single-transaction commit with in-tx
  re-validation → import history. Vendor headers live only inside the three PROVISIONAL
  adapters; a future API connector is just another adapter.
- ADR-006 unit registry (`src/lib/units/`) with exact factors + round-trip tests; RFC-4180
  parser; WebCrypto SHA-256; migration core split runtime-agnostic so the browser applies
  the same versioned SQL.
- Import Data page is a real working flow on the local PGlite (IndexedDB) backend behind
  the `ImportBackend` seam, with generated sample files (§13: demo season enters through
  the real pipeline) and a local-only reset utility. PGlite WASM is lazy and hard-gated to
  APP_ENV=local.
- Tests 45 → 79 (csv/hash 7, units 6, pipeline 13, commit-integration 6 incl. forced
  rollback to zero rows + unique-constraint final guard + before/after audit, UI walk 1).
  All green; guarded production build green.
- Browser E2E: TeamBuildr fixture committed (59 rows), Perch fixture landed on the SAME
  lift session (55 rows, no new-session badge), identical re-upload → duplicate banner +
  all-skip + blocked commit, history mirrors the DB, console clean.
- ADR-003 updated with the local proof + two local-only adaptations (local:// object key;
  imports row created at commit). Transaction semantics unchanged.
- Deferred to AWS phase: S3 original storage + download, uploaded/previewed staging
  statuses, §4.3 formula-escaping on audit export, persistent header-Ignore (needs a
  schema decision), rollback UI (§4.2 says optional; audit suffices).

### 2026-07-17 — Session 4 (Step 5 frontend-first, milestones 1–2: seam + Overview)

- **Owner decision recorded:** the §2.1 "spike before full UI" gate is consciously waived
  in favor of a frontend-first Step 5 behind a data seam; the spike remains the gate for
  anything backend-wired.
- Dashboard data seam shipped: `DashboardDataProvider` + local provider transforming the
  generated season into typed view models (latent traits never mapped), selected-date
  context in the topbar, SavedViewsStore (localStorage locally; saved_views on AWS).
  Old dev-data context deleted.
- Pure selector layer reusing the tested calc functions: availability, last-session GPS
  (prior-comparable delta, device-missing count), load health (ACWR bands via calc layer,
  observation language, incomplete/insufficient first-class), S&C % change (4 bases,
  zero-baseline refusal, stated ±2% unchanged band, interpretation-aware), speed flags
  (90% threshold + ≥3 baseline + exposure-eligible sessions; insufficient separated),
  single-session athletes table (same-date sessions separate; quality states).
- Shared component system: KPIValue/formatting core (registry decimals, units,
  missing ≠ zero, NaN/∞ impossible), TrendIndicator, CompletenessBadge,
  AvailabilityBadge, AlertCard, ChartCard (built-in accessible table toggle), sticky
  sortable DataTable, Drawer, PageHeader, FilterBar + selector controls, SaveViewControl,
  ErrorState, SVG Sparkline/DistributionBar, KPI→chart-token registry.
- Overview complete: five Team Dashboard tiles (reveal-in-place lists, switchable
  last-session metric, transparent thresholds everywhere) + Athletes page (session
  picker, position filter, metric show/hide, drawer, saved views, mobile cards).
- Tests 79 → 102 (17 selector/format incl. generated-season smoke; 6 jsdom page tests).
  Typecheck, lint, guarded build green. Browser-reviewed at 1280/768/375 — findings in
  docs/visual-review.md; console clean.
- Remaining Step-5 milestones: Monitoring (Availability, Readiness), Monitoring GPS
  (Session Overview/Compare/Trends+Recommendations — needs the line-chart component),
  Data Trends shared graph+table, Performance (tiles/leaderboards/profile radar),
  responsive/a11y pass, docs.
