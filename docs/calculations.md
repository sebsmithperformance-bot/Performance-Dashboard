# Calculations

The dashboard's formulas, in one place. All of them live in
[`src/lib/calculations/`](../src/lib/calculations/) as **pure functions**, are
exhaustively unit-tested (`calculations.test.ts`), and are **CODEOWNERS-protected**
(`/src/lib/calculations/`). Formulas are fixed — they are not authorable from
settings, and they are not changed during cleanup. Settings can only tune the
transparent *display bands and thresholds* around them (ADR-005, ADR-006).

Public API is re-exported from `src/lib/calculations/index.ts`.

## Governing principles

- **Windows are calendar-day arrays** ending at the evaluation date (index 0 =
  oldest, last = "today"). A wrong window *length* is a programming error and
  throws; bad *data* returns `{ computable: false, reason, completeness }`.
- **Missing data is never zeroed.** A window with any `missing` day is
  incomplete and not computable (see the three day-states in
  [data-contract.md](./data-contract.md#missing-data-is-first-class)).
- **NaN / ∞ are impossible outputs** — every function guards its denominator and
  finiteness and degrades to a "not computable" reason instead.

## The load metric

The coach-facing daily load is the **1–10 Workload** value
(`LOAD_KPI = 'workload'`, `src/lib/dashboard/selectors/daily-load.ts`) — **not**
Player Load, which is filtered out of the coach registry. Every load window below
is built from this single metric; they are never mixed with Player Load.

`dailyLoadByDate` assembles the per-athlete daily series: no team field session →
`rest`; participated with a Workload observation → `observed` (loads summed across
that day's field sessions); participated but no device value → `missing`.

## Load windows (`load.ts`)

| Function | Formula | Computable when |
| --- | --- | --- |
| `acute7d(window7)` | Σ load over 7 days | window complete |
| `chronic28dWeeklyEquivalent(window28)` | (Σ load over 28 days) ÷ 4 | window complete |
| `acwr(window28)` | `acute7d(trailing 7) / chronic28dWeeklyEquivalent` | 28-day window complete **and** chronic > 0 (else `zero_chronic`) |
| `monotony7d(window7)` | mean(daily load) / population stdev(daily load) | window complete **and** stdev > 0 (else `zero_variance`) |
| `strain7d(window7)` | `Σ load over 7 days × monotony7d` | inherits monotony's computability |

`ACUTE_WINDOW_DAYS = 7`, `CHRONIC_WINDOW_DAYS = 28`. Confirmed rest days count as
0-load days in both the mean and the stdev for monotony (ADR-005).
`windowCompleteness(window)` returns the `{expectedDays, observedDays, restDays,
missingDays, complete}` breakdown surfaced in the UI.

## Comparisons (`comparison.ts`)

| Function | Formula | Computable when |
| --- | --- | --- |
| `percentChange(current, baseline)` | `(current − baseline) / \|baseline\| × 100` | baseline ≠ 0 (else `zero_baseline`) |
| `speedPercentOfBest(current, priorValid[], minObs = 3)` | `(current / max(priorValid)) × 100` | inputs valid **and** ≥ `minObs` prior valid observations (else `insufficient_baseline`) |

`SPEED_BASELINE_MIN_OBSERVATIONS = 3` is a **coach-visible threshold** (the
default); the formula itself is fixed. Below the minimum the result is
"insufficient baseline", never a flag. Both comparison inputs must already be in
the same canonical unit — unit compatibility is the caller's contract (ADR-006).

## Date helpers (`series.ts`)

`addDays`, `windowEndingAt`, and `assertIsoDate` build and validate the
calendar-day windows the load functions require.

## Display bands (not formulas)

Thresholds that colour/label results — ACWR band edges, the speed-flag percentage,
the percent-change "unchanged" band — live in `ThresholdSettings`
(`src/lib/settings/types.ts`) and are shown transparently in the UI. They tune
*interpretation*, never the stored values or the formulas, and never constitute an
injury prediction (§6.8).

## Related ADRs

- `docs/adr/005-load-calculations-and-missing-data.md`
- `docs/adr/006-unit-storage-and-display.md`
</content>
