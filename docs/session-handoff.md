# Session Handoff — Cleanup & handoff (finalized 2026-07-22)

Branch `cleanup/dashboard-handoff` (off `main` @ `35b3c6a`), opened as a pull
request targeting `dev`. Workstream 1 only: audit, clean, and document the
existing dashboard so it is stable and easy to hand off. **No** Shiny rebuild,
AWS, vendor APIs, deployment changes, or new features.

**Finalization checks (all pass):** no secrets tracked, no real athlete data
tracked (only `tests/fixtures/`), Player Load still filtered from the coach
registry (`COACH_HIDDEN_KPIS`), routes/nav unchanged vs `main` (33 route entries,
0 removed), GitHub Pages behavior untouched.

## State at start

Tests, typecheck, lint, and build all passed. The codebase was already clean — no
`console.log`/`TODO`/`debugger`/commented-out code, no lint suppressions, and (per
an import-graph scan) exactly one unreferenced source file. The real handoff gap
was documentation, so that is where most of this session went.

## What changed

**Code (minimal, low-risk):**

- Deleted the dead component `src/components/ui/CompletenessBadge.tsx` — not
  imported anywhere (completeness is surfaced via selectors + the Data
  Completeness tile). Corrected its stale mention in `build-status.md`.
- Fixed a flaky DB test: the PGlite (WASM) suites could exceed vitest's 5s default
  on a cold run. Added `testTimeout`/`hookTimeout: 20000` to the `test` block in
  `vite.config.ts` (test config only — `base`, plugins, and the dev-data
  middleware are untouched). Full suite now passes reliably on repeated cold runs.

**Documentation (the main deliverable):**

- New: `docs/current-architecture.md`, `docs/page-map.md`, `docs/data-contract.md`,
  `docs/calculations.md`.
- Updated: `README.md` (two-workstream framing, doc index, reference-implementation
  note), this handoff, and the `build-status.md` component list.

## Deliberately NOT touched (per session scope)

- **Deployment / GitHub Pages / generated dev-data / build artifacts.** The
  untracked `dev-data/` and `public/dev-data/` folders and the `.github` deploy
  workflow were left exactly as-is at the user's explicit instruction.
- **Protected paths** (`src/lib/calculations`, `units`, `import`, `env-guards`) —
  no formula or contract changes.
- **Marginal unused *type* exports** in app selectors — left alone to avoid churn;
  most live under CODEOWNERS-protected paths anyway.

## Known issues intentionally deferred

- The GitHub Pages deploy copies `public/dev-data/` into `dist/`, but that folder
  is untracked and CI does not regenerate it, so the live Pages site ships without
  data. **Flagged, not changed** — out of scope for this session (deployment).
- `dev-data/` (repo root) is a byte-identical, unreferenced duplicate of
  `public/dev-data/`. Left in place (generated dev-data is out of scope).
- Lint emits non-blocking `react-refresh/only-export-components` warnings on the
  context files. Cosmetic; no action taken.

## Gates at handoff

161 tests green (21 files); `tsc -b` clean; `oxlint` clean (warnings only);
`npm run build` passes.

## Suggested next steps

- Decide how the live deploy should get its data (commit `public/dev-data/`, or
  have CI run `npm run seed:generate`) — see the deferred issue above.
- The §2.1 AWS spike remains the gate for any backend-wired work.
- Begin the R Shiny rebuild in its own branch/session, using this dashboard as the
  reference implementation.
</content>
