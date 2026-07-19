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
