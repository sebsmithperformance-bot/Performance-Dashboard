# Build Status

Live tracker maintained by the orchestrator (docs/orchestration.md). Spec references
(§) point at `docs/spec/build-prompt.md`.

**Current phase:** Build Order steps 5–6 complete frontend-first (all coach-facing sections
+ admin customization pages, behind the data/settings seams), then a coach-feedback polish
revision, a reference-driven visual redesign, and a **front-facing product revision**
(sidebar-only nav, clickable Team Snapshot, Workload terminology, larger Athlete Profile
radar, prototype Import History, standalone Competition, Annual Plan). 139 tests green;
typecheck/lint/guarded-build green. Backend spike (§2.1) remains blocked on AWS account
access and is still the gate for anything backend-wired.

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
| 5    | Coach-facing modules                                        | **Done (frontend-first)** — all four sections + polish  |
| 6    | Administration                                              | **Done (frontend-first)** — KPI Settings + Data Mgmt    |
| 7    | Hardening + launch                                          | Not started                                             |

## Functional checklist (§13) — condensed

- Platform/data: repo+tooling done. Import pipeline done locally: upload/preview/resolve/
  acknowledge/atomic-commit ✓, hash dedupe ✓, identities remembered ✓, fuzzy-never-creates ✓,
  Import History with per-row before/after ✓. Cognito auth + S3 originals — gated on spike.
- Overview / Monitoring / Data Trends / Performance modules — **done frontend-first**
  (synthetic data through the seams; averages-by-default, four-state Load Health, smooth
  charts, guidance-first Trends, radar team comparison)
- Administration — Import Data page (local backend) + KPI Settings (registry, add-KPI,
  per-KPI thresholds, operational thresholds, positions) + Data Management (layout) done

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

### 2026-07-18 — Session 5 (Step 5 complete + coach-feedback revision)

- Completed all coach-facing sections and both admin customization pages (build order
  steps 5–6, frontend-first), then applied a full coach-feedback revision. Six bounded
  commits on `dev`; 102 → 127 tests; typecheck, lint, guarded build green throughout.
- **Navigation/clutter:** sidebar now shows the active section's subcategories; the
  duplicate content-area tab row is removed (GPS keeps its deeper row). Added a reusable
  `InfoHint` popover so methodology/formula text lives out of primary page space.
- **Overview:** Last Session GPS defaults to Player Load and reports the average per
  participating athlete (never a hidden total); a Team Dashboard Customize drawer picks the
  GPS metric set. Load Health became four transparent ACWR states (added `acwrHighBand`)
  with team median ACWR + avg 7-day acute load; session-type annotations on every date
  option.
- **Monitoring GPS:** Session Compare rebuilt as a chronological team-average trend — left
  vertical session selector, smooth monotone `LineChart` (now with hover tooltips), and
  multi-metric comparison indexed to each metric's first session. Trends leads with concise
  Session Guidance then restructured alerts (happened → number → why → review). Removed the
  orphaned HBarChart.
- **Performance:** Athlete Profile radar overlays a team/position-average reference series
  (multi-series RadarChart + legend, shared percentile scale, insufficient-sample message).
- **Admin:** Add-KPI form (safe key gen + dedupe + validation, empty until data mapped;
  custom KPIs injected into the effective registry, retire/restore/delete) and a per-KPI
  display-threshold editor (bounds/state/explanation/active, overlap + range validation,
  reset). Settings model gained `customKpis`, `kpiThresholds`, `acwrHighBand`,
  `overviewGpsMetrics`; localStorage load() forward-merges them over defaults.
- Browser-reviewed at 1280/1024/768/390; console clean. Deferred (see visual-review.md):
  mobile radar spoke-label clipping; wiring per-KPI thresholds into render-time flags.
- Unchanged and protected: calculation formulas, import pipeline, DB schema, the five
  replaceable seams. No AWS/backend work — the §2.1 spike remains the gate for anything
  backend-wired.

### 2026-07-19 — Session 6 (reference visual redesign)

- Translated the supplied reference performance-dashboard screenshots into Penn branding
  in nine bounded commits (`584a98b` → head). No gold palette, football terminology,
  football positions, Send Report, or injury-risk language was carried over.
- **Shell:** Penn Navy masthead with a crimson divider and a text-only wordmark (no
  approved Penn logo asset exists in the repo, so none is recreated); compact page-control
  bar owning the page title; sidebar rebuilt as a grouped tree with uppercase section
  labels, always-visible leaves, crimson-tinted active rows and a left indicator (GPS
  expands to its third level; collapsed = icon rail); uppercase condensed sub-tabs.
- **Tokens/typography:** palette aligned to the Penn spec (`bg-input`, `navigation-*`,
  `status-info`, documented chart tints); Swiss 721 is the single family everywhere —
  hierarchy comes from weight/caps/tracking, not a second display font (Inter removed).
- **KPI system:** new `KpiCard`/`KpiStrip`/`SectionHeader`; dense strips added to Overview,
  Availability, Readiness, GPS Trends, Performance Overview and Athlete Profile; coach-
  selectable compact/wide card density (`DisplayPreferences.kpiCardSize`).
- **Overview:** Team Snapshot is now the single source of last-session GPS averages (the
  duplicate Last Session GPS panel was deleted); the remaining four panels form an even
  two-column grid with equal-height rows.
- **Charts:** smooth monotone curves, 2.25px lines and restrained gridlines across every
  line chart; 44px table rows.
- Tests 127 → 129. Typecheck, lint and the guarded production build are green.

### 2026-07-20 — Front-facing product revision (branch `dev`)

Targeted revision on the existing app (no rebuild, no backend). Nine bounded commits:

- **Navigation:** the sidebar is now the ONLY primary+secondary nav — the horizontal
  sub-tab row and the GPS third-level strip are gone. GPS became three flat Monitoring
  leaves; **Competition** and **Annual Plan** joined as top-level sections; Import moved
  under Admin next to a new **Competition Settings**. Routes adopt explicit per-leaf paths
  (`/overview/team-snapshot`, `/monitoring/gps/session-*`, `/data-trends/*`,
  `/performance/*`, `/competition/*`, `/annual-plan`, `/admin/*`) with legacy redirects;
  `aria-current` on the active item; standalone sections render as one clickable row.
- **Team Snapshot:** the Overview page is now a pure grid of clickable summary tiles; each
  opens one shared drill-down drawer (full-screen sheet on mobile). Seven tiles:
  Availability, Workload, Load Health, Speed Flags, Last Session GPS, S&C Change, Data
  Completeness. Tile show/hide + order still honour the layout config.
- **Workload:** coach-facing load is the 1–10 Workload source everywhere (daily-load
  selector `LOAD_KPI='workload'`; ACWR/monotony/strain/readiness inputs); Player Load is
  filtered out of the effective KPI registry at the `DashboardDataContext` seam. It stays
  in imports, raw records, the DB registry and the fixture for back-compat.
- **Copy + info controls:** methodology paragraphs replaced with keyboard-accessible `(i)`
  buttons (ACWR/monotony/strain, data completeness, radar percentiles, competition
  scoring); over-limit subtitles trimmed.
- **Athlete Profile:** the percentile radar is the top visual focus (~60% of the first
  row), enlarged, with the comparison-group benchmark polygon pinned to exactly 50 on
  every axis (not the drifting percentile-of-mean). Raw values stay visible.
- **Trend lines:** `LineChart` gained a `connectGaps` mode — daily Workload reads as one
  continuous line, bridging missing intervals with a muted dashed connector, no zero-fill.
- **Import History:** prototype/synthetic badges, a never-blank PROTOTYPE MODE empty state,
  and Demo Import labels on local fixture imports.
- **Competition (new, isolated):** a scoring selector ranks valid athletes per scored
  session × eligible KPI × scoring mode (direction-aware), converts place→configurable
  points via a dated profile, and accumulates over a range (never one best session).
  Absolute + relative-to-bodyweight; only explicitly eligible S&C KPIs score. Team
  Standings / Individual Leaderboard (podium + 4th + table) and KPI Leaderboards (card per
  KPI). Competition owns its own shared time range; config lives in Admin → Competition
  Settings. Points never appear outside the section.
- **Annual Plan (new):** stores one Excel workbook link (`AnnualPlanSettings`) via the
  existing SettingsRepository — no new backend, no Excel parsing. Empty/connected states,
  http(s) validation, `noopener noreferrer` new-tab open, confirm-on-remove.
- Tests 129 → 139 (+ overview tile/drawer, LineChart gaps, competition scoring, annual
  plan). Typecheck, lint and the guarded production build are green. Browser-reviewed at
  1440/1280/390 (responsive grid covers 1024/768); console clean on fresh loads.
- Unchanged and protected: calculation formulas, import pipeline, DB schema, the five
  seams. No AWS/backend work — the §2.1 spike remains the gate.
