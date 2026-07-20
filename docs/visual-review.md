# Visual Review Notes — Step 5

Running log per Step-5 §8. Reviewed in the browser at 1280px (desktop), 768px (tablet),
375px (mobile) against the default synthetic seed.

## Session 4 (2026-07-17) — Overview milestone

**Verified good**

- Team Dashboard tiles read as one system: consistent Panel headers, distribution bars,
  token colors, tabular numerals; compact states carry the one key number.
- Load Health states its band definitions verbatim and shows 14 incomplete windows
  honestly (strict ADR-005 rule); observation language only.
- Speed flag surfaced organically (84.0% of baseline, n=58, threshold shown).
- Athletes table: sticky first column/header, "—" for non-participants and device-missing
  (never zero), quality badges with text; mobile card fallback works; drawer opens.
- No console errors at any width; reduced-motion + focus rings inherited from tokens.

**Issues / follow-ups (for the Step-5 responsive pass, milestone 7)**

1. Topbar crowds at exactly 768px — the Import Data button can clip. Consider hiding its
   text label below `lg` (icon + aria-label) or collapsing the athlete badge.
2. Team Dashboard left column leaves a gap under the short Availability tile at ≥768px
   (ragged grid heights). Acceptable, but worth a reorder or `grid-flow-dense` check.
3. Flag cards don't show current-session exposure minutes; a 20-minute cameo can read
   below threshold (Rowan Danforth case). Add "exposure: N min" to the flag card detail
   so coaches see the context. (Selector already has participation available.)
4. S&C % Change: +18.5% median vs prior week is the deload→normal program swing —
   correct, but consider a footnote when the baseline week is a deload (needs a
   week-type concept in the seam; defer).
5. Athletes table on tablet shows ~4 metric columns before scroll; fine, but the Metrics
   picker default could hide the three least-used columns (ypm, sprint distance, HIE) to
   reduce initial density.

## Session 5 (2026-07-18) — coach-feedback revision

Reviewed at 1280 (desktop), 768 (tablet), 390 (mobile) against the default synthetic seed
across the changed pages (sidebar, Overview, Session Compare, Trends, Athlete Profile,
KPI Settings).

**Verified good**

- Sidebar subcategories render under the active primary section (Overview → Team Dashboard
  / Athletes; Monitoring → Availability / Readiness / GPS, etc.); active section + sub-tab
  both obvious. Content-area duplicate tab row removed; GPS keeps its deeper tab row.
- Session-type annotations on every date option ("Sun, Dec 6 · Game", "Wed · Practice +
  Lift"); same-day sessions stay distinct in the Athletes session sub-picker.
- Last Session GPS defaults to Player Load, labeled "average per athlete"; Team Dashboard
  Customize drawer toggles the GPS metric set with reset.
- Load Health reads as four transparent states with team median ACWR + avg 7-day acute
  load stat tiles; band definitions moved into an info popover; 2×2 stat grid on mobile.
- Session Compare: left vertical session selector (type badges, All/Clear) with a smooth
  monotone line chart; multi-metric mode indexes to each metric's first session (=100%)
  with a legend; hover tooltip reads out each series. Selector stacks above the chart on
  tablet/mobile.
- Trends leads with concise Session Guidance, then restructured alerts (headline → number
  → why → Review:), calculation detail behind info popovers. Observation language only.
- Athlete Profile radar overlays Team/Position average (green) on the athlete (red) with a
  legend and shared percentile scale; raw values in the table; insufficient-sample message.
- KPI Settings: Add KPI form (empty-until-mapped note, safe key preview, dedupe, validation)
  and a per-KPI display-threshold editor with overlap/range validation and reset.
- Topbar no longer crowds at 768 (Import Data collapses to an icon). No console errors; no
  invalid DOM nesting after the InfoHint `<ul>`-in-`<p>` fix.

**Follow-ups (deferred, non-blocking)**

1. Athlete Profile radar: long S&C spoke labels ("Trap Bar Deadlift Mean Power") clip at
   the SVG edges at 390px. Desktop/tablet are clean. Consider abbreviating spoke labels or
   shrinking the radar on narrow screens.
2. Per-KPI display thresholds are defined and validated in KPI Settings but not yet wired
   into every KPIValue render as coloured flags — the definition/validation/storage layer
   is complete; render-time application is a small follow-up.

## Session 6 (2026-07-19) — reference visual redesign

Translated the supplied reference performance-dashboard screenshots into Penn branding
(no gold, no football terminology/positions, no Send Report, no injury-risk language).
Reviewed at 1440 / 1024 / 768 / 390.

**Routes actually opened and reviewed:** Overview Team Dashboard, Overview Athletes,
Monitoring Availability, Monitoring Readiness, GPS Session Overview, GPS Session Compare,
GPS Trends & Recommendations, Data Trends Performance, Performance Overview, Leaderboards,
Athlete Profile, KPI Settings, Data Management. (Data Trends → GPS was not opened
separately — it is the same TrendExplorer component as Data Trends → Performance.)

**Verified good**

- Two-level shell: Penn Navy masthead (text-only wordmark — no licensed Penn logo asset
  exists, so none is recreated) with a thin crimson divider, then a compact page-control
  bar (page title + athlete count + session date + Import Data).
- Sidebar is a grouped tree with uppercase section labels and always-visible leaves;
  active rows use a crimson-tinted background + left indicator; GPS expands to its third
  level. Collapsed = icon rail. Mobile off-canvas drawer shows the full tree.
- Uppercase condensed sub-tabs with a crimson underline; muted inactive.
- Dense KPI strips on Overview, Availability, Readiness, Trends, Performance Overview and
  Athlete Profile — small uppercase label, large tabular value, short descriptor, one
  interpretation line, thin semantic top border paired with text.
- Overview: Team Snapshot is the single source for last-session GPS averages (one card per
  coach-selected metric + session caption + per-metric delta); the duplicate Last Session
  GPS panel is gone. The four remaining panels form an even two-column grid whose rows
  stretch to equal heights — no ragged blank space.
- KPI card density is coach-selectable (compact ≈7/row; wide ≈4/row with descriptors that
  wrap instead of truncating), in the Team Dashboard Customize drawer.
- Charts: smooth monotone curves everywhere (Overview/Readiness/Compare/Trends/Data
  Trends), 2.25px lines, restrained gridlines, visible gaps for missing data, accessible
  table fallback.
- Typography is Swiss 721 only (Helvetica/Arial fallback) — hierarchy comes from weight,
  capitalization and tracking, not a second display font.
- Topbar no longer truncates the page title at 768; masthead uses a "Penn FH" short form
  below sm. No console errors at any width; no page-level horizontal overflow.

**Follow-ups (deferred, non-blocking)**

1. Athlete Profile radar spoke labels still clip at 390px (pre-existing).
2. Per-KPI display thresholds remain definition-only (not yet render-time flags).
3. Equal-height rows leave some internal whitespace at the bottom of the shorter panel in
   a row — inherent to matched rows; revisit only if it reads as empty.
4. Session Overview keeps its existing position/ranking layout; the reference's split
   position-breakdown + ranked-bar panels were not rebuilt (its IA was already approved).
