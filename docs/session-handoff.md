# Session Handoff — Front-facing product revision (2026-07-20)

Branch `dev`. This was a targeted front-facing revision of the existing dashboard — no
rebuild, no AWS/backend work. The §2.1 backend spike remains the gate for anything
backend-wired (blocked on the AWS account decision).

## What landed (9 bounded commits)

1. `refactor: remove duplicate tabs and clarify sidebar navigation`
2. `refactor: convert overview to clickable team snapshot`
3. `refactor: replace player load with workload scale`
4. `refactor: simplify copy and add information controls`
5. `feat: enlarge athlete profile radar comparison`
6. `feat: continuous daily workload trend lines`
7. `fix: clarify prototype import history`
8. `feat: add standalone competition section`
9. `feat: add annual plan link page`
   (+ this docs commit)

## Key architectural notes

- **Player Load is hidden at one choke point** — `COACH_HIDDEN_KPIS` in
  `src/lib/dashboard/DashboardDataContext.tsx` filters it out of the effective KPI
  registry. Observations stay canonical (imports, DB registry, fixtures keep `player_load`).
  The daily-load metric is `LOAD_KPI = 'workload'` in
  `src/lib/dashboard/selectors/daily-load.ts`.
- **Team Snapshot** = `TeamSnapshotPage` + `SnapshotTile` + `snapshot.ts` (summaries) +
  `tiles/*Detail.tsx` (drawer bodies). Tile catalog in `overview/widgets.ts`.
- **Competition** is fully isolated. Scoring lives in
  `src/lib/dashboard/selectors/competition.ts`; the three pages consume a `result` from
  `competition/CompetitionContext.tsx` (`CompetitionLayout` owns the shared range state and
  wraps the routed pages). Config is `settings.competition` (see
  `settings/types.ts` + `defaultCompetition()` in `settings/defaults.ts`), edited in
  `admin/CompetitionSettingsPage.tsx`.
- **Annual Plan** stores `settings.annualPlan` (`{fileName,fileUrl,lastUpdated}`) via the
  existing SettingsRepository. No Excel parsing — a future workbook reader replaces the
  link card behind `annual-plan/AnnualPlanPage.tsx`.
- **Continuous lines**: `LineChart` `connectGaps` prop bridges gaps with a dashed connector
  (no zero-fill). Applied to daily-Workload lines.
- **Radar benchmark = 50**: enforced in `performance/AthleteProfilePage.tsx` (benchmark
  series is a constant 50 per rankable axis), not in the selector.

## State of the gates

139 tests green; `npm run typecheck`, `npm run lint`, and the guarded
`VITE_APP_ENV=local npm run build` all pass. Working tree clean after the docs commit.
Browser-reviewed at 1440/1280/390.

## Suggested next steps (not started)

- The §2.1 AWS spike (still the gate). Nothing here touches the backend.
- Deferred UI polish in `docs/visual-review.md` Session 7 (radar spoke-label clipping at
  390px; competition relative scoring needs body weights entered).
- Competition could gain saved-range editing UI and dated-profile management (the data
  model already supports both).
