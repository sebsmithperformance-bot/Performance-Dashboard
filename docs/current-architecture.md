# Current Architecture

How the existing dashboard is put together. This is a **client-only React app**
running on synthetic data behind a provider seam; the AWS backend named in the
spec is *planned, not built*. This document describes what actually runs today.

> This dashboard is the complete visual and functional **reference
> implementation** for a later R Shiny rebuild (a separate workstream, separate
> branch, separate session). Nothing here depends on that future work.
>
> Finalized for handoff 2026-07-22.

## Stack

- **Build/dev:** Vite (`vite.config.ts`), React 19, TypeScript (strict, project
  references), Tailwind CSS v4.
- **Routing:** `react-router` (`src/app/routes.tsx`).
- **Icons:** `lucide-react`. **Fonts:** Swiss 721 (single family everywhere).
- **Tests:** Vitest. **Lint:** oxlint. **Format:** Prettier.
- **Local database (tests + import prototype):** PGlite — in-process Postgres
  compiled to WASM (`@electric-sql/pglite`). No database server is required.

## Layers

```
main.tsx
  └─ App → AppRoutes (react-router)
       └─ AppShell  (Masthead / Sidebar / Topbar / <Outlet>)
            └─ page components  (src/app/**)
                 ├─ read view-models from selectors  (src/lib/dashboard/selectors/**)
                 │      └─ pure calculations          (src/lib/calculations/**)
                 ├─ read the dataset via the provider (src/lib/dashboard/**)
                 └─ read/write coach settings         (src/lib/settings/**)
```

### 1. Data seam — where data comes from

Every coach-facing component consumes the **`DashboardDataset`** shape and never
knows its origin. The contract lives in
[`src/lib/dashboard/types.ts`](../src/lib/dashboard/types.ts) (`DashboardDataProvider`);
the full field-by-field description is in
[data-contract.md](./data-contract.md).

- **Today:** `LocalDashboardDataProvider`
  (`src/lib/dashboard/local-provider.ts`) fetches the generated synthetic season
  (`canonical.json`) and builds the dataset + indexes via
  `src/lib/dashboard/dataset.ts`. Saved views and availability overrides persist
  to `localStorage`.
- **Future:** an `AwsDashboardDataProvider` returning the same shapes from
  AppSync. Components do not change when the provider changes — that is the
  point of the seam.

`DashboardDataContext` provides the loaded dataset to the tree and filters
Player Load out of the coach-facing KPI registry (§5).

### 2. Selectors — view-models

`src/lib/dashboard/selectors/**` turn the dataset into page-ready view-models
(one file per surface: `availability.ts`, `readiness.ts`, `gps.ts`,
`performance.ts`, `competition.ts`, `load-health.ts`, `overview-kpis.ts`, …).
Selectors are pure functions of `(dataset, settings)` — no React, no I/O — which
is what makes them unit-testable (`selectors.test.ts`, `step5-selectors.test.ts`,
`competition.test.ts`, `workload.test.ts`).

### 3. Calculations — the formulas

`src/lib/calculations/**` holds the load/comparison math (ACWR, monotony, strain,
acute/chronic, percent-change, speed-percent-of-best). Pure, exhaustively tested,
and **CODEOWNERS-protected**. See [calculations.md](./calculations.md). Formulas
are not changed during cleanup and are not authorable from settings.

### 4. Settings — customization

`src/lib/settings/**` is one plain `DashboardSettings` object persisted whole
through a `SettingsRepository` seam (localStorage locally). It carries **display,
layout, thresholds, position groups, custom KPIs, competition config, annual-plan
link, and saved date ranges** — never formulas or canonical units
(`src/lib/settings/types.ts`). The admin pages under `/admin/**` edit slices of
this object.

**Layout & Navigation.** `DashboardLayoutConfig` stores order + visibility
overrides only. `src/app/nav-layout.ts` is the single place that applies them to
the canonical `NAV_AREAS` tree, so new areas/categories/pages added in code
appear automatically (empty config = canonical order, nothing hidden). Both the
sidebar and the Layout & Navigation admin page read through it.

**Saved date ranges (§6).** `SavedRangeControl` + `useSavedRanges(scope)`
(`src/components/controls/SavedRangeControl.tsx`) back onto
`settings.savedRanges` / `settings.defaultRanges`, keyed by a **scope** string so
each product area keeps its own list and default. The *active* range lives in the
parent page (via `value`/`onChange`) so areas stay independent. Wired into Data
Trends, the S&C % Change drawer, and Competition.

### 5. Import pipeline (prototype)

`src/lib/import/**` is a working, transactional CSV import prototype for the three
real sources (TeamBuildr, PlayerData, Perch): parse → normalize → resolve
athletes/sessions → validate → commit, with duplicate-file detection and an audit
trail. It runs against PGlite locally (`local/local-backend.ts`) and is
CODEOWNERS-protected. This is prototype-only plumbing — see
[data-contract.md](./data-contract.md#import-pipeline-prototype).

## Auth (mock)

`src/lib/auth/**` is a mock sign-in for the prototype (`SignInScreen`,
`AuthContext`, idle sign-out). Real Cognito auth is deferred to the AWS
workstream. Production builds hard-fail if mock auth or dev resource identifiers
are detected (`scripts/verify-build-env.ts` → `src/lib/env-guards/policy.ts`).

## What is prototype-only vs deferred

- **Prototype-only (runs locally, real logic):** synthetic data generator
  (`seed/**`), import pipeline, PGlite database + migrations (`db/**`), mock auth.
- **Deferred to the AWS/Shiny workstreams:** real vendor API connections, Cognito
  auth, AppSync/Aurora backend, deployment architecture. None of this is wired in
  the current dashboard.
</content>
