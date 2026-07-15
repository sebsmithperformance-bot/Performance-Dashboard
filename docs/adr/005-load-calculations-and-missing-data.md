# ADR-005: Load Calculations and Missing-Data Semantics

- **Status:** Accepted for formulas and edge behavior (spec §3.1); execution location
  revisited after ADR-001
- **Date:** 2026-07-15

## Context

ACWR, monotony, strain, speed-percent-of-best, and percent-change drive flags and
recommendations. Wrong denominators or silent zeros here mislead coaching decisions.

## Decision — formulas (v1, locked)

Over the athlete's selected load KPI (default: Player Load / PlayerData "Session Load"):

- `acute_7d` = sum over current date + previous 6 calendar days.
- `chronic_28d_weekly_equivalent` = sum over current date + previous 27 days ÷ 4.
- `acwr` = acute ÷ chronic, **only when** chronic > 0 **and** the window is complete
  enough to interpret.
- `monotony_7d` = mean daily load ÷ stdev of daily load over the 7-day window (population
  stdev, N=7 daily values incl. zero-load *confirmed* rest days), **only when** stdev > 0.
- `strain_7d` = 7-day total load × monotony.
- `speed_percent_of_best` = session top speed ÷ athlete's highest valid top speed within
  the configured comparison window. A speed flag needs ≥ 3 prior valid observations;
  otherwise "insufficient baseline", never a flag.
- `percent_change` = (current − baseline) ÷ |baseline| × 100, only when baseline ≠ 0 and
  units match.

## Decision — missing data

Three distinct day states: **observed load** (value), **confirmed no-session/rest**
(counts as 0 in windows), **missing data** (no import covering an expected date). Missing
days make a window *incomplete*: the calculation is omitted and a data-completeness
warning shown. Missing never coerces to zero. No calculation may emit NaN, Infinity, or a
divide-by-zero artifact — unrepresentable results return an explicit
"not-computable + reason" value.

## Decision — where it runs

One pure TypeScript module (`src/lib/calculations/`) is the single tested implementation,
consumed by (a) the app over bounded per-season queries, and (b) the synthetic-data
quality report. These are display-layer derivations — they never write stored data, so
§6.12 server-authoritative-writes is not violated. If the spike lands on SQL-side views
for performance, those views must be validated against this module's fixture tests before
replacing it.

## Consequences

Every consumer gets identical edge behavior. Fixture tests are hand-calculated (§9.1) and
live beside the module; changing a window, denominator, or missing-data rule is an
architecture-sensitive change requiring review (§15).
