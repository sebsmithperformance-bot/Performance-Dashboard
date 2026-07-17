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
