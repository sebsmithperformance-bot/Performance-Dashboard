# Session Handoff — Navigation & settings restructure (2026-07-21)

Branch `dev`. Front-facing revision of the existing dashboard — no rebuild, no AWS/backend
work. The §2.1 backend spike remains the gate for anything backend-wired.

## What landed (4 commits, `151081d`→`7d5534c`)

1. `refactor: three product areas, accordion nav, layout settings, metric settings rename`
2. `feat: shared saveable custom date ranges`
3. `test: verify workload uses the 1-10 scale and label remaining load displays`
   (docs commit follows)

## Key architecture

- **Nav model** is `Area → Category → Page` in `src/app/nav.ts` (`NAV_AREAS`). Three areas:
  Performance Dashboard (4 categories), Competition (1 category), Annual Plan (1 page).
  `matchNavPage(pathname)` finds the active page/category/area.
- **`src/app/nav-layout.ts`** is the one place that applies the layout config (order +
  visibility) — `visibleNavTree`, `orderedAreas/Categories/Pages`, `firstVisiblePath`.
  Used by both the sidebar and the Layout & Navigation page.
- **Sidebar** (`src/app/Sidebar.tsx`) is an accordion: `openId` state = active category,
  synced on route change; single-category areas render as one accordion, single-page areas
  as a standalone leaf.
- **Layout config** (`DashboardLayoutConfig`) now has areaOrder/hiddenAreas/categoryOrder/
  hiddenCategories/pageOrder/hiddenPages + widget keys. The **Layout & Navigation** admin
  page (`admin/LayoutNavigationPage.tsx`, route `/admin/layout-navigation`, replaces Data
  Management) does show/hide + reorder at every level + Reset; `safeUpdate` blocks the tree
  from going fully empty.
- **Metric Settings** = renamed KPI Settings (`admin/MetricSettingsPage.tsx`, route
  `/admin/metric-settings`, legacy redirect). KPI keys/data unchanged.
- **Shared saved ranges** (§6): `components/controls/SavedRangeControl.tsx` +
  `useSavedRanges(scope)`, backed by `settings.savedRanges`/`defaultRanges` (keyed by
  scope). Wired into Data Trends, the S&C Change drawer, and Competition. Active range is
  parent-local so scopes stay independent.
- **Workload**: `LOAD_KPI = 'workload'` (`selectors/daily-load.ts`) drives all current-load
  calcs; Player Load is filtered out of the coach registry at `DashboardDataContext`.

## Gates

159 tests green; typecheck, lint, and guarded `VITE_APP_ENV=local npm run build` pass.
Working tree clean after the docs commit. Browser-reviewed at 1280.

## Suggested next steps (not started)

- The §2.1 AWS spike (still the gate).
- Deferred UI polish in `docs/visual-review.md` Session 8 (Competition Date-range initial
  values; inline range-rename editor).
